// AudioWorklet processor for WASM-based gain
// This runs in the audio worklet thread (not the main thread)

import init, { WasmGainProcessor } from '../../../audio-worklets/wasm-gain/pkg/wasm_gain.js'

let wasmInitialized = false
let wasmInstance = null

class WasmGainWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()

    this.processor = null
    this.gain = options.processorOptions?.gain ?? 1.0

    // Initialize WASM asynchronously
    this.initWasm()

    // Listen for parameter changes from the main thread
    this.port.onmessage = (e) => {
      if (e.data.type === 'setGain') {
        this.gain = e.data.value
        if (this.processor) {
          this.processor.set_gain(this.gain)
        }
      }
    }
  }

  async initWasm() {
    if (!wasmInitialized) {
      // Initialize WASM module once per worklet context
      wasmInstance = await init()
      wasmInitialized = true
    }

    // Create processor instance
    this.processor = new WasmGainProcessor()
    this.processor.set_gain(this.gain)
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

      // Copy input to output (WASM will process in-place)
      outputChannel.set(inputChannel)

      // Process with WASM
      this.processor.process(outputChannel, outputChannel.length)
    }

    return true
  }
}

registerProcessor('wasm-gain-processor', WasmGainWorkletProcessor)
