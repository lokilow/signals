import { createSignal, Show } from 'solid-js'
import type { AudioEngine } from '../audio/engine.ts'
import { Waveform } from './Waveform.tsx'
import { Spectrum } from './Spectrum.tsx'

interface Props {
  engine: AudioEngine
}

export function Visualizer(props: Props) {
  const [activeTab, setActiveTab] = createSignal<'waveform' | 'spectrum'>('waveform')

  return (
    <div class="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Mobile Tabs */}
      <div class="flex md:hidden border-b border-gray-800">
        <button
          class={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${
            activeTab() === 'waveform'
              ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('waveform')}
        >
          Waveform
        </button>
        <button
          class={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${
            activeTab() === 'spectrum'
              ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('spectrum')}
        >
          Spectrum
        </button>
      </div>

      {/* Desktop Header (Hidden on Mobile) */}
      <div class="hidden md:flex items-center justify-between px-4 py-2 bg-gray-800/50">
        <span class="text-xs font-semibold text-gray-400">Visualization</span>
      </div>

      {/* Content Area */}
      <div class="flex-1 p-3 md:p-4 min-h-[160px]">
        {/* Mobile: Tabbed View */}
        <div class="md:hidden h-full">
          <Show when={activeTab() === 'waveform'}>
            <Waveform getData={() => props.engine.getTimeDomainData()} />
          </Show>
          <Show when={activeTab() === 'spectrum'}>
            <Spectrum
              getData={() => props.engine.getFrequencyData()}
              sampleRate={props.engine.sampleRate}
            />
          </Show>
        </div>

        {/* Desktop: Side-by-Side Grid */}
        <div class="hidden md:grid grid-cols-2 gap-4 h-full">
          <div class="bg-gray-950/50 rounded border border-gray-800 p-2">
            <div class="text-[10px] text-gray-500 mb-1 text-center">Waveform</div>
            <Waveform getData={() => props.engine.getTimeDomainData()} />
          </div>
          <div class="bg-gray-950/50 rounded border border-gray-800 p-2">
            <div class="text-[10px] text-gray-500 mb-1 text-center">Spectrum</div>
            <Spectrum
              getData={() => props.engine.getFrequencyData()}
              sampleRate={props.engine.sampleRate}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
