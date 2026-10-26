import * as THREE from 'three'

const G = 9.81
const clamp = THREE.MathUtils.clamp

export class VehicleController {
  constructor({ vehicle, environment, spec }) {
    this.vehicle = vehicle
    this.env = environment
    this.spec = spec

    this.input = {
      forward: false, backward: false, left: false, right: false,
      handbrake: false, nitro: false, headlights: true
    }

    /* ---------------- vehicle parameters (metric) ---------------- */
    this.mass = 1400
    this.Iz = 2450
    this.wheelBase = 2.60
    this.a = 1.25            // CG -> front axle
    this.b = 1.35            // CG -> rear axle
    this.cgHeight = 0.42
    this.mu = 1.6
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
    this.brakeRise = 6.0          // brake pressure build-up (1/s)
    this.brakeFall = 10.0         // brake release rate (1/s)
    this.brakeFront = 0.68
    this.brakeRear = 0.32
    this.engineBrakeForce = 1800  // N at the rear wheels off-throttle
    this.driveFront = 0.25        // rear-biased AWD keeps power oversteer possible
    this.driveRear = 0.75

    // anti-lock braking / traction control
    this.absEnabled = true
    this.absFrequency = 12
    this.absPhase = 0
    this.tcsEnabled = true

    // simplified Pacejka tyre: initial slope ~ B*C*mu*Fz, peak near 11 deg
    this.tireB = 9.0
    this.tireC = 1.5
    this.tireE = 0.97
    this.tirePeakSlip = 0.19
    this.longStiffness = 12.0

    // speed sensitive steering
    this.maxSteer = 0.75           // low speed lock
    this.maxSteerHigh = 0.14       // high speed lock cap — yengilroq tez burilish
    this.steerRate = 9.5           // progressiv rul tezligi (rad/s) — tezroq jawob
    this.steerReturnRate = 25.0    // rul qaytish tezligi — tezda to'g'rilanish
    this.steerSensitivity = 1.6    // keyboard sensibility

    // suspension geometry
    this.trackWidth = 1.56

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
    this.shiftLock = 0
    this.liftTimer = 0
    this._shiftKind = null
    this._prevThrottle = 0

    this.slip = 0
    this.slipAngleF = 0
    this.slipAngleR = 0
    this.slipRatioF = 0
    this.slipRatioR = 0
    this.tireSlipRatio = 0
    this.brakePressure = 0
    this.absActive = false
    this.absPulse = 1
    this.tcsActive = false
    this.stmActive = false
    this.lockFront = 0
    this.lockRear = 0

    this.steerCommand = 0
    this.currentSteerAngle = 0
    this.controlsEnabled = true
    this.understeer = 0
    this.oversteer = 0
    this.isUndersteering = false
    this.isOversteering = false
    this.weightDistribution = { front: 0.5, rear: 0.5, left: 0.5, right: 0.5 }
    this.gForceVector = { lateral: 0, longitudinal: 0, vertical: 1 }

    this.camYaw = 0
    this.camLook = new THREE.Vector3(0, 1.2, -12)
    this.camDistance = 4.5
    // the rig's actual smoothed position (a spring, not a hard weld to the car)
    this.camPos = new THREE.Vector3(0, 2, 6)
    this._snapCamera = true
    this.shake = 0
    this._shakeT = 0
    this.longAccel = 0
    // accelerations low-passed before they tilt the body / the camera
    this.smoothAccel = 0
    this.smoothLateral = 0
    this.bodyRoll = 0
    this.bodyPitch = 0

    this.isBike = false
    this.topSpeed = 117

    if (spec) this.applyVehicle(spec)
    this._bindKeys()
  }

