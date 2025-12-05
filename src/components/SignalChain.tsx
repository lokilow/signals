import { For } from 'solid-js'
import { createStore } from 'solid-js/store'
import { onCleanup, onMount } from 'solid-js'
import type {
  AudioEngine,
  EngineState,
  StageKind,
  WaveformType,
} from '../audio/engine.ts'
import { STAGE_REGISTRY } from '../audio/stages.ts'
import { StageCard } from './StageCard.tsx'
import { LevelMeter } from './LevelMeter.tsx'

interface Props {
  engine: AudioEngine
}

const STAGE_KINDS = Object.keys(STAGE_REGISTRY) as StageKind[]

export function SignalChain(props: Props) {
  const [state, setState] = createStore<EngineState>(props.engine.getState())

  onMount(() => {
    const unsubscribe = props.engine.subscribe((next: EngineState) =>
      setState(() => next)
    )
    onCleanup(unsubscribe)
  })

  const handleEnableMic = async () => {
    try {
      await props.engine.enableMicrophone()
    } catch (err) {
      console.error('mic enable failed', err)
    }
  }

  return (
    <div class="bg-gray-900 rounded-lg p-4">
      {/* Add stage buttons */}
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Signal Chain
        </span>
        <div class="flex gap-1">
          <For each={STAGE_KINDS}>
            {(kind) => (
              <button
                class="px-2 py-1 text-[10px] rounded bg-blue-700 hover:bg-blue-600"
                onClick={() => props.engine.addStage(kind)}
              >
                + {STAGE_REGISTRY[kind].label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Horizontal chain */}
      <div class="flex items-stretch gap-2 overflow-x-auto pb-2">
        {/* Source selector */}
        <div class="flex flex-col w-32 bg-gray-800 rounded-lg overflow-hidden shrink-0">
          <div class="px-2 py-1.5 bg-gray-700">
            <span class="text-xs font-semibold">Source</span>
          </div>
          <div class="flex-1 p-2 space-y-2">
            <button
              class={`w-full px-2 py-1 text-xs rounded ${
                state.source === 'oscillator' ? 'bg-blue-600' : 'bg-gray-600'
              }`}
              onClick={() => props.engine.setSource('oscillator')}
            >
              Oscillator
            </button>
            <button
              class={`w-full px-2 py-1 text-xs rounded ${
                state.source === 'microphone' ? 'bg-blue-600' : 'bg-gray-600'
              } ${!state.mic.enabled ? 'opacity-50' : ''}`}
              disabled={!state.mic.enabled}
              onClick={() => props.engine.setSource('microphone')}
            >
              Microphone
            </button>
            {!state.mic.enabled ? (
              <button
                class="w-full px-2 py-1 text-[10px] rounded bg-green-700 hover:bg-green-600"
                onClick={handleEnableMic}
              >
                Enable Mic
              </button>
            ) : (
              <button
                class="w-full px-2 py-1 text-[10px] rounded bg-red-700 hover:bg-red-600"
                onClick={() => props.engine.disableMicrophone()}
              >
                Disable Mic
              </button>
            )}

            {/* Oscillator controls when oscillator is source */}
            {state.source === 'oscillator' && (
              <div class="pt-2 border-t border-gray-700 space-y-2">
                <div class="flex flex-wrap gap-1">
                  {(['sine', 'square', 'saw', 'tri'] as const).map(
                    (type, i) => {
                      const fullType = (
                        ['sine', 'square', 'sawtooth', 'triangle'] as const
                      )[i]
                      return (
                        <button
                          class={`px-1.5 py-0.5 text-[10px] rounded ${
                            state.oscillator.type === fullType
                              ? 'bg-blue-600'
                              : 'bg-gray-600'
                          }`}
                          onClick={() => props.engine.setType(fullType!)}
                        >
                          {type}
                        </button>
                      )
                    }
                  )}
                </div>
                <div class="space-y-0.5">
                  <div class="flex justify-between text-[10px]">
                    <span class="text-gray-400">Freq</span>
                    <span class="text-gray-300 font-mono">
                      {state.oscillator.frequency}Hz
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="2000"
                    value={state.oscillator.frequency}
                    onInput={(e) =>
                      props.engine.setFrequency(
                        parseFloat(e.currentTarget.value)
                      )
                    }
                    class="w-full h-1 appearance-none bg-gray-600 rounded cursor-pointer"
                  />
                </div>
                <button
                  class={`w-full px-2 py-1 text-xs rounded ${
                    state.oscillator.running ? 'bg-red-600' : 'bg-green-600'
                  }`}
                  onClick={() =>
                    state.oscillator.running
                      ? props.engine.stopOscillator()
                      : props.engine.startOscillator()
                  }
                >
                  {state.oscillator.running ? 'Stop' : 'Start'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div class="flex items-center text-gray-600 shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
          </svg>
        </div>

        {/* Stages */}
        <For each={state.stages}>
          {(stage, index) => (
            <>
              <StageCard
                stage={stage}
                index={index()}
                total={state.stages.length}
                onBypassToggle={() =>
                  props.engine.setStageBypass(stage.id, !stage.bypassed)
                }
                onParamChange={(key: string, val: number) =>
                  props.engine.setStageParams(stage.id, { [key]: val })
                }
                onMoveLeft={() => props.engine.moveStage(stage.id, 'up')}
                onMoveRight={() => props.engine.moveStage(stage.id, 'down')}
                onRemove={() => props.engine.removeStage(stage.id)}
              />
              {/* Arrow between stages */}
              <div class="flex items-center text-gray-600 shrink-0">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                </svg>
              </div>
            </>
          )}
        </For>

        {/* Empty state */}
        {state.stages.length === 0 && (
          <>
            <div class="flex items-center justify-center w-36 border-2 border-dashed border-gray-700 rounded-lg text-gray-600 text-xs shrink-0">
              Add stages
            </div>
            <div class="flex items-center text-gray-600 shrink-0">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
              </svg>
            </div>
          </>
        )}

        {/* Output / Master */}
        <div class="flex flex-col w-24 bg-gray-800 rounded-lg overflow-hidden shrink-0">
          <div class="px-2 py-1.5 bg-gray-700">
            <span class="text-xs font-semibold">Master</span>
          </div>
          <div class="flex-1 p-2 flex items-center justify-center">
            <LevelMeter engine={props.engine} orientation="vertical" />
          </div>
        </div>
      </div>
    </div>
  )
}
