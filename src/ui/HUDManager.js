const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export class HUDManager {
  constructor() {
    this.el = {
      speedReadout: document.getElementById('speedReadout'),
      speedUnit: document.getElementById('speedUnit'),
      gearDisplay: document.getElementById('gearDisplay'),
      nitroFill: document.getElementById('nitroFill'),
      nitroPct: document.getElementById('nitroPct'),
      headlightIcon: document.getElementById('headlightIcon'),
      absLamp: document.getElementById('absLamp'),
      tcsLamp: document.getElementById('tcsLamp'),
      stmLamp: document.getElementById('stmLamp'),
      speedoCanvas: document.getElementById('speedoCanvas'),
      settingsBtn: document.getElementById('settingsBtn'),
      settingsPanel: document.getElementById('settingsPanel'),
      trafficDensity: document.getElementById('trafficDensity'),
      trafficVal: document.getElementById('trafficVal'),
      camDistance: document.getElementById('camDistance'),
      camDistVal: document.getElementById('camDistVal'),
      steerSensitivity: document.getElementById('steerSensitivity'),
      steerSensVal: document.getElementById('steerSensVal'),
      absOn: document.getElementById('absOn'),
      absOff: document.getElementById('absOff'),
      absState: document.getElementById('absState'),
      weatherSpring: document.getElementById('weatherSpring'),
      weatherSummer: document.getElementById('weatherSummer'),
      weatherAutumn: document.getElementById('weatherAutumn'),
      weatherRain: document.getElementById('weatherRain'),
      timeNight: document.getElementById('timeNight'),
      timeDay: document.getElementById('timeDay'),
      audioOn: document.getElementById('audioOn'),
      audioOff: document.getElementById('audioOff'),
      radioHud: document.getElementById('radioHud'),
      radioStation: document.getElementById('radioStation'),
      radioGenre: document.getElementById('radioGenre'),
      radioStationLabel: document.getElementById('radioStationLabel'),
      radioVolume: document.getElementById('radioVolume'),
      radioVolVal: document.getElementById('radioVolVal'),
      radioNext: document.getElementById('radioNext'),
      radioOn: document.getElementById('radioOn'),
      radioOff: document.getElementById('radioOff'),
      garageBtn: document.getElementById('garageBtn')
    }

    this.callbacks = {}
    this.settingsOpen = false

    /* ---- high-dpi tach canvas ---- */
    this.ctx = this.el.speedoCanvas.getContext('2d')
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.size = 350
    this.el.speedoCanvas.width = this.size * this.dpr
    this.el.speedoCanvas.height = this.size * this.dpr
    this.ctx.scale(this.dpr, this.dpr)

    this.startAngle = Math.PI * (140 / 180)
    this.endAngle = Math.PI * (400 / 180)
    this.sweep = this.endAngle - this.startAngle
    this.maxRpm = 9000
    this.redline = 8000

    this.needle = 0
    this._lastTime = performance.now()

    // the dial's static artwork (backing, track, redline, ticks) is rendered
    // once into offscreen layers; per frame only the progress arc and the
    // needle are drawn on top.  Rebuilding the gradients and ~50 ticks every
    // frame was the single biggest CPU cost of the HUD.
    this._layersValid = false
    this._bgLayer = document.createElement('canvas')
    this._fgLayer = document.createElement('canvas')
    this._bgLayer.width = this._fgLayer.width = this.size * this.dpr
    this._bgLayer.height = this._fgLayer.height = this.size * this.dpr
    this._bgCtx = this._bgLayer.getContext('2d')
    this._fgCtx = this._fgLayer.getContext('2d')
    this._bgCtx.scale(this.dpr, this.dpr)
    this._fgCtx.scale(this.dpr, this.dpr)

    // cache DOM state so unchanged readings are not written every frame
    this._lastSpeed = null
    this._lastGear = null
    this._lastNitroPct = null
    this._lastHeadlights = null
    this._lastAbs = null
    this._lastTcs = null
    this._lastStm = null

    this._bind()
    this._draw(0)
  }

  on(event, fn) { this.callbacks[event] = fn }

  _setGroupActive(group, activeId) {
    for (const [id, elem] of Object.entries(group)) {
      if (elem) elem.classList.toggle('active', id === activeId)
    }
  }

  weatherGroup() {
    return { spring: this.el.weatherSpring, summer: this.el.weatherSummer, autumn: this.el.weatherAutumn, rain: this.el.weatherRain }
  }
  timeGroup() { return { night: this.el.timeNight, day: this.el.timeDay } }
  audioGroup() { return { on: this.el.audioOn, off: this.el.audioOff } }
  radioGroup() { return { on: this.el.radioOn, off: this.el.radioOff } }

  /** Tune the tachometer to the selected machine. */
  setVehicle(spec) {
    this.redline = spec.physics.redline
    this.maxRpm = Math.ceil((spec.physics.redline + 500) / 1000) * 1000
    this._layersValid = false
    this._draw(this.needle)
  }

  updateRadio({ name, genre, title, enabled }) {
    if (name) {
      this.el.radioStation.textContent = name
      this.el.radioStationLabel.textContent = name
    }
    // mixtape stations report the playing track instead of a genre
    const sub = title && title !== 'LIVE MIX' ? title : genre
    if (sub) this.el.radioGenre.textContent = sub
    this.el.radioHud.classList.toggle('off', enabled === false)
  }

  _bind() {
    const el = this.el

    el.settingsBtn.addEventListener('click', () => {
      this.settingsOpen = !this.settingsOpen
      el.settingsPanel.classList.toggle('open', this.settingsOpen)
    })

    document.addEventListener('click', (e) => {
      if (!this.settingsOpen) return
      if (!el.settingsPanel.contains(e.target) && !el.settingsBtn.contains(e.target)) {
        this.settingsOpen = false
        el.settingsPanel.classList.remove('open')
      }
    })

    el.trafficDensity.addEventListener('input', (e) => {
      el.trafficVal.textContent = e.target.value
      this.callbacks.onTrafficDensity?.(Number(e.target.value))
    })

    el.camDistance.addEventListener('input', (e) => {
      el.camDistVal.textContent = Number(e.target.value).toFixed(1)
      this.callbacks.onCameraDistance?.(Number(e.target.value))
    })

    el.steerSensitivity.addEventListener('input', (e) => {
      el.steerSensVal.textContent = Number(e.target.value).toFixed(1)
      this.callbacks.onSteerSensitivity?.(Number(e.target.value))
    })

    el.absOn.addEventListener('click', () => {
      el.absOn.classList.add('active')
      el.absOff.classList.remove('active')
      el.absState.textContent = 'ON'
      this.callbacks.onABS?.(true)
    })
    el.absOff.addEventListener('click', () => {
      el.absOff.classList.add('active')
      el.absOn.classList.remove('active')
      el.absState.textContent = 'OFF'
      this.callbacks.onABS?.(false)
    })

    el.weatherSpring.addEventListener('click', () => {
      this._setGroupActive(this.weatherGroup(), 'spring'); this.callbacks.onWeather?.('spring')
    })
    el.weatherSummer.addEventListener('click', () => {
      this._setGroupActive(this.weatherGroup(), 'summer'); this.callbacks.onWeather?.('summer')
    })
    el.weatherAutumn.addEventListener('click', () => {
      this._setGroupActive(this.weatherGroup(), 'autumn'); this.callbacks.onWeather?.('autumn')
    })
    el.weatherRain.addEventListener('click', () => {
      this._setGroupActive(this.weatherGroup(), 'rain'); this.callbacks.onWeather?.('rain')
    })

    el.timeNight.addEventListener('click', () => {
      this._setGroupActive(this.timeGroup(), 'night'); this.callbacks.onTime?.(true)
    })
    el.timeDay.addEventListener('click', () => {
      this._setGroupActive(this.timeGroup(), 'day'); this.callbacks.onTime?.(false)
    })

    el.audioOn.addEventListener('click', () => {
      this._setGroupActive(this.audioGroup(), 'on'); this.callbacks.onAudio?.(true)
    })
    el.audioOff.addEventListener('click', () => {
      this._setGroupActive(this.audioGroup(), 'off'); this.callbacks.onAudio?.(false)
    })

    el.radioOn.addEventListener('click', () => {
      this._setGroupActive(this.radioGroup(), 'on'); this.callbacks.onRadio?.(true)
    })
    el.radioOff.addEventListener('click', () => {
      this._setGroupActive(this.radioGroup(), 'off'); this.callbacks.onRadio?.(false)
    })
    el.radioNext.addEventListener('click', () => this.callbacks.onRadioNext?.())
    el.radioVolume.addEventListener('input', (e) => {
      el.radioVolVal.textContent = e.target.value
      this.callbacks.onRadioVolume?.(Number(e.target.value) / 100)
    })
    el.garageBtn.addEventListener('click', () => this.callbacks.onGarage?.())
  }

  update(state) {
    const now = performance.now()
    const dt = Math.min(Math.max((now - this._lastTime) / 1000, 0), 0.06)
    this._lastTime = now

    const target = clamp(state.rpm / this.maxRpm, 0, 1)
    const response = target > this.needle ? 15 : 9
    this.needle += (target - this.needle) * Math.min(1, dt * response)
    this._draw(this.needle)

    const speed = Math.round(state.speedKmh)
    if (speed !== this._lastSpeed) {
      this.el.speedReadout.textContent = speed
      this._lastSpeed = speed
    }

    const gear = String(state.gear)
    if (gear !== this._lastGear) {
      this.el.gearDisplay.textContent = gear
      this._lastGear = gear
    }

    const pct = Math.round(state.nitro)
    if (pct !== this._lastNitroPct) {
      this.el.nitroFill.style.width = `${pct}%`
      this.el.nitroPct.textContent = `${pct}%`
      this._lastNitroPct = pct
    }

    const headlights = !!state.headlights
    if (headlights !== this._lastHeadlights) {
      this.el.headlightIcon.classList.toggle('active', headlights)
      this._lastHeadlights = headlights
    }

    const abs = !!state.abs
    if (abs !== this._lastAbs) {
      this.el.absLamp.classList.toggle('active', abs)
      this._lastAbs = abs
    }

    const tcs = !!state.tcs
    if (tcs !== this._lastTcs) {
      this.el.tcsLamp.classList.toggle('active', tcs)
      this._lastTcs = tcs
    }

    const stm = !!state.stm
    if (stm !== this._lastStm) {
      this.el.stmLamp.classList.toggle('active', stm)
      this._lastStm = stm
    }
  }

  _draw(needleFrac) {
    const ctx = this.ctx
    const W = this.size
    const cx = W / 2
    const cy = W * 0.53
    const R = W * 0.385
    const { startAngle, sweep } = this

    if (!this._layersValid) this._buildLayers()

    ctx.clearRect(0, 0, W, W)
    ctx.drawImage(this._bgLayer, 0, 0, W, W)

    /* ---- rpm progress ---- */
    if (needleFrac > 0.002) {
      ctx.beginPath()
      ctx.arc(cx, cy, R, startAngle, startAngle + needleFrac * sweep)
      ctx.strokeStyle = 'rgba(235,255,255,0.28)'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    ctx.drawImage(this._fgLayer, 0, 0, W, W)

    /* ---- needle ---- */
    const angle = startAngle + clamp(needleFrac, 0, 1) * sweep
    const tip = R - 26
    ctx.save()
    ctx.shadowColor = 'rgba(255,255,255,0.95)'
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(angle) * 20, cy - Math.sin(angle) * 20)
    ctx.lineTo(cx + Math.cos(angle) * tip, cy + Math.sin(angle) * tip)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx + Math.cos(angle) * tip, cy + Math.sin(angle) * tip, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    /* ---- center hub (mostly hidden behind the gear ring) ---- */
    ctx.beginPath()
    ctx.arc(cx, cy, 9, 0, Math.PI * 2)
    ctx.fillStyle = '#051015'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,229,255,0.85)'
    ctx.lineWidth = 2
    ctx.stroke()

    /* ---- small label ---- */
    ctx.fillStyle = 'rgba(160,215,230,0.55)'
    ctx.font = '700 9px "Segoe UI", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('RPM ×1000', cx, cy + R * 0.46)
  }

  /** Render the unchanging dial artwork into the two offscreen layers. */
  _buildLayers() {
    const W = this.size
    const cx = W / 2
    const cy = W * 0.53
    const R = W * 0.385
    const { startAngle, endAngle, sweep } = this

    const bg = this._bgCtx
    bg.clearRect(0, 0, W, W)

    /* ---- dark glass backing so the dial reads in daylight ---- */
    const disc = bg.createRadialGradient(cx, cy - 18, R * 0.15, cx, cy, R + 20)
    disc.addColorStop(0, 'rgba(3,9,13,0.62)')
    disc.addColorStop(0.72, 'rgba(3,9,13,0.44)')
    disc.addColorStop(1, 'rgba(3,9,13,0)')
    bg.beginPath()
    bg.arc(cx, cy, R + 20, 0, Math.PI * 2)
    bg.fillStyle = disc
    bg.fill()

    /* ---- soft outer halo ---- */
    const halo = bg.createRadialGradient(cx, cy, R * 0.5, cx, cy, R + 24)
    halo.addColorStop(0, 'rgba(0,229,255,0)')
    halo.addColorStop(0.72, 'rgba(0,229,255,0.045)')
    halo.addColorStop(1, 'rgba(0,229,255,0)')
    bg.beginPath()
    bg.arc(cx, cy, R + 24, 0, Math.PI * 2)
    bg.fillStyle = halo
    bg.fill()

    /* ---- dial track ---- */
    bg.beginPath()
    bg.arc(cx, cy, R, startAngle, endAngle)
    bg.strokeStyle = 'rgba(170,210,225,0.13)'
    bg.lineWidth = 10
    bg.lineCap = 'round'
    bg.stroke()

    const fg = this._fgCtx
    fg.clearRect(0, 0, W, W)

    /* ---- redline sector ---- */
    const redFrom = startAngle + (this.redline / this.maxRpm) * sweep
    fg.save()
    fg.beginPath()
    fg.arc(cx, cy, R, redFrom, endAngle)
    fg.strokeStyle = 'rgba(255,45,80,0.85)'
    fg.lineWidth = 10
    fg.lineCap = 'round'
    fg.shadowColor = 'rgba(255,45,80,0.9)'
    fg.shadowBlur = 14
    fg.stroke()
    fg.restore()

    /* ---- ticks and numbers ---- */
    // ticks are laid out by rpm value, not by equal spacing, so every number
    // lines up with the needle and the redline sector
    const tickStep = 200
    const tickCount = Math.floor(this.maxRpm / tickStep)
    // a 15000 rpm bike dial would crowd 16 numbers into one sweep, so only
    // every other thousand gets a label above 12000 rpm
    const labelStep = this.maxRpm >= 12000 ? 2000 : 1000
    fg.save()
    fg.shadowColor = 'rgba(0,0,0,0.9)'
    fg.shadowBlur = 4
    for (let i = 0; i <= tickCount; i++) {
      const rpmValue = i * tickStep
      const labeled = rpmValue % labelStep === 0
      const long = rpmValue % 1000 === 0
      const a = startAngle + (rpmValue / this.maxRpm) * sweep
      const hot = rpmValue >= this.redline
      const r0 = R - (labeled ? 22 : long ? 16 : 12)
      const r1 = R - 8

      fg.beginPath()
      fg.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      fg.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      fg.strokeStyle = hot
        ? (long ? 'rgba(255,120,145,0.95)' : 'rgba(255,90,120,0.6)')
        : (long ? 'rgba(240,255,255,0.9)' : 'rgba(180,215,225,0.4)')
      fg.lineWidth = long ? 2 : 1
      fg.stroke()

      if (labeled) {
        const lx = cx + Math.cos(a) * (R - 40)
        const ly = cy + Math.sin(a) * (R - 40)
        fg.fillStyle = hot ? 'rgba(255,130,150,0.95)' : 'rgba(235,250,255,0.88)'
        fg.font = '700 13px "Segoe UI", Arial, sans-serif'
        fg.textAlign = 'center'
        fg.textBaseline = 'middle'
        fg.fillText(String(rpmValue / 1000), lx, ly)
      }
    }
    fg.restore()

    this._layersValid = true
  }
}
