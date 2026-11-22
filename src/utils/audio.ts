/**
 * Procedural Web Audio Engine for AETHER-HYD
 * Synthesizes ambient monsoon rainfall, sub-bass thunder on lightning strikes,
 * and crisp tactile telemetry clicks with zero external audio assets.
 */
class SoundEngine {
  private ctx: AudioContext | null = null
  private reactorOsc: OscillatorNode | null = null
  private reactorGain: GainNode | null = null
  private reactorStopTimer: number | null = null
  private rainSource: AudioBufferSourceNode | null = null
  private rainGain: GainNode | null = null
  private rainFilter: BiquadFilterNode | null = null
  private rumbleOsc: OscillatorNode | null = null
  private rumbleGain: GainNode | null = null
  private rainfall = 0
  private enabled = false

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public setEnabled(val: boolean) {
    this.enabled = val
    if (!val) {
      this.stopAll()
    } else {
      this.getContext()
      this.updateRainAmbience()
    }
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setRainfall(rainfall: number) {
    this.rainfall = Math.max(0, Math.min(120, rainfall))
    if (this.enabled) this.updateRainAmbience()
  }

  private updateRainAmbience() {
    const ctx = this.getContext()
    if (!ctx || !this.enabled) return

    if (!this.rainSource) {
      // Pink-ish noise buffer for realistic rain texture
      const length = ctx.sampleRate * 3
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const samples = buffer.getChannelData(0)
      let b0 = 0
      let b1 = 0
      let b2 = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.997 * b0 + white * 0.029
        b1 = 0.985 * b1 + white * 0.032
        b2 = 0.950 * b2 + white * 0.048
        samples[i] = (b0 + b1 + b2 + white * 0.12) * 1.4
      }

      this.rainSource = ctx.createBufferSource()
      this.rainSource.buffer = buffer
      this.rainSource.loop = true

      this.rainFilter = ctx.createBiquadFilter()
      this.rainFilter.type = 'bandpass'
      this.rainFilter.Q.value = 0.65

      this.rainGain = ctx.createGain()
      this.rainGain.gain.value = 0.0001

      this.rainSource.connect(this.rainFilter)
      this.rainFilter.connect(this.rainGain)
      this.rainGain.connect(ctx.destination)
      this.rainSource.start()

      // Subtle sub-bass atmospheric pressure drone
      this.rumbleOsc = ctx.createOscillator()
      this.rumbleGain = ctx.createGain()
      this.rumbleGain.gain.value = 0.0001
      const rumbleFilter = ctx.createBiquadFilter()
      rumbleFilter.type = 'lowpass'
      rumbleFilter.frequency.value = 78
      this.rumbleOsc.type = 'sine'
      this.rumbleOsc.frequency.value = 38
      this.rumbleOsc.connect(rumbleFilter)
      rumbleFilter.connect(this.rumbleGain)
      this.rumbleGain.connect(ctx.destination)
      this.rumbleOsc.start()
    }

    const intensity = this.rainfall / 120
    const now = ctx.currentTime
    // Keep very subtle ambient air floor even at 0 mm/hr when unmuted
    this.rainGain?.gain.setTargetAtTime(0.004 + intensity * 0.045, now, 0.3)
    this.rainFilter?.frequency.setTargetAtTime(340 + intensity * 920, now, 0.3)
    this.rumbleGain?.gain.setTargetAtTime(0.003 + intensity * 0.015, now, 0.45)
  }

  private stopAll() {
    this.stopReactorHum()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    this.rainGain?.gain.setTargetAtTime(0.0001, now, 0.04)
    this.rumbleGain?.gain.setTargetAtTime(0.0001, now, 0.04)
    const rainSource = this.rainSource
    const rainFilter = this.rainFilter
    const rainGain = this.rainGain
    const rumbleOsc = this.rumbleOsc
    const rumbleGain = this.rumbleGain
    this.rainSource = null
    this.rainFilter = null
    this.rainGain = null
    this.rumbleOsc = null
    this.rumbleGain = null

    window.setTimeout(() => {
      try {
        rainSource?.stop()
        rainSource?.disconnect()
        rainFilter?.disconnect()
        rainGain?.disconnect()
        rumbleOsc?.stop()
        rumbleOsc?.disconnect()
        rumbleGain?.disconnect()
      } catch {
        // Ignore already stopped nodes
      }
    }, 180)
  }

  /**
   * Distant sub-bass thunder roll synchronized to lightning illumination bursts
   */
  public playThunder(intensity = 0.7) {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const duration = 2.4
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const noise = ctx.createBufferSource()
      noise.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(160, now)
      filter.frequency.exponentialRampToValueAtTime(42, now + duration)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.09 * intensity, now + 0.14)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      noise.start(now)
      noise.stop(now + duration + 0.05)
    } catch {
      // Ignore audio errors
    }
  }

  public playClick(freq = 1100) {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, ctx.currentTime + 0.032)

      gain.gain.setValueAtTime(0.045, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.04)
    } catch {
      // Ignore
    }
  }

  public playSectorSwitch() {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(280, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.09)

      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.11)
    } catch {
      // Ignore
    }
  }

  public startReactorHum(intensity = 0.5) {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return
    if (this.reactorStopTimer !== null) {
      window.clearTimeout(this.reactorStopTimer)
      this.reactorStopTimer = null
    }

    try {
      if (!this.reactorOsc) {
        this.reactorOsc = ctx.createOscillator()
        this.reactorGain = ctx.createGain()

        this.reactorOsc.type = 'triangle'
        this.reactorOsc.frequency.setValueAtTime(52, ctx.currentTime)

        this.reactorGain.gain.setValueAtTime(0.005, ctx.currentTime)
        this.reactorGain.gain.linearRampToValueAtTime(0.035 * intensity, ctx.currentTime + 0.18)

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(180, ctx.currentTime)

        this.reactorOsc.connect(filter)
        filter.connect(this.reactorGain)
        this.reactorGain.connect(ctx.destination)

        this.reactorOsc.start()
      } else if (this.reactorGain && this.reactorOsc) {
        this.reactorOsc.frequency.linearRampToValueAtTime(48 + intensity * 48, ctx.currentTime + 0.1)
        this.reactorGain.gain.linearRampToValueAtTime(0.045 * intensity, ctx.currentTime + 0.1)
      }
    } catch {
      // Ignore
    }
  }

  public stopReactorHum() {
    if (this.reactorGain && this.reactorOsc && this.ctx) {
      try {
        this.reactorGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.14)
        const oscillator = this.reactorOsc
        const gain = this.reactorGain
        this.reactorStopTimer = window.setTimeout(() => {
          if (this.reactorOsc === oscillator) {
            try {
              oscillator.stop()
              oscillator.disconnect()
              gain.disconnect()
            } catch {
              // Ignore
            }
            this.reactorOsc = null
            this.reactorGain = null
          }
        }, 160)
      } catch {
        this.reactorOsc = null
        this.reactorGain = null
      }
    }
  }
}

export const soundEngine = new SoundEngine()
