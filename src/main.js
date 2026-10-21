import * as THREE from 'three'
import './style.css'
import './ui/weather.css'
import { createWorld, applyEnvironment } from './core/Scene.js'
import { Road } from './core/Road.js'
import { PlayerCar } from './entities/PlayerCar.js'
import { Traffic } from './entities/Traffic.js'
import { Spedometer } from './ui/Spedometer.js'
import { SettingsModal } from './ui/SettingsModal.js'
import { InputHandler } from './utils/InputHandler.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <canvas id="world"></canvas><div class="vignette"></div>
  <header class="topbar"><a class="wordmark" href="#"><span class="mark">A</span><span>APEX<span class="thin"> / DRIVE</span><small>OPEN ROAD SIMULATOR</small></span></a>
    <div class="session"><i></i> FREE DRIVE <span>•</span> ROUTE 01</div>
    <button id="settings-toggle" class="settings-button" aria-label="Open settings"><span>☷</span><b>SETTINGS</b></button>
  </header>
  <div class="scene-tag"><span class="tag-line"></span><span id="scene-name">SUMMER / DAY</span><small>ENDLESS HIGHWAY</small></div>
  <div class="road-stats"><span><i></i> ENGINE READY</span><span>ENVIRONMENT <b id="weather-label">CLEAR</b></span></div>
  <aside id="speedometer"></aside>
  <div class="controls-hint"><span>W</span><span>A</span><span>S</span><span>D</span><small>DRIVE</small><span class="key-boost">Q</span><small>BOOST</small><span class="key-light">E</span><small>LIGHTS</small></div>
  <div class="modal-backdrop" id="modal-backdrop" aria-hidden="true"><section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head"><div><span class="eyebrow">DRIVE CONFIGURATION</span><h2 id="modal-title">Your world,<br><em>your rules.</em></h2></div><button id="modal-close" class="close-button" aria-label="Close settings">×</button></div>
    <label class="setting-row"><span><b>Traffic density</b><small>Vehicles on the road</small></span><input data-setting="density" type="range" min="0.05" max="1" step="0.05" value="0.42"><output id="density-out">42%</output></label>
    <div class="setting-select"><span><b>Season</b><small>Set the atmosphere</small></span><select data-setting="season"><option>Summer</option><option>Autumn</option><option>Winter</option><option>Rainy</option></select></div>
    <div class="setting-select"><span><b>Time of day</b><small>Change the light</small></span><select data-setting="time"><option>Day</option><option>Sunset</option><option>Cyberpunk Night</option></select></div>
    <label class="setting-row"><span><b>Effects volume</b><small>Engine & ambience</small></span><input data-setting="volume" type="range" min="0" max="100" value="40"><output id="volume-out">40%</output></label>
    <div class="modal-foot"><span>SETTINGS APPLY IN REAL TIME</span><button id="modal-close-bottom" class="done-button">BACK TO DRIVE <span>↗</span></button></div>
  </section></div><div class="toast" id="toast">NITRO ENGAGED</div>
`
document.body.insertAdjacentHTML('beforeend', '<div class="rain-effect" aria-hidden="true"></div>')
const rainEffect = document.querySelector('.rain-effect')
const world = createWorld(document.querySelector('#world'))
const road = new Road(world.scene)
const car = new PlayerCar(world.scene)
const traffic = new Traffic(world.scene)
const input = new InputHandler()
const hud = new Spedometer(document.querySelector('#speedometer'))
const settings = { density: .42, season: 'Summer', time: 'Day', volume: 40 }
let speed = 0, nitro = 1, headlights = false, toastTimer = 0, last = performance.now()

const modal = new SettingsModal((next) => {
  Object.assign(settings, next)
  applyEnvironment(world, settings.season, settings.time)
  rainEffect.classList.toggle('active', settings.season === 'Rainy')
  document.querySelector('#scene-name').textContent = `${settings.season.toUpperCase()} / ${settings.time.toUpperCase()}`
  document.querySelector('#weather-label').textContent = settings.season === 'Rainy' ? 'RAIN' : settings.season === 'Winter' ? 'SNOW' : 'CLEAR'
})
document.querySelector('#modal-close-bottom').addEventListener('click', () => modal.close())
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyE' && !event.repeat) { headlights = !headlights; car.setHeadlights(headlights) }
  if (event.code === 'KeyQ' && !event.repeat && nitro > .08) { document.querySelector('#toast').classList.add('show'); toastTimer = 1.1 }
})
window.addEventListener('resize', () => world.resize())

const cameraTarget = new THREE.Vector3()
const cameraLook = new THREE.Vector3()
function animate(now) {
  requestAnimationFrame(animate)
  const dt = Math.min((now - last) / 1000, .04)
  last = now
  const boosting = input.boost && nitro > .02
  const targetSpeed = (input.throttle ? 48 : 0) - (input.brake ? 20 : 0)
  speed = THREE.MathUtils.damp(speed, targetSpeed * (boosting ? 1.48 : 1), input.brake ? 3 : 1.25, dt)
  speed = Math.max(-5, speed)
  nitro = THREE.MathUtils.clamp(nitro + (boosting ? -.22 : .055) * dt, 0, 1)
  car.update(dt, input, speed, boosting)
  road.update(dt, Math.max(0, speed))
  traffic.update(dt, Math.max(0, speed), settings.density)
  world.updateSnow(dt)
  world.camera.fov = THREE.MathUtils.damp(world.camera.fov, boosting ? 72 : 62, 3, dt)
  world.camera.updateProjectionMatrix()
  cameraTarget.set(car.root.position.x * .46, 5.4, 10.6)
  world.camera.position.lerp(cameraTarget, 1 - Math.exp(-2.6 * dt))
  cameraLook.set(car.root.position.x * .2, 1, -18)
  world.camera.lookAt(cameraLook)
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) document.querySelector('#toast').classList.remove('show')
  hud.update(Math.max(0, speed), nitro, headlights)
  world.renderer.render(world.scene, world.camera)
}
requestAnimationFrame(animate)
