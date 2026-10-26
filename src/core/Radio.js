/**
 * In-game radio, Underground style.
 *
 * The four built-in stations are synthesised live with Web Audio, so the game
 * ships without licensed music.  If /audio/radio/manifest.json lists your own
 * tracks, an extra MIXTAPE station is added and plays those files instead.
 */

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

const STATIONS = [
  {
    id: 'subway', name: 'SUBWAY 88.3', genre: 'UNDERGROUND BREAKS', bpm: 92, root: 33,
    scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 5, 3, 4], swing: 0.07,
    kick: '1000000010100000', snare: '0000100000001000', hat: '1010101010101010',
    openHat: '0000000000000010',
    bass: [0, null, 0, 3, null, 0, 7, null, 5, null, 3, null, 0, null, 7, null],
    arp: [null, null, 0, null, 7, null, null, 10, null, 7, null, null, 12, null, 10, null],
    pad: true, stabs: null, leadWave: 'triangle', bassWave: 'sawtooth'
  },
  {
    id: 'neon', name: 'NEON 101.9', genre: 'SYNTHWAVE', bpm: 112, root: 30,
    scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 5, 3, 4], swing: 0,
    kick: '1000100010001000', snare: '0000100000001000', hat: '0010101000101010',
    openHat: null,
    bass: [0, 0, null, 0, 7, 7, null, 7, 5, 5, null, 5, 3, 3, null, 3],
    arp: [0, 7, 12, 7, 15, 12, 7, 12, 5, 12, 17, 12, 15, 12, 7, 12],
    pad: true, stabs: null, leadWave: 'square', bassWave: 'square'
  },
  {
    id: 'garage', name: 'GARAGE 92.1', genre: 'DEEP HOUSE', bpm: 124, root: 31,
    scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 5, 3, 4], swing: 0.02,
    kick: '1000100010001000', snare: '0000100000001000', hat: '0010001000100010',
    openHat: '0000000010000000',
    bass: [0, null, 0, 0, 7, null, 0, null, 5, null, 5, 3, 0, null, 7, null],
    arp: [null, null, 7, null, null, null, 12, null, null, null, 10, null, null, null, 7, null],
    pad: false, stabs: '0010000000100000', leadWave: 'triangle', bassWave: 'sawtooth'
  },
  {
    id: 'ridge', name: 'RIDGE 104.5', genre: 'DRUM & BASS', bpm: 172, root: 33,
    scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 3, 5, 4], swing: 0,
    kick: '1000000010000000', snare: '0000100000001000', hat: '1010101010101010',
    openHat: '0000000000000010',
    bass: [0, null, null, 7, null, 3, null, null, 0, null, 5, null, 7, null, 10, null],
    arp: [null, null, null, 0, null, 7, null, null, null, 12, null, null, 10, null, null, 15],
    pad: true, stabs: null, leadWave: 'sawtooth', bassWave: 'square'
  }
]

function makeNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function semitone(scale, degree) {
  const octave = Math.floor(degree / scale.length)
  const index = ((degree % scale.length) + scale.length) % scale.length
  return scale[index] + octave * 12
}

export class Radio {
  constructor() {
    this.stations = STATIONS.map((s) => ({ ...s }))
    this.index = 0
    this.enabled = true
    this.volume = 0.5
    this.ducked = false
    this.started = false
    this.playing = false
    this.step = 0
    this.nextStepTime = 0
    this.timer = null
    this.onChange = null
    this.audioEl = null
    this.localTrack = 0
    this._loadLocalTracks()
  }

  get station() { return this.stations[this.index] }

  start() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') this.ctx.resume()
      return
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = this.ctx = new Ctx()

      this.master = ctx.createGain()
      this.master.gain.value = this.enabled && !this.ducked ? this.volume * 0.34 : 0
      this.master.connect(ctx.destination)

      this.comp = ctx.createDynamicsCompressor()
      this.comp.threshold.value = -18
      this.comp.knee.value = 24
      this.comp.ratio.value = 4
      this.comp.attack.value = 0.005
      this.comp.release.value = 0.2
      this.comp.connect(this.master)

      this.bus = ctx.createGain()
      this.bus.gain.value = 0.9
      this.bus.connect(this.comp)

      this.noiseBuf = makeNoise(ctx, 2)

      // feedback delay for the lead lines / station space
      this.delay = ctx.createDelay(1.0)
      this.delayFb = ctx.createGain()
      this.delayFb.gain.value = 0.34
      this.delaySend = ctx.createGain()
      this.delaySend.gain.value = 0.5
      this.delayWet = ctx.createGain()
      this.delayWet.gain.value = 0.4
      this.delay.connect(this.delayFb)
      this.delayFb.connect(this.delay)
      this.delay.connect(this.delayWet)
      this.delayWet.connect(this.bus)
      this.delaySend.connect(this.delay)

