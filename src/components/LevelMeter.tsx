import { createSignal, onCleanup, onMount } from 'solid-js'
import type { AudioEngine, SignalLevels } from '../audio/engine.ts'

interface Props {
  engine: AudioEngine
  orientation?: 'horizontal' | 'vertical'
  showLabels?: boolean
}

export function LevelMeter(props: Props) {
  const [levels, setLevels] = createSignal<SignalLevels>({
    peak: 0,
    rms: 0,
    peakDb: -Infinity,
    rmsDb: -Infinity,
  })

  let rafId: number

  onMount(() => {
    const update = () => {
      setLevels(props.engine.getSignalLevels())
      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
  })

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId)
  })

  const formatDb = (db: number) => {
    if (db === -Infinity) return '-inf'
    if (db < -60) return '-60'
    return db.toFixed(0)
  }

  // Convert dB to percentage for meter display (-60dB to 0dB range)
  const dbToPercent = (db: number) => {
    if (db === -Infinity) return 0
    const clamped = Math.max(-60, Math.min(0, db))
    return ((clamped + 60) / 60) * 100
  }

  const isVertical = () => props.orientation === 'vertical'
  const showLabels = () => props.showLabels ?? true

  return (
    <div
      class={`flex ${isVertical() ? 'flex-col items-center' : 'flex-row items-end'} gap-1`}
    >
      {showLabels() && (
        <div
          class={`text-[10px] text-gray-500 font-mono ${isVertical() ? 'mb-1' : 'mr-2 w-8 text-right'}`}
        >
          {formatDb(levels().peakDb)}
        </div>
      )}

      <div
        class={`flex gap-1 ${isVertical() ? 'flex-row h-24' : 'flex-col w-32'}`}
      >
        {/* Peak meter */}
        <div
          class={`bg-gray-800 rounded overflow-hidden ${isVertical() ? 'w-3 h-full' : 'h-2 w-full'}`}
        >
          <div
            class={`bg-gradient-to-${isVertical() ? 't' : 'r'} from-green-500 via-yellow-500 to-red-500 transition-all duration-75 ${isVertical() ? 'w-full' : 'h-full'}`}
            style={{
              [isVertical() ? 'height' : 'width']: `${dbToPercent(levels().peakDb)}%`,
            }}
          />
        </div>

        {/* RMS meter */}
        <div
          class={`bg-gray-800 rounded overflow-hidden ${isVertical() ? 'w-3 h-full' : 'h-2 w-full'}`}
        >
          <div
            class={`bg-gradient-to-${isVertical() ? 't' : 'r'} from-blue-600 via-blue-400 to-blue-300 transition-all duration-75 ${isVertical() ? 'w-full' : 'h-full'}`}
            style={{
              [isVertical() ? 'height' : 'width']: `${dbToPercent(levels().rmsDb)}%`,
            }}
          />
        </div>
      </div>

      {showLabels() && (
        <div
          class={`text-[10px] text-gray-600 ${isVertical() ? 'mt-1' : 'ml-2'}`}
        >
          dB
        </div>
      )}
    </div>
  )
}
