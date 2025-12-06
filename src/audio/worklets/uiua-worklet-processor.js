// Generic AudioWorklet processor for Uiua worklets
// This runs in the audio worklet thread (not the main thread)

// Polyfill TextDecoder/TextEncoder for AudioWorklet context
import './TextEncoderPolyfill.js'

import init, { UiuaGainWorklet, wasm_memory, process_audio } from '../../../audio-worklets/uiua-worklet/pkg/uiua_worklet.js'

let wasmInitialized = false

class UiuaWorkletProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'gain',
        defaultValue: 1,
        minValue: 0,
        maxValue: 2,
        automationRate: 'k-rate',
      },
    ]
  }

  constructor(options) {
    super()

    this.processor = null
    this.workletType = options.processorOptions?.workletType || 'gain'
    this.gain = options.processorOptions?.gain ?? 1.0
    this.memory = null
    this.inputView = null
    this.outputView = null
    this.bufferLength = 0
    this.supportsSharedBuffers = false
    this.loggedFallbackNotice = false
    this.loggedSharedInit = false

    // Listen for parameter changes from the main thread
    this.port.onmessage = (e) => {
      if (e.data.type === 'setGain') {
        const value = typeof e.data.value === 'number' ? e.data.value : this.gain
        this.gain = Math.min(Math.max(value, 0), 2)
      } else if (e.data.type === 'initWasm') {
        // Main thread sends WASM bytes
        this.initWasm(e.data.wasmBytes)
      }
    }
  }

  async initWasm(wasmBytes) {
    try {
      if (!wasmInitialized) {
        // Initialize WASM module once per worklet context
        await init({ module_or_path: wasmBytes })
        wasmInitialized = true
      }
      this.memory = wasm_memory()

      // Create processor instance based on workletType
      switch (this.workletType) {
        case 'gain':
          this.processor = new UiuaGainWorklet()
          break
        // Future worklets can be added here:
        // case 'reverb':
        //   this.processor = new UiuaReverbWorklet(this.bufferSize)
        //   break
        default:
          throw new Error(`Unknown worklet type: ${this.workletType}`)
      }

      this.supportsSharedBuffers = typeof this.processor.buffer_len === 'function'
      if (this.supportsSharedBuffers) {
        this.setupBufferViews()
      }

      // Notify main thread that WASM is ready
      this.port.postMessage({ type: 'wasmReady' })
    } catch (err) {
      console.error('Failed to initialize Uiua WASM:', err)
      this.port.postMessage({ type: 'error', message: err.toString() })
    }
  }

  setupBufferViews() {
    if (!this.processor) {
      return
    }

    this.memory = this.memory || wasm_memory()
    const bufferLength = this.processor.buffer_len()
    this.bufferLength = bufferLength
    const inputPtr = this.processor.input_ptr()
    const outputPtr = this.processor.output_ptr()

    this.inputView = new Float32Array(this.memory.buffer, inputPtr, bufferLength)
    this.outputView = new Float32Array(this.memory.buffer, outputPtr, bufferLength)
  }

  ensureBufferViews() {
    if (!this.processor) {
      return false
    }
    if (
      !this.memory ||
      !this.inputView ||
      !this.outputView ||
      this.inputView.buffer !== this.memory.buffer ||
      this.outputView.buffer !== this.memory.buffer
    ) {
      this.setupBufferViews()
    }
    return Boolean(this.inputView && this.outputView)
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    const gainParam = parameters?.gain
    const nextGain =
      Array.isArray(gainParam) && gainParam.length > 0 ? gainParam[0] : this.gain

    if (typeof nextGain === 'number') {
      this.gain = Math.min(Math.max(nextGain, 0), 2)
    }

    // If WASM isn't ready yet, pass through
    if (!this.processor) {
      if (input && input.length > 0) {
        for (let channel = 0; channel < input.length; channel++) {
          output[channel].set(input[channel])
        }
      }
      return true
    }

    if (!input || input.length === 0 || !output || output.length === 0) {
      return true
    }

    if (!this.supportsSharedBuffers) {
      for (let channel = 0; channel < input.length; channel++) {
        const inputChannel = input[channel]
        const outputChannel = output[channel]

        try {
          const result = process_audio(Array.from(inputChannel), this.gain)
          outputChannel.set(result)
        } catch (err) {
          console.error('[Worklet] Uiua fallback processing error:', err, err.stack)
          outputChannel.set(inputChannel)
        }
      }
      if (!this.loggedFallbackNotice) {
        console.warn('[UiuaWorklet] process_block API unavailable; using JS fallback path')
        this.loggedFallbackNotice = true
      }
      return true
    }

    if (!this.ensureBufferViews()) {
      for (let channel = 0; channel < input.length; channel++) {
        output[channel].set(input[channel])
      }
      return true
    }

    const inputBuffer = this.inputView
    const outputBuffer = this.outputView
    const maxFrames = this.bufferLength

    // Process each channel
    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel]
      const outputChannel = output[channel]
      const frames = inputChannel.length

      if (frames > maxFrames) {
        console.warn('[Worklet] Block larger than buffer length', frames, maxFrames)
        outputChannel.set(inputChannel)
        continue
      }

      try {
        inputBuffer.set(inputChannel)
        this.processor.process_block(frames, this.gain)
        outputChannel.set(outputBuffer.subarray(0, frames))
        if (!this.loggedSharedInit) {
          console.log('[UiuaWorklet] Shared buffer processing active (frames:', frames, ')')
          this.loggedSharedInit = true
        }

      } catch (err) {
        console.error('[Worklet] Uiua processing error:', err, err.stack)
        // On error, pass through unmodified
        outputChannel.set(inputChannel)
      }
    }

    return true
  }
}

registerProcessor('uiua-worklet-processor', UiuaWorkletProcessor)
