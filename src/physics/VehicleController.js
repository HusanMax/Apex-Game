import * as THREE from 'three'

const G = 9.81
const clamp = THREE.MathUtils.clamp

export class VehicleController {
  constructor({ vehicle, environment }) {
    this.vehicle = vehicle
    this.env = environment

    this.input = {
      forward: false, backward: false, left: false, right: false,
      handbrake: false, nitro: false, headlights: false
    }

    /* ---------------- vehicle parameters (metric) ---------------- */
    this.mass = 1400
    this.Iz = 2450
    this.wheelBase = 2.60
    this.a = 1.25            // CG -> front axle
    this.b = 1.35            // CG -> rear axle
    this.cgHeight = 0.42
    this.Cf = 110000
    this.Cr = 106000
    this.mu = 1.48
    this.wheelRadius = 0.38

    this.finalDrive = 3.60
    this.gearRatios = [3.30, 2.15, 1.55, 1.18, 0.95, 0.78, 0.63]
    this.redline = 8500
    this.idle = 850
    this.maxTorque = 640

    this.dragCd = 0.28
    this.area = 2.00
    this.rho = 1.20
    this.rollResist = 0.013
    this.brakeForce = 24000

    this.maxSteer = 0.62
    this.steerSpeed = 7.0
    this.steerSensitivity = 1.2

    /* ---------------- state ---------------- */
    this.X = 2                // start centred in the right-hand lane
    this.Z = 0
    this.psi = 0
    this.u = 0               // longitudinal velocity (m/s)
    this.v = 0               // lateral velocity (m/s)
    this.r = 0               // yaw rate (rad/s)
    this.steerAngle = 0
    this.gear = 1
    this.rpm = this.idle
    this.shiftTimer = 0
    this.throttle = 0
    this.brakeInput = 0

    this.nitro = 100
    this.nitroMax = 100
    this.nitroActive = false
    this.nitroConsume = 16
    this.nitroRegen = 10
    this.nitroCooldown = 0

    this.shiftPitch = 0
    this.slip = 0
    this.absActive = false
    this.tcsActive = false
    this.stmActive = false

    this.camVel = new THREE.Vector3()
    this.camYaw = 0
    this.camLook = new THREE.Vector3(0, 1.2, -12)
    this.camDistance = 4.5
    this.shake = 0
    this.longAccel = 0
    this.bodyRoll = 0
    this.bodyPitch = 0

    this._bindKeys()
  }

  /* ------------------------------------------------------------- input */
  _bindKeys() {
    const handler = (e) => {
      const down = e.type === 'keydown'
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.input.forward = down; break
        case 'KeyS': case 'ArrowDown': this.input.backward = down; break
        case 'KeyA': case 'ArrowLeft': this.input.left = down; break
        case 'KeyD': case 'ArrowRight': this.input.right = down; break
        case 'Space': this.input.handbrake = down; break
        case 'KeyQ':
          if (down && !e.repeat) this._toggleNitro()
          break
        case 'KeyE':
          if (down && !e.repeat) this.input.headlights = this.vehicle.toggleHeadlights()
          break
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', handler)
  }

  _toggleNitro() {
    if (this.nitroCooldown > 0 || this.nitro < 10) return
    this.nitroActive = !this.nitroActive
    this.vehicle.setNitroColor(this.nitroActive)
  }

  registerCollision() {
    this.u *= 0.45
    this.v *= 0.30
    this.r *= 0.4
    this.shake = 0.6
  }

  /* ------------------------------------------------------------- torque */
  _torqueCurve(x) {
    // normalized torque vs rpm fraction, peak ~0.55
    const peak = 0.55
    return clamp(1 - Math.pow((x - peak) / 0.62, 2) * 0.75, 0.22, 1)
  }

  _updateGearbox(dt) {
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt
      return
    }
    if (this.u < -0.5) return // reverse
    const gearRatio = this.gearRatios[this.gear - 1]
    const wheelRpm = (Math.abs(this.u) / this.wheelRadius) * gearRatio * this.finalDrive * 60 / (2 * Math.PI)
    if (wheelRpm > this.redline * 0.93 && this.gear < this.gearRatios.length) {
      this.gear++
      this.shiftTimer = 0.13
      this.shiftPitch = -0.018
      this.shake = Math.max(this.shake, 0.14)
    } else if (wheelRpm < 2100 && this.gear > 1) {
      this.gear--
      this.shiftTimer = 0.11
      this.shiftPitch = 0.014
      this.shake = Math.max(this.shake, 0.1)
    }
  }

