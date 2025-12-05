import { For } from 'solid-js'
import type { StageState } from '../audio/engine.ts'
import { STAGE_REGISTRY, type StageParamDef } from '../audio/stages.ts'

interface Props {
  stage: StageState
  index: number
  total: number
  onBypassToggle: () => void
  onParamChange: (key: string, value: number) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

export function StageControl(props: Props) {
  const definition = () => STAGE_REGISTRY[props.stage.kind]
  const paramEntries = () =>
    Object.entries(definition().params) as [string, StageParamDef][]

  return (
    <div class="flex flex-col gap-2 p-3 bg-gray-800 rounded">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold">{definition().label}</span>
        <div class="flex gap-1">
          <button
            class="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={props.onMoveUp}
            disabled={props.index === 0}
            title="Move up"
          >
            ↑
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={props.onMoveDown}
            disabled={props.index === props.total - 1}
            title="Move down"
          >
            ↓
          </button>
          <button
            class={`px-2 py-1 text-xs rounded ${
              !props.stage.bypassed ? 'bg-red-600' : 'bg-green-600'
            }`}
            onClick={props.onBypassToggle}
          >
            {!props.stage.bypassed ? 'Bypass' : 'Enable'}
          </button>
          <button
            class="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700"
            onClick={props.onRemove}
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>

      <For each={paramEntries()}>
        {([key, paramDef]) => {
          const value = () =>
            (props.stage.params as Record<string, number>)[key] ??
            paramDef.default

          return (
            <>
              <label class="text-xs text-gray-300">
                {paramDef.label}: {paramDef.format(value())}
              </label>
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
              />
            </>
          )
        }}
      </For>
    </div>
  )
}
