import { createSignal } from 'solid-js'
import type { WaveformType, AudioEngine } from '../audio/engine.ts'

interface Props {
  engine: AudioEngine
}

export function OscillatorControls(props: Props) {
  const [playing, setPlaying] = createSignal(false)
  const [frequency, setFrequency] = createSignal(440)
  const [waveform, setWaveform] = createSignal<WaveformType>('sine')
  const [micEnabled, setMicEnabled] = createSignal(false)
  const [source, setSource] = createSignal<'oscillator' | 'microphone'>(
    'oscillator'
  )
  const [gainActive, setGainActive] = createSignal(false)
  const [gainValue, setGainValue] = createSignal(1)

  const toggle = () => {
    if (playing()) {
      props.engine.stop()
      setPlaying(false)
    } else {
      props.engine.start(waveform(), frequency())
      setPlaying(true)
    }
  }

  const handleFrequency = (e: Event) => {
    const val = parseFloat((e.target as HTMLInputElement).value)
    setFrequency(val)
    props.engine.setFrequency(val)
  }

  const handleWaveform = (type: WaveformType) => {
    setWaveform(type)
    props.engine.setType(type)
  }

  const handleEnableMic = async () => {
    try {
      await props.engine.enableMicrophone()
      setMicEnabled(true)
      setSource('microphone')
    } catch (err) {
      console.error('mic enable failed', err)
    }
  }

  const handleDisableMic = () => {
    props.engine.disableMicrophone()
    setMicEnabled(false)
    if (source() === 'microphone') {
      setSource('oscillator')
    }
  }

  const handleSelectSource = (next: 'oscillator' | 'microphone') => {
    props.engine.setSource(next)
    setSource(next)
  }

  const toggleGainStage = () => {
    if (gainActive()) {
      props.engine.disableGainStage()
      setGainActive(false)
    } else {
      props.engine.enableGainStage()
      setGainActive(true)
    }
  }

  const handleGainChange = (e: Event) => {
    const val = parseFloat((e.target as HTMLInputElement).value)
    setGainValue(val)
    props.engine.setGainStageLevel(val)
  }

  return (
    <div class="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg">
      <div class="flex gap-2">
        <button
          class={`px-3 py-1 rounded ${
            source() === 'oscillator' ? 'bg-blue-600' : 'bg-gray-700'
          }`}
          onClick={() => handleSelectSource('oscillator')}
        >
          Oscillator
        </button>
        <button
          class={`px-3 py-1 rounded ${
            source() === 'microphone' ? 'bg-blue-600' : 'bg-gray-700'
          } ${!micEnabled() ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!micEnabled()}
          onClick={() => handleSelectSource('microphone')}
        >
          Microphone
        </button>
        {!micEnabled() ? (
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
            class={`px-3 py-1 rounded ${waveform() === type ? 'bg-blue-600' : 'bg-gray-700'}`}
            onClick={() => handleWaveform(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div class="flex items-center gap-4">
        <label class="text-sm">Frequency: {frequency()} Hz</label>
        <input
          type="range"
          min="20"
          max="2000"
          value={frequency()}
          onInput={handleFrequency}
          class="flex-1"
        />
      </div>

      <div class="flex flex-col gap-2 p-3 bg-gray-800 rounded">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">Gain Stage</span>
          <button
            class={`px-2 py-1 text-sm rounded ${
              gainActive() ? 'bg-red-600' : 'bg-green-600'
            }`}
            onClick={toggleGainStage}
          >
            {gainActive() ? 'Bypass' : 'Enable'}
          </button>
        </div>
        <label class="text-xs text-gray-300">
          Level: {gainValue().toFixed(2)}x
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={gainValue()}
          onInput={handleGainChange}
          disabled={!gainActive()}
        />
      </div>

      <button
        class={`px-4 py-2 rounded ${playing() ? 'bg-red-600' : 'bg-green-600'}`}
        onClick={toggle}
      >
        {playing() ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}
