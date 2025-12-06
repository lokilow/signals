import { onMount, onCleanup } from 'solid-js'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

interface Props {
  getData: () => Float32Array
  samples?: number
}

export function Waveform(props: Props) {
  let container!: HTMLDivElement
  let plot: uPlot
  let rafId: number

  onMount(() => {
    const samples = props.samples ?? 512
    const xData = new Float64Array(samples).map((_, i) => i)
    const yData = new Float64Array(samples)

    const opts: uPlot.Options = {
      width: container.clientWidth || 300,
      height: Math.min(200, window.innerHeight * 0.25),
      title: 'Waveform',
      scales: {
        y: { range: [-1, 1] },
      },
      series: [{}, { stroke: '#22c55e', width: 1 }],
      axes: [
        { show: true, label: 'Sample' },
        { show: true, label: 'Amplitude' },
      ],
    }

    plot = new uPlot(opts, [xData, yData], container)

    // Resize handler for responsive behavior
    const handleResize = () => {
      plot.setSize({
        width: container.clientWidth,
        height: Math.min(200, window.innerHeight * 0.25),
      })
    }
    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))

    const update = () => {
      const data = props.getData()
      const yData = new Float64Array(samples)
      for (let i = 0; i < samples; i++) {
        yData[i] = data[i] ?? 0
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
