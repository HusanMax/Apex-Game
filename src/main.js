import { Renderer } from './core/Renderer.js'
import { SceneEnvironment } from './core/SceneEnvironment.js'
import { AudioEngine } from './core/AudioEngine.js'
import { Radio } from './core/Radio.js'
import { PlayerVehicle } from './entities/PlayerVehicle.js'
import { TrafficSystem } from './entities/TrafficSystem.js'
import { VehicleController } from './physics/VehicleController.js'
import { HUDManager } from './ui/HUDManager.js'
import { Garage } from './ui/Garage.js'
import { VEHICLES, DEFAULT_VEHICLE_ID, getVehicle } from './data/vehicles.js'

const canvas = document.getElementById('canvas')

/* ---------- core ---------- */
const renderer = new Renderer({ canvas, width: window.innerWidth, height: window.innerHeight })
const environment = new SceneEnvironment(renderer.renderer)
renderer.setScene(environment.scene, environment.camera)

/* ---------- garage / machine ---------- */
let currentSpec = getVehicle(DEFAULT_VEHICLE_ID)

const vehicle = new PlayerVehicle(currentSpec)
environment.scene.add(vehicle.group)

let loadingHidden = false
const hideLoading = () => {
  if (loadingHidden) return
  loadingHidden = true
  const el = document.getElementById('loading')
  if (el) el.remove()
}
// CSS animation hides loading after 0.3s automatically.
// This JS call removes the element entirely after JS finishes booting.
setTimeout(hideLoading, 800)

const traffic = new TrafficSystem(environment.scene)
const physics = new VehicleController({ vehicle, environment, spec: currentSpec })

/* ---------- ui / audio ---------- */
const hud = new HUDManager()
const audio = new AudioEngine()
const radio = new Radio()

hud.setVehicle(currentSpec)
audio.setProfile({ ...currentSpec.sound, id: currentSpec.id })

hud.on('onTrafficDensity', (n) => traffic.setDensity(n))
hud.on('onCameraDistance', (d) => physics.setCameraDistance(d))
hud.on('onSteerSensitivity', (v) => physics.setSteerSensitivity(v))
hud.on('onABS', (on) => physics.setAbsEnabled(on))
hud.on('onWeather', (type) => environment.setWeather(type))
hud.on('onTime', (isNight) => {
  environment.setNight(isNight)
  vehicle.setDayMode(!isNight)
})
hud.on('onAudio', (enabled) => audio.setEnabled(enabled))
hud.on('onRadio', (enabled) => radio.setEnabled(enabled))
hud.on('onRadioNext', () => radio.next())
hud.on('onRadioVolume', (v) => radio.setVolume(v))
hud.on('onGarage', () => openGarage())

radio.onChange = (info) => hud.updateRadio(info)
hud.updateRadio({ name: radio.station.name, genre: radio.station.genre, enabled: radio.enabled })

const DEFAULT_TRAFFIC = Number(document.getElementById('trafficDensity').value) || 6
traffic.setDensity(DEFAULT_TRAFFIC)
physics.setSteerSensitivity(Number(document.getElementById('steerSensitivity').value) || 1.3)

let garageOpen = false
let hasStarted = false
let orbitAngle = 0
// short throttle blip when a machine is picked, so the garage previews its voice
let garageRevT = 0

/* ---------- machine switching ---------- */
function selectVehicle(spec) {
  currentSpec = spec
  vehicle.setVehicle(spec)
  physics.applyVehicle(spec, { keepPlace: garageOpen })
  hud.setVehicle(spec)
  audio.setProfile({ ...spec.sound, id: spec.id })
  garageRevT = 1.1
}

const garage = new Garage({
  vehicles: VEHICLES,
  selectedId: currentSpec.id,
  onPreview: (spec) => {
    if (spec.id !== currentSpec.id) selectVehicle(spec)
  },
  onStart: () => startDriving(),
  onOpen: () => {
    garageOpen = true
    orbitAngle = 0.7
    garageRevT = 1.1
    physics.setControlsEnabled(false)
    // park the machine so the garage previews it standing still instead of
    // the camera orbiting a car that is still sliding down the road
    physics.park()
    audio.resetTransients()
    // the garage is about the engine: duck the music so the selected machine's
    // voice is what the player hears while choosing
    radio.duck(true)
    physics.input.forward = false
    physics.input.backward = false
    physics.input.left = false
    physics.input.right = false
    physics.input.handbrake = false
  },
  onClose: () => {
    garageOpen = false
    physics.setControlsEnabled(true)
    radio.duck(false)
  }
})

