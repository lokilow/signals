export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle'

type ProcessingNodeInstance = {
  input: AudioNode
  output: AudioNode
}

export type ProcessingNode = {
  id: string
  createNode: (ctx: AudioContext) => ProcessingNodeInstance
  instance: ProcessingNodeInstance | null
  bypassed: boolean
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private analyser: AnalyserNode | null = null
  private masterGain: GainNode | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private sourceType: 'oscillator' | 'microphone' = 'oscillator'
  private processingNodes: ProcessingNode[] = []
  private readonly gainStageId = 'gain-stage'
  private readonly panStageId = 'pan-stage'
  private readonly delayStageId = 'delay-stage'
  private gainLevel = 1
  private panValue = 0
  private delayTime = 0.2
  private delayWet = 0.5
  private delayFeedback = 0.3
  private delayStageNodes: {
    delay: DelayNode
    wetGain: GainNode
    dryGain: GainNode
    feedbackGain: GainNode
  } | null = null

  // Buffers for visualization
  readonly fftSize = 2048
  private timeDomainData: Float32Array
  private frequencyData: Float32Array

  constructor() {
    this.timeDomainData = new Float32Array(this.fftSize)
    this.frequencyData = new Float32Array(this.fftSize / 2)
  }

  enableGainStage() {
    const node = this.ensureGainStage()
    if (!node) return
    if (node.bypassed) {
      node.bypassed = false
      this.rebuildSignalChain()
    }
  }

  disableGainStage() {
    const node = this.findProcessingNode(this.gainStageId)
    if (!node) return
    if (!node.bypassed) {
      node.bypassed = true
      this.rebuildSignalChain()
    }
  }

  setGainStageLevel(level: number) {
    this.gainLevel = level
    const stage = this.ensureGainStage()
    if (!stage) return
    const instance = this.ensureStageInstance(stage)
    if (instance?.input instanceof GainNode) {
      instance.input.gain.value = level
    }
  }

  enablePanStage() {
    const node = this.ensurePanStage()
    if (!node) return
    if (node.bypassed) {
      node.bypassed = false
      this.rebuildSignalChain()
    }
  }

  disablePanStage() {
    const node = this.findProcessingNode(this.panStageId)
    if (!node) return
    if (!node.bypassed) {
      node.bypassed = true
      this.rebuildSignalChain()
    }
  }

  setPanValue(value: number) {
    this.panValue = value
    const stage = this.ensurePanStage()
    if (!stage) return
    const instance = this.ensureStageInstance(stage)
    if (instance?.input instanceof StereoPannerNode) {
      instance.input.pan.value = value
    }
  }

  enableDelayStage() {
    const node = this.ensureDelayStage()
    if (!node) return
    if (node.bypassed) {
      node.bypassed = false
      this.rebuildSignalChain()
    }
  }

  disableDelayStage() {
    const node = this.findProcessingNode(this.delayStageId)
    if (!node) return
    if (!node.bypassed) {
      node.bypassed = true
      this.rebuildSignalChain()
    }
  }

  setDelayTime(value: number) {
    this.delayTime = value
    const nodes = this.ensureDelayStageNodes()
    nodes?.delay && (nodes.delay.delayTime.value = value)
  }

  setDelayWet(value: number) {
    this.delayWet = value
    const nodes = this.ensureDelayStageNodes()
    if (nodes) {
      nodes.wetGain.gain.value = value
      nodes.dryGain.gain.value = 1 - value
    }
  }

  setDelayFeedback(value: number) {
    this.delayFeedback = value
    const nodes = this.ensureDelayStageNodes()
    if (nodes) {
      nodes.feedbackGain.gain.value = value
    }
  }

  async init() {
    this.ctx = new AudioContext()

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = this.fftSize
    this.analyser.smoothingTimeConstant = 0
    this.analyser.channelCount = 2
    this.analyser.channelCountMode = 'explicit'

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.3
    this.masterGain.connect(this.ctx.destination)

    this.ensureGainStage()
    this.ensurePanStage()
    this.ensureDelayStage()
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
    createNode: (ctx: AudioContext) => ProcessingNodeInstance
    bypassed?: boolean
  }) {
    const exists = this.processingNodes.find((node) => node.id === config.id)
    if (exists) return

    this.processingNodes.push({
      id: config.id,
      createNode: config.createNode,
      instance: null,
      bypassed: config.bypassed ?? false,
    })

    this.rebuildSignalChain()
  }

  removeProcessingNode(id: string) {
    this.processingNodes = this.processingNodes.filter((node) => {
      if (node.id === id) {
        node.instance?.input.disconnect()
        node.instance?.output.disconnect()
        if (id === this.delayStageId) {
          this.delayStageNodes = null
        }
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

  private ensureStageInstance(stage: ProcessingNode) {
    if (!this.ctx) return null
    if (!stage.instance) {
      stage.instance = stage.createNode(this.ctx)
    }
    return stage.instance
  }

  private ensureDelayStageNodes() {
    const stage = this.ensureDelayStage()
    if (!stage) return null
    this.ensureStageInstance(stage)
    return this.delayStageNodes
  }

  private rebuildSignalChain() {
    if (!this.ctx || !this.analyser || !this.masterGain) return

    const source =
      this.sourceType === 'microphone' ? this.micSource : this.oscillator
    if (!source) return

    this.oscillator?.disconnect()
    this.micSource?.disconnect()
    for (const node of this.processingNodes) {
      node.instance?.input.disconnect()
      node.instance?.output.disconnect()
    }

    let current: AudioNode = source
    for (const node of this.processingNodes) {
      if (node.bypassed) continue
      const instance = this.ensureStageInstance(node)
      if (!instance) continue
      current.connect(instance.input)
      current = instance.output
    }

    current.connect(this.masterGain)
    current.connect(this.analyser)
  }

  private ensureGainStage() {
    if (!this.ctx) return null
    let existing = this.findProcessingNode(this.gainStageId)
    if (!existing) {
      existing = {
        id: this.gainStageId,
        bypassed: true,
        instance: null,
        createNode: (ctx) => {
          const gain = ctx.createGain()
          gain.gain.value = this.gainLevel
          return { input: gain, output: gain }
        },
      }
      this.processingNodes.push(existing)
    }
    return existing
  }

  private ensurePanStage() {
    if (!this.ctx) return null
    let existing = this.findProcessingNode(this.panStageId)
    if (!existing) {
      existing = {
        id: this.panStageId,
        bypassed: true,
        instance: null,
        createNode: (ctx) => {
          const pan = ctx.createStereoPanner()
          pan.pan.value = this.panValue
          return { input: pan, output: pan }
        },
      }
      this.processingNodes.push(existing)
    }
    return existing
  }

  private ensureDelayStage() {
    if (!this.ctx) return null
    let existing = this.findProcessingNode(this.delayStageId)
    if (!existing) {
      existing = {
        id: this.delayStageId,
        bypassed: true,
        instance: null,
        createNode: (ctx) => {
          const input = ctx.createGain()
          const output = ctx.createGain()
          const delay = ctx.createDelay(2)
          const wetGain = ctx.createGain()
          const dryGain = ctx.createGain()
          const feedbackGain = ctx.createGain()

          delay.delayTime.value = this.delayTime
          wetGain.gain.value = this.delayWet
          dryGain.gain.value = 1 - this.delayWet
          feedbackGain.gain.value = this.delayFeedback

          input.connect(dryGain)
          dryGain.connect(output)

          input.connect(delay)
          delay.connect(wetGain)
          wetGain.connect(output)

          delay.connect(feedbackGain)
          feedbackGain.connect(delay)

          this.delayStageNodes = { delay, wetGain, dryGain, feedbackGain }

          return { input, output }
        },
      }
      this.processingNodes.push(existing)
    }
    return existing
  }

  private findProcessingNode(id: string) {
    return this.processingNodes.find((node) => node.id === id)
  }
}
