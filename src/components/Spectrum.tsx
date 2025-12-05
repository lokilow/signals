import { onMount, onCleanup } from 'solid-js'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

interface Props {
  getData: () => Float32Array
  sampleRate: number
  bins?: number
}

export function Spectrum(props: Props) {
  let container!: HTMLDivElement
  let plot: uPlot
  let rafId: number

  onMount(() => {
    const bins = props.bins ?? 256
    const freqResolution = props.sampleRate / (bins * 2)
    const xData = new Float64Array(bins).map((_, i) => i * freqResolution)
    const yData = new Float64Array(bins)

    const opts: uPlot.Options = {
      width: 600,
      height: 200,
      title: 'Spectrum',
      scales: {
        x: { range: [0, props.sampleRate / 4] }, // Show up to Nyquist/2
        y: { range: [-100, 0] }, // dB scale
      },
      series: [
        {},
        { stroke: '#3b82f6', width: 1, fill: 'rgba(59, 130, 246, 0.1)' },
      ],
      axes: [
        { show: true, label: 'Frequency (Hz)' },
        { show: true, label: 'Magnitude (dB)' },
      ],
    }

    plot = new uPlot(opts, [xData, yData], container)

    const update = () => {
      const data = props.getData()
      const yData = new Float64Array(bins)
      for (let i = 0; i < bins; i++) {
        yData[i] = data[i] ?? -100
      }
      plot.setData([xData, yData])
      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
  })

  onCleanup(() => {
    cancelAnimationFrame(rafId)
    plot?.destroy()
  })

  return <div ref={container!} />
}
