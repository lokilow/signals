// AudioWorklet processor for Uiua-powered gain
// This runs in the audio worklet thread (not the main thread)

// Polyfill TextDecoder/TextEncoder for AudioWorklet context
import './TextEncoderPolyfill.js'

import init, { UiuaGainProcessor } from '../../../audio-worklets/uiua-gain/pkg/uiua_gain.js'

let wasmInitialized = false
let wasmInstance = null

class UiuaGainWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()

    this.processor = null
    this.gain = options.processorOptions?.gain ?? 1.0

    // Listen for parameter changes from the main thread
    this.port.onmessage = (e) => {
      if (e.data.type === 'setGain') {
        this.gain = e.data.value
        if (this.processor) {
          this.processor.set_gain(this.gain)
        }
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
        wasmInstance = await init(wasmBytes)
        wasmInitialized = true
      }

      // Create processor instance
      this.processor = UiuaGainProcessor.new()
      this.processor.set_gain(this.gain)

      // Notify main thread that WASM is ready
      this.port.postMessage({ type: 'wasmReady' })
    } catch (err) {
      console.error('Failed to initialize Uiua WASM:', err)
      this.port.postMessage({ type: 'error', message: err.toString() })
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]

    // If WASM isn't ready yet, pass through
    if (!this.processor) {
      for (let channel = 0; channel < input.length; channel++) {
        output[channel].set(input[channel])
      }
      return true
    }

    // Process each channel
    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel]
      const outputChannel = output[channel]

      // Copy input to output (Uiua will process in-place)
      outputChannel.set(inputChannel)

      // Process with Uiua
      try {
        this.processor.process(outputChannel, outputChannel.length)
      } catch (err) {
        console.error('Uiua processing error:', err)
        // On error, pass through unmodified
      }
    }

    return true
  }
}

registerProcessor('uiua-gain-processor', UiuaGainWorkletProcessor)
