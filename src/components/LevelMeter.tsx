import { createSignal, onCleanup, onMount, For } from 'solid-js'
import type {
  AudioEngine,
  StereoLevels,
  ChannelLevels,
} from '../audio/engine.ts'

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
  const [levels, setLevels] = createSignal<StereoLevels>({
    left: { peak: 0, rms: 0, peakDb: -Infinity, rmsDb: -Infinity },
    right: { peak: 0, rms: 0, peakDb: -Infinity, rmsDb: -Infinity },
  })
  const [mode, setMode] = createSignal<'peak' | 'rms'>('peak')
  const [clippingL, setClippingL] = createSignal(false)
  const [clippingR, setClippingR] = createSignal(false)
  const [peakHoldL, setPeakHoldL] = createSignal(-Infinity)
  const [peakHoldR, setPeakHoldR] = createSignal(-Infinity)

  let rafId: number
  let peakHoldTimeoutL: number | null = null
  let peakHoldTimeoutR: number | null = null

  onMount(() => {
    const update = () => {
      const newLevels = props.engine.getStereoLevels()
      setLevels(newLevels)

      // Clipping detection (signal >= 0dB)
      if (newLevels.left.peakDb >= -0.1) {
        setClippingL(true)
      }
      if (newLevels.right.peakDb >= -0.1) {
        setClippingR(true)
      }

      // Peak hold for left channel
      if (newLevels.left.peakDb > peakHoldL()) {
        setPeakHoldL(newLevels.left.peakDb)
        if (peakHoldTimeoutL) clearTimeout(peakHoldTimeoutL)
        peakHoldTimeoutL = setTimeout(() => {
          setPeakHoldL(-Infinity)
        }, 2000) as unknown as number
      }

      // Peak hold for right channel
      if (newLevels.right.peakDb > peakHoldR()) {
        setPeakHoldR(newLevels.right.peakDb)
        if (peakHoldTimeoutR) clearTimeout(peakHoldTimeoutR)
        peakHoldTimeoutR = setTimeout(() => {
          setPeakHoldR(-Infinity)
        }, 2000) as unknown as number
      }

      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
  })

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId)
    if (peakHoldTimeoutL) clearTimeout(peakHoldTimeoutL)
    if (peakHoldTimeoutR) clearTimeout(peakHoldTimeoutR)
  })

  const clearClipping = () => {
    setClippingL(false)
    setClippingR(false)
    setPeakHoldL(-Infinity)
    setPeakHoldR(-Infinity)
  }

  const toggleMode = () => {
    setMode(mode() === 'peak' ? 'rms' : 'peak')
  }

  const isVertical = () => props.orientation !== 'horizontal'
  const showScale = () => props.showScale ?? true

  // Get the dB value based on current mode
  const getDb = (channel: ChannelLevels) => {
    return mode() === 'peak' ? channel.peakDb : channel.rmsDb
  }

  // Check if a segment should be lit based on current level
  const isSegmentLit = (segmentDb: number, levelDb: number) => {
    return levelDb >= segmentDb
  }

  // Check if this segment is the peak hold position
  const isPeakHoldSegment = (
    segmentDb: number,
    index: number,
    peakHold: number
  ) => {
    if (peakHold === -Infinity) return false
    const nextSegment = SEGMENTS[index + 1]
    if (nextSegment) {
      return peakHold >= segmentDb && peakHold < nextSegment.db
    }
    return peakHold >= segmentDb
  }

  const isClipping = () => clippingL() || clippingR()

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
        {/* Left channel */}
        <div
          class={`flex ${isVertical() ? 'flex-col-reverse' : 'flex-row'} gap-px bg-gray-900 p-0.5 rounded ${isVertical() ? 'h-32 w-4' : 'w-full h-4'}`}
        >
          <For each={SEGMENTS}>
            {(segment, index) => {
              const levelDb = () => getDb(levels().left)
              const lit = () => isSegmentLit(segment.db, levelDb())
              const isPeakHold = () =>
                isPeakHoldSegment(segment.db, index(), peakHoldL())

              return (
                <div
                  class={`${isVertical() ? 'w-full flex-1' : 'h-full flex-1'} rounded-sm transition-opacity duration-75 ${
                    lit()
                      ? segment.color
                      : isPeakHold()
                        ? 'bg-white'
                        : 'bg-gray-800'
                  } ${isPeakHold() || lit() ? 'opacity-100' : 'opacity-40'}`}
                />
              )
            }}
          </For>
        </div>

        {/* Right channel */}
        <div
          class={`flex ${isVertical() ? 'flex-col-reverse' : 'flex-row'} gap-px bg-gray-900 p-0.5 rounded ${isVertical() ? 'h-32 w-4' : 'w-full h-4'}`}
        >
          <For each={SEGMENTS}>
            {(segment, index) => {
              const levelDb = () => getDb(levels().right)
              const lit = () => isSegmentLit(segment.db, levelDb())
              const isPeakHold = () =>
                isPeakHoldSegment(segment.db, index(), peakHoldR())

              return (
                <div
                  class={`${isVertical() ? 'w-full flex-1' : 'h-full flex-1'} rounded-sm transition-opacity duration-75 ${
                    lit()
                      ? segment.color
                      : isPeakHold()
                        ? 'bg-white'
                        : 'bg-gray-800'
                  } ${isPeakHold() || lit() ? 'opacity-100' : 'opacity-40'}`}
                />
              )
            }}
          </For>
        </div>
      </div>

      {/* Labels */}
      <div
        class={`flex ${isVertical() ? 'flex-col' : 'flex-row'} text-[9px] text-gray-500 font-mono ${isVertical() ? 'pl-0.5 justify-between h-32' : 'pt-0.5 justify-around w-full'}`}
      >
        <span>L</span>
        <span>R</span>
      </div>

      {/* Controls */}
      <div
        class={`flex ${isVertical() ? 'flex-col items-center' : 'flex-row items-center'} gap-1 ${isVertical() ? 'pl-1' : 'pt-1'}`}
      >
        {/* Mode toggle */}
        <button
          class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-700 hover:bg-gray-600"
          onClick={toggleMode}
          title="Toggle Peak/RMS"
        >
          {mode() === 'peak' ? 'PK' : 'RMS'}
        </button>

        {/* Clip indicator */}
        <button
          class={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
            isClipping()
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-gray-800 text-gray-600'
          }`}
          onClick={clearClipping}
          title="Click to clear"
        >
          CLIP
        </button>

        {/* dB readout */}
        <div class="text-[10px] font-mono text-gray-400">
          {Math.max(getDb(levels().left), getDb(levels().right)) === -Infinity
            ? '-inf'
            : Math.max(getDb(levels().left), getDb(levels().right)).toFixed(1)}
        </div>
      </div>
    </div>
  )
}
