import { createSignal } from 'solid-js'
import { AudioEngine } from './audio/engine.ts'
import { Visualizer } from './components/Visualizer.tsx'
import { SignalChain } from './components/SignalChain.tsx'
import { LevelMeter } from './components/LevelMeter.tsx'
import { AudioDebug } from './components/AudioDebug.tsx'

export function App() {
  const [engine, setEngine] = createSignal<AudioEngine | null>(null)
  const [ready, setReady] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const init = async () => {
    setError(null)
    try {
      const e = new AudioEngine()
      await e.init()
      setEngine(e)
      ;(window as any).engine = e
      setReady(true)
    } catch (err) {
      console.error('Audio initialization failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize audio engine')
    }
  }

  return (
    <div class="min-h-screen bg-gray-950 text-white p-3 sm:p-4 md:p-6">
      <header class="mb-4 md:mb-6">
        <h1 class="text-lg sm:text-xl font-bold text-gray-200">Signals</h1>
      </header>

      {!ready() ? (
        <div class="flex flex-col items-center justify-center h-64 gap-4">
          <button
            class="px-8 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-95 rounded-lg text-lg font-medium transition-all touch-manipulation shadow-lg"
            onClick={init}
          >
            Initialize Audio
          </button>
          {error() && (
            <div class="text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded border border-red-800 max-w-md text-center">
              {error()}
            </div>
          )}
        </div>
      ) : (
        <div class="flex flex-col gap-4 md:gap-6">
          {/* Main visualization area */}
          <div class="flex flex-col md:flex-row gap-4 items-stretch min-h-[200px]">
            {/* Visualizer (Combined Waveform/Spectrum) */}
            <div class="flex-1">
              <Visualizer engine={engine()!} />
            </div>

            {/* Master level meter */}
            <div class="bg-gray-900 rounded-lg p-3 md:p-4 flex flex-col md:items-center md:justify-start shrink-0 gap-2 md:gap-0">
              {/* Desktop Header */}
              <span class="hidden md:block text-xs font-semibold text-gray-400 md:mb-3">
                Master
              </span>
              
              {/* Mobile Header */}
              <div class="flex md:hidden justify-between items-center mb-1">
                <span class="text-xs font-semibold text-gray-400">Master Output</span>
              </div>

              {/* Desktop: Vertical Meter */}
              <div class="hidden md:block">
                <LevelMeter engine={engine()!} orientation="vertical" />
              </div>

              {/* Mobile: Horizontal Meter (Compact) */}
              <div class="block md:hidden w-full">
                <LevelMeter 
                  engine={engine()!} 
                  orientation="horizontal" 
                  showScale={false} 
                />
              </div>
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
