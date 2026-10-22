import { Renderer } from './core/Renderer.js'
import { SceneEnvironment } from './core/SceneEnvironment.js'
import { AudioEngine } from './core/AudioEngine.js'
import { PlayerVehicle } from './entities/PlayerVehicle.js'
import { TrafficSystem } from './entities/TrafficSystem.js'
import { VehicleController } from './physics/VehicleController.js'
import { HUDManager } from './ui/HUDManager.js'

const canvas = document.getElementById('canvas')

/* ---------- core ---------- */
const renderer = new Renderer({ canvas, width: window.innerWidth, height: window.innerHeight })
const environment = new SceneEnvironment(renderer.renderer)
renderer.setScene(environment.scene, environment.camera)

/* ---------- entities ---------- */
const vehicle = new PlayerVehicle()
environment.scene.add(vehicle.group)

let loadingHidden = false
const hideLoading = () => {
  if (loadingHidden) return
  loadingHidden = true
  document.getElementById('loading')?.classList.add('hidden')
}
vehicle.loadModel('/models/chevrolet_cobalt_ltz.glb', hideLoading)
setTimeout(hideLoading, 10000)

const traffic = new TrafficSystem(environment.scene)
const physics = new VehicleController({ vehicle, environment })

/* ---------- ui / audio ---------- */
const hud = new HUDManager()
const audio = new AudioEngine()

hud.on('onTrafficDensity', (n) => traffic.setDensity(n))
hud.on('onCameraDistance', (d) => physics.setCameraDistance(d))
hud.on('onSteerSensitivity', (v) => physics.setSteerSensitivity(v))
hud.on('onWeather', (type) => environment.setWeather(type))
hud.on('onTime', (isNight) => {
  environment.setNight(isNight)
  vehicle.setDayMode(!isNight)
})
hud.on('onAudio', (enabled) => audio.setEnabled(enabled))

const DEFAULT_TRAFFIC = Number(document.getElementById('trafficDensity').value) || 6
traffic.setDensity(DEFAULT_TRAFFIC)
physics.setSteerSensitivity(Number(document.getElementById('steerSensitivity').value) || 1.3)

const startAudio = () => {
  audio.start()
  window.removeEventListener('keydown', startAudio)
  window.removeEventListener('pointerdown', startAudio)
}
window.addEventListener('keydown', startAudio)
window.addEventListener('pointerdown', startAudio)

/* ---------- loop ---------- */
let last = performance.now()

function loop(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05)
  last = now

  physics.update(dt, environment.camera)

  const collided = traffic.update(dt, vehicle.position.z, vehicle.position.x)
  if (collided) {
    physics.registerCollision()
    audio.collision()
  }

  environment.updateWeather(dt, vehicle.position.z)

  const state = physics.state
  renderer.setSpeedEffects(dt, state)
  hud.update(state)
  audio.update(
    state.rpm,
    physics.input.forward ? 1 : 0,
    state.nitroActive,
    state.gear,
    state.speedKmh,
    physics.input.backward ? 1 : 0,
    physics.input.handbrake ? 1 : 0,
    state.slip
  )

  renderer.render()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

/* ---------- resize ---------- */
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
})
