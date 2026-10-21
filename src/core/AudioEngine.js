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
      this.master.gain.value = this.enabled ? 0.14 : 0
      this.master.connect(ctx.destination)

      this.comp = ctx.createDynamicsCompressor()
      this.comp.threshold.value = -18
      this.comp.knee.value = 24
      this.comp.ratio.value = 6
      this.comp.attack.value = 0.004
      this.comp.release.value = 0.2
      this.comp.connect(this.master)

      /* -------- synthesised fallback engine (used until samples load) -------- */
      this.shaper = ctx.createWaveShaper()
      this.shaper.curve = makeDistortionCurve(18)
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
      this.body.connect(this.comp)

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
      this.oscSub = mkOsc('sine', 0.55)
      this.oscSaw = mkOsc('sawtooth', 0.3, -7)
      this.oscSaw2 = mkOsc('sawtooth', 0.25, 9)

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

      /* ---------------- turbo ---------------- */
      this.turbo = ctx.createOscillator()
      this.turbo.type = 'triangle'
      this.turbo.frequency.value = 900
      this.turboGain = ctx.createGain()
      this.turboGain.gain.value = 0.0001
      this.turbo.connect(this.turboGain)
      this.turboGain.connect(this.comp)
      this.turbo.start()

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

  update(rpm, throttle, nitro, gear = null, speedKmh = 0, brake = 0, handbrake = 0) {
    if (!this.ctx || !this.started) return
    const t = this.ctx.currentTime
    const rpmFrac = Math.min(rpm / 7600, 1)
    const speedN = Math.min(speedKmh / 160, 1)
    const cycle = Math.max(4, rpm / 120)

    /* ---------------- engine ---------------- */
    if (this.engineSamples) {
      // real recorded V8 loops, pitch-locked to the firing frequency
      const key = rpm < 1500 ? 'idle' : rpm < 2800 ? 'mid' : 'high'
      const refs = { idle: 600, mid: 1950, high: 2355 }
      const level = 2.0 + throttle * 0.9 + (nitro ? 0.25 : 0) + speedN * 0.2

      for (const k of ['idle', 'mid', 'high']) {
        const node = this.engineSamples[k]
        const active = k === key
        node.gain.gain.setTargetAtTime(active ? level : 0.0001, t, 0.055)
        node.src.playbackRate.setTargetAtTime(clamp(rpm / refs[k], 0.3, 5.5), t, 0.05)
        node.filter.frequency.setTargetAtTime(3000 + rpm * 0.55 + (nitro ? 2200 : 0), t, 0.08)
      }
      // silence the synth engine
      this.engineGain.gain.setTargetAtTime(0.0001, t, 0.08)
      this.noiseGain.gain.setTargetAtTime(0.0001, t, 0.08)
    } else {
      this.oscSub.frequency.setTargetAtTime(cycle * 4, t, 0.03)
      this.oscSaw.frequency.setTargetAtTime(cycle, t, 0.03)
      this.oscSaw2.frequency.setTargetAtTime(cycle * 2, t, 0.03)

      const level = 0.02 + rpmFrac * 0.03 + throttle * 0.045 + (nitro ? 0.02 : 0)
      this.engineGain.gain.setTargetAtTime(Math.max(level, 0.0001), t, 0.06)

      const cutoff = 480 + rpm * 0.3 + throttle * 800 + (nitro ? 1200 : 0)
      this.filter.frequency.setTargetAtTime(cutoff, t, 0.07)
      this.filter.Q.setTargetAtTime(nitro ? 2.0 : 1.0, t, 0.1)
      this.body.frequency.setTargetAtTime(120 + rpm * 0.035, t, 0.1)

      this.noiseGain.gain.setTargetAtTime(0.006 + throttle * 0.018 + (nitro ? 0.015 : 0), t, 0.1)
      this.noiseFilter.frequency.setTargetAtTime(320 + rpm * 0.3 + (nitro ? 900 : 0), t, 0.08)
    }

    /* ---------------- turbo ---------------- */
    const spool = Math.min(1, rpm / 5500) * (0.35 + throttle * 0.65)
    this.turbo.frequency.setTargetAtTime(700 + spool * 2600, t, 0.06)
    this.turboGain.gain.setTargetAtTime(0.002 + spool * 0.02, t, 0.1)

    /* ---------------- brakes ---------------- */
    const braking = Math.min(1, brake)
    const brakeSpeed = Math.min(1, speedKmh / 120)

    if (this.brakeSample) {
      // real brake squeal, audible while the pedal is held
      const amt = braking * clamp(speedKmh / 45, 0, 1)
      this.brakeSample.gain.gain.setTargetAtTime(amt > 0.02 ? 1.1 + 0.7 * speedN : 0.0001, t, 0.04)
      this.brakeSample.src.playbackRate.setTargetAtTime(0.9 + speedN * 0.35, t, 0.1)
      this.brakeSample.filter.frequency.setTargetAtTime(6000 + speedN * 2500, t, 0.08)
    }

    this.brakeGain.gain.setTargetAtTime(0.0001 + braking * brakeSpeed * 0.07, t, 0.06)
    this.brakeFilter.frequency.setTargetAtTime(500 + brakeSpeed * 1100, t, 0.08)

    const hardBrake = braking > 0.5 && speedKmh > 25
    const sliding = handbrake > 0.5 && speedKmh > 12
    const screechAmt = (hardBrake || sliding) ? 0.06 * Math.min(1, speedKmh / 70) : 0
    this.screechGain.gain.setTargetAtTime(0.0001 + screechAmt, t, 0.05)
    this.screechFilter.frequency.setTargetAtTime(1500 + speedN * 600, t, 0.06)

    if (braking > 0.05 && this.lastBrake <= 0.05 && speedKmh > 3) this._brakeClunk()

    /* ---------------- shifts ---------------- */
    if (gear !== this.lastGear) {
      const numeric = typeof gear === 'number' && typeof this.lastGear === 'number'
      if (this.lastGear !== null && numeric && this.lastThrottle > 0.2) {
        this.playShift(gear > this.lastGear ? 1 : 0.6)
      }
      this.lastGear = gear
    }

    if (this.lastThrottle > 0.5 && throttle < 0.05 && this.lastRpm > 1600) {
      this._whoosh(0, 0.45, 2800, 420, 0.2)
    }

    this.lastThrottle = throttle
    this.lastRpm = rpm
    this.lastBrake = braking
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
    this._whoosh(0, 0.8 * intensity, 4200, 520, 0.16)
    this._whoosh(0.035, 0.62 * intensity, 3600, 400, 0.2)
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
    if (this.master) this.master.gain.value = enabled ? 0.14 : 0
  }
}
