import { For } from 'solid-js'
import { createStore } from 'solid-js/store'
import { onCleanup, onMount } from 'solid-js'
import type {
  WaveformType,
  AudioEngine,
  EngineState,
  StageKind,
} from '../audio/engine.ts'
import { STAGE_REGISTRY } from '../audio/stages.ts'
import { StageControl } from './StageControl.tsx'

interface Props {
  engine: AudioEngine
}

const STAGE_KINDS = Object.keys(STAGE_REGISTRY) as StageKind[]

export function OscillatorControls(props: Props) {
  const [state, setState] = createStore<EngineState>(props.engine.getState())

  onMount(() => {
    const unsubscribe = props.engine.subscribe((next: EngineState) =>
      setState(() => next)
    )
    onCleanup(unsubscribe)
  })

  const toggle = () => {
    if (state.oscillator.running) {
      props.engine.stopOscillator()
    } else {
      props.engine.startOscillator()
    }
  }

  const handleFrequency = (e: Event) => {
    const val = parseFloat((e.target as HTMLInputElement).value)
    props.engine.setFrequency(val)
  }

  const handleWaveform = (type: WaveformType) => {
    props.engine.setType(type)
  }

  const handleEnableMic = async () => {
    try {
      await props.engine.enableMicrophone()
    } catch (err) {
      console.error('mic enable failed', err)
    }
  }

  const handleDisableMic = () => {
    props.engine.disableMicrophone()
  }

  const handleSelectSource = (next: 'oscillator' | 'microphone') => {
    props.engine.setSource(next)
  }

  const handleAddStage = (kind: StageKind) => {
    props.engine.addStage(kind)
  }

  return (
    <div class="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg">
      <div class="flex gap-2">
        <button
          class={`px-3 py-1 rounded ${
            state.source === 'oscillator' ? 'bg-blue-600' : 'bg-gray-700'
          }`}
          onClick={() => handleSelectSource('oscillator')}
        >
          Oscillator
        </button>
        <button
          class={`px-3 py-1 rounded ${
            state.source === 'microphone' ? 'bg-blue-600' : 'bg-gray-700'
          } ${!state.mic.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!state.mic.enabled}
          onClick={() => handleSelectSource('microphone')}
        >
          Microphone
        </button>
        {!state.mic.enabled ? (
          <button
            class="px-3 py-1 rounded bg-green-700"
            onClick={handleEnableMic}
          >
            Enable Mic
          </button>
        ) : (
          <button
            class="px-3 py-1 rounded bg-red-700"
            onClick={handleDisableMic}
          >
            Disable Mic
          </button>
        )}
      </div>

      <div class="flex gap-2">
        {(['sine', 'square', 'sawtooth', 'triangle'] as const).map((type) => (
          <button
            class={`px-3 py-1 rounded ${
              state.oscillator.type === type ? 'bg-blue-600' : 'bg-gray-700'
            }`}
            onClick={() => handleWaveform(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div class="flex items-center gap-4">
        <label class="text-sm">
          Frequency: {state.oscillator.frequency} Hz
        </label>
        <input
          type="range"
          min="20"
          max="2000"
          value={state.oscillator.frequency}
          onInput={handleFrequency}
          class="flex-1"
        />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-gray-300">Signal Chain</span>
          <div class="flex gap-1">
            <For each={STAGE_KINDS}>
              {(kind) => (
                <button
                  class="px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600"
                  onClick={() => handleAddStage(kind)}
                >
                  + {STAGE_REGISTRY[kind].label}
                </button>
              )}
            </For>
          </div>
        </div>

        <For each={state.stages}>
          {(stage, index) => (
            <StageControl
              stage={stage}
              index={index()}
              total={state.stages.length}
              onBypassToggle={() =>
                props.engine.setStageBypass(stage.id, !stage.bypassed)
              }
              onParamChange={(key: string, val: number) =>
                props.engine.setStageParams(stage.id, { [key]: val })
              }
              onMoveUp={() => props.engine.moveStage(stage.id, 'up')}
              onMoveDown={() => props.engine.moveStage(stage.id, 'down')}
              onRemove={() => props.engine.removeStage(stage.id)}
            />
          )}
        </For>

        {state.stages.length === 0 && (
          <div class="text-sm text-gray-500 text-center py-4">
            No stages in chain. Add one above.
          </div>
        )}
      </div>

      <button
        class={`px-4 py-2 rounded ${
          state.oscillator.running ? 'bg-red-600' : 'bg-green-600'
        }`}
        onClick={toggle}
      >
        {state.oscillator.running ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}
