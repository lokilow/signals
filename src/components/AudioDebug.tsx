import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type {
  AudioEngine,
  AudioGraphDebugInfo,
  StereoLevels,
  EngineState,
} from '../audio/engine.ts'

interface Props {
  engine: AudioEngine
}

export function AudioDebug(props: Props) {
  const [isOpen, setIsOpen] = createSignal(false)
  const [debugInfo, setDebugInfo] = createSignal<AudioGraphDebugInfo | null>(
    null
  )
  const [stereoLevels, setStereoLevels] = createSignal<StereoLevels | null>(
    null
  )
  const [engineState, setEngineState] = createSignal<EngineState | null>(null)

  let animationId: number | null = null

  const updateDebugInfo = () => {
    if (isOpen()) {
      setDebugInfo(props.engine.getDebugInfo())
      setStereoLevels(props.engine.getStereoLevels())
    }
    animationId = requestAnimationFrame(updateDebugInfo)
  }

  onMount(() => {
    const unsubscribe = props.engine.subscribe((state) => setEngineState(state))
    animationId = requestAnimationFrame(updateDebugInfo)
    onCleanup(() => {
      unsubscribe()
      if (animationId) cancelAnimationFrame(animationId)
    })
  })

  const formatDb = (db: number) => {
    if (db === -Infinity) return '-inf'
    return db.toFixed(1)
  }

  return (
    <div class="fixed bottom-4 right-4 z-50">
      <button
        class="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-mono"
        onClick={() => setIsOpen(!isOpen())}
      >
        {isOpen() ? 'Hide Debug' : 'Debug'}
      </button>

      <Show when={isOpen()}>
        <div class="absolute bottom-12 right-0 w-96 max-h-[80vh] overflow-auto bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs font-mono">
          <h3 class="text-sm font-bold mb-3 text-gray-200">
            Audio Graph Debug
          </h3>

          <Show when={stereoLevels()}>
            {(levels) => (
              <Section title="Signal Levels (Stereo)">
                <div class="flex gap-4">
                  <div class="flex-1">
                    <div class="text-gray-400 mb-1">Left</div>
                    <div class="h-2 bg-gray-800 rounded overflow-hidden">
                      <div
                        class="h-full bg-green-500 transition-all duration-75"
                        style={{
                          width: `${Math.min(100, levels().left.peak * 100)}%`,
                        }}
                      />
                    </div>
                    <div class="text-gray-500 mt-1">
                      {formatDb(levels().left.peakDb)} dB
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="text-gray-400 mb-1">Right</div>
                    <div class="h-2 bg-gray-800 rounded overflow-hidden">
                      <div
                        class="h-full bg-blue-500 transition-all duration-75"
                        style={{
                          width: `${Math.min(100, levels().right.peak * 100)}%`,
                        }}
                      />
                    </div>
                    <div class="text-gray-500 mt-1">
                      {formatDb(levels().right.peakDb)} dB
                    </div>
                  </div>
                </div>
              </Section>
            )}
          </Show>

          <Show when={debugInfo()}>
            {(info) => (
              <>
                <Section title="Audio Context">
                  <Row label="State" value={info().contextState} />
                  <Row label="Sample Rate" value={`${info().sampleRate} Hz`} />
                  <Row
                    label="Time"
                    value={`${info().currentTime.toFixed(2)}s`}
                  />
                  <Row
                    label="Master Gain"
                    value={info().masterGainValue.toFixed(2)}
                  />
                </Section>

                <Section title="Source">
                  <Row label="Active" value={info().source.type} />
                  <Row
                    label="Oscillator"
                    value={
                      info().source.oscillatorActive ? 'running' : 'stopped'
                    }
                    valueClass={
                      info().source.oscillatorActive
                        ? 'text-green-400'
                        : 'text-gray-500'
                    }
                  />
                  <Row
                    label="Microphone"
                    value={info().source.micActive ? 'active' : 'inactive'}
                    valueClass={
                      info().source.micActive
                        ? 'text-green-400'
                        : 'text-gray-500'
                    }
                  />
                </Section>

                <Section title="Analyser">
                  <Row label="FFT Size" value={info().analyser.fftSize} />
                  <Row
                    label="Freq Bins"
                    value={info().analyser.frequencyBinCount}
                  />
                </Section>

                <Section title="Stage Instances">
                  {info().stageInstances.length === 0 ? (
                    <div class="text-gray-500">No stages</div>
                  ) : (
                    <div class="space-y-1">
                      {info().stageInstances.map((stage, i) => (
                        <div
                          class={`flex items-center justify-between p-1 rounded ${
                            stage.bypassed
                              ? 'bg-gray-800 opacity-50'
                              : 'bg-gray-800'
                          }`}
                        >
                          <span>
                            {i + 1}. {stage.kind}
                          </span>
                          <div class="flex gap-2 text-[10px]">
                            <span
                              class={
                                stage.hasInstance
                                  ? 'text-green-400'
                                  : 'text-yellow-400'
                              }
                            >
                              {stage.hasInstance ? 'inst' : 'no-inst'}
                            </span>
                            <span
                              class={
                                stage.bypassed
                                  ? 'text-yellow-400'
                                  : 'text-green-400'
                              }
                            >
                              {stage.bypassed ? 'bypass' : 'active'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </>
            )}
          </Show>

          <Section title="Engine State (JSON)">
            <pre class="text-[10px] text-gray-400 overflow-auto max-h-48 bg-gray-800 p-2 rounded">
              {JSON.stringify(engineState(), null, 2)}
            </pre>
          </Section>
        </div>
      </Show>
    </div>
  )
}

function Section(props: { title: string; children: any }) {
  return (
    <div class="mb-4">
      <h4 class="text-gray-400 font-semibold mb-2 border-b border-gray-700 pb-1">
        {props.title}
      </h4>
      {props.children}
    </div>
  )
}

function Row(props: {
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div class="flex justify-between py-0.5">
      <span class="text-gray-500">{props.label}</span>
      <span class={props.valueClass ?? 'text-gray-300'}>{props.value}</span>
    </div>
  )
}
