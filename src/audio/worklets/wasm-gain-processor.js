// AudioWorklet processor for WASM-based gain
// This runs in the audio worklet thread (not the main thread)

// Polyfill TextDecoder/TextEncoder for AudioWorklet context (wasm-bindgen requires these)
// AudioWorklet contexts don't have these defined in the spec yet
// Inline polyfill to avoid module resolution issues in some environments
;(function (global) {
  'use strict';

  if (global.TextEncoder && global.TextDecoder) {
    return; // Already defined, no need for polyfill
  }

  // TextEncoder polyfill
  function TextEncoder() {}

  TextEncoder.prototype.encode = function (string) {
    // Convert string to UTF-8 byte array
    const octets = [];
    let i = 0;
    while (i < string.length) {
      const codePoint = string.codePointAt(i);
      let c = 0;
      let bits = 0;
      if (codePoint <= 0x007F) {
        c = 0;
        bits = 0x00;
      } else if (codePoint <= 0x07FF) {
        c = 6;
        bits = 0xC0;
      } else if (codePoint <= 0xFFFF) {
        c = 12;
        bits = 0xE0;
      } else if (codePoint <= 0x1FFFFF) {
        c = 18;
        bits = 0xF0;
      }
      octets.push(bits | (codePoint >> c));
      while (c >= 6) {
        c -= 6;
        octets.push(0x80 | ((codePoint >> c) & 0x3F));
      }
      i += codePoint >= 0x10000 ? 2 : 1;
    }
    return new Uint8Array(octets);
  };

  // TextDecoder polyfill
  function TextDecoder(encoding, options) {
    // wasm-bindgen uses utf-8 encoding
    this.encoding = encoding || 'utf-8';
    this.fatal = (options && options.fatal) || false;
    this.ignoreBOM = (options && options.ignoreBOM) || false;
  }

  TextDecoder.prototype.decode = function (octets) {
    // Handle edge cases - wasm-bindgen calls decode() with no args during init
    if (octets === undefined || octets === null) {
      return '';
    }

    if (octets.length === 0) {
      return '';
    }

    // Ensure we have a Uint8Array
    if (!(octets instanceof Uint8Array)) {
      octets = new Uint8Array(octets);
    }

    let string = '';
    let i = 0;
    while (i < octets.length) {
      let octet = octets[i];
      let bytesNeeded = 0;
      let codePoint = 0;
      if (octet <= 0x7F) {
        bytesNeeded = 0;
        codePoint = octet & 0xFF;
      } else if (octet <= 0xDF) {
        bytesNeeded = 1;
        codePoint = octet & 0x1F;
      } else if (octet <= 0xEF) {
        bytesNeeded = 2;
        codePoint = octet & 0x0F;
      } else if (octet <= 0xF4) {
        bytesNeeded = 3;
        codePoint = octet & 0x07;
      }
      if (octets.length - i - bytesNeeded > 0) {
        let k = 0;
        while (k < bytesNeeded) {
          octet = octets[i + k + 1];
          codePoint = (codePoint << 6) | (octet & 0x3F);
          k += 1;
        }
      } else {
        codePoint = 0xFFFD;
        bytesNeeded = octets.length - i;
      }
      string += String.fromCodePoint(codePoint);
      i += bytesNeeded + 1;
    }
    return string;
  };

  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
})(typeof globalThis !== 'undefined' ? globalThis : self);

import init, { WasmGainProcessor } from '../../../audio-worklets/wasm-gain/pkg/wasm_gain.js'

let wasmInitialized = false
let wasmInstance = null

class WasmGainWorkletProcessor extends AudioWorkletProcessor {
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
    if (!wasmInitialized) {
      // Initialize WASM module once per worklet context
      // Pass the WASM bytes directly instead of relying on URL
      wasmInstance = await init(wasmBytes)
      wasmInitialized = true
    }

    // Create processor instance
    this.processor = new WasmGainProcessor()
    this.processor.set_gain(this.gain)

    // Notify main thread that WASM is ready
    this.port.postMessage({ type: 'wasmReady' })
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
