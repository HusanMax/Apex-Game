function makeDistortionCurve(k = 18) {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.enabled = true
    this.started = false
    this.lastGear = null
    this.lastThrottle = 0
    this.lastRpm = 0
    this.lastBrake = 0
    this.lastNitro = false
    this.engineSamples = null
    this.brakeSample = null
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = this.ctx = new Ctx()

      this.master = ctx.createGain()
      this.master.gain.value = this.enabled ? 0.16 : 0
      this.master.connect(ctx.destination)

      this.comp = ctx.createDynamicsCompressor()
      this.comp.threshold.value = -16
      this.comp.knee.value = 22
      this.comp.ratio.value = 7
      this.comp.attack.value = 0.003
      this.comp.release.value = 0.18
      this.comp.connect(this.master)

      /* -------- synthesised engine (always present, samples add texture) -------- */
      this.shaper = ctx.createWaveShaper()
      this.shaper.curve = makeDistortionCurve(22)
      this.shaper.oversample = '2x'

      this.drive = ctx.createGain()
      this.drive.gain.value = 0.3
      this.shaper.connect(this.drive)

      this.filter = ctx.createBiquadFilter()
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 900
      this.filter.Q.value = 0.9
      this.drive.connect(this.filter)

      this.body = ctx.createBiquadFilter()
      this.body.type = 'peaking'
      this.body.frequency.value = 170
      this.body.Q.value = 2.2
      this.body.gain.value = 7
      this.filter.connect(this.body)

      this.body2 = ctx.createBiquadFilter()
      this.body2.type = 'peaking'
      this.body2.frequency.value = 420
      this.body2.Q.value = 2.6
      this.body2.gain.value = 4
      this.body.connect(this.body2)
      this.body2.connect(this.comp)

      this.engineGain = ctx.createGain()
      this.engineGain.gain.value = 0.0001
      this.engineGain.connect(this.shaper)

      this.mod = ctx.createGain()
      this.mod.gain.value = 0.7
      this.mod.connect(this.engineGain)

      const mkOsc = (type, gain, detune = 0) => {
        const o = ctx.createOscillator()
        o.type = type
        o.detune.value = detune
        const g = ctx.createGain()
        g.gain.value = gain
        o.connect(g)
        g.connect(this.mod)
        o.start()
        return o
      }
      this.oscSub = mkOsc('sine', 0.6)
      this.oscSaw = mkOsc('sawtooth', 0.32, -7)
      this.oscSaw2 = mkOsc('sawtooth', 0.27, 9)
      this.oscHarm = mkOsc('square', 0.1, 4)

      // exhaust rasp
      this.noiseBuffer = this._makeNoise(2)
      this.noise = ctx.createBufferSource()
      this.noise.buffer = this.noiseBuffer
      this.noise.loop = true
      this.noiseFilter = ctx.createBiquadFilter()
      this.noiseFilter.type = 'bandpass'
      this.noiseFilter.frequency.value = 300
      this.noiseFilter.Q.value = 0.8
      this.noiseGain = ctx.createGain()
      this.noiseGain.gain.value = 0.0001
      this.noise.connect(this.noiseFilter)
      this.noiseFilter.connect(this.noiseGain)
      this.noiseGain.connect(this.shaper)
      this.noise.start()

      /* ---------------- turbo whistle ---------------- */
      this.turbo = ctx.createOscillator()
      this.turbo.type = 'triangle'
      this.turbo.frequency.value = 900
      this.turboGain = ctx.createGain()
      this.turboGain.gain.value = 0.0001
      this.turbo.connect(this.turboGain)
      this.turboGain.connect(this.comp)
      this.turbo.start()

      this.whistle = ctx.createOscillator()
      this.whistle.type = 'sine'
      this.whistle.frequency.value = 1600
      this.whistleGain = ctx.createGain()
      this.whistleGain.gain.value = 0.0001
      this.whistle.connect(this.whistleGain)
      this.whistleGain.connect(this.comp)
      this.whistle.start()

      /* ---------------- transmission whine ---------------- */
      this.whine = ctx.createOscillator()
      this.whine.type = 'sawtooth'
      this.whine.frequency.value = 300
      this.whineFilter = ctx.createBiquadFilter()
      this.whineFilter.type = 'bandpass'
      this.whineFilter.frequency.value = 900
      this.whineFilter.Q.value = 5
      this.whineGain = ctx.createGain()
      this.whineGain.gain.value = 0.0001
      this.whine.connect(this.whineFilter)
      this.whineFilter.connect(this.whineGain)
      this.whineGain.connect(this.comp)
      this.whine.start()

      /* ---------------- wind rush ---------------- */
      this.windSrc = ctx.createBufferSource()
      this.windSrc.buffer = this.noiseBuffer
      this.windSrc.loop = true
      this.windFilter = ctx.createBiquadFilter()
      this.windFilter.type = 'lowpass'
      this.windFilter.frequency.value = 500
      this.windGain = ctx.createGain()
      this.windGain.gain.value = 0.0001
      this.windSrc.connect(this.windFilter)
      this.windFilter.connect(this.windGain)
      this.windGain.connect(this.comp)
      this.windSrc.start()

      /* ---------------- nitro whoosh ---------------- */
      this.nitroSrc = ctx.createBufferSource()
      this.nitroSrc.buffer = this.noiseBuffer
      this.nitroSrc.loop = true
      this.nitroFilter = ctx.createBiquadFilter()
      this.nitroFilter.type = 'bandpass'
      this.nitroFilter.frequency.value = 1100
      this.nitroFilter.Q.value = 0.7
      this.nitroGain = ctx.createGain()
      this.nitroGain.gain.value = 0.0001
      this.nitroSrc.connect(this.nitroFilter)
      this.nitroFilter.connect(this.nitroGain)
      this.nitroGain.connect(this.comp)
      this.nitroSrc.start()

      /* ---------------- brakes (synth layers) ---------------- */
      this.brakeSrc = ctx.createBufferSource()
      this.brakeSrc.buffer = this.noiseBuffer
      this.brakeSrc.loop = true
      this.brakeFilter = ctx.createBiquadFilter()
      this.brakeFilter.type = 'bandpass'
      this.brakeFilter.frequency.value = 800
      this.brakeFilter.Q.value = 0.7
      this.brakeGain = ctx.createGain()
      this.brakeGain.gain.value = 0.0001
      this.brakeSrc.connect(this.brakeFilter)
      this.brakeFilter.connect(this.brakeGain)
      this.brakeGain.connect(this.comp)
      this.brakeSrc.start()

      this.screechSrc = ctx.createBufferSource()
      this.screechSrc.buffer = this.noiseBuffer
      this.screechSrc.loop = true
      this.screechFilter = ctx.createBiquadFilter()
      this.screechFilter.type = 'bandpass'
      this.screechFilter.frequency.value = 1800
      this.screechFilter.Q.value = 7
      this.screechGain = ctx.createGain()
      this.screechGain.gain.value = 0.0001
      this.screechSrc.connect(this.screechFilter)
      this.screechFilter.connect(this.screechGain)
      this.screechGain.connect(this.comp)
      this.screechSrc.start()

      this.started = true
      this._loadSamples()
    } catch (e) {
      console.warn('Audio unavailable', e)
    }
  }

  _makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  async _loadSamples() {
    const files = {
      idle: '/audio/engine_idle.mp3',
      mid: '/audio/engine_mid.mp3',
      high: '/audio/engine_high.mp3',
      brake: '/audio/brake_squeal.mp3'
    }
    const buffers = {}
    for (const [key, url] of Object.entries(files)) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const arr = await res.arrayBuffer()
        buffers[key] = await this.ctx.decodeAudioData(arr)
      } catch (e) {
        console.warn('[Audio] sample failed:', url, e)
      }
    }

    if (buffers.idle && buffers.mid && buffers.high) {
      this.engineSamples = {
        idle: this._makeLoop(buffers.idle, 60, 6000),
        mid: this._makeLoop(buffers.mid, 60, 7000),
        high: this._makeLoop(buffers.high, 60, 9000)
      }
    }
    if (buffers.brake) {
      this.brakeSample = this._makeLoop(buffers.brake, 700, 9000)
    }
  }

  _makeLoop(buffer, highpass, lowpass) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = highpass

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lowpass
    lp.Q.value = 0.5

    const gain = ctx.createGain()
    gain.gain.value = 0.0001

    src.connect(hp)
    hp.connect(lp)
    lp.connect(gain)
    gain.connect(this.comp)
    src.start()
    return { src, gain, filter: lp }
  }

  update(rpm, throttle, nitro, gear = null, speedKmh = 0, brake = 0, handbrake = 0, slip = 0, tireSlipRatio = 0) {
    if (!this.ctx || !this.started) return
    const t = this.ctx.currentTime
    const rpmFrac = clamp(rpm / 9000, 0, 1)
    const speedN = clamp(speedKmh / 420, 0, 1)
    const cycle = Math.max(4, rpm / 120)

    /* ---------------- engine ----------------
       Several detuned oscillators feed a distortion stage: this gives the
       hard, raspy NFS-Underground-style exhaust note.  When the recorded
       loops are available they are layered on top of the synth. */
    this.oscSub.frequency.setTargetAtTime(cycle * 4, t, 0.03)
    this.oscSaw.frequency.setTargetAtTime(cycle, t, 0.03)
    this.oscSaw2.frequency.setTargetAtTime(cycle * 2, t, 0.03)
    this.oscHarm.frequency.setTargetAtTime(cycle * 8, t, 0.03)

    const baseLevel = 0.022 + rpmFrac * 0.03 + throttle * 0.05 + (nitro ? 0.024 : 0)
    this.engineGain.gain.setTargetAtTime(
      Math.max(this.engineSamples ? baseLevel * 0.45 : baseLevel, 0.0001), t, 0.05
    )

    const cutoff = 480 + rpm * 0.32 + throttle * 900 + (nitro ? 1400 : 0)
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.06)
    this.filter.Q.setTargetAtTime(nitro ? 2.2 : 1.1, t, 0.1)
    this.body.frequency.setTargetAtTime(120 + rpm * 0.035, t, 0.1)
    this.body2.frequency.setTargetAtTime(380 + rpm * 0.05, t, 0.1)

    this.noiseGain.gain.setTargetAtTime(0.006 + throttle * 0.02 + (nitro ? 0.018 : 0), t, 0.1)
    this.noiseFilter.frequency.setTargetAtTime(320 + rpm * 0.3 + (nitro ? 1000 : 0), t, 0.08)

    if (this.engineSamples) {
      const key = rpm < 1500 ? 'idle' : rpm < 2800 ? 'mid' : 'high'
      const refs = { idle: 600, mid: 1950, high: 2355 }
      const level = 1.6 + throttle * 1.0 + (nitro ? 0.35 : 0) + speedN * 0.25

      for (const k of ['idle', 'mid', 'high']) {
        const node = this.engineSamples[k]
        const active = k === key
        node.gain.gain.setTargetAtTime(active ? level : 0.0001, t, 0.055)
        node.src.playbackRate.setTargetAtTime(clamp(rpm / refs[k], 0.3, 6.5), t, 0.05)
        node.filter.frequency.setTargetAtTime(3000 + rpm * 0.6 + (nitro ? 2600 : 0), t, 0.08)
      }
    }

    /* ---------------- turbo spool + whistle ---------------- */
    const spool = Math.min(1, rpm / 6200) * (0.3 + throttle * 0.7)
    this.turbo.frequency.setTargetAtTime(700 + spool * 3100, t, 0.06)
    this.turboGain.gain.setTargetAtTime(0.002 + spool * 0.022, t, 0.1)
    this.whistle.frequency.setTargetAtTime(1600 + spool * 4600, t, 0.05)
    this.whistleGain.gain.setTargetAtTime(0.0005 + spool * 0.009, t, 0.12)

    /* ---------------- transmission whine ---------------- */
    const whineFreq = 260 + Math.min(speedKmh, 420) * 5.4
    this.whine.frequency.setTargetAtTime(whineFreq, t, 0.05)
    this.whineFilter.frequency.setTargetAtTime(700 + speedKmh * 4.5, t, 0.08)
    this.whineGain.gain.setTargetAtTime(Math.pow(speedN, 0.7) * 0.012, t, 0.12)

    /* ---------------- wind ---------------- */
    this.windFilter.frequency.setTargetAtTime(380 + speedKmh * 4.5, t, 0.15)
    this.windGain.gain.setTargetAtTime(Math.pow(speedN, 2) * 0.055, t, 0.18)

    /* ---------------- nitro ---------------- */
    this.nitroFilter.frequency.setTargetAtTime(800 + speedKmh * 3.5, t, 0.12)
    this.nitroGain.gain.setTargetAtTime(nitro ? 0.045 : 0.0001, t, 0.1)
    if (nitro && !this.lastNitro) this._whoosh(0, 0.35, 500, 1800, 0.3)

    /* ---------------- brakes ---------------- */
    const braking = Math.min(1, brake)
    const brakeSpeed = Math.min(1, speedKmh / 120)

    if (this.brakeSample) {
      const amt = braking * clamp(speedKmh / 45, 0, 1)
      this.brakeSample.gain.gain.setTargetAtTime(amt > 0.02 ? 1.1 + 0.7 * speedN : 0.0001, t, 0.04)
      this.brakeSample.src.playbackRate.setTargetAtTime(0.9 + speedN * 0.35, t, 0.1)
      this.brakeSample.filter.frequency.setTargetAtTime(6000 + speedN * 2500, t, 0.08)
    }

    this.brakeGain.gain.setTargetAtTime(0.0001 + braking * brakeSpeed * 0.07, t, 0.06)
    this.brakeFilter.frequency.setTargetAtTime(500 + brakeSpeed * 1100, t, 0.08)

    const hardBrake = braking > 0.5 && speedKmh > 25
    const sliding = handbrake > 0.5 && speedKmh > 12
    const slipping = Math.max(Math.abs(slip), Math.abs(tireSlipRatio) * 0.85) > 0.16 && speedKmh > 25
    const screechAmt = (hardBrake || sliding || slipping)
      ? 0.06 * Math.min(1, speedKmh / 70) * (slipping ? 1.2 : 1)
      : 0
    this.screechGain.gain.setTargetAtTime(0.0001 + screechAmt, t, 0.05)
    this.screechFilter.frequency.setTargetAtTime(1500 + speedN * 900, t, 0.06)

    if (braking > 0.05 && this.lastBrake <= 0.05 && speedKmh > 3) this._brakeClunk()

    /* ---------------- gear shifts ---------------- */
    if (gear !== this.lastGear) {
      const numeric = typeof gear === 'number' && typeof this.lastGear === 'number'
      if (this.lastGear !== null && numeric && this.lastThrottle > 0.2) {
        this.playShift(gear > this.lastGear ? 1 : 0.7)
      }
      this.lastGear = gear
    }

    /* ---------------- lift-off: dump valve + exhaust pops ---------------- */
    if (this.lastThrottle > 0.5 && throttle < 0.05 && this.lastRpm > 1600) {
      this._whoosh(0, 0.4, 2800, 420, 0.2)
      if (this.lastRpm > 3800) {
        this._blowOff(0.35)
        if (Math.random() < 0.75) this._exhaustPops()
      }
    }

    this.lastThrottle = throttle
    this.lastRpm = rpm
    this.lastBrake = braking
    this.lastNitro = nitro
  }

  _brakeClunk() {
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.16)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g)
    g.connect(this.comp)
    o.start(t)
    o.stop(t + 0.2)
  }

  playShift(intensity = 1) {
    if (!this.ctx || !this.started) return
    // mechanical thunk + clutch clack
    this._clunk(0.55 * intensity)
    this._whoosh(0.01, 0.4 * intensity, 3600, 500, 0.14)
    // turbo dump valve right after the gear engages
    this._blowOff(0.55 * intensity, 0.02)
  }

  _clunk(volume = 0.5, delay = 0) {
    const ctx = this.ctx
    const t = ctx.currentTime + delay

    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(volume * 0.16, 0.0002), t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g)
    g.connect(this.comp)
    o.start(t)
    o.stop(t + 0.18)

    this._whoosh(delay, volume * 0.25, 2400, 700, 0.09)
  }

  _blowOff(volume = 0.5, delay = 0) {
    const ctx = this.ctx
    const t = ctx.currentTime + delay

    // airy "psssh"
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(1800, t)
    hp.frequency.exponentialRampToValueAtTime(500, t + 0.28)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(volume * 0.18, 0.0002), t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    src.connect(hp)
    hp.connect(g)
    g.connect(this.comp)
    src.start(t)
    src.stop(t + 0.36)

    // flutter chirp
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(2900, t)
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.14)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(Math.max(volume * 0.05, 0.0001), t + 0.01)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(og)
    og.connect(this.comp)
    o.start(t)
    o.stop(t + 0.18)
  }

  _exhaustPops() {
    const ctx = this.ctx
    const t0 = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const t = t0 + 0.03 + i * 0.055
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 180 + Math.random() * 260
      bp.Q.value = 1.6
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.06 + Math.random() * 0.04, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      src.connect(bp)
      bp.connect(g)
      g.connect(this.comp)
      src.start(t)
      src.stop(t + 0.08)
    }
  }

  collision(intensity = 1) {
    if (!this.ctx || !this.started) return
    this._clunk(1.1 * intensity)
    this._whoosh(0, 0.8 * intensity, 2800, 180, 0.3)
    this._whoosh(0.03, 0.5 * intensity, 900, 120, 0.22)
  }

  _whoosh(delay, volume, f0, f1, dur) {
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.4
    bp.frequency.setValueAtTime(f0, t)
    bp.frequency.exponentialRampToValueAtTime(Math.max(f1, 60), t + dur)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    src.connect(bp)
    bp.connect(g)
    g.connect(this.comp)
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (this.master) this.master.gain.value = enabled ? 0.16 : 0
  }
}
