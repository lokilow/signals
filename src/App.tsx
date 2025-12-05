import { onMount, createSignal } from 'solid-js'
import { AudioEngine } from './audio/engine'
import { Waveform } from './components/Waveform'
import { Spectrum } from './components/Spectrum'
import { OscillatorControls } from './components/OscillatorControls'

export function App() {
  const [engine, setEngine] = createSignal<AudioEngine | null>(null)
  const [ready, setReady] = createSignal(false)

  const init = async () => {
    const e = new AudioEngine()
    await e.init()
    setEngine(e)
    setReady(true)
  }

  return (
    <div class="min-h-screen bg-gray-950 text-white p-8">
      <h1 class="text-2xl font-bold mb-8">DSP Visualizer</h1>
      
      {!ready() ? (
        <button
          class="px-6 py-3 bg-blue-600 rounded-lg text-lg"
          onClick={init}
        >
          Initialize Audio
        </button>
      ) : (
        <div class="flex flex-col gap-8">
          <OscillatorControls engine={engine()!} />
          
          <div class="flex gap-8">
            <Waveform getData={() => engine()!.getTimeDomainData()} />
            <Spectrum 
              getData={() => engine()!.getFrequencyData()} 
              sampleRate={engine()!.sampleRate}
            />
          </div>
        </div>
      )}
    </div>
  )
}