      this.delay.delayTime.value = (60 / this.station.bpm) * 0.72

      this.started = true
      this.playing = true
      this.nextStepTime = ctx.currentTime + 0.08
      this.timer = setInterval(() => this._tick(), 25)
      if (this.station.files) this._playLocal()
      this._emit()
    } catch (e) {
      console.warn('[Radio] unavailable', e)
    }
  }

  /* ------------------------------------------------------------- controls */
  next() { this.setStation(this.index + 1) }
  prev() { this.setStation(this.index - 1) }

  setStation(i) {
    this.index = (i + this.stations.length) % this.stations.length
    this.step = 0
    this._stopLocal()

    if (this.ctx) {
      this.nextStepTime = this.ctx.currentTime + 0.06
      this.delay.delayTime.setTargetAtTime((60 / this.station.bpm) * 0.72, this.ctx.currentTime, 0.1)
    }
    if (this.station.files) this._playLocal()
    this._emit()
  }

  setEnabled(enabled) {
    this.enabled = !!enabled
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.enabled && !this.ducked ? this.volume * 0.34 : 0,
        this.ctx.currentTime, 0.05
      )
    }
    if (this.audioEl) {
      this.audioEl.volume = this.enabled && !this.ducked ? this.volume : 0
      if (!this.enabled) this.audioEl.pause()
      else this._playLocal()
    }
    this._emit()
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.enabled && !this.ducked ? this.volume * 0.34 : 0,
        this.ctx.currentTime, 0.05
      )
    }
    if (this.audioEl) this.audioEl.volume = this.enabled && !this.ducked ? this.volume : 0
  }

  /**
   * Temporarily quiet the radio without changing the player's on/off choice.
   * Used while the garage is open so the engine preview is not buried under
   * the music, then released when the run resumes.
   */
  duck(on) {
    this.ducked = !!on
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.enabled && !this.ducked ? this.volume * 0.34 : 0,
        this.ctx.currentTime, 0.12
      )
    }
    if (this.audioEl) this.audioEl.volume = this.enabled && !this.ducked ? this.volume : 0
  }

  _emit() {
    this.onChange?.({
      index: this.index,
      name: this.station.name,
      genre: this.station.genre,
      title: this.station.files ? this._localTitle() : 'LIVE MIX',
      enabled: this.enabled
    })
  }

  /* ---------------------------------------------------------- own tracks */
  async _loadLocalTracks() {
    try {
      const res = await fetch('/audio/radio/manifest.json', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const list = (data.tracks || []).filter(Boolean)
      if (!list.length) return

      this.localStation = {
        id: 'mixtape',
        name: data.name || 'MIXTAPE 107.7',
        genre: 'LOCAL TRACKS',
        files: list.map((t) => (typeof t === 'string' ? t : t.file)),
        titles: list.map((t) => (typeof t === 'string' ? t.split('/').pop() : (t.title || t.file))),
        bpm: 120, root: 33, scale: [0, 2, 3, 5, 7, 8, 10],
        progression: [0, 5, 3, 4], kick: '0000', snare: '0000', hat: '0000',
        bass: [], arp: [], pad: false, stabs: null, swing: 0
      }
      this.stations.push(this.localStation)
      this._emit()
    } catch {
      /* no manifest is fine: the built-in stations still play */
    }
  }

  _localTitle() {
    if (!this.localStation?.titles?.length) return 'MIXTAPE'
    return this.localStation.titles[this.localTrack % this.localStation.titles.length]
  }

  _playLocal() {
    // before the run starts there is no radio at all — the garage only plays
    // the engine preview, so a station switch must not start a track there
    if (!this.started) return
    const s = this.station
    if (!s?.files || !s.files.length || !this.enabled) return
    if (!this.audioEl) {
      this.audioEl = new Audio()
      this.audioEl.addEventListener('ended', () => {
        if (this.station.files) {
          this.localTrack++
          this._playLocal()
        }
      })
    }
    const file = s.files[this.localTrack % s.files.length]
    if (this.audioEl.src !== new URL(file, location.href).href) this.audioEl.src = file
    this.audioEl.volume = this.enabled && !this.ducked ? this.volume : 0
    this.audioEl.play().catch(() => {})
    this._emit()
  }

  _stopLocal() {
    if (this.audioEl) this.audioEl.pause()
  }

  /* ------------------------------------------------------------ scheduler */
  _tick() {
    if (!this.ctx || !this.playing || this.station.files) return
    const lookahead = this.ctx.currentTime + 0.12
    // a backgrounded tab can fall seconds behind; jump back to the present
    // instead of scheduling hundreds of missed steps in one go
    if (this.nextStepTime < this.ctx.currentTime - 0.5) {
      this.nextStepTime = this.ctx.currentTime + 0.05
    }
    while (this.nextStepTime < lookahead) {
      this._playStep(this.step, this.nextStepTime)
      this.step++
      this.nextStepTime += (60 / this.station.bpm) / 4
    }
  }

  _playStep(step, when) {
    const s = this.station
    const bar = Math.floor(step / 16)
    const i = step % 16
    const swing = i % 2 === 1 ? s.swing * (60 / s.bpm) : 0
    const t = when + swing

    const rootDeg = s.progression[bar % s.progression.length]
    const rootSemi = s.root + semitone(s.scale, rootDeg)

    if (s.kick[i] === '1') this._kick(t)
    if (s.snare[i] === '1') this._snare(t)
    if (s.hat[i] === '1') this._hat(t, 0.035, 0.13)
    if (s.openHat && s.openHat[i] === '1') this._hat(t, 0.16, 0.09)

    const bassDeg = s.bass[i]
    if (bassDeg !== null && bassDeg !== undefined) {
      this._bass(midiToFreq(rootSemi + semitone(s.scale, bassDeg)), t, (60 / s.bpm) * 0.3, s.bassWave)
    }

    const arpDeg = s.arp[i]
    if (arpDeg !== null && arpDeg !== undefined) {
      this._lead(midiToFreq(rootSemi + 24 + semitone(s.scale, arpDeg)), t, s.leadWave)
    }

    if (s.pad && i === 0) {
      const notes = [0, 2, 4].map((d) => midiToFreq(rootSemi + 12 + semitone(s.scale, d)))
      this._pad(notes, t, (60 / s.bpm) * 3.6)
    }

    if (s.stabs && s.stabs[i] === '1') {
      const notes = [0, 2, 4].map((d) => midiToFreq(rootSemi + 12 + semitone(s.scale, d)))
      this._stab(notes, t)
    }

    // tiny top-end sparkle every other bar keeps the loop from feeling static
    if (i === 15 && bar % 2 === 1) {
      this._noiseHit(t, 0.5, 'bandpass', 5200, 0.035, 2)
    }
  }

  /* ---------------------------------------------------------- instruments */
  _kick(t) {
    const c = this.ctx
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.11)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o.connect(g)
    g.connect(this.bus)
    o.start(t)
    o.stop(t + 0.32)
  }

  _snare(t) {
    this._noiseHit(t, 0.12, 'bandpass', 1750, 0.32, 0.8)
    const c = this.ctx
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(195, t)
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    o.connect(g)
    g.connect(this.bus)
    o.start(t)
    o.stop(t + 0.12)
  }

  _hat(t, dur, level) {
    this._noiseHit(t, dur, 'highpass', 7800, level, 0.6)
  }

  _noiseHit(t, dur, type, freq, level, q = 1) {
    const c = this.ctx
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.bus)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  _bass(freq, t, dur, wave = 'sawtooth') {
    const c = this.ctx
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.Q.value = 5
    f.frequency.setValueAtTime(1100, t)
    f.frequency.exponentialRampToValueAtTime(170, t + dur)

    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05)

    const o = c.createOscillator()
    o.type = wave
    o.frequency.value = freq
    o.connect(f)
    f.connect(g)
    g.connect(this.bus)
    o.start(t)
    o.stop(t + dur + 0.06)

    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = freq / 2
    const sg = c.createGain()
    sg.gain.setValueAtTime(0.0001, t)
    sg.gain.exponentialRampToValueAtTime(0.13, t + 0.01)
    sg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04)
    sub.connect(sg)
    sg.connect(this.bus)
    sub.start(t)
    sub.stop(t + dur + 0.06)
  }

  _lead(freq, t, wave = 'triangle') {
    const c = this.ctx
    const o = c.createOscillator()
    o.type = wave
    o.frequency.value = freq
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(4200, t)
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.22)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    o.connect(f)
    f.connect(g)
    g.connect(this.bus)
    g.connect(this.delaySend)
    o.start(t)
    o.stop(t + 0.26)
  }

  _pad(freqs, t, dur) {
    const c = this.ctx
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 1300
    f.Q.value = 0.7
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.045, t + 0.3)
    g.gain.linearRampToValueAtTime(0.03, t + dur * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    f.connect(g)
    g.connect(this.bus)
    for (const freq of freqs) {
      for (const detune of [-7, 7]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = freq
        o.detune.value = detune
        o.connect(f)
        o.start(t)
        o.stop(t + dur + 0.05)
      }
    }
  }

  _stab(freqs, t) {
    const c = this.ctx
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(3200, t)
    f.frequency.exponentialRampToValueAtTime(900, t + 0.2)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    f.connect(g)
    g.connect(this.bus)
    g.connect(this.delaySend)
    for (const freq of freqs) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = freq
      o.connect(f)
      o.start(t)
      o.stop(t + 0.24)
    }
  }
}