  /** Load the garage machine's performance package and start fresh. */
  applyVehicle(spec, { keepPlace = false } = {}) {
    const p = spec.physics
    const X = this.X
    const Z = this.Z
    const psi = this.psi
    const camYaw = this.camYaw
    this.spec = spec
    this.isBike = spec.type === 'bike'

    this.mass = p.mass
    this.Iz = p.iz
    this.wheelBase = p.wheelBase
    this.a = p.a
    this.b = p.b
    this.cgHeight = p.cgHeight
    this.mu = p.mu
    this.trackWidth = p.trackWidth
    this.wheelRadius = p.wheelRadius
    this.finalDrive = p.finalDrive
    this.gearRatios = [...p.gearRatios]
    this.redline = p.redline
    this.idle = p.idle
    this.maxTorque = p.torque
    this.dragCd = p.dragCd
    this.area = p.area
    this.brakeForce = p.brakeForce
    this.brakeFront = p.brakeFront
    this.brakeRear = p.brakeRear
    this.driveFront = p.driveFront
    this.driveRear = p.driveRear
    this.maxSteer = p.maxSteer
    this.maxSteerHigh = p.maxSteerHigh
    this.topSpeed = p.topSpeedKph / 3.6

    this.vehicle.maxSpeed = p.topSpeedKph
    // the new machine arrives with its lights on; keep the HUD lamp in sync
    this.input.headlights = this.vehicle.headlightsOn !== false
    this.reset()

    // swapping machines in the garage should not teleport the player back to
    // the start line — keep the current spot, just stop the machine there
    if (keepPlace) {
      this.X = X
      this.Z = Z
      this.psi = psi
      // the camera is parked behind the machine; without this it swings back
      // around the moment the new machine is picked
      this.camYaw = camYaw
      this.camLook.set(
        this.X - Math.sin(this.psi) * 10,
        1.15,
        this.Z - Math.cos(this.psi) * 10
      )
      this.vehicle.setPosition(this.X, 0, this.Z, this.psi)
    }
  }

  reset() {
    this.X = 2
    this.Z = 0
    this.psi = 0
    this.u = 0
    this.v = 0
    this.r = 0
    this.steerAngle = 0
    this.steerCommand = 0
    this.currentSteerAngle = 0
    this.gear = 1
    this.rpm = this.idle
    this.shiftTimer = 0
    this.throttle = 0
    this.brakeInput = 0
    this._prevThrottle = 0
    this.nitro = this.nitroMax
    this.nitroActive = false
    this.nitroCooldown = 0
    this.shiftPitch = 0
    this.shiftLock = 0
    this.liftTimer = 0
    this._shiftKind = null
    this.slip = 0
    this.slipAngleF = 0
    this.slipAngleR = 0
    this.slipRatioF = 0
    this.slipRatioR = 0
    this.tireSlipRatio = 0
    this.brakePressure = 0
    this.absActive = false
    this.absPulse = 1
    this.bodyRoll = 0
    this.bodyPitch = 0
    this.shake = 0
    this._shakeT = 0
    this.smoothAccel = 0
    this.smoothLateral = 0
    this.longAccel = 0
    this.camYaw = 0
    this._snapCamera = true
    this.camLook.set(this.X - Math.sin(this.psi) * 10, 1.15, this.Z - Math.cos(this.psi) * 10)
    this.input.forward = false
    this.input.backward = false
    this.input.left = false
    this.input.right = false
    this.input.handbrake = false
    this.input.nitro = false

    this.vehicle.setNitroColor?.(false)
    this.vehicle.setSteerAngle?.(0)
    this.vehicle.setPosition(this.X, 0, this.Z, this.psi)
    this.vehicle.setBodyAttitude(0, 0)
  }

  /** Stop the machine where it stands (the garage is opened mid-run). */
  park() {
    this.u = 0
    this.v = 0
    this.r = 0
    this.steerAngle = 0
    this.steerCommand = 0
    this.currentSteerAngle = 0
    this.throttle = 0
    this.brakeInput = 0
    this.brakePressure = 0
    this.slip = 0
    this.slipAngleF = 0
    this.slipAngleR = 0
    this.slipRatioF = 0
    this.slipRatioR = 0
    this.tireSlipRatio = 0
    this.gear = 1
    this.rpm = this.idle
    this.shiftTimer = 0
    this.shiftLock = 0
    this.shiftPitch = 0
    this.liftTimer = 0
    this._shiftKind = null
    this._prevThrottle = 0
    this.nitroActive = false
    this.bodyRoll = 0
    this.bodyPitch = 0
    this.longAccel = 0
    this.shake = 0
    this._shakeT = 0
    this.smoothAccel = 0
    this.smoothLateral = 0
    // line the chase camera up with the machine while it stands in the garage,
    // so closing the garage does not snap the view round from a stale yaw
    this.camYaw = this.psi
    this._snapCamera = true
    this.camLook.set(
      this.X - Math.sin(this.psi) * 10,
      1.15,
      this.Z - Math.cos(this.psi) * 10
    )
    this.vehicle.setNitroColor?.(false)
    this.vehicle.setSteerAngle?.(0)
    this.vehicle.setBodyAttitude(0, 0)
  }

  /* ------------------------------------------------------------- input */
  /**
   * While the garage is open the arrow keys drive the menu, not the car, so
   * the controller stops listening. Any held key is released on re-enable.
   */
  setControlsEnabled(enabled) {
    this.controlsEnabled = !!enabled
    if (!this.controlsEnabled) {
      this.input.forward = false
      this.input.backward = false
      this.input.left = false
      this.input.right = false
      this.input.handbrake = false
    }
  }

