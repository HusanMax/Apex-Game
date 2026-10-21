const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export class HUDManager {
  constructor() {
    this.el = {
      speedReadout: document.getElementById('speedReadout'),
      gearDisplay: document.getElementById('gearDisplay'),
      nitroFill: document.getElementById('nitroFill'),
      nitroPct: document.getElementById('nitroPct'),
      headlightIcon: document.getElementById('headlightIcon'),
      tachCanvas: document.getElementById('tachCanvas'),
      settingsBtn: document.getElementById('settingsBtn'),
      settingsPanel: document.getElementById('settingsPanel'),
      trafficDensity: document.getElementById('trafficDensity'),
      trafficVal: document.getElementById('trafficVal'),
      camDistance: document.getElementById('camDistance'),
      camDistVal: document.getElementById('camDistVal'),
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

    // hi-dpi tach canvas
    this.ctx = this.el.tachCanvas.getContext('2d')
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.size = 292
    this.el.tachCanvas.width = this.size * this.dpr
    this.el.tachCanvas.height = this.size * this.dpr
    this.ctx.scale(this.dpr, this.dpr)
    this._lastRpm = -1

    this._bind()
    this._drawTach(0)
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
    const kmh = Math.round(state.speedKmh)
    this.el.speedReadout.textContent = kmh
    this.el.gearDisplay.textContent = state.gear
    const pct = Math.round(state.nitro)
    this.el.nitroFill.style.width = `${pct}%`
    this.el.nitroPct.textContent = `${pct}%`
    this.el.headlightIcon.classList.toggle('active', state.headlights)

    const rpmRounded = Math.round(state.rpm / 25) * 25
    if (rpmRounded !== this._lastRpm) {
      this._lastRpm = rpmRounded
      this._drawTach(state.rpm)
    }
  }

  _drawTach(rpm) {
    const ctx = this.ctx
    const W = this.size
    const cx = W / 2
    const cy = W / 2
    const R = 116

    ctx.clearRect(0, 0, W, W)

    const start = Math.PI * 0.75
    const end = Math.PI * 2.25
    const sweep = end - start

    // outer glow ring
    ctx.beginPath()
    ctx.arc(cx, cy, R + 10, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(25,255,138,0.18)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // dial base
    ctx.beginPath()
    ctx.arc(cx, cy, R + 2, 0, Math.PI * 2)
    const bg = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, R + 10)
    bg.addColorStop(0, 'rgba(16,22,28,0.92)')
    bg.addColorStop(1, 'rgba(5,8,11,0.96)')
    ctx.fillStyle = bg
    ctx.fill()

    // arc track
    ctx.beginPath()
    ctx.arc(cx, cy, R, start, end)
    ctx.strokeStyle = 'rgba(120,170,150,0.16)'
    ctx.lineWidth = 9
    ctx.stroke()

    // redline zone
    ctx.beginPath()
    ctx.arc(cx, cy, R, start + (7 / 8) * sweep, end)
    ctx.strokeStyle = 'rgba(255,45,80,0.6)'
    ctx.lineWidth = 9
    ctx.stroke()

    // ticks + labels
    for (let i = 0; i <= 8; i++) {
      const a = start + (i / 8) * sweep
      const isMajor = true
      const r0 = R - (isMajor ? 16 : 10)
      const r1 = R - 4
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      ctx.strokeStyle = i >= 7 ? 'rgba(255,80,110,0.9)' : 'rgba(210,240,225,0.75)'
      ctx.lineWidth = 2
      ctx.stroke()

      // minor ticks
      for (let m = 1; m < 5; m++) {
        const am = a + (m / 5) * (sweep / 8)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(am) * (R - 9), cy + Math.sin(am) * (R - 4))
        ctx.lineTo(cx + Math.cos(am) * (R - 4), cy + Math.sin(am) * (R - 4))
        ctx.strokeStyle = 'rgba(160,200,185,0.35)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // labels
      const lx = cx + Math.cos(a) * (R - 30)
      const ly = cy + Math.sin(a) * (R - 30)
      ctx.fillStyle = i >= 7 ? 'rgba(255,120,140,0.9)' : 'rgba(200,230,215,0.75)'
      ctx.font = '600 11px "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i), lx, ly)
    }

    // needle
    const frac = clamp(rpm / 8000, 0, 1)
    const angle = start + frac * sweep
    const nx = cx + Math.cos(angle) * (R - 22)
    const ny = cy + Math.sin(angle) * (R - 22)

    ctx.save()
    ctx.shadowColor = 'rgba(25,255,138,0.9)'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(angle) * 14, cy - Math.sin(angle) * 14)
    ctx.lineTo(nx, ny)
    ctx.strokeStyle = frac > 0.87 ? '#ff3860' : '#19ff8a'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()

    // hub
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#0b1114'
    ctx.fill()
    ctx.strokeStyle = 'rgba(25,255,138,0.8)'
    ctx.lineWidth = 2
    ctx.stroke()

    // "RPM x1000" label
    ctx.fillStyle = 'rgba(140,180,165,0.6)'
    ctx.font = '600 8px "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('RPM x1000', cx, cy + 44)
  }
}
