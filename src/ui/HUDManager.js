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
      audioOff: document.getElementById('audioOff')
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
  }

  update(state) {
    const now = performance.now()
    const dt = Math.min(Math.max((now - this._lastTime) / 1000, 0), 0.06)
    this._lastTime = now

    const target = clamp(state.rpm / this.maxRpm, 0, 1)
    const response = target > this.needle ? 15 : 9
    this.needle += (target - this.needle) * Math.min(1, dt * response)
    this._draw(this.needle)

    this.el.speedReadout.textContent = Math.round(state.speedKmh)
    this.el.gearDisplay.textContent = String(state.gear)
    this.el.speedUnit.textContent = 'KM/H'

    const pct = Math.round(state.nitro)
    this.el.nitroFill.style.width = `${pct}%`
    this.el.nitroPct.textContent = `${pct}%`
    this.el.headlightIcon.classList.toggle('active', state.headlights)

    this.el.absLamp.classList.toggle('active', !!state.abs)
    this.el.tcsLamp.classList.toggle('active', !!state.tcs)
    this.el.stmLamp.classList.toggle('active', !!state.stm)
  }

  _draw(needleFrac) {
    const ctx = this.ctx
    const W = this.size
    const cx = W / 2
    const cy = W * 0.53
    const R = W * 0.385
    const { startAngle, endAngle, sweep } = this

    ctx.clearRect(0, 0, W, W)

    /* ---- dark glass backing so the dial reads in daylight ---- */
    const disc = ctx.createRadialGradient(cx, cy - 18, R * 0.15, cx, cy, R + 20)
    disc.addColorStop(0, 'rgba(3,9,13,0.62)')
    disc.addColorStop(0.72, 'rgba(3,9,13,0.44)')
    disc.addColorStop(1, 'rgba(3,9,13,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, R + 20, 0, Math.PI * 2)
    ctx.fillStyle = disc
    ctx.fill()

    /* ---- soft outer halo ---- */
    const halo = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R + 24)
    halo.addColorStop(0, 'rgba(0,229,255,0)')
    halo.addColorStop(0.72, 'rgba(0,229,255,0.045)')
    halo.addColorStop(1, 'rgba(0,229,255,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, R + 24, 0, Math.PI * 2)
    ctx.fillStyle = halo
    ctx.fill()

    /* ---- dial track ---- */
    ctx.beginPath()
    ctx.arc(cx, cy, R, startAngle, endAngle)
    ctx.strokeStyle = 'rgba(170,210,225,0.13)'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.stroke()

    /* ---- rpm progress ---- */
    if (needleFrac > 0.002) {
      ctx.beginPath()
      ctx.arc(cx, cy, R, startAngle, startAngle + needleFrac * sweep)
      ctx.strokeStyle = 'rgba(235,255,255,0.28)'
      ctx.lineWidth = 10
      ctx.stroke()
    }

    /* ---- redline 8-9 ---- */
    const redFrom = startAngle + (this.redline / this.maxRpm) * sweep
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, redFrom, endAngle)
    ctx.strokeStyle = 'rgba(255,45,80,0.85)'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(255,45,80,0.9)'
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.restore()

    /* ---- ticks and numbers 0..9 ---- */
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 4
    for (let i = 0; i <= 45; i++) {
      const major = i % 5 === 0
      const a = startAngle + (i / 45) * sweep
      const value = i / 5
      const hot = value >= this.redline / 1000
      const r0 = R - (major ? 22 : 12)
      const r1 = R - 8

      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      ctx.strokeStyle = hot
        ? (major ? 'rgba(255,120,145,0.95)' : 'rgba(255,90,120,0.6)')
        : (major ? 'rgba(240,255,255,0.9)' : 'rgba(180,215,225,0.4)')
      ctx.lineWidth = major ? 2 : 1
      ctx.stroke()

      if (major) {
        const lx = cx + Math.cos(a) * (R - 40)
        const ly = cy + Math.sin(a) * (R - 40)
        ctx.fillStyle = hot ? 'rgba(255,130,150,0.95)' : 'rgba(235,250,255,0.88)'
        ctx.font = '700 13px "Segoe UI", Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(value), lx, ly)
      }
    }
    ctx.restore()

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
}
