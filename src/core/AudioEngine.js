import { renderEngineLoop, ENGINE_LOOP_REF_FRAC } from './EngineVoice.js'

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

/** Smooth 0..1 ramp between a and b (smoothstep), used to cross-fade loops. */
const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1)
  return k * k * (3 - 2 * k)
}

// Shared fallback loops. A machine can override these with its own recording
// via `sound.samples` in src/data/vehicles.js or via
// public/audio/engines/manifest.json, keyed by vehicle id.  A custom entry may
// supply either one continuous rev recording (`loop`) or the three fixed-band
// loops (`idle` / `mid` / `high`).
const SHARED_ENGINE_FILES = {
  idle: '/audio/engine_idle.mp3',
  mid: '/audio/engine_mid.mp3',
  high: '/audio/engine_high.mp3'
}

const DEFAULT_PROFILE = {
  cylinders: 4, firing: 2, redline: 8500, idle: 850,
  turbo: true, turboKind: 'turbo', rasp: 1, sub: 0.7, brightness: 1,
  lope: 0, useSamples: true, loudness: 1,
  // harmonic balance of the synthesised exhaust:
  // sub = crank-order thump, saw = fundamental, saw2 = octave, harm = upper buzz
  harmonics: { sub: 0.6, saw: 0.32, saw2: 0.27, harm: 0.1 },
  // level of the recorded loops under the synth (1 = full old loudness,
  // 0 = synth only); machines with custom recordings can sit at 1
  sampleLevel: 1,
  samplePitch: 1
}

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
    this.sampleSets = new Map()      // sample key -> loop nodes
    this.customSamples = new Map()   // vehicle id -> { loop | idle/mid/high }
    this.sampleKey = null            // key of the loops currently playing
    this.loadingSampleKeys = new Set()
    this.failedSampleKeys = new Set()
    this.engineManifest = null
    this.engineManifestPromise = null
    this.voiceProfiles = new Map()      // vehicle id -> its `sound` profile
    this.voiceSignatures = new Map()    // vehicle id -> profile fingerprint
    this._samplesMuted = false
    this.profile = { ...DEFAULT_PROFILE }
    this.redline = DEFAULT_PROFILE.redline
  }

  /** Forget the last frame's engine state (used when the garage opens or the
   *  machine changes) so no stale shift / lift-off sound fires on the switch. */
  resetTransients() {
    this.lastGear = null
    this.lastThrottle = 0
    this.lastRpm = 0
    this.lastBrake = 0
    this.lastNitro = false
  }

  /** Give each garage machine its own engine voice. */
  setProfile(profile) {
    this.profile = { ...DEFAULT_PROFILE, ...(profile || {}) }
    this.profile.harmonics = {
      ...DEFAULT_PROFILE.harmonics,
      ...(profile?.harmonics || {})
    }
    // remember any recording declared in src/data/vehicles.js under this id,
    // so the async loader never has to look at whichever profile is current
    if (profile?.id) {
      if (profile.samples) this.customSamples.set(profile.id, profile.samples)
      else this.customSamples.delete(profile.id)
      this._rememberVoice(profile)
    }
    this.redline = this.profile.redline || DEFAULT_PROFILE.redline
    this.resetTransients()
    // loading is fire-and-forget: the synth engine is already audible, so a
    // failed download must never surface as an unhandled promise rejection
    this._requestSamples().catch((e) => console.warn('[Audio] sample switch failed:', e))
  }

  /**
   * Remember the machine's voice so a loop can be rendered from it, and drop
   * the cached take when the profile actually changed.
   */
  _rememberVoice(profile) {
    const id = profile.id
    const sig = JSON.stringify([
      profile.firing, profile.redline, profile.rasp, profile.lope, profile.harmonics
    ])
    this.voiceProfiles.set(id, profile)
    if (this.voiceSignatures.get(id) === sig) return
    this.voiceSignatures.set(id, sig)
    // a re-tuned machine must not keep playing the take rendered from the old
    // profile; the next _requestSamples renders and swaps in a fresh one
    const cached = this.sampleSets?.get(id)
    if (cached?.generated) this.sampleSets.delete(id)
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

      // uneven-firing lope (V-twin potato, big-cube V8 burble)
      this.lopeOsc = ctx.createOscillator()
      this.lopeOsc.type = 'sine'
      this.lopeOsc.frequency.value = 6
      this.lopeDepth = ctx.createGain()
      this.lopeDepth.gain.value = 0
      this.lopeOsc.connect(this.lopeDepth)
      this.lopeDepth.connect(this.mod.gain)
      this.lopeOsc.start()

      const mkOsc = (type, gain, detune = 0) => {
        const o = ctx.createOscillator()
        o.type = type
        o.detune.value = detune
        const g = ctx.createGain()
        g.gain.value = gain
        o.connect(g)
        g.connect(this.mod)
        o.start()
        return { osc: o, gain: g }
      }
      const sub = mkOsc('sine', 0.6)
      const saw = mkOsc('sawtooth', 0.32, -7)
      const saw2 = mkOsc('sawtooth', 0.27, 9)
      const harm = mkOsc('square', 0.1, 4)
      this.oscSub = sub.osc
      this.oscSaw = saw.osc
      this.oscSaw2 = saw2.osc
      this.oscHarm = harm.osc
      // live harmonic mix, re-balanced by the selected machine's profile
      this.oscGains = { sub: sub.gain, saw: saw.gain, saw2: saw2.gain, harm: harm.gain }

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
      this._loadSamples().catch((e) => console.warn('[Audio] sample load failed:', e))
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
    if (!this.sampleSets) this.sampleSets = new Map()

    // brake squeal is shared by every machine
    try {
      const res = await fetch('/audio/brake_squeal.mp3')
      if (res.ok) {
        const arr = await res.arrayBuffer()
        this.brakeSample = this._makeLoop(await this.ctx.decodeAudioData(arr), 700, 9000)
      }
    } catch (e) {
      console.warn('[Audio] brake sample failed:', e)
    }

    await this._loadEngineManifest()
    await this._requestSamples()
  }

  /**
   * Optional per-machine recordings. Drop files into public/audio/engines and
   * list them by vehicle id:
   *   { "hellcat": { "idle": "/audio/engines/hellcat_idle.mp3", ... } }
   * A machine without a recording is not left on the shared loops: a loop is
   * rendered from its own voice profile (see EngineVoice.js), so every machine
   * still gets a take of its own.
   */
  _loadEngineManifest() {
    // one shared promise: a machine may be selected while the manifest is still
    // in flight, and without this the loader would pick the shared loops for a
    // machine that actually has its own recording
    if (!this.engineManifestPromise) {
      this.engineManifestPromise = fetch('/audio/engines/manifest.json', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((data) => {
          this.engineManifest = data
          return data
        })
    }
    return this.engineManifestPromise
  }

  /** The machine's own recording, if one is wired up (manifest or spec). */
  _recordingFor(id) {
    // manifest keys starting with "_" are comments, not machines
    if (!id || id[0] === '_') return null
    return this.engineManifest?.[id] || this.customSamples.get(id) || null
  }

  /** A machine with its own recording always uses it, even if the synth-only
   *  profile normally disables samples (V12, sportbike, V-twin). */
  _hasCustomSamples(id) {
    return !!this._recordingFor(id)
  }

  /**
   * Every machine plays its own set: its real recording when one exists,
   * otherwise the shared loops pitch-shifted per machine.  Rendered loops
   * deferred to a future version with Web Workers.
   */
  _sampleKey() {
    const id = this.profile?.id
    if (!id) return 'shared'
    return this._hasCustomSamples(id) ? id : 'shared'
  }

  async _requestSamples() {
    if (!this.ctx || !this.started) return
    if (!this.sampleSets) this.sampleSets = new Map()

    // the manifest decides whether this machine has its own recording, so it
    // must be here before choosing between the custom set and the shared loops
    await this._loadEngineManifest()

    // the player can pick another machine while a fetch is in flight, so keep
    // resolving whichever machine is selected *now* until it has its loops
    for (let guard = 0; guard < 4; guard++) {
      // every machine now gets a take: its own recording, or one rendered from
      // its voice profile.  Only a machine with neither falls back to nothing.
      const id = this.profile?.id
      const wantsSamples = this._hasCustomSamples(id) || this.voiceProfiles.has(id)
      if (!wantsSamples) return

      const key = this._sampleKey()
      if (this.sampleSets.has(key)) {
        this._useSampleSet(key)
        return
      }
      // never retry a key that already failed (a bad manifest path would
      // otherwise refetch on every garage selection), and let an in-flight
      // request for this same key finish and switch the loops itself
      if (this.failedSampleKeys.has(key) || this.loadingSampleKeys.has(key)) return
      this.loadingSampleKeys.add(key)

      let set = null
      try {
        set = await this._loadEngineSet(key)
      } finally {
        this.loadingSampleKeys.delete(key)
      }
      if (set) {
        this.sampleSets.set(key, set)
        // every machine renders its own take, so the cache must stay bounded:
        // drop the oldest entry that is not the one playing right now
        if (this.sampleSets.size > 12) {
          for (const k of this.sampleSets.keys()) {
            if (k !== this._sampleKey() && k !== this.sampleKey) {
              // an evicted set is never switched back to, so stop its sources
              // instead of leaving silent loops running for the whole session
              const evicted = this.sampleSets.get(k)
              this._fadeSampleSet(evicted, 0.05)
              const stop = setTimeout(() => this._stopSampleSet(evicted), 400)
              if (stop?.unref) stop.unref()
              this.sampleSets.delete(k)
              break
            }
          }
        }
      } else {
        this.failedSampleKeys.add(key)
      }

      // the machine changed while this fetch ran: loop round and fetch the
      // new machine's loops instead of leaving it on the synth alone
      if (this._sampleKey() !== key) continue
      if (set) this._useSampleSet(key)
      return
    }
  }

  async _loadEngineSet(key) {
    // 1. a real recording, if this machine has one
    const recording = this._recordingFor(key)
    if (recording) {
      const files = typeof recording === 'string' ? { loop: recording } : recording
      const set = await this._decodeEngineFiles(files)
      if (set) {
        // a real recording already carries its own note: play it at native pitch
        set.custom = true
        return set
      }
      console.warn('[Audio] engine recording unusable for', key, '— using shared loops')
    }

    // 2. fallback to shared loops for all machines without a real recording.
    // Loop rendering is deferred to a future version with Web Workers.
    if (key !== 'shared') {
      const shared = await this._decodeEngineFiles(SHARED_ENGINE_FILES)
      if (shared) {
        shared.custom = false
        this.sampleSets.set('shared', shared)
      }
      return shared
    }
    return null
  }

  async _decodeEngineFiles(files) {
    // a single continuous rev recording is the best case: one source whose
    // playback rate follows the engine, so there are no loop-band seams
    if (files.loop) {
      try {
        const res = await fetch(files.loop)
        if (res.ok) {
          const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer())
          return { loop: this._makeLoop(buffer, 60, 12000), mode: 'loop' }
        }
      } catch (e) {
        console.warn('[Audio] engine loop failed:', files.loop, e)
      }
    }

    const buffers = {}
    for (const k of ['idle', 'mid', 'high']) {
      if (!files[k]) continue
      try {
        const res = await fetch(files[k])
        if (!res.ok) continue
        buffers[k] = await this.ctx.decodeAudioData(await res.arrayBuffer())
      } catch (e) {
        console.warn('[Audio] engine sample failed:', files[k], e)
      }
    }
    if (!(buffers.idle && buffers.mid && buffers.high)) return null
    return {
      idle: this._makeLoop(buffers.idle, 60, 6000),
      mid: this._makeLoop(buffers.mid, 60, 7000),
      high: this._makeLoop(buffers.high, 60, 9000),
      mode: 'bands'
    }
  }

  _useSampleSet(key) {
    const set = this.sampleSets.get(key)
    if (!set) return
    this.sampleKey = key
    if (this.engineSamples === set) {
      // the same loops are already wired up; just make sure a previous
      // synth-only machine has not left them faded out
      this._samplesMuted = false
      return
    }
    // fade out whichever machine was playing before (the loops stay running
    // silently so switching back is instant and click-free)
    if (this.engineSamples) this._fadeSampleSet(this.engineSamples, 0.06)
    this.engineSamples = set
    this._samplesMuted = false
  }

  _fadeSampleSet(set, tau) {
    const t = this.ctx.currentTime
    for (const node of Object.values(set || {})) {
      if (node && node.gain) node.gain.gain.setTargetAtTime(0.0001, t, tau)
    }
  }

  /** Stop every source in a set that is no longer reachable. */
  _stopSampleSet(set) {
    for (const node of Object.values(set || {})) {
      if (!node || !node.src) continue
      try {
        node.src.stop()
      } catch {
        // already stopped: nothing to do
      }
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
    // recordings arrive at wildly different levels; normalise each one so a
    // dropped-in mp3 never clips or disappears under the synthesised engine
    return { src, gain, filter: lp, norm: this._normFor(buffer) }
  }

  _normFor(buffer) {
    let peak = 0
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < data.length; i += 8) {
        const v = Math.abs(data[i])
        if (v > peak) peak = v
      }
    }
    if (peak < 0.002) return 1
    // level every recording to roughly the same peak so a quiet phone take is
    // audible next to a loud studio sample without either one clipping the mix
    return clamp(0.6 / peak, 0.25, 2.0)
  }

  update(rpm, throttle, nitro, gear = null, speedKmh = 0, brake = 0, handbrake = 0, slip = 0, tireSlipRatio = 0) {
    if (!this.ctx || !this.started) return
    const t = this.ctx.currentTime
    const P = this.profile
    const rpmFrac = clamp(rpm / this.redline, 0, 1)
    const speedN = clamp(speedKmh / 420, 0, 1)
    // firing frequency of the engine in Hz: revs/second × power strokes per
    // revolution.  This is the note the exhaust actually plays, so a V12 at
    // 8000 rpm screams an octave above an I4 and a V-twin lopes far below.
    const cycle = Math.max(8, (rpm * P.firing) / 60)

    /* ---------------- engine ----------------
       Several detuned oscillators feed a distortion stage: this gives the
       hard, raspy NFS-Underground-style exhaust note.  When the recorded
       loops are available they are layered on top of the synth. */
    this.oscSub.frequency.setTargetAtTime(cycle * 0.5, t, 0.03)
    this.oscSaw.frequency.setTargetAtTime(cycle, t, 0.03)
    this.oscSaw2.frequency.setTargetAtTime(cycle * 2, t, 0.03)
    this.oscHarm.frequency.setTargetAtTime(cycle * 4, t, 0.03)

    // each engine family gets its own harmonic balance: a big-cube V8 is all
    // sub-bass, a V12 is bright upper harmonics, an I4 is mid-range rasp
    const H = P.harmonics
    this.oscGains.sub.gain.setTargetAtTime(H.sub, t, 0.08)
    this.oscGains.saw.gain.setTargetAtTime(H.saw, t, 0.08)
    this.oscGains.saw2.gain.setTargetAtTime(H.saw2, t, 0.08)
    this.oscGains.harm.gain.setTargetAtTime(H.harm, t, 0.08)

    // every machine has its own profile for the synth, but all share the
    // recorded loops (pitch-shifted per machine) until Web Workers enable
    // per-machine loop rendering without blocking the audio context
    const ownVoice = this._hasCustomSamples(P.id)
    const sampleLevel = ownVoice && !(P.sampleLevel > 0) ? 0.8 : P.sampleLevel
    // only the loops that belong to the machine in the garage may play; if its
    // take failed to load it runs on the synthesised engine alone
    const set = this.sampleSets.get(this._sampleKey()) || null
    const samplesOn = !!set && (ownVoice || (P.useSamples && P.sampleLevel > 0))
    const synthScale = samplesOn ? Math.max(0.4, 1 - sampleLevel * 0.55) : 1
    const baseLevel = (0.022 + rpmFrac * 0.03 + throttle * 0.05 + (nitro ? 0.024 : 0)) * P.loudness
    this.engineGain.gain.setTargetAtTime(Math.max(baseLevel * synthScale, 0.0001), t, 0.05)

    // V-twins wobble their intake note; the lope adds that uneven pulse.  The
    // rate is kept in the "burble" range (a few Hz) rather than following the
    // firing rate, otherwise a V8 at idle would flutter instead of throb.
    this.lopeOsc.frequency.setTargetAtTime(
      clamp(cycle * 0.16, 3, 16), t, 0.12
    )
    this.lopeDepth.gain.setTargetAtTime(P.lope * 0.3, t, 0.12)

    const cutoff = (480 + rpm * 0.32 + throttle * 900 + (nitro ? 1400 : 0)) * P.brightness
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.06)
    this.filter.Q.setTargetAtTime(nitro ? 2.2 : 1.1, t, 0.1)
    this.body.frequency.setTargetAtTime(120 + rpm * 0.035, t, 0.1)
    this.body.gain.setTargetAtTime(2 + 8 * P.sub, t, 0.12)
    this.body2.frequency.setTargetAtTime(380 + rpm * 0.05, t, 0.1)
    this.body2.gain.setTargetAtTime(1 + 5 * P.sub, t, 0.12)

    this.noiseGain.gain.setTargetAtTime(
      (0.006 + throttle * 0.02 + (nitro ? 0.018 : 0)) * P.rasp, t, 0.1
    )
    this.noiseFilter.frequency.setTargetAtTime(320 + rpm * 0.3 + (nitro ? 1000 : 0), t, 0.08)

    if (samplesOn) {
      this._samplesMuted = false
      // a machine's own recording already carries its real note, so it is not
      // transposed; the shared loops are re-pitched to each machine's redline
      const pitch = set.custom ? 1 : (this.redline / 8500) * P.samplePitch
      // the recorded layer is normalised to a common peak, then scaled into the
      // mix so a quiet phone recording and a loud studio take end up equal
      // a rendered take is the synth frozen at one rpm, so it only needs to add
      // texture under the live synth; a real recording carries the note itself
      // and can sit at full level.  For now all machines use shared loops.
      const levelScale = set.generated ? 0.45 : 1
      const level = (1.6 + throttle * 1.0 + (nitro ? 0.35 : 0) + speedN * 0.25) *
        sampleLevel * 0.85 * levelScale

      if (set.mode === 'loop') {
        // one continuous recording: playback speed follows the revs, so the
        // note climbs smoothly instead of switching between three loop bands.
        // `samplePitch` transposes the shared take per machine (a V8 sits well
        // below the recording's natural note, an I4 slightly above it).
        const node = set.loop
        // all machines use shared loops for now (no per-machine rendering)
        const rate = (0.55 + 0.95 * rpmFrac) * pitch
        node.gain.gain.setTargetAtTime(level * node.norm, t, 0.055)
        node.src.playbackRate.setTargetAtTime(clamp(rate, 0.2, 2.6), t, 0.045)
        node.filter.frequency.setTargetAtTime(3200 + rpm * 0.7 + (nitro ? 2800 : 0), t, 0.08)
      } else {
        // cross-fade the three recorded bands instead of hard-switching at a
        // threshold, so the note glides from idle through mid to the top end.
        // The thresholds scale with the machine's redline: the shared loops are
        // recorded for an 8500 rpm engine, so a 6200 rpm V8 must hand over to
        // the high band sooner than a 14000 rpm bike would.
        const bandScale = this.redline / 8500
        const wHigh = smoothstep(2400 * bandScale, 3300 * bandScale, rpm)
        const wIdle = 1 - smoothstep(1100 * bandScale, 1750 * bandScale, rpm)
        const wMid = Math.max(0, 1 - wHigh - wIdle)
        const weights = { idle: wIdle, mid: wMid, high: wHigh }
        const refs = { idle: 600, mid: 1950, high: 2355 }
        // a machine's own bands are already recorded at their real note, so
        // they only get a slight pitch rise with the revs; the shared bands
        // are matched to the engine speed so the note follows the tacho
        const bandRate = set.custom
          ? 0.85 + 0.4 * rpmFrac
          : null
        for (const k of ['idle', 'mid', 'high']) {
          const node = set[k]
          if (!node) continue
          node.gain.gain.setTargetAtTime(
            Math.max(weights[k] * level * node.norm, 0.0001), t, 0.05
          )
          // pitch < 1 transposes the loop down (V8 / V-twin), > 1 up (V12 / I4)
          const rate = bandRate ?? (rpm / refs[k]) * pitch
          node.src.playbackRate.setTargetAtTime(clamp(rate, 0.3, 6.5), t, 0.05)
          node.filter.frequency.setTargetAtTime(3000 + rpm * 0.6 + (nitro ? 2600 : 0), t, 0.08)
        }
      }
    } else if (this.engineSamples && !this._samplesMuted) {
      // switched to a machine that does not use the recorded loops: silence
      // them instead of leaving the previous car's engine playing (once per
      // switch — not every frame)
      this._fadeSampleSet(this.engineSamples, 0.08)
      this._samplesMuted = true
    }

    /* ---------------- turbo / blower ---------------- */
    if (P.turbo) {
      const blower = P.turboKind === 'blower'
      const spool = Math.min(1, rpm / (blower ? 4200 : 6200)) * (0.3 + throttle * 0.7)
      this.turbo.frequency.setTargetAtTime(700 + spool * (blower ? 1800 : 3100), t, 0.06)
      this.turboGain.gain.setTargetAtTime(0.002 + spool * (blower ? 0.03 : 0.022), t, 0.1)
      this.whistle.frequency.setTargetAtTime(1600 + spool * (blower ? 2600 : 4600), t, 0.05)
      this.whistleGain.gain.setTargetAtTime(0.0005 + spool * (blower ? 0.012 : 0.009), t, 0.12)
    } else {
      this.turboGain.gain.setTargetAtTime(0.0001, t, 0.15)
      this.whistleGain.gain.setTargetAtTime(0.0001, t, 0.15)
    }

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
        if (this.profile.turbo) this._blowOff(0.35)
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
    // turbo dump valve right after the gear engages (forced-induction only)
    if (this.profile.turbo) this._blowOff(0.55 * intensity, 0.02)
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
