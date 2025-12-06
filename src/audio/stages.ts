/**
 * Stage Registry - Single source of truth for stage definitions
 *
 * Each stage kind is defined here with:
 * - Type-safe parameter definitions with UI metadata
 * - Factory function to create WebAudio node instances
 * - Default parameter values
 */

// Parameter definition for UI rendering and validation
export type StageParamDef = {
  min: number
  max: number
  step: number
  default: number
  label: string
  format: (v: number) => string
}

// Maps stage kinds to their parameter shapes
export type StageParamsMap = {
  gain: { gain: number }
  pan: { pan: number }
  delay: { time: number; wet: number; feedback: number }
  'wasm-gain': { gain: number }
  'uiua-gain': { gain: number }
}

export type StageKind = keyof StageParamsMap

// Runtime instance returned by factory
export type StageInstance = {
  input: AudioNode
  output: AudioNode
  update: (params: Record<string, number>) => void
  dispose: () => void
}

// Definition structure for each stage kind
export type StageDefinition<K extends StageKind> = {
  kind: K
  label: string
  params: { [P in keyof StageParamsMap[K]]: StageParamDef }
  createInstance: (
    ctx: AudioContext,
    params: StageParamsMap[K]
  ) => StageInstance
}

// Type-safe registry type
type StageRegistry = { [K in StageKind]: StageDefinition<K> }

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

export const STAGE_REGISTRY: StageRegistry = {
  gain: {
    kind: 'gain',
    label: 'Gain',
    params: {
      gain: {
        min: 0,
        max: 2,
        step: 0.01,
        default: 1,
        label: 'Level',
        format: (v) => `${v.toFixed(2)}x`,
      },
    },
    createInstance: (ctx, params) => {
      const gain = ctx.createGain()
      gain.gain.value = params.gain
      return {
        input: gain,
        output: gain,
        update: (p) => {
          if (typeof p.gain === 'number') {
            gain.gain.value = clamp(p.gain, 0, 2)
          }
        },
        dispose: () => gain.disconnect(),
      }
    },
  },

  pan: {
    kind: 'pan',
    label: 'Stereo Pan',
    params: {
      pan: {
        min: -1,
        max: 1,
        step: 0.01,
        default: 0,
        label: 'Position',
        format: (v) => v.toFixed(2),
      },
    },
    createInstance: (ctx, params) => {
      const pan = ctx.createStereoPanner()
      pan.pan.value = params.pan
      return {
        input: pan,
        output: pan,
        update: (p) => {
          if (typeof p.pan === 'number') {
            pan.pan.value = clamp(p.pan, -1, 1)
          }
        },
        dispose: () => pan.disconnect(),
      }
    },
  },

  delay: {
    kind: 'delay',
    label: 'Delay',
    params: {
      time: {
        min: 0,
        max: 2,
        step: 0.01,
        default: 0.4,
        label: 'Time',
        format: (v) => `${v.toFixed(2)}s`,
      },
      wet: {
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.5,
        label: 'Wet Mix',
        format: (v) => `${(v * 100).toFixed(0)}%`,
      },
      feedback: {
        min: 0,
        max: 0.95,
        step: 0.01,
        default: 0.4,
        label: 'Feedback',
        format: (v) => `${(v * 100).toFixed(0)}%`,
      },
    },
    createInstance: (ctx, params) => {
      const input = ctx.createGain()
      const output = ctx.createGain()
      const delay = ctx.createDelay(2)
      const wetGain = ctx.createGain()
      const dryGain = ctx.createGain()
      const feedbackGain = ctx.createGain()

      delay.delayTime.value = params.time
      wetGain.gain.value = params.wet
      dryGain.gain.value = 1 - params.wet
      feedbackGain.gain.value = params.feedback

      // Dry path
      input.connect(dryGain)
      dryGain.connect(output)

      // Wet path
      input.connect(delay)
      delay.connect(wetGain)
      wetGain.connect(output)

      // Feedback loop
      delay.connect(feedbackGain)
      feedbackGain.connect(delay)

      return {
        input,
        output,
        update: (p) => {
          if (typeof p.time === 'number') {
            delay.delayTime.value = clamp(p.time, 0, 2)
          }
          if (typeof p.wet === 'number') {
            const wet = clamp(p.wet, 0, 1)
            wetGain.gain.value = wet
            dryGain.gain.value = 1 - wet
          }
          if (typeof p.feedback === 'number') {
            feedbackGain.gain.value = clamp(p.feedback, 0, 0.95)
          }
        },
        dispose: () => {
          input.disconnect()
          output.disconnect()
          delay.disconnect()
          wetGain.disconnect()
          dryGain.disconnect()
          feedbackGain.disconnect()
        },
      }
    },
  },

  'wasm-gain': {
    kind: 'wasm-gain',
    label: 'WASM Gain',
    params: {
      gain: {
        min: 0,
        max: 2,
        step: 0.01,
        default: 1,
        label: 'Level',
        format: (v) => `${v.toFixed(2)}x`,
      },
    },
    createInstance: (ctx, params) => {
      const workletNode = new AudioWorkletNode(ctx, 'wasm-gain-processor', {
        processorOptions: { gain: params.gain },
      })

      // Load and send WASM bytes to the worklet
      fetch(
        new URL(
          '../../audio-worklets/wasm-gain/pkg/wasm_gain_bg.wasm',
          import.meta.url
        )
      )
        .then((response) => response.arrayBuffer())
        .then((wasmBytes) => {
          workletNode.port.postMessage({ type: 'initWasm', wasmBytes })
        })
        .catch((err) => {
          console.error('Failed to load WASM module:', err)
        })

      return {
        input: workletNode,
        output: workletNode,
        update: (p) => {
          if (typeof p.gain === 'number') {
            const gainValue = clamp(p.gain, 0, 2)
            workletNode.port.postMessage({ type: 'setGain', value: gainValue })
          }
        },
        dispose: () => workletNode.disconnect(),
      }
    },
  },

  'uiua-gain': {
    kind: 'uiua-gain',
    label: 'Uiua Gain',
    params: {
      gain: {
        min: 0,
        max: 2,
        step: 0.01,
        default: 1,
        label: 'Level',
        format: (v) => `${v.toFixed(2)}x`,
      },
    },
    createInstance: (ctx, params) => {
      const workletNode = new AudioWorkletNode(ctx, 'uiua-gain-processor', {
        processorOptions: { gain: params.gain },
      })

      // Load and send WASM bytes to the worklet
      fetch(
        new URL(
          '../../audio-worklets/uiua-gain/pkg/uiua_gain_bg.wasm',
          import.meta.url
        )
      )
        .then((response) => response.arrayBuffer())
        .then((wasmBytes) => {
          workletNode.port.postMessage({ type: 'initWasm', wasmBytes })
        })
        .catch((err) => {
          console.error('Failed to load Uiua WASM module:', err)
        })

      return {
        input: workletNode,
        output: workletNode,
        update: (p) => {
          if (typeof p.gain === 'number') {
            const gainValue = clamp(p.gain, 0, 2)
            workletNode.port.postMessage({ type: 'setGain', value: gainValue })
          }
        },
        dispose: () => workletNode.disconnect(),
      }
    },
  },
}

// Helper to get default params for a stage kind
export function getDefaultParams<K extends StageKind>(
  kind: K
): StageParamsMap[K] {
  const def = STAGE_REGISTRY[kind]
  const params: Record<string, number> = {}
  for (const [key, paramDef] of Object.entries(def.params)) {
    params[key] = (paramDef as StageParamDef).default
  }
  return params as StageParamsMap[K]
}
