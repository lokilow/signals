import { For } from 'solid-js'
import type { StageState } from '../audio/engine.ts'
import { STAGE_REGISTRY, type StageParamDef } from '../audio/stages.ts'

interface Props {
  stage: StageState
  onBypassToggle: () => void
  onParamChange: (key: string, value: number) => void
}

export function StageControl(props: Props) {
  const definition = () => STAGE_REGISTRY[props.stage.kind]
  const paramEntries = () =>
    Object.entries(definition().params) as [string, StageParamDef][]

  return (
    <div class="flex flex-col gap-2 p-3 bg-gray-800 rounded">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold">{definition().label}</span>
        <button
          class={`px-2 py-1 text-sm rounded ${
            !props.stage.bypassed ? 'bg-red-600' : 'bg-green-600'
          }`}
          onClick={props.onBypassToggle}
        >
          {!props.stage.bypassed ? 'Bypass' : 'Enable'}
        </button>
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
