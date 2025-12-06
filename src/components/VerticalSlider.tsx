import { createSignal } from 'solid-js'

interface Props {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function VerticalSlider(props: Props) {
  let containerRef: HTMLDivElement | undefined
  const [isDragging, setIsDragging] = createSignal(false)

  const handleStart = (e: PointerEvent) => {
    if (props.disabled || !containerRef) return
    e.preventDefault()
    setIsDragging(true)
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const updateValue = (clientY: number) => {
        if (!containerRef) return
        const rect = containerRef.getBoundingClientRect()
        const height = rect.height
        // y relative to bottom
        const y = rect.bottom - clientY
        const clampedY = Math.max(0, Math.min(y, height))
        
        const normalized = clampedY / height
        const range = props.max - props.min
        const newValue = props.min + (normalized * range)
        
        // Round to rough step precision to avoid jitter if needed, but standard float is fine
        // We rely on the parent to format it, but we should respect the step if possible?
        // The prompt didn't explicitly ask for step handling in the slider logic, but it's good practice.
        // However, standard range input logic usually handles step. 
        // For now raw float is fine, or I can pass step.
        
        props.onChange(Math.min(Math.max(newValue, props.min), props.max))
    }

    updateValue(e.clientY)

    const handleMove = (e: PointerEvent) => {
      updateValue(e.clientY)
    }

    const handleEnd = (e: PointerEvent) => {
      setIsDragging(false)
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleEnd)
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleEnd)
  }

  const percentage = () => {
    const range = props.max - props.min
    return Math.min(100, Math.max(0, ((props.value - props.min) / range) * 100))
  }

  return (
    <div
      ref={containerRef}
      class={`relative w-12 h-32 bg-gray-900 rounded-lg overflow-hidden touch-none select-none ${
        props.disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : isDragging() 
            ? 'cursor-grabbing hover:bg-gray-800' 
            : 'cursor-grab hover:bg-gray-800'
      } border border-gray-700`}
      onPointerDown={handleStart}
    >
      {/* Fill */}
      <div
        class="absolute bottom-0 w-full bg-blue-600/80 transition-[height] duration-75 ease-out"
        style={{ height: `${percentage()}%` }}
      />
      
      {/* Value line/Thumb */}
      <div 
        class="absolute w-full h-px bg-blue-400 shadow-[0_0_4px_rgba(59,130,246,0.8)]"
        style={{ bottom: `${percentage()}%` }}
      />
    </div>
  )
}
