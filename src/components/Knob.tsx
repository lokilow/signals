import { createSignal } from 'solid-js'

interface Props {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  size?: number
  label?: string
  format?: (v: number) => string
}

export function Knob(props: Props) {
  const size = () => props.size ?? 48
  const [isDragging, setIsDragging] = createSignal(false)
  
  const handleStart = (e: PointerEvent) => {
    if (props.disabled) return
    e.preventDefault()
    setIsDragging(true)
    
    const startY = e.clientY
    const startValue = props.value
    const sensitivity = 200 // pixels for full range
    
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    
    const handleMove = (e: PointerEvent) => {
        const deltaY = startY - e.clientY // Up is positive
        const range = props.max - props.min
        const change = (deltaY / sensitivity) * range
        const newValue = Math.min(Math.max(startValue + change, props.min), props.max)
        props.onChange(newValue)
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

  // Visual calculation
  const rotation = () => {
    const range = props.max - props.min
    const percent = (props.value - props.min) / range
    // Map 0..1 to -145deg .. +145deg (290 degree arc)
    return -145 + (percent * 290)
  }

  return (
    <div class="flex flex-col items-center gap-1">
        <div 
            class={`relative rounded-full bg-gray-900 border border-gray-700 touch-none select-none ${
              props.disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : isDragging() 
                  ? 'cursor-grabbing border-gray-500' 
                  : 'cursor-grab hover:border-gray-500'
            }`}
            style={{ width: `${size()}px`, height: `${size()}px` }}
            onPointerDown={handleStart}
        >
        {/* Tick marks */}
        <div class="absolute inset-0 rounded-full border-2 border-gray-800 box-border" />
        
        {/* Indicator */}
        <div 
            class="absolute w-1 h-[40%] bg-blue-500 left-1/2 top-[10%] origin-bottom rounded-full shadow-[0_0_4px_rgba(59,130,246,0.5)]"
            style={{ 
                transform: `translateX(-50%) rotate(${rotation()}deg)`,
            }}
        />
        </div>
    </div>
  )
}
