/**
 * Garage screen: pick a car or a motorcycle, see its numbers, then drive.
 * The garage does not build models itself — it reports the chosen spec and
 * main.js swaps the vehicle, physics and engine sound together.
 */
export class Garage {
  constructor({ vehicles, selectedId, onPreview, onStart, onOpen, onClose }) {
    this.vehicles = vehicles
    this.selectedId = selectedId
    this.filter = 'all'
    this.isOpen = true
    this.onPreview = onPreview
    this.onStart = onStart
    this.onOpen = onOpen
    this.onClose = onClose

    this.el = {
      root: document.getElementById('garage'),
      list: document.getElementById('garageList'),
      spec: document.getElementById('garageSpec'),
      start: document.getElementById('garageStart'),
      tabs: document.getElementById('garageTabs'),
      close: document.getElementById('garageClose')
    }

    this._bind()
    this.select(selectedId, false)
  }

  get selected() {
    return this.vehicles.find((v) => v.id === this.selectedId) || this.vehicles[0]
  }

  _filtered() {
    if (this.filter === 'all') return this.vehicles
    return this.vehicles.filter((v) => v.type === this.filter)
  }

  _bind() {
    const el = this.el

    el.list.addEventListener('click', (e) => {
      const card = e.target.closest('[data-id]')
      if (card) this.select(card.dataset.id)
    })

    el.tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-filter]')
      if (!tab) return
      this.filter = tab.dataset.filter
      for (const b of el.tabs.querySelectorAll('button')) {
        b.classList.toggle('active', b === tab)
      }
      this._renderList()
      const selected = this.selected
      if (this.filter !== 'all' && selected.type !== this.filter) {
        this.select(this._filtered()[0]?.id || selected.id)
      }
    })

    el.start.addEventListener('click', () => this._start())

    el.close?.addEventListener('click', () => this.close())

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault()
        const list = this._filtered()
        const current = list.findIndex((v) => v.id === this.selectedId)
        const dir = e.code === 'ArrowDown' ? 1 : -1
        const next = (current + dir + list.length) % list.length
        this.select(list[next].id)
      } else if (e.code === 'Enter') {
        e.preventDefault()
        this._start()
      }
    })
  }

  _start() {
    if (!this.isOpen) return
    this.onStart?.(this.selected)
  }

  select(id, preview = true) {
    const spec = this.vehicles.find((v) => v.id === id)
    if (!spec) return
    this.selectedId = id
    this._renderList()
    this._renderDetail(spec)
    if (preview) this.onPreview?.(spec)
  }

  _renderList() {
    const list = this._filtered()
    // re-rendering the list must not jump it back to the top while the player
    // is arrowing through a long roster
    const scroll = this.el.list.scrollTop
    this.el.list.innerHTML = list.map((v) => {
      const selected = v.id === this.selectedId
      return `
        <button class="veh-card${selected ? ' selected' : ''}${v.type === 'bike' ? ' bike' : ''}" data-id="${v.id}">
          <span class="veh-icon">${v.type === 'bike' ? bikeIcon : carIcon}</span>
          <span class="veh-main">
            <span class="veh-badge">${v.type === 'bike' ? 'MOTORCYCLE' : 'CAR'} · ${v.klass}</span>
            <span class="veh-name">${v.name}</span>
            <span class="veh-sub">${v.topSpeedKph} km/h · ${v.powerHp} hp · ${v.drivetrain}</span>
          </span>
          <span class="veh-speed">
            <b>${v.topSpeedKph}</b>
            <i>KM/H</i>
          </span>
        </button>
      `
    }).join('')
    this.el.list.scrollTop = scroll
    // keep the highlighted card in view without scrolling the page itself
    const card = this.el.list.querySelector('.veh-card.selected')
    if (card) {
      const box = this.el.list
      const cardBox = card.getBoundingClientRect()
      const listBox = box.getBoundingClientRect()
      if (cardBox.top < listBox.top) {
        box.scrollTop -= listBox.top - cardBox.top + 6
      } else if (cardBox.bottom > listBox.bottom) {
        box.scrollTop += cardBox.bottom - listBox.bottom + 6
      }
    }
  }

  _renderDetail(v) {
    const bar = (label, value, max, display) => `
      <div class="stat">
        <div class="stat-head"><span>${label}</span><b>${display}</b></div>
        <div class="stat-track"><i style="width:${Math.max(4, Math.min(100, (value / max) * 100))}%"></i></div>
      </div>`

    this.el.spec.innerHTML = `
      <div class="spec-head">
        <div class="spec-badge">${v.type === 'bike' ? 'MOTORCYCLE' : 'CAR'} · ${v.klass} · ${v.year}</div>
        <h2>${v.name}</h2>
        <p class="spec-tagline">${v.tagline}</p>
      </div>

      <div class="spec-grid">
        <div><span>DVIGATEL</span><b>${v.engine}</b></div>
        <div><span>YETAK</span><b>${v.drivetrain}</b></div>
        <div><span>UZATMA</span><b>${v.gearbox}</b></div>
        <div><span>VAZN</span><b>${v.weightKg} kg</b></div>
        <div><span>QUVVAT</span><b>${v.powerHp} hp</b></div>
        <div><span>MOMENT</span><b>${v.torqueNm} Nm</b></div>
      </div>

      <div class="spec-stats">
        ${bar('MAKSIMAL TEZLIK', v.topSpeedKph, 500, `${v.topSpeedKph} km/h`)}
        ${bar('0–100 KM/H', 12 - v.zeroToHundred, 9.5, `${v.zeroToHundred.toFixed(1)} s`)}
        ${bar('BOSHQARUV', v.stats.handling, 100, `${v.stats.handling}`)}
        ${bar('TORMOZ', v.stats.braking, 100, `${v.stats.braking}`)}
      </div>

      <div class="spec-sound">
        <span>OVOZ</span>
        <p>${v.soundFlavor}</p>
      </div>
    `
  }

  open() {
    this.isOpen = true
    this.el.root.classList.remove('hidden')
    document.body.classList.add('garage-open')
    this._renderList()
    this._renderDetail(this.selected)
    this.onOpen?.()
  }

  close() {
    this.isOpen = false
    this.el.root.classList.add('hidden')
    document.body.classList.remove('garage-open')
    this.onClose?.()
  }

  toggle() {
    if (this.isOpen) this.close()
    else this.open()
  }
}

const carIcon = `<svg viewBox="0 0 64 32" aria-hidden="true"><path d="M4 22h56M8 22l4-8 10-4h18l8 6 6 2v4M14 22a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm30 0a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const bikeIcon = `<svg viewBox="0 0 64 32" aria-hidden="true"><path d="M14 22a6 6 0 1 0 12 0 6 6 0 0 0-12 0Zm26 0a6 6 0 1 0 12 0 6 6 0 0 0-12 0ZM26 22l6-10h8m-6-4h8l6 14M16 22l8-8h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
