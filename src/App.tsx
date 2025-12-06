import { createSignal } from 'solid-js'
import { AudioEngine } from './audio/engine.ts'
import { Waveform } from './components/Waveform.tsx'
import { Spectrum } from './components/Spectrum.tsx'
import { SignalChain } from './components/SignalChain.tsx'
import { LevelMeter } from './components/LevelMeter.tsx'
import { AudioDebug } from './components/AudioDebug.tsx'

export function App() {
  const [engine, setEngine] = createSignal<AudioEngine | null>(null)
  const [ready, setReady] = createSignal(false)

  const init = async () => {
    const e = new AudioEngine()
    await e.init()
    setEngine(e)
    ;(window as any).engine = e
    setReady(true)
  }

  return (
    <div class="min-h-screen bg-gray-950 text-white p-3 sm:p-4 md:p-6">
      <header class="mb-4 md:mb-6">
        <h1 class="text-lg sm:text-xl font-bold text-gray-200">Signals</h1>
      </header>

      {!ready() ? (
        <div class="flex items-center justify-center h-64">
          <button
            class="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-medium transition-colors"
            onClick={init}
          >
            Initialize Audio
          </button>
        </div>
      ) : (
        <div class="flex flex-col gap-4 md:gap-6">
          {/* Main visualization area */}
          <div class="flex flex-col md:flex-row gap-4 items-stretch">
            {/* Waveform */}
            <div class="flex-1 bg-gray-900 rounded-lg p-3 md:p-4">
              <Waveform getData={() => engine()!.getTimeDomainData()} />
            </div>

            {/* Spectrum */}
            <div class="flex-1 bg-gray-900 rounded-lg p-3 md:p-4">
              <Spectrum
                getData={() => engine()!.getFrequencyData()}
                sampleRate={engine()!.sampleRate}
              />
            </div>

            {/* Master level meter */}
            <div class="bg-gray-900 rounded-lg p-3 md:p-4 flex md:flex-col items-center justify-center md:justify-start gap-4 md:gap-0">
              <span class="text-xs font-semibold text-gray-400 md:mb-3">
                Master
              </span>
              <LevelMeter engine={engine()!} orientation="vertical" />
            </div>
          </div>

          {/* Signal chain */}
          <SignalChain engine={engine()!} />

          {/* Debug panel */}
          <AudioDebug engine={engine()!} />
        </div>
      )}
    </div>
  )
}
