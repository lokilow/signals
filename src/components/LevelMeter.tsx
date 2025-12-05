import { createSignal, onCleanup, onMount, For } from 'solid-js'
import type { AudioEngine, SignalLevels } from '../audio/engine.ts'

interface Props {
  engine: AudioEngine
  orientation?: 'horizontal' | 'vertical'
  showScale?: boolean
}

// Meter segments from bottom to top (or left to right)
// Each segment has a dB threshold and color
const SEGMENTS = [
  { db: -48, color: 'bg-green-600' },
  { db: -42, color: 'bg-green-600' },
  { db: -36, color: 'bg-green-500' },
  { db: -30, color: 'bg-green-500' },
  { db: -24, color: 'bg-green-400' },
  { db: -18, color: 'bg-green-400' },
  { db: -12, color: 'bg-yellow-400' },
  { db: -9, color: 'bg-yellow-400' },
  { db: -6, color: 'bg-yellow-500' },
  { db: -3, color: 'bg-orange-500' },
  { db: -1, color: 'bg-orange-600' },
  { db: 0, color: 'bg-red-600' },
]

const SCALE_MARKS = [-48, -36, -24, -12, -6, -3, 0]

export function LevelMeter(props: Props) {
  const [levels, setLevels] = createSignal<SignalLevels>({
    peak: 0,
    rms: 0,
    peakDb: -Infinity,
    rmsDb: -Infinity,
  })
  const [clipping, setClipping] = createSignal(false)
  const [peakHold, setPeakHold] = createSignal(-Infinity)

  let rafId: number
  let peakHoldTimeout: number | null = null

  onMount(() => {
    const update = () => {
      const newLevels = props.engine.getSignalLevels()
      setLevels(newLevels)

      // Clipping detection (signal >= 0dB)
      if (newLevels.peakDb >= -0.1) {
        setClipping(true)
      }

      // Peak hold - update if new peak is higher
      if (newLevels.peakDb > peakHold()) {
        setPeakHold(newLevels.peakDb)
        // Reset peak hold after 2 seconds
        if (peakHoldTimeout) clearTimeout(peakHoldTimeout)
        peakHoldTimeout = setTimeout(() => {
          setPeakHold(-Infinity)
        }, 2000) as unknown as number
      }

      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
  })

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId)
    if (peakHoldTimeout) clearTimeout(peakHoldTimeout)
  })

  const clearClipping = () => {
    setClipping(false)
    setPeakHold(-Infinity)
  }

  const isVertical = () => props.orientation !== 'horizontal'
  const showScale = () => props.showScale ?? true

  // Check if a segment should be lit based on current level
  const isSegmentLit = (segmentDb: number, levelDb: number) => {
    return levelDb >= segmentDb
  }

  // Check if this segment is the peak hold position
  const isPeakHoldSegment = (segmentDb: number, index: number) => {
    const hold = peakHold()
    if (hold === -Infinity) return false
    // Find the segment that matches peak hold
    const nextSegment = SEGMENTS[index + 1]
    if (nextSegment) {
      return hold >= segmentDb && hold < nextSegment.db
    }
    return hold >= segmentDb
  }

  return (
    <div
      class={`flex ${isVertical() ? 'flex-row' : 'flex-col'} gap-1 select-none`}
    >
      {/* Scale markings */}
      {showScale() && (
        <div
          class={`flex ${isVertical() ? 'flex-col-reverse justify-between' : 'flex-row justify-between'} text-[9px] text-gray-500 font-mono ${isVertical() ? 'h-32 pr-1' : 'w-full pb-1'}`}
        >
          <For each={SCALE_MARKS}>
            {(mark) => (
              <span class={mark === 0 ? 'text-red-500' : ''}>
                {mark === 0 ? '0' : mark}
              </span>
            )}
          </For>
        </div>
      )}

      {/* Meter bars container */}
      <div class={`flex ${isVertical() ? 'flex-row' : 'flex-col'} gap-0.5`}>
        {/* Left/Top channel (or mono) - using peak */}
        <div
          class={`flex ${isVertical() ? 'flex-col-reverse' : 'flex-row'} gap-px bg-gray-900 p-0.5 rounded ${isVertical() ? 'h-32 w-4' : 'w-full h-4'}`}
        >
          <For each={SEGMENTS}>
            {(segment, index) => (
              <div
                class={`${isVertical() ? 'w-full flex-1' : 'h-full flex-1'} rounded-sm transition-opacity duration-75 ${
                  isSegmentLit(segment.db, levels().peakDb)
                    ? segment.color
                    : isPeakHoldSegment(segment.db, index())
                      ? 'bg-white'
                      : 'bg-gray-800'
                } ${isPeakHoldSegment(segment.db, index()) ? 'opacity-100' : isSegmentLit(segment.db, levels().peakDb) ? 'opacity-100' : 'opacity-40'}`}
              />
            )}
          </For>
        </div>

        {/* Right/Bottom channel - using RMS */}
        <div
          class={`flex ${isVertical() ? 'flex-col-reverse' : 'flex-row'} gap-px bg-gray-900 p-0.5 rounded ${isVertical() ? 'h-32 w-4' : 'w-full h-4'}`}
        >
          <For each={SEGMENTS}>
            {(segment, index) => (
              <div
                class={`${isVertical() ? 'w-full flex-1' : 'h-full flex-1'} rounded-sm transition-opacity duration-75 ${
                  isSegmentLit(segment.db, levels().rmsDb)
                    ? segment.color
                    : 'bg-gray-800'
                } ${isSegmentLit(segment.db, levels().rmsDb) ? 'opacity-100' : 'opacity-40'}`}
              />
            )}
          </For>
        </div>
      </div>

      {/* Clipping indicator and dB readout */}
      <div
        class={`flex ${isVertical() ? 'flex-col items-center' : 'flex-row items-center'} gap-1 ${isVertical() ? 'pl-1' : 'pt-1'}`}
      >
        {/* Clip indicator */}
        <button
          class={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
            clipping()
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-gray-800 text-gray-600'
          }`}
          onClick={clearClipping}
          title="Click to clear"
        >
          CLIP
        </button>

        {/* Peak dB readout */}
        <div class="text-[10px] font-mono text-gray-400">
          {levels().peakDb === -Infinity ? '-inf' : levels().peakDb.toFixed(1)}
        </div>
      </div>
    </div>
  )
}
