export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null

  // Buffers for visualization
  readonly fftSize = 2048
  private timeDomainData: Float32Array
  private frequencyData: Float32Array

  constructor() {
    this.timeDomainData = new Float32Array(this.fftSize)
    this.frequencyData = new Float32Array(this.fftSize / 2)
  }

  async init() {
    this.ctx = new AudioContext()

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = this.fftSize
    this.analyser.smoothingTimeConstant = 0

    this.gain = this.ctx.createGain()
    this.gain.gain.value = 0.3

    this.analyser.connect(this.gain)
    this.gain.connect(this.ctx.destination)
  }

  start(type: WaveformType, frequency: number) {
    if (!this.ctx || !this.analyser) return

    this.stop()

    this.oscillator = this.ctx.createOscillator()
    this.oscillator.type = type
    this.oscillator.frequency.value = frequency
    this.oscillator.connect(this.analyser)
    this.oscillator.start()
  }

  stop() {
    this.oscillator?.stop()
    this.oscillator?.disconnect()
    this.oscillator = null
  }

  setFrequency(freq: number) {
    if (this.oscillator) {
      this.oscillator.frequency.value = freq
    }
  }

  setType(type: WaveformType) {
    if (this.oscillator) {
      this.oscillator.type = type
    }
  }

  getTimeDomainData(): Float32Array {
    const tdBuffer = this.timeDomainData as Float32Array<ArrayBuffer>
    this.analyser?.getFloatTimeDomainData(tdBuffer)
    return this.timeDomainData
  }

  getFrequencyData(): Float32Array {
    const freqBuffer = this.frequencyData as Float32Array<ArrayBuffer>
    this.analyser?.getFloatFrequencyData(freqBuffer)
    return this.frequencyData
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100
  }
}