  _bindKeys() {
    const handler = (e) => {
      if (!this.controlsEnabled) return
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
        case 'KeyX':
          if (down && !e.repeat) this._manualShift(1)
          break
        case 'KeyZ':
          if (down && !e.repeat) this._manualShift(-1)
          break
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', handler)
    // a keyup is lost when the window loses focus mid-corner (alt-tab), which
    // would leave the throttle pinned; release everything instead
    window.addEventListener('blur', () => {
      this.input.forward = false
      this.input.backward = false
      this.input.left = false
      this.input.right = false
      this.input.handbrake = false
    })
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
    // Normalised torque vs rpm fraction.  A real engine makes peak torque
    // around two-thirds of the rev range: below that the curve climbs, above
    // it torque falls away towards the limiter.  That shape is what gives the
    // launch its shove and makes the top of the rev range feel like it is
    // running out of breath.
    const peak = 0.62
    if (x <= peak) {
      const t = clamp(x / peak, 0, 1)
      return 0.45 + 0.55 * Math.sin((t * Math.PI) / 2)
    }
    const t = clamp((x - peak) / (1 - peak), 0, 1)
    return 1 - 0.14 * t * t
  }

  /**
   * Simplified Pacejka magic-formula lateral curve. It rises linearly at
   * small slip angles, peaks near `tirePeakSlip`, then falls away so the car
   * can understeer or break traction instead of gripping forever.
   */
  _tireForce(alpha, Fz, mu) {
    const B = this.tireB
    const C = this.tireC
    const E = this.tireE
    const x = alpha
    return mu * Fz * Math.sin(C * Math.atan(B * x - E * (B * x - Math.atan(B * x))))
  }

  /** Convert an axle longitudinal force into an approximate slip ratio. */
  _slipRatio(longForce, Fz) {
    return clamp(longForce / (this.longStiffness * Math.max(Fz, 1)), -1, 1)
  }

  _manualShift(direction) {
    if (this.shiftTimer > 0 || this.u < -0.5) return
    if (direction > 0 && this.gear < this.gearRatios.length) {
      this.gear++
      this.shiftTimer = 0.12
      this._shiftKind = 'up'
      this.shiftPitch = -0.012
      this.shake = Math.max(this.shake, 0.14)
    } else if (direction < 0 && this.gear > 1) {
      this.gear--
      const ratio = this.gearRatios[this.gear - 1]
      const newWheelRpm = (Math.abs(this.u) / this.wheelRadius) * ratio * this.finalDrive * 60 / (2 * Math.PI)
      // a manual downshift has no rev-match: high rpm locks the rear briefly
      if (newWheelRpm > this.redline * 0.82) {
        this.shiftLock = 0.3
        this.shake = Math.max(this.shake, 0.22)
      }
      this.rpm = Math.max(this.rpm, Math.min(this.redline, newWheelRpm))
      this.shiftTimer = 0.1
      this._shiftKind = 'down'
      this.shiftPitch = 0.012
    }
  }

  _updateGearbox(dt) {
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt
      if (this.shiftTimer <= 0) {
        // clutch closes: sharp torque re-engagement (shift shock)
        if (this._shiftKind === 'up') {
          this.shiftPitch = 0.026
          this.shake = Math.max(this.shake, 0.16)
        } else if (this._shiftKind === 'down') {
          this.shiftPitch = -0.012
          this.shake = Math.max(this.shake, 0.1)
        }
        this._shiftKind = null
      }
      return
    }
    if (this.u < -0.5) return // reverse
    const gearRatio = this.gearRatios[this.gear - 1]
    const wheelRpm = (Math.abs(this.u) / this.wheelRadius) * gearRatio * this.finalDrive * 60 / (2 * Math.PI)
    if (wheelRpm > this.redline * 0.93 && this.gear < this.gearRatios.length) {
      this.gear++
      this.shiftTimer = 0.13
      this._shiftKind = 'up'
      this.shiftPitch = -0.012
      this.shake = Math.max(this.shake, 0.14)
    } else if (wheelRpm < clamp(this.redline * 0.3, 1500, 3200) && this.gear > 1) {
      this.gear--
      const newRatio = this.gearRatios[this.gear - 1]
      const newWheelRpm = (Math.abs(this.u) / this.wheelRadius) * newRatio * this.finalDrive * 60 / (2 * Math.PI)
      // automatic rev-match blip keeps the downshift smooth
      this.rpm = Math.max(this.rpm, Math.min(this.redline, newWheelRpm))
      if (newWheelRpm > this.redline * 0.82) {
        // too much engine speed for the new gear: brief rear-wheel lock
        this.shiftLock = 0.3
        this.shake = Math.max(this.shake, 0.22)
      }
      this.shiftTimer = 0.11
      this._shiftKind = 'down'
      this.shiftPitch = 0.012
    }
  }