function openGarage() {
  if (garageOpen) return
  // Garage.open() runs onOpen, which parks the machine, releases the keys and
  // starts the selection blip — the same path used on the very first screen
  garage.open()
}

function closeGarage() {
  if (!garageOpen) return
  garageOpen = false
  physics.setControlsEnabled(true)
  garage.close()
}

function startDriving() {
  const firstStart = !hasStarted
  closeGarage()
  hasStarted = true
  document.getElementById('garage').classList.add('started')
  // the first START drops the machine on the start line; re-opening the garage
  // mid-run and pressing START again continues from where it was parked
  if (firstStart) physics.reset()
  orbitAngle = 0
  audio.start()
  radio.start()
  // Now that the player has committed to this vehicle, stream the high-res GLB.
  // The procedural body stays visible until the download finishes, then swaps out.
  vehicle.loadModel()
}

/* garage is the first screen: choose a machine before the run */
garage.open()
physics.setControlsEnabled(false)

window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  if (e.code === 'KeyG') {
    if (garageOpen) {
      if (hasStarted) closeGarage()
    } else {
      openGarage()
    }
  } else if (e.code === 'Escape' && garageOpen && hasStarted) {
    closeGarage()
  } else if (e.code === 'KeyR') {
    radio.next()
  }
})

/* ---------- audio unlock ---------- */
const startAudio = () => {
  // the engine voice is unlocked here so the garage can blip the selected
  // machine; the radio only starts when the run does, so it never drowns out
  // the engine preview
  audio.start()
  // browsers only allow audio after a gesture: replay the garage blip now that
  // the context is live so the selected machine introduces itself properly
  if (garageOpen && garageRevT <= 0) garageRevT = 1.1
  window.removeEventListener('keydown', startAudio)
  window.removeEventListener('pointerdown', startAudio)
}
window.addEventListener('keydown', startAudio)
window.addEventListener('pointerdown', startAudio)

/* ---------- garage camera ---------- */
function updateGarageCamera(dt) {
  orbitAngle += dt * 0.24
  const bike = currentSpec.type === 'bike'
  const radius = bike ? 4.2 : 6.6
  const car = vehicle.position
  const camera = environment.camera

  camera.position.set(
    car.x + Math.sin(orbitAngle) * radius,
    (bike ? 1.35 : 1.85) + Math.sin(orbitAngle * 0.7) * 0.12,
    car.z + Math.cos(orbitAngle) * radius
  )
  camera.fov += (44 - camera.fov) * (1 - Math.exp(-4 * dt))
  camera.updateProjectionMatrix()
  camera.lookAt(car.x, bike ? 0.8 : 0.7, car.z)
  // push the machine into the free right-hand side of the screen
  camera.translateX(bike ? -1.15 : -2.15)
}

/* ---------- loop ---------- */
let last = performance.now()

function loop(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05)
  last = now

  if (garageOpen) {
    updateGarageCamera(dt)
    environment.updateWeather(dt, vehicle.position.z)
    renderer.setSpeedEffects(dt, { nitroActive: false, speedFactor: 0 })
    // blip the throttle after a selection so the machine introduces itself
    const idle = currentSpec.physics.idle
    const redline = currentSpec.physics.redline
    let rpm = idle
    let throttle = 0
    if (garageRevT > 0) {
      garageRevT = Math.max(0, garageRevT - dt)
      const rev = Math.sin(Math.min(1, 1 - garageRevT / 1.1) * Math.PI)
      rpm = idle + (redline * 0.55 - idle) * rev
      throttle = rev
    }
    audio.update(rpm, throttle, false, 1, 0, 0, 0, 0, 0)
  } else {
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
      physics.gear, // numeric ratio (not the HUD's N/R strings) so the shift clack is timed right
      state.speedKmh,
      physics.input.backward ? 1 : 0,
      physics.input.handbrake ? 1 : 0,
      state.slip,
      state.tireSlipRatio
    )
  }

  renderer.render()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

/* ---------- resize ---------- */
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
})
