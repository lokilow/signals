import { ValueKnob } from './ValueKnob.tsx'

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

export function LeftRightKnob(props: Props) {
  return (
    <div class="relative inline-flex flex-col items-center mb-2">
      <ValueKnob {...props} />

      <span
        class="absolute left-0 text-[10px] font-bold text-gray-500 pointer-events-none select-none"
        style={{ bottom: '-12px' }}
      >
        L
      </span>

      <span
        class="absolute right-0 text-[10px] font-bold text-gray-500 pointer-events-none select-none"
        style={{ bottom: '-12px' }}
      >
        R
      </span>
    </div>
  )
}