  /* ------------------------------------------------------------- update */
  update(dt, camera) {
    dt = Math.min(Math.max(dt, 0), 0.033)

    this.throttle = this.input.forward ? 1 : 0
    this.brakeInput = this.input.backward ? 1 : 0

    const speed = Math.hypot(this.u, this.v)
    const speedFactor = clamp(speed / 70, 0, 1)

    /* ---- steering: progressive, speed-sensitive, self-centering ---- */
    // convention: positive steer = left, positive v = left, positive r = left
    const steerTarget = (this.input.left ? 1 : 0) + (this.input.right ? -1 : 0)
    const speedSteer = THREE.MathUtils.lerp(this.maxSteer, this.maxSteerHigh, Math.pow(speedFactor, 0.65))
    const gripSteer = Math.atan((this.mu * G * this.wheelBase) / Math.max(speed * speed, 4))
    let steerLimit = Math.min(speedSteer, gripSteer * 1.45)
    if (this.input.handbrake) steerLimit *= 1.5

    // player command ramps in/out, so a keyboard is not a step input
    const commandRate = steerTarget === 0 ? this.steerReturnRate : this.steerRate
    this.steerCommand += clamp(steerTarget - this.steerCommand, -commandRate * dt, commandRate * dt)

    const released = steerTarget === 0 && !this.input.handbrake
    // sensitivity scales the available lock (still capped by the speed limit)
    const sensLimit = Math.min(this.maxSteer, steerLimit * this.steerSensitivity)
    let desired
    if (released) {
      // self-centering / lane assist: the wheel snaps back to centre and the
      // chassis is pulled back towards the road direction.  The old gains were
      // soft enough that the car kept drifting through the corner after the
      // key was let go; these straighten it out in one quick, clean move.
      desired = clamp(-this.psi * 7.0 - this.r * 1.6, -steerLimit, steerLimit)
    } else {
      desired = clamp(this.steerCommand * sensLimit, -sensLimit, sensLimit)
    }

    // turn-in yaw kick: makes a quick keyboard tap feel immediate
    if (steerTarget !== 0 && this._lastSteer !== steerTarget && Math.abs(this.u) > 6 && !this.input.handbrake) {
      const gripRate = (this.mu * G) / Math.max(Math.abs(this.u), 5)
      this.r += clamp(steerTarget * Math.min(0.2, gripRate * 0.4) * this.steerSensitivity, -0.2, 0.2)
    }
    this._lastSteer = steerTarget

    // steering weight rises with speed; return-to-centre is faster than turn-in
    const wheelRate = (released ? this.steerReturnRate : this.steerRate) * (1 - speedFactor * 0.28)
    this.steerAngle += clamp(desired - this.steerAngle, -wheelRate * dt, wheelRate * dt)
    this.currentSteerAngle = this.steerAngle

    /* ---- gearbox, engine & rpm ---- */
    this._updateGearbox(dt)
    const gearRatio = this.gearRatios[this.gear - 1]
    const wheelRpm = (Math.abs(this.u) / this.wheelRadius) * gearRatio * this.finalDrive * 60 / (2 * Math.PI)
    const engineTarget = Math.max(wheelRpm, this.idle + this.throttle * 1400)
    this.rpm += (Math.min(engineTarget, this.redline) - this.rpm) * Math.min(1, dt * 10)

    /* ---- brake pressure curve + ABS ---- */
    const brakeTarget = this.brakeInput
    const brakeRate = brakeTarget > this.brakePressure ? this.brakeRise : this.brakeFall
    this.brakePressure += clamp(brakeTarget - this.brakePressure, -brakeRate * dt, brakeRate * dt)

    const speedKmh = Math.hypot(this.u, this.v) * 3.6
    this.absActive = this.absEnabled && this.brakePressure > 0.6 && speedKmh > 18 && Math.abs(this.u) > 3
    if (this.absActive) {
      // pressure is released/reapplied at ~12 Hz instead of locking the wheel
      this.absPhase = (this.absPhase + dt * this.absFrequency) % 1
      this.absPulse = this.absPhase < 0.55 ? 1 : 0.35
    } else {
      this.absPulse = 1
    }

    /* ---- drive / brake / engine-brake forces ---- */
    const tq = this._torqueCurve(this.rpm / this.redline) * this.maxTorque
    // 0.95 accounts for the driveline loss; it is also what lets every machine
    // pull its own advertised top speed in top gear before the governor trims it
    let driveForce = this.throttle * tq * gearRatio * this.finalDrive / this.wheelRadius * 0.95
    if (this.nitroActive) driveForce *= 2.5
    if (this.shiftTimer > 0) driveForce *= 0.12

    const brakeMag = this.brakePressure * this.brakeForce * this.absPulse
    let brakeForce = 0
    if (this.brakeInput > 0.05 && this.u <= 0.5) {
      brakeForce = -6500 * this.brakePressure // reverse gear
    } else if (this.u > 0.5) {
      brakeForce = -brakeMag
    }

    const engineBrake = (this.throttle < 0.05 && Math.abs(this.u) > 1)
      ? -Math.sign(this.u) * this.engineBrakeForce * (0.35 + this.rpm / this.redline)
      : 0

    // traction control only trims torque once the rear is actually sliding
    this.tcsActive = this.tcsEnabled && this.throttle > 0.6 && this.gear <= 3 &&
      Math.abs(this.slip) > 0.14
    if (this.tcsActive) driveForce *= 0.8

    const handbrakeForce = this.input.handbrake && Math.abs(this.u) > 0.5 ? -Math.sign(this.u) * 6500 : 0
    const Fdrag = -0.5 * this.rho * this.dragCd * this.area * this.u * Math.abs(this.u)
    const Froll = -this.rollResist * this.mass * G * Math.sign(this.u)

    // distribute tyre longitudinal forces, capped by static axle load
    const muR = this.input.handbrake ? this.mu * 0.45 : this.mu
    const FzFstatic = this.mass * G * this.b / this.wheelBase
    const FzRstatic = this.mass * G * this.a / this.wheelBase
    const rawFxF = driveForce * this.driveFront + brakeForce * this.brakeFront
    const rawFxR = driveForce * this.driveRear + brakeForce * this.brakeRear + engineBrake + handbrakeForce
    const FxF = clamp(rawFxF, -this.mu * FzFstatic, this.mu * FzFstatic)
    const FxR = clamp(rawFxR, -muR * FzRstatic, muR * FzRstatic)
    const Fx = FxF + FxR + Fdrag + Froll
    const ax = Fx / this.mass
    this.longAccel = ax
    this.u += ax * dt
    this.u = clamp(this.u, -12, this.topSpeed * 1.08)
    // machine-specific top speed: a soft governor instead of a hard wall.
    // Nitro earns a little headroom above the stock limit, like the games it
    // is inspired by, but the machine always settles back to its own top end.
    const governor = this.topSpeed * (this.nitroActive ? 1.08 : 1)
    if (this.u > governor) {
      this.u += (governor - this.u) * Math.min(1, dt * 2.2)
    }

    /* ---- weight transfer (longitudinal + lateral) ---- */
    const FzF = Math.max(this.mass * G * this.b / this.wheelBase - this.mass * ax * this.cgHeight / this.wheelBase, this.mass * G * 0.2)
    const FzR = Math.max(this.mass * G * this.a / this.wheelBase + this.mass * ax * this.cgHeight / this.wheelBase, this.mass * G * 0.2)
    const ay = this.u * this.r
    const FzLeft = Math.max(this.mass * G * 0.5 - this.mass * ay * this.cgHeight / this.trackWidth, this.mass * G * 0.1)
    const FzRight = Math.max(this.mass * G * 0.5 + this.mass * ay * this.cgHeight / this.trackWidth, this.mass * G * 0.1)
    const totalFz = FzF + FzR
    this.weightDistribution.front = FzF / totalFz
    this.weightDistribution.rear = FzR / totalFz
    this.weightDistribution.left = FzLeft / (FzLeft + FzRight)
    this.weightDistribution.right = FzRight / (FzLeft + FzRight)
    this.gForceVector.lateral = ay / G
    this.gForceVector.longitudinal = ax / G
    this.gForceVector.vertical = totalFz / (this.mass * G)

    /* ---- lateral tyre model (nonlinear bicycle + friction circle) ---- */
    const absU = Math.max(Math.abs(this.u), 1.5)
    const alphaF = this.steerAngle - Math.atan2(this.v + this.a * this.r, absU)
    const alphaR = -Math.atan2(this.v - this.b * this.r, absU)
    this.slipAngleF = alphaF
    this.slipAngleR = alphaR

    // locked front wheels (ABS off) stop generating lateral force
    const lockTarget = !this.absEnabled && this.brakePressure > 0.55
      ? clamp((this.brakePressure - 0.55) / 0.45, 0, 1) * clamp(Math.abs(this.u) / 8, 0, 1)
      : 0
    this.lockFront += (lockTarget - this.lockFront) * Math.min(1, dt * 9)
    this.lockRear = this.input.handbrake ? 1 : 0
    if (this.shiftLock > 0) {
      this.shiftLock = Math.max(0, this.shiftLock - dt)
      this.lockRear = Math.max(this.lockRear, this.shiftLock / 0.3)
    }

    // lift-off / sudden-power detection (sample before updating the latch)
    const prevThrottle = this._prevThrottle
    if (prevThrottle > 0.5 && this.throttle < 0.1 && Math.abs(this.u) > 12) this.liftTimer = 0.3
    this.liftTimer = Math.max(0, this.liftTimer - dt)
    this._prevThrottle = this.throttle

    const lowSpeedGrip = clamp(Math.abs(this.u) / 3.0, 0, 1)
    const clampedFxF = clamp(FxF, -this.mu * FzF, this.mu * FzF)
    const clampedFxR = clamp(FxR, -muR * FzR, muR * FzR)
    const maxFyF = Math.sqrt(Math.max(0, (this.mu * FzF) ** 2 - clampedFxF ** 2))
    const maxFyR = Math.sqrt(Math.max(0, (muR * FzR) ** 2 - clampedFxR ** 2))

    let FyF = this._tireForce(alphaF, FzF, this.mu) * (1 - 0.9 * this.lockFront)
    let FyR = this._tireForce(alphaR, FzR, muR) * (1 - 0.55 * this.lockRear)
    if (this.liftTimer > 0) FyR *= 1 - 0.22 * (this.liftTimer / 0.3)
    // power oversteer: a bootful of throttle in the lower gears unloads the
    // rear contact patch, letting the tail step out before TCS reacts.
    if (this.throttle > 0.6 && this.gear <= 3 && Math.abs(this.steerAngle) > 0.03) {
      FyR *= 1 - 0.2 * this.throttle
    }
    FyF = clamp(FyF, -maxFyF, maxFyF) * lowSpeedGrip
    FyR = clamp(FyR, -maxFyR, maxFyR) * lowSpeedGrip

    const cosSteer = Math.cos(this.steerAngle)
    const vDot = (FyF * cosSteer + FyR) / this.mass - this.u * this.r
    const rDot = (this.a * FyF * cosSteer - this.b * FyR) / this.Iz

    // sudden power with steering: rear-biased torque steps the tail out
    if (this.throttle > 0.85 && prevThrottle < 0.5 && this.gear <= 3 &&
        Math.abs(this.steerAngle) > 0.03 && Math.abs(this.u) > 5 && !this.input.handbrake) {
      this.r += Math.sign(this.steerAngle) * clamp(Math.abs(this.u) / 18, 0.25, 1) * 0.42
    }

    this.v += vDot * dt
    this.r += rDot * dt

    // light base damping keeps the car eager to rotate while weaving
    this.v *= (1 - 0.35 * dt)
    this.r *= (1 - 0.3 * dt)

    // steering self-centering: with the wheel released the car straightens
    // its line instead of continuing to rotate into the next lane.  Firm and
    // frame-rate independent, so letting go mid-corner ends the turn promptly.
    if (released && Math.abs(this.u) > 5) {
      this.r *= Math.exp(-9.0 * dt)
    }

    // tyre slip telemetry + understeer / oversteer detection
    this.slip = Math.atan2(this.v, Math.max(Math.abs(this.u), 1))
    this.slipRatioF = this._slipRatio(clampedFxF, FzF)
    this.slipRatioR = this._slipRatio(clampedFxR, FzR)
    if (this.lockFront > 0.5) this.slipRatioF = -this.lockFront
    if (this.lockRear > 0.5) this.slipRatioR = -this.lockRear
    this.tireSlipRatio = Math.max(Math.abs(this.slipRatioF), Math.abs(this.slipRatioR))

    const peak = this.tirePeakSlip
    this.understeer = clamp((Math.abs(alphaF) - 0.06) / (peak - 0.06), 0, 1)
    this.oversteer = clamp((Math.abs(alphaR) - 0.07) / (peak - 0.07), 0, 1)
    this.isOversteering = (this.oversteer > 0.1 && Math.abs(alphaR) > Math.abs(alphaF)) ||
      (Math.abs(this.slip) > 0.1 && Math.abs(this.r) > 0.35)
    this.isUndersteering = !this.isOversteering && this.understeer > 0.1 &&
      Math.abs(alphaF) >= Math.abs(alphaR) && Math.abs(steerTarget) > 0 && Math.abs(this.u) > 4

    // stability management: catch the body before it slides out of line.
    // disabled while the handbrake is pulled so drifting still works.
    const stmThreshold = 0.15 + this.throttle * 0.12
    this.stmActive = !this.input.handbrake && Math.abs(this.u) > 8 && Math.abs(this.slip) > stmThreshold
    if (this.stmActive) {
      const excess = Math.abs(this.slip) - stmThreshold
      this.v *= 1 - Math.min(2.4, excess * 6) * dt
      this.r *= 1 - Math.min(1.4, excess * 4) * dt
    }

    this.v = clamp(this.v, -16, 16)
    this.r = clamp(this.r, -2.2, 2.2)

    this.psi += this.r * dt

    /* ---- integrate world position ---- */
    this.X += (-this.u * Math.sin(this.psi) - this.v * Math.cos(this.psi)) * dt
    this.Z += (-this.u * Math.cos(this.psi) + this.v * Math.sin(this.psi)) * dt

    /* ---- road barrier ----
     * Scraping the kerb must not scrub speed.  The barrier only holds the
     * machine inside the road and cancels the sideways velocity that pushed it
     * there; the forward speed carries straight through.  The old code bled
     * 2·u per second off the throttle and threw away 70% of the lateral
     * velocity every frame (0.7^60 ≈ 0 within a second), so brushing the edge
     * at speed felt like stamping on the brake. */
    if (Math.abs(this.X) > 7.2) {
      this.X = Math.sign(this.X) * 7.2
      // damp only the component driving into the wall, frame-rate independent
      this.v *= Math.exp(-12 * dt)
      // a light, steady rumble while the body grinds along the barrier
      this.shake = Math.max(this.shake, 0.08)
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
    this.vehicle.speedKmh = speedKmh
    this.vehicle.setPosition(this.X, 0, this.Z, this.psi)

    // subtle body roll into corners + pitch under braking/acceleration.
    // The raw forces buzz at 10-15 Hz: the ABS pressure pulse alone switches the
    // brake force on and off at 12 Hz, and feeding that square wave straight into
    // the attitude made the whole machine nod, with the camera (which leans with
    // the body) shaking along with it.  Low-pass the accelerations first so the
    // body settles into the corner instead of vibrating.
    const attEase = 1 - Math.exp(-6 * dt)
    this.smoothAccel += (this.longAccel - this.smoothAccel) * attEase
    this.smoothLateral += (ay - this.smoothLateral) * attEase

    const lateralAccel = this.smoothLateral
    const rollScale = clamp(Math.abs(this.u) / 7, 0, 1)
    // cars roll outward on their springs; bikes lean INTO the corner
    const targetRoll = this.isBike
      ? clamp(lateralAccel * 0.03, -0.7, 0.7) * rollScale
      : clamp(-lateralAccel * 0.007, -0.06, 0.06) * rollScale
    this.shiftPitch *= Math.max(0, 1 - dt * 9)
    const targetPitch = clamp(this.smoothAccel * 0.0035 + this.shiftPitch, -0.05, 0.05)
    const attRate = 1 - Math.exp(-9 * dt)
    this.bodyRoll += (targetRoll - this.bodyRoll) * attRate
    this.bodyPitch += (targetPitch - this.bodyPitch) * attRate
    this.vehicle.setBodyAttitude(this.bodyRoll, this.bodyPitch)
    // front wheels visibly turn with the steering (cars only; a bike's fork
    // is a fixed part of its body model)
    this.vehicle.setSteerAngle?.(this.steerAngle)

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

  setAbsEnabled(on) {
    this.absEnabled = !!on
    if (!this.absEnabled) {
      this.absActive = false
      this.absPulse = 1
    }
  }

  _updateCamera(dt, camera, speedFactor) {
    // Exponential smoothing.  `dt * k` changes strength with the frame rate, so
    // at 30 fps the camera followed at half the speed it did at 60 fps and the
    // view looked like it lagged behind and then jumped to catch up.
    const ease = (rate) => 1 - Math.exp(-rate * dt)

    // The chase camera is a spring, not a weld.  Copying the car's position
    // every frame made it feel bolted to the roof: no sense of speed, no sense
    // of weight.  Following the car with a lag instead lets it pull away under
    // acceleration, close in under braking and swing wide through a corner —
    // that trailing motion is what sells the movement.
    let dYaw = this.psi - this.camYaw
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw))
    this.camYaw += dYaw * ease(4.0)

    const dist = this.camDistance
    // Almost no pull-back at speed: the rig used to stretch 16% back by top
    // speed, which combined with the spring lag left the car shrinking into
    // the distance.  The chase length now stays essentially fixed.
    const stretch = 1 + speedFactor * 0.04
    const local = new THREE.Vector3(0, 1.95 + (dist - 4.5) * 0.14, dist * stretch)
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw)
    const desired = new THREE.Vector3(this.X, 0, this.Z).add(local)
    // the camera sags back on the throttle and noses in under braking
    desired.y -= clamp(this.smoothAccel * 0.0016, -0.05, 0.05)

