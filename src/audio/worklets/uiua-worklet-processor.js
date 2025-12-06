// Generic AudioWorklet processor for Uiua worklets
// This runs in the audio worklet thread (not the main thread)

// Polyfill TextDecoder/TextEncoder for AudioWorklet context
// Inline polyfill to avoid module resolution issues in some environments
;(function (global) {
  'use strict'

  if (global.TextEncoder && global.TextDecoder) {
    return // Already defined, no need for polyfill
  }

  // TextEncoder polyfill
  function TextEncoder() {}

  TextEncoder.prototype.encode = function (string) {
    // Convert string to UTF-8 byte array
    const octets = []
    let i = 0
    while (i < string.length) {
      const codePoint = string.codePointAt(i)
      let c = 0
      let bits = 0
      if (codePoint <= 0x007f) {
        c = 0
        bits = 0x00
      } else if (codePoint <= 0x07ff) {
        c = 6
        bits = 0xc0
      } else if (codePoint <= 0xffff) {
        c = 12
        bits = 0xe0
      } else if (codePoint <= 0x1fffff) {
        c = 18
        bits = 0xf0
      }
      octets.push(bits | (codePoint >> c))
      while (c >= 6) {
        c -= 6
        octets.push(0x80 | ((codePoint >> c) & 0x3f))
      }
      i += codePoint >= 0x10000 ? 2 : 1
    }
    return new Uint8Array(octets)
  }

  // TextDecoder polyfill
  function TextDecoder(encoding, options) {
    // wasm-bindgen uses utf-8 encoding
    this.encoding = encoding || 'utf-8'
    this.fatal = (options && options.fatal) || false
    this.ignoreBOM = (options && options.ignoreBOM) || false
  }

  TextDecoder.prototype.decode = function (octets) {
    // Handle edge cases - wasm-bindgen calls decode() with no args during init
    if (octets === undefined || octets === null) {
      return ''
    }

    if (octets.length === 0) {
      return ''
    }

    // Ensure we have a Uint8Array
    if (!(octets instanceof Uint8Array)) {
      octets = new Uint8Array(octets)
    }

    let string = ''
    let i = 0
    while (i < octets.length) {
      let octet = octets[i]
      let bytesNeeded = 0
      let codePoint = 0
      if (octet <= 0x7f) {
        bytesNeeded = 0
        codePoint = octet & 0xff
      } else if (octet <= 0xdf) {
        bytesNeeded = 1
        codePoint = octet & 0x1f
      } else if (octet <= 0xef) {
        bytesNeeded = 2
        codePoint = octet & 0x0f
      } else if (octet <= 0xf4) {
        bytesNeeded = 3
        codePoint = octet & 0x07
      }
      if (octets.length - i - bytesNeeded > 0) {
        let k = 0
        while (k < bytesNeeded) {
          octet = octets[i + k + 1]
          codePoint = (codePoint << 6) | (octet & 0x3f)
          k += 1
        }
      } else {
        codePoint = 0xfffd
        bytesNeeded = octets.length - i
      }
      string += String.fromCodePoint(codePoint)
      i += bytesNeeded + 1
    }
    return string
  }

  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
})(typeof globalThis !== 'undefined' ? globalThis : self)

import init, {
  UiuaGainWorklet,
  UiuaBiquadWorklet,
  UiuaDelayWorklet,
  wasm_memory,
  process_audio,
} from './uiua-worklet/pkg/uiua_worklet.js'

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
    this.params = [0, 0, 0, 0] // Generic params for stateful worklets
    this.paramsUsed = 1 // How many params to pass to process_block
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
        const value =
          typeof e.data.value === 'number' ? e.data.value : this.gain
        this.gain = Math.min(Math.max(value, 0), 2)
      } else if (e.data.type === 'setParam') {
        // Stateful worklet param update
        const { index, value } = e.data
        if (typeof index === 'number' && index >= 0 && index < 4) {
          this.params[index] = value
          if (this.processor?.set_param) {
            this.processor.set_param(index, value)
          }
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
        await init({ module_or_path: wasmBytes })
        wasmInitialized = true
      }
      this.memory = wasm_memory()

      // Create processor instance based on workletType
      switch (this.workletType) {
        case 'gain':
          this.processor = new UiuaGainWorklet()
          this.isStateful = false
          break
        case 'biquad':
          this.processor = new UiuaBiquadWorklet()
          this.isStateful = true
          this.paramsUsed = 1 // cutoff
          break
        case 'delay':
          this.processor = new UiuaDelayWorklet()
          this.isStateful = true
          this.paramsUsed = 2 // wet, feedback
          break
        default:
          throw new Error(`Unknown worklet type: ${this.workletType}`)
      }

      this.supportsSharedBuffers =
        typeof this.processor.buffer_len === 'function'
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

    this.inputView = new Float32Array(
      this.memory.buffer,
      inputPtr,
      bufferLength
    )
    this.outputView = new Float32Array(
      this.memory.buffer,
      outputPtr,
      bufferLength
    )
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
      Array.isArray(gainParam) && gainParam.length > 0
        ? gainParam[0]
        : this.gain

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
          console.error(
            '[Worklet] Uiua fallback processing error:',
            err,
            err.stack
          )
          outputChannel.set(inputChannel)
        }
      }
      if (!this.loggedFallbackNotice) {
        console.warn(
          '[UiuaWorklet] process_block API unavailable; using JS fallback path'
        )
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
        console.warn(
          '[Worklet] Block larger than buffer length',
          frames,
          maxFrames
        )
        outputChannel.set(inputChannel)
        continue
      }

      try {
        inputBuffer.set(inputChannel)

        if (this.isStateful) {
          // Stateful worklet: process_block(frames, params_used)
          this.processor.process_block(frames, this.paramsUsed)
        } else {
          // Stateless worklet (gain): process_block(frames, gain)
          this.processor.process_block(frames, this.gain)
        }

        outputChannel.set(outputBuffer.subarray(0, frames))
        if (!this.loggedSharedInit) {
          console.debug(
            '[UiuaWorklet] Shared buffer processing active (frames:',
            frames,
            ') stateful:',
            this.isStateful
          )
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
