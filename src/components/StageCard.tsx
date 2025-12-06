import { For, Show } from 'solid-js'
import type { StageState } from '../audio/engine.ts'
import { STAGE_REGISTRY, type StageParamDef } from '../audio/stages.ts'
import { VerticalSlider } from './VerticalSlider.tsx'
import { ValueKnob } from './ValueKnob.tsx'
import { LeftRightKnob } from './LeftRightKnob.tsx'

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
      class={`flex flex-col w-32 sm:w-36 bg-gray-800 rounded-lg overflow-hidden shrink-0 shadow-lg border border-gray-700 ${
        props.stage.bypassed ? 'opacity-60 grayscale' : ''
      }`}
    >
      {/* Header */}
      <div class="flex items-center justify-between px-2 py-1.5 bg-gray-700 border-b border-gray-600">
        <span class="text-xs font-bold text-gray-200 truncate">
          {definition().label}
        </span>
        <button
          class="text-gray-400 hover:text-red-400 active:text-red-300 text-lg leading-none p-2 -mr-2 touch-manipulation transition-colors"
          onClick={props.onRemove}
          title="Remove"
        >
          ×
        </button>
      </div>

      {/* Parameters */}
      <div class="flex-1 p-3 bg-gray-800 flex flex-col items-center justify-center min-h-[160px]">
        <Show
          when={props.stage.kind === 'pan'}
          fallback={
            <Show
              when={paramEntries().length === 1}
              fallback={
                // Multi-parameter view (Knobs)
                <div class="flex flex-wrap justify-center gap-x-2 gap-y-3">
                  <For each={paramEntries()}>
                    {([key, paramDef]) => {
                      const value = () =>
                        (props.stage.params as Record<string, number>)[key] ??
                        paramDef.default

                      return (
                        <div class="flex flex-col items-center w-[56px]">
                          <ValueKnob
                            value={value()}
                            min={paramDef.min}
                            max={paramDef.max}
                            onChange={(val) => props.onParamChange(key, val)}
                            disabled={props.stage.bypassed}
                            size={42}
                          />
                          <span class="text-[9px] text-gray-400 mt-1 text-center w-full truncate leading-tight">
                            {paramDef.label}
                          </span>
                          <span class="text-[9px] text-blue-300 font-mono leading-tight">
                            {paramDef.format(value())}
                          </span>
                        </div>
                      )
                    }}
                  </For>
                </div>
              }
            >
              {/* Single parameter view (Vertical Slider) */}
              <For each={paramEntries()}>
                {([key, paramDef]) => {
                  const value = () =>
                    (props.stage.params as Record<string, number>)[key] ??
                    paramDef.default

                  return (
                    <div class="flex flex-col items-center w-full h-full gap-2">
                      <div class="flex justify-between w-full text-[10px] font-medium px-1">
                        <span class="text-gray-400">{paramDef.label}</span>
                        <span class="text-blue-300 font-mono">
                          {paramDef.format(value())}
                        </span>
                      </div>
                      <VerticalSlider
                        value={value()}
                        min={paramDef.min}
                        max={paramDef.max}
                        onChange={(val) => props.onParamChange(key, val)}
                        disabled={props.stage.bypassed}
                      />
                    </div>
                  )
                }}
              </For>
            </Show>
          }
        >
          {/* Pan specific view */}
          <For each={paramEntries()}>
            {([key, paramDef]) => {
              const value = () =>
                (props.stage.params as Record<string, number>)[key] ??
                paramDef.default

              return (
                <div class="flex flex-col items-center w-full justify-center gap-2">
                  <div class="flex flex-col items-center text-[10px] font-medium px-1 mb-1">
                    <span class="text-gray-400">{paramDef.label}</span>
                    <span class="text-blue-300 font-mono">
                      {paramDef.format(value())}
                    </span>
                  </div>
                  <LeftRightKnob
                    value={value()}
                    min={paramDef.min}
                    max={paramDef.max}
                    onChange={(val) => props.onParamChange(key, val)}
                    disabled={props.stage.bypassed}
                    size={56}
                  />
                </div>
              )
            }}
          </For>
        </Show>
      </div>

      {/* Footer controls */}
      <div class="flex items-center justify-between px-2 py-1.5 bg-gray-750 border-t border-gray-700">
        <div class="flex gap-1">
          <button
            class="px-3 py-1.5 text-[10px] font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation transition-colors"
            onClick={props.onMoveLeft}
            disabled={props.index === 0}
            title="Move Left"
          >
            ←
          </button>
          <button
            class="px-3 py-1.5 text-[10px] font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation transition-colors"
            onClick={props.onMoveRight}
            disabled={props.index === props.total - 1}
            title="Move Right"
          >
            →
          </button>
        </div>
        <button
          class={`px-2 py-0.5 text-[10px] font-bold rounded touch-manipulation transition-colors ${
            !props.stage.bypassed
              ? 'bg-green-900/80 text-green-300 hover:bg-green-800 border border-green-700'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600'
          }`}
          onClick={props.onBypassToggle}
        >
          {!props.stage.bypassed ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