    if (this._snapCamera) {
      // fresh start / garage: put the rig where it belongs instead of gliding
      this.camPos.copy(desired)
      this._snapCamera = false
    } else {
      // A fixed lag works while parking but not at speed: at 300 km/h the car
      // covers five metres in one 60 Hz frame, so the same smoothing dropped
      // the rig further and further behind and the car shrank into the
      // distance.  Chase harder the faster the car goes, so the trailing feel
      // stays at low speed and the gap stays small at high speed.
      const followRate = 7 + speedFactor * 22
      this.camPos.x += (desired.x - this.camPos.x) * ease(followRate)
      this.camPos.z += (desired.z - this.camPos.z) * ease(followRate)
      // a little slower vertically so crests are not rigid
      this.camPos.y += (desired.y - this.camPos.y) * ease(4)

      // Hard limit on how far the spring may trail its station, so a long
      // straight can never leave the camera drifting away from the machine.
      const driftX = this.camPos.x - desired.x
      const driftZ = this.camPos.z - desired.z
      const drift = Math.hypot(driftX, driftZ)
      const maxDrift = 1.2
      if (drift > maxDrift) {
        const k = maxDrift / drift
        this.camPos.x = desired.x + driftX * k
        this.camPos.z = desired.z + driftZ * k
      }
    }
    camera.position.copy(this.camPos)

