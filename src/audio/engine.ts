import {
  STAGE_REGISTRY,
  getDefaultParams,
  type StageKind,
  type StageParamsMap,
  type StageInstance,
} from './stages.ts'

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle'
export type SourceType = 'oscillator' | 'microphone'

// Re-export for consumers
export type { StageKind, StageParamsMap }

// Stage state uses discriminated union for type safety
export type StageState<K extends StageKind = StageKind> = {
  id: string
  kind: K
  bypassed: boolean
  params: StageParamsMap[K]
}

export type EngineState = {
  source: SourceType
  oscillator: { running: boolean; type: WaveformType; frequency: number }
  mic: { enabled: boolean }
  stages: StageState[]
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private masterGain: GainNode | null = null
  private oscillator: OscillatorNode | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null

  private stageInstances = new Map<string, StageInstance>()
  private subscribers = new Set<(state: EngineState) => void>()

  private state: EngineState = {
    source: 'oscillator',
    oscillator: { running: false, type: 'sine', frequency: 440 },
    mic: { enabled: false },
    stages: [
      {
        id: 'gain-stage',
        kind: 'gain',
        bypassed: true,
        params: getDefaultParams('gain'),
      },
      {
        id: 'pan-stage',
        kind: 'pan',
        bypassed: true,
        params: getDefaultParams('pan'),
      },
      {
        id: 'delay-stage',
        kind: 'delay',
        bypassed: true,
        params: getDefaultParams('delay'),
      },
    ],
  }

  async init() {
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0
    this.analyser.channelCount = 2
    this.analyser.channelCountMode = 'explicit'

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.3
    this.masterGain.connect(this.ctx.destination)

    this.emitState()
    this.rebuildSignalChain()
  }

  subscribe(handler: (state: EngineState) => void): () => void {
    this.subscribers.add(handler)
    handler(this.cloneState())
    return () => this.subscribers.delete(handler)
  }

  getState(): EngineState {
    return this.cloneState()
  }

  startOscillator() {
    this.updateState((state) => {
      state.oscillator.running = true
      state.source = 'oscillator'
    })
  }

  stopOscillator() {
    this.updateState((state) => {
      state.oscillator.running = false
    })
  }

  setFrequency(freq: number) {
    this.updateState((state) => {
      state.oscillator.frequency = freq
    })
  }

  setType(type: WaveformType) {
    this.updateState((state) => {
      state.oscillator.type = type
    })
  }

  async enableMicrophone() {
    if (!this.ctx) return
    if (this.micSource) {
      this.updateState((state) => {
        state.mic.enabled = true
        state.source = 'microphone'
      })
      return
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.micStream = stream
    this.micSource = this.ctx.createMediaStreamSource(stream)
    this.updateState((state) => {
      state.mic.enabled = true
      state.source = 'microphone'
    })
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

    this.updateState((state) => {
      state.mic.enabled = false
      if (state.source === 'microphone') {
        state.source = 'oscillator'
      }
    })
  }

  setSource(source: SourceType): boolean {
    if (source === 'microphone' && !this.state.mic.enabled) return false
    this.updateState((state) => {
      state.source = source
    })
    return true
  }

  setStageBypass(id: string, bypassed: boolean) {
    this.updateState((state) => {
      const stage = state.stages.find((s) => s.id === id)
      if (stage) stage.bypassed = bypassed
    })
  }

  setStageParams(id: string, params: Record<string, number>) {
    this.updateState((state) => {
      const stage = state.stages.find((s) => s.id === id)
      if (stage) {
        stage.params = { ...stage.params, ...params }
      }
    })
  }

  /**
   * Add a new stage to the chain
   * @param kind - The type of stage to add
   * @param afterId - Optional ID of stage to insert after. If omitted, appends to end.
   * @returns The ID of the newly created stage
   */
  addStage(kind: StageKind, afterId?: string): string {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`
    this.updateState((state) => {
      const newStage: StageState = {
        id,
        kind,
        bypassed: false,
        params: getDefaultParams(kind),
      }

      if (afterId) {
        const index = state.stages.findIndex((s) => s.id === afterId)
        if (index !== -1) {
          state.stages.splice(index + 1, 0, newStage)
          return
        }
      }
      state.stages.push(newStage)
    })
    return id
  }

  /**
   * Remove a stage from the chain
   * @param id - The ID of the stage to remove
   */
  removeStage(id: string) {
    this.updateState((state) => {
      const index = state.stages.findIndex((s) => s.id === id)
      if (index !== -1) {
        state.stages.splice(index, 1)
      }
    })
  }

  /**
   * Move a stage up or down in the chain
   * @param id - The ID of the stage to move
   * @param direction - 'up' moves toward source, 'down' moves toward output
   */
  moveStage(id: string, direction: 'up' | 'down') {
    this.updateState((state) => {
      const index = state.stages.findIndex((s) => s.id === id)
      if (index === -1) return

      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= state.stages.length) return

      const [stage] = state.stages.splice(index, 1)
      state.stages.splice(newIndex, 0, stage!)
    })
  }

  getTimeDomainData(): Float32Array {
    const buffer = new Float32Array(this.analyser?.fftSize ?? 2048)
    if (this.analyser) {
      this.analyser.getFloatTimeDomainData(buffer)
    }
    return buffer
  }

  getFrequencyData(): Float32Array {
    const buffer = new Float32Array((this.analyser?.fftSize ?? 2048) / 2)
    if (this.analyser) {
      this.analyser.getFloatFrequencyData(buffer)
    }
    return buffer
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100
  }

  private updateState(mutator: (state: EngineState) => void) {
    mutator(this.state)
    this.emitState()
    this.rebuildSignalChain()
  }

  private emitState() {
    const snapshot = this.cloneState()
    for (const sub of this.subscribers) {
      sub(snapshot)
    }
  }

  private cloneState(): EngineState {
    return {
      source: this.state.source,
      oscillator: { ...this.state.oscillator },
      mic: { ...this.state.mic },
      stages: this.state.stages.map((s) => ({
        id: s.id,
        kind: s.kind,
        bypassed: s.bypassed,
        params: { ...s.params },
      })) as StageState[],
    }
  }

  private rebuildSignalChain() {
    if (!this.ctx || !this.analyser || !this.masterGain) return

    // Disconnect all existing connections
    // Only disconnect outputs - disconnecting inputs would break internal wiring
    // for complex stages like delay (input connects to internal nodes)
    this.oscillator?.disconnect()
    this.micSource?.disconnect()
    for (const instance of this.stageInstances.values()) {
      instance.output.disconnect()
    }

    // Sync source nodes with state
    this.syncOscillatorNode()
    this.syncMicSource()

    // Determine active source
    let chosenSource: AudioNode | null = null
    let chosenType: SourceType = this.state.source

    if (this.state.source === 'microphone' && this.micSource) {
      chosenSource = this.micSource
    } else if (this.state.source === 'oscillator' && this.oscillator) {
      chosenSource = this.oscillator
    } else if (
      this.state.source === 'microphone' &&
      !this.micSource &&
      this.oscillator
    ) {
      chosenSource = this.oscillator
      chosenType = 'oscillator'
    } else if (
      this.state.source === 'oscillator' &&
      !this.oscillator &&
      this.micSource
    ) {
      chosenSource = this.micSource
      chosenType = 'microphone'
    }

    if (chosenType !== this.state.source) {
      this.state.source = chosenType
      this.emitState()
    }

    if (!chosenSource) return

    // Build the processing chain
    const activeIds = new Set<string>()
    let current: AudioNode = chosenSource

    for (const stageState of this.state.stages) {
      activeIds.add(stageState.id)
      const instance = this.ensureStageInstance(stageState)
      instance.update(stageState.params)

      if (!stageState.bypassed) {
        current.connect(instance.input)
        current = instance.output
      }
    }

    // Garbage collect orphaned instances
    for (const [id, instance] of this.stageInstances) {
      if (!activeIds.has(id)) {
        instance.dispose()
        this.stageInstances.delete(id)
      }
    }

    // Connect to output
    current.connect(this.masterGain)
    current.connect(this.analyser)
  }

  private syncOscillatorNode() {
    if (!this.ctx) return
    if (this.state.oscillator.running) {
      if (!this.oscillator) {
        this.oscillator = this.ctx.createOscillator()
        this.oscillator.start()
      }
      this.oscillator.type = this.state.oscillator.type
      this.oscillator.frequency.value = this.state.oscillator.frequency
    } else {
      if (this.oscillator) {
        this.oscillator.stop()
        this.oscillator.disconnect()
        this.oscillator = null
      }
    }
  }

  private syncMicSource() {
    if (!this.ctx) return
    if (!this.state.mic.enabled) return
    if (this.micSource) return
    if (!this.micStream) return
    this.micSource = this.ctx.createMediaStreamSource(this.micStream)
  }

  private ensureStageInstance(stage: StageState): StageInstance {
    const existing = this.stageInstances.get(stage.id)
    if (existing) return existing

    const created = this.createStageInstance(stage)
    this.stageInstances.set(stage.id, created)
    return created
  }

  private createStageInstance(stage: StageState): StageInstance {
    if (!this.ctx) {
      throw new Error('AudioContext not initialized')
    }

    // Use type assertion through unknown to handle the discriminated union
    const definition = STAGE_REGISTRY[stage.kind]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return definition.createInstance(this.ctx, stage.params as any)
  }
}
