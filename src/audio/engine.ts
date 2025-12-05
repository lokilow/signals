export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle'

export type ProcessingNode = {
  id: string
  createNode: (ctx: AudioContext) => AudioNode
  node: AudioNode | null
  bypassed: boolean
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private sourceType: 'oscillator' | 'microphone' = 'oscillator'
  private processingNodes: ProcessingNode[] = []

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
    // ensure oscillator is the active source when starting it
    this.sourceType = 'oscillator'
    this.rebuildSignalChain()
    this.oscillator.start()
  }

  stop() {
    this.oscillator?.stop()
    this.oscillator?.disconnect()
    this.oscillator = null
    this.rebuildSignalChain()
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

  async enableMicrophone() {
    if (!this.ctx) return
    if (this.micSource) return

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.micStream = stream
    this.micSource = this.ctx.createMediaStreamSource(stream)
    this.sourceType = 'microphone'
    this.rebuildSignalChain()
  }

  disableMicrophone() {
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) {
        track.stop()
      }
    }
    this.micSource?.disconnect()
    this.micStream = null
    this.micSource = null
    if (this.sourceType === 'microphone') {
      this.sourceType = 'oscillator'
    }
    this.rebuildSignalChain()
  }

  setSource(type: 'oscillator' | 'microphone') {
    if (type === 'microphone' && !this.micSource) return
    if (type === 'oscillator' && !this.oscillator) return
    this.sourceType = type
    this.rebuildSignalChain()
  }

  addProcessingNode(config: {
    id: string
    createNode: (ctx: AudioContext) => AudioNode
    bypassed?: boolean
  }) {
    const exists = this.processingNodes.find((node) => node.id === config.id)
    if (exists) return

    this.processingNodes.push({
      id: config.id,
      createNode: config.createNode,
      node: null,
      bypassed: config.bypassed ?? false,
    })

    this.rebuildSignalChain()
  }

  removeProcessingNode(id: string) {
    this.processingNodes = this.processingNodes.filter((node) => {
      if (node.id === id) {
        node.node?.disconnect()
        return false
      }
      return true
    })
    this.rebuildSignalChain()
  }

  toggleProcessingNode(id: string) {
    const target = this.processingNodes.find((node) => node.id === id)
    if (!target) return

    target.bypassed = !target.bypassed
    this.rebuildSignalChain()
  }

  private rebuildSignalChain() {
    if (!this.ctx || !this.analyser || !this.gain) return

    const source =
      this.sourceType === 'microphone' ? this.micSource : this.oscillator
    if (!source) return

    this.oscillator?.disconnect()
    this.micSource?.disconnect()
    for (const node of this.processingNodes) {
      node.node?.disconnect()
    }

    let current: AudioNode = source
    for (const node of this.processingNodes) {
      if (node.bypassed) continue
      if (!node.node) {
        node.node = node.createNode(this.ctx)
      }
      current.connect(node.node)
      current = node.node
    }

    current.connect(this.analyser)
    // analyser is already connected to gain/destination during init
  }
}