    // aim well past the nose: at speed the view looks down the road instead of
    // at the boot lid
    const lookDist = 8 + speedFactor * 12
    const look = new THREE.Vector3(
      this.X - Math.sin(this.psi) * lookDist,
      1.15,
      this.Z - Math.cos(this.psi) * lookDist
    )
    this.camLook.lerp(look, ease(6))
    camera.lookAt(this.camLook)

    // weight-transfer camera recoil: lean with the body and settle under G
    // (a bike leans much further than a car, so the camera only takes a
    // fraction of it — a full lean would roll the whole screen)
    camera.rotateZ(-clamp(this.bodyRoll, -0.14, 0.14) * 0.55)
    camera.rotateX(this.bodyPitch * 0.3)
    camera.translateX(clamp((this.smoothLateral / G) * 0.1, -0.1, 0.1))

    // A hit is a decaying tremor, not a fresh random offset every frame.  New
    // random numbers at 60 Hz read as permanent vibration, and the ABS pulse
    // added a 12 Hz buzz on top of it.  Two out-of-phase sines give a smooth,
    // short shudder that fades out with this.shake.
    if (this.shake > 0.02) this._shakeT += dt
    const shakeAmt = Math.max(0, this.shake - 0.02) * 0.22 + (this.nitroActive ? 0.012 : 0)
    if (shakeAmt > 0.0005) {
      camera.position.x += Math.sin(this._shakeT * 41) * shakeAmt
      camera.position.y += Math.sin(this._shakeT * 57 + 1.7) * shakeAmt * 0.7
    }

    // speed/nitro FOV kick
    const targetFov = 60 + speedFactor * 3 + (this.nitroActive ? 2.5 : 0)
    camera.fov += (targetFov - camera.fov) * ease(5)
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
      speedFactor: Math.min(Math.hypot(this.u, this.v) / 70, 1),
      // telemetry for HUD / audio / visual effects
      currentSteerAngle: this.steerAngle,
      steerAngleDegrees: THREE.MathUtils.radToDeg(this.steerAngle),
      weightDistribution: { ...this.weightDistribution },
      tireSlipRatio: this.tireSlipRatio,
      tireSlipAngle: { front: this.slipAngleF, rear: this.slipAngleR },
      isOversteering: this.isOversteering,
      isUndersteering: this.isUndersteering,
      gForceVector: { ...this.gForceVector },
      brakePressure: this.brakePressure,
      absEnabled: this.absEnabled,
      shiftLock: this.shiftLock
    }
  }
}
