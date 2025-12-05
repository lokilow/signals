import { For, Show } from 'solid-js'
import type { StageState } from '../audio/engine.ts'
import { STAGE_REGISTRY, type StageParamDef } from '../audio/stages.ts'

interface Props {
  stage: StageState
  index: number
  total: number
  onBypassToggle: () => void
  onParamChange: (key: string, value: number) => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onRemove: () => void
}

export function StageCard(props: Props) {
  const definition = () => STAGE_REGISTRY[props.stage.kind]
  const paramEntries = () =>
    Object.entries(definition().params) as [string, StageParamDef][]

  return (
    <div
      class={`flex flex-col w-36 bg-gray-800 rounded-lg overflow-hidden ${
        props.stage.bypassed ? 'opacity-50' : ''
      }`}
    >
      {/* Header */}
      <div class="flex items-center justify-between px-2 py-1.5 bg-gray-700">
        <span class="text-xs font-semibold truncate">{definition().label}</span>
        <button
          class="text-gray-400 hover:text-red-400 text-xs leading-none"
          onClick={props.onRemove}
          title="Remove"
        >
          x
        </button>
      </div>

      {/* Parameters */}
      <div class="flex-1 p-2 space-y-2">
        <For each={paramEntries()}>
          {([key, paramDef]) => {
            const value = () =>
              (props.stage.params as Record<string, number>)[key] ??
              paramDef.default

            return (
              <div class="space-y-0.5">
                <div class="flex justify-between text-[10px]">
                  <span class="text-gray-400">{paramDef.label}</span>
                  <span class="text-gray-300 font-mono">
                    {paramDef.format(value())}
                  </span>
                </div>
                <input
                  type="range"
                  min={paramDef.min}
                  max={paramDef.max}
                  step={paramDef.step}
                  value={value()}
                  onInput={(e) => {
                    const val = parseFloat(e.currentTarget.value)
                    props.onParamChange(key, val)
                  }}
                  disabled={props.stage.bypassed}
                  class="w-full h-1 appearance-none bg-gray-600 rounded cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            )
          }}
        </For>
      </div>

      {/* Footer controls */}
      <div class="flex items-center justify-between px-2 py-1.5 bg-gray-750 border-t border-gray-700">
        <div class="flex gap-1">
          <button
            class="px-1.5 py-0.5 text-[10px] rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={props.onMoveLeft}
            disabled={props.index === 0}
          >
            &lt;
          </button>
          <button
            class="px-1.5 py-0.5 text-[10px] rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={props.onMoveRight}
            disabled={props.index === props.total - 1}
          >
            &gt;
          </button>
        </div>
        <button
          class={`px-2 py-0.5 text-[10px] rounded ${
            !props.stage.bypassed
              ? 'bg-green-600 hover:bg-green-500'
              : 'bg-gray-600 hover:bg-gray-500'
          }`}
          onClick={props.onBypassToggle}
        >
          {!props.stage.bypassed ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