  /* ------------------------------------------------------------- update */
  update(dt, camera) {
    dt = Math.min(Math.max(dt, 0), 0.033)

    this.throttle = this.input.forward ? 1 : 0
    this.brakeInput = this.input.backward ? 1 : 0

    const speed = Math.hypot(this.u, this.v)
    const speedFactor = clamp(speed / 70, 0, 1)

    /* ---- steering (grip-limited + speed sensitive spring) ---- */
    // convention: positive steer = left, positive v = left, positive r = left
    const steerTarget = (this.input.left ? 1 : 0) + (this.input.right ? -1 : 0)
    const gripSteer = Math.atan((this.mu * G * this.wheelBase) / Math.max(speed * speed, 4))
    let steerLimit = Math.min(this.maxSteer, gripSteer * 1.35)
    if (this.input.handbrake) steerLimit *= 1.5
    const desired = clamp(steerTarget * steerLimit * this.steerSensitivity, -this.maxSteer, this.maxSteer)
    const response = this.steerSpeed * (1 - speedFactor * 0.3)
    this.steerAngle += (desired - this.steerAngle) * Math.min(1, response * dt * 7)

    /* ---- gearbox & rpm ---- */
    this._updateGearbox(dt)
    const gearRatio = this.gearRatios[this.gear - 1]
    const wheelRpm = (Math.abs(this.u) / this.wheelRadius) * gearRatio * this.finalDrive * 60 / (2 * Math.PI)
    const engineTarget = Math.max(wheelRpm, this.idle + this.throttle * 1400)
    this.rpm += (Math.min(engineTarget, this.redline) - this.rpm) * Math.min(1, dt * 10)

    /* ---- longitudinal forces ---- */
    const tq = this._torqueCurve(this.rpm / this.redline) * this.maxTorque
    let driveForce = this.throttle * tq * gearRatio * this.finalDrive / this.wheelRadius * 0.85
    if (this.nitroActive) driveForce *= 2.5
    if (this.shiftTimer > 0) driveForce *= 0.12

    const Fdrag = -0.5 * this.rho * this.dragCd * this.area * this.u * Math.abs(this.u)
    const Froll = -this.rollResist * this.mass * G * Math.sign(this.u)

    let Fx = driveForce + Fdrag + Froll

    if (this.brakeInput > 0) {
      if (this.u > 0.5) {
        Fx -= this.brakeInput * this.brakeForce
      } else {
        // reverse gear
        Fx -= 8500
      }
    }
    if (this.input.handbrake) {
      Fx -= 6500 * Math.sign(this.u || 1)
    }

    const ax = Fx / this.mass
    this.longAccel = ax
    this.u += ax * dt
    this.u = clamp(this.u, -12, 117)

    /* ---- lateral tyre model (dynamic bicycle) ---- */
    const absU = Math.max(Math.abs(this.u), 1.5)
    const alphaF = this.steerAngle - Math.atan2(this.v + this.a * this.r, absU)
    const alphaR = -Math.atan2(this.v - this.b * this.r, absU)

    const FzF = Math.max(this.mass * G * this.b / this.wheelBase - this.mass * ax * this.cgHeight / this.wheelBase, this.mass * G * 0.2)
    const FzR = Math.max(this.mass * G * this.a / this.wheelBase + this.mass * ax * this.cgHeight / this.wheelBase, this.mass * G * 0.2)

    const muR = this.input.handbrake ? this.mu * 0.45 : this.mu
    const maxFyF = this.mu * FzF
    const maxFyR = muR * FzR

    // scale lateral grip by forward speed so the model stays stable at a standstill
    const lowSpeedGrip = clamp(Math.abs(this.u) / 3.0, 0, 1)
    const FyF = clamp(this.Cf * alphaF, -maxFyF, maxFyF) * lowSpeedGrip
    const FyR = clamp(this.Cr * alphaR, -maxFyR, maxFyR) * lowSpeedGrip

    const cosSteer = Math.cos(this.steerAngle)
    const vDot = (FyF * cosSteer + FyR) / this.mass - this.u * this.r
    const rDot = (this.a * FyF * cosSteer - this.b * FyR) / this.Iz

    this.v += vDot * dt
    this.r += rDot * dt

    // light base damping keeps the car eager to rotate while weaving
    this.v *= (1 - 0.42 * dt)
    this.r *= (1 - 0.55 * dt)

    // stability management: catch the body before it slides out of line.
    // disabled while the handbrake is pulled so drifting still works.
    this.slip = Math.atan2(this.v, Math.max(Math.abs(this.u), 1))
    this.stmActive = !this.input.handbrake && Math.abs(this.u) > 8 && Math.abs(this.slip) > 0.13
    if (this.stmActive) {
      const excess = Math.abs(this.slip) - 0.13
      this.v *= 1 - Math.min(2.4, excess * 6) * dt
      this.r *= 1 - Math.min(1.4, excess * 4) * dt
    }

    this.v = clamp(this.v, -16, 16)
    this.r = clamp(this.r, -2.2, 2.2)

    this.psi += this.r * dt

    /* ---- integrate world position ---- */
    this.X += (-this.u * Math.sin(this.psi) - this.v * Math.cos(this.psi)) * dt
    this.Z += (-this.u * Math.cos(this.psi) + this.v * Math.sin(this.psi)) * dt

    /* ---- road barrier ---- */
    if (Math.abs(this.X) > 7.2) {
      this.X = Math.sign(this.X) * 7.2
      this.u *= (1 - 2.0 * dt)
      this.v *= 0.7
      this.shake = Math.max(this.shake, 0.25)
    }

    /* ---- nitro resource ---- */
    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - this.nitroConsume * dt)
      if (this.nitro <= 0) {
        this.nitroActive = false
        this.vehicle.setNitroColor(false)
        this.nitroCooldown = 1.2
      }
    } else {
      if (this.nitroCooldown > 0) this.nitroCooldown = Math.max(0, this.nitroCooldown - dt)
      else this.nitro = Math.min(this.nitroMax, this.nitro + this.nitroRegen * dt)
    }

    /* ---- sync vehicle ---- */
    const speedKmh = Math.hypot(this.u, this.v) * 3.6
    this.vehicle.speedKmh = speedKmh
    this.vehicle.setPosition(this.X, 0, this.Z, this.psi)

    // driver aids (also reflected on the new HUD)
    this.absActive = this.brakeInput > 0.5 && speedKmh > 25
    this.tcsActive = this.throttle > 0.5 && this.gear <= 2 && speedKmh < 95

    // subtle body roll into corners + pitch under braking/acceleration
    const lateralAccel = this.u * this.r
    const rollScale = clamp(Math.abs(this.u) / 7, 0, 1)
    const targetRoll = clamp(-lateralAccel * 0.006, -0.04, 0.04) * rollScale
    this.shiftPitch *= Math.max(0, 1 - dt * 9)
    const targetPitch = clamp(this.longAccel * 0.0035 + this.shiftPitch, -0.05, 0.05)
    this.bodyRoll += (targetRoll - this.bodyRoll) * Math.min(1, dt * 7)
    this.bodyPitch += (targetPitch - this.bodyPitch) * Math.min(1, dt * 8)
    this.vehicle.setBodyAttitude(this.bodyRoll, this.bodyPitch)

    this.vehicle.update(dt, Math.abs(this.u))
    this.vehicle.setNitroColor(this.nitroActive)

    /* ---- environment ---- */
    this.env.updateRoad(this.Z)

    /* ---- camera ---- */
    this.shake = Math.max(0, this.shake - dt * 1.8)
    this._updateCamera(dt, camera, speedFactor)
  }

  setCameraDistance(v) {
    this.camDistance = Math.max(3.5, Math.min(14, v))
  }

  setSteerSensitivity(v) {
    this.steerSensitivity = clamp(v, 0.5, 2.0)
  }

  _updateCamera(dt, camera, speedFactor) {
    // smooth yaw follow: the camera swings behind the car when cornering
    // (fixed orbit radius, so it never pulls away at speed)
    let dYaw = this.psi - this.camYaw
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw))
    this.camYaw += dYaw * Math.min(1, dt * 7)

    const dist = this.camDistance
    const local = new THREE.Vector3(0, 1.95 + (dist - 4.5) * 0.14, dist)
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw)
    const desired = new THREE.Vector3(this.X, 0, this.Z).add(local)

    camera.position.copy(desired)
    this.camVel.set(0, 0, 0)

    // look ahead of the car
    const lookDist = 10 + speedFactor * 6
    const look = new THREE.Vector3(
      this.X - Math.sin(this.psi) * lookDist,
      1.15,
      this.Z - Math.cos(this.psi) * lookDist
    )
    this.camLook.lerp(look, Math.min(1, dt * 10))
    camera.lookAt(this.camLook)

    // shake
    const shakeAmt = this.shake * 0.35 + (this.nitroActive ? 0.035 : 0)
    if (shakeAmt > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt
      camera.position.y += (Math.random() - 0.5) * shakeAmt
    }

    // constant FOV so the car never appears to drift away
    const targetFov = 60
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5)
    camera.updateProjectionMatrix()
  }

  get state() {
    const speedKmh = Math.hypot(this.u, this.v) * 3.6
    let gear = this.gear
    if (this.u < -0.5) gear = 'R'
    else if (Math.abs(this.u) < 0.35 && this.throttle < 0.05) gear = 'N'
    return {
      speedKmh,
      rpm: this.rpm,
      gear,
      nitro: this.nitro,
      nitroActive: this.nitroActive,
      headlights: this.input.headlights,
      abs: this.absActive,
      tcs: this.tcsActive,
      stm: this.stmActive,
      slip: this.slip,
      speedFactor: Math.min(Math.hypot(this.u, this.v) / 70, 1)
    }
  }
}
