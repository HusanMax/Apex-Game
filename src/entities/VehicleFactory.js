import * as THREE from 'three'

/**
 * Builds the visible machine for a spec from src/data/vehicles.js.
 * Cars are extruded body profiles with wheels, aero and lamps; bikes are
 * assembled from tubes, fairings and a rider.  Everything returns the same
 * interface so PlayerVehicle can swap models at runtime.
 */

const GLASS = () => new THREE.MeshPhysicalMaterial({
  color: 0x0a141b, metalness: 0.4, roughness: 0.07,
  transparent: true, opacity: 0.72, clearcoat: 1, envMapIntensity: 1.6
})

const CARBON = () => new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.42, metalness: 0.55 })
const CHROME = () => new THREE.MeshStandardMaterial({ color: 0xc6ced6, metalness: 1.0, roughness: 0.18 })
const TIRE = () => new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.9 })
const RED_LIGHT = () => new THREE.MeshStandardMaterial({
  color: 0xff1a2a, emissive: 0xff1a2a, emissiveIntensity: 2.4
})
const HEAD_ON = () => new THREE.MeshBasicMaterial({ color: 0xffffff })
const HEAD_OFF = () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x111111 })

/* ------------------------------------------------------------------ shapes */

const CAR_STYLES = {
  sports: {
    halfLength: 2.28, width: 1.92, wheelWidth: 0.30,
    profile: [
      [2.28, 0.30], [2.32, 0.56], [2.05, 0.68], [1.25, 0.79], [0.55, 0.88],
      [0.12, 1.30], [-0.72, 1.33], [-1.22, 1.02], [-1.95, 0.92],
      [-2.28, 0.64], [-2.28, 0.30]
    ],
    canopy: { w: 1.66, h: 0.44, l: 1.72, y: 1.16, z: -0.12 },
    head: { x: 0.66, y: 0.72 }, tail: { x: 0.70, y: 0.78 },
    wing: 'lip', splitter: true, scoop: false
  },
  jdm: {
    halfLength: 2.28, width: 1.92, wheelWidth: 0.30,
    profile: [
      [2.28, 0.32], [2.30, 0.58], [1.95, 0.70], [1.05, 0.80], [0.48, 0.86],
      [0.16, 1.24], [-0.80, 1.27], [-1.28, 0.96], [-2.00, 0.88],
      [-2.28, 0.66], [-2.28, 0.32]
    ],
    canopy: { w: 1.70, h: 0.42, l: 1.74, y: 1.12, z: -0.16 },
    head: { x: 0.68, y: 0.70 }, tail: { x: 0.72, y: 0.76 },
    wing: 'high', splitter: true, scoop: false
  },
  muscle: {
    halfLength: 2.50, width: 2.02, wheelWidth: 0.33,
    profile: [
      [2.50, 0.32], [2.52, 0.62], [2.05, 0.74], [1.30, 0.82], [0.72, 0.90],
      [0.42, 1.24], [-0.80, 1.26], [-1.32, 0.94], [-2.18, 0.90],
      [-2.50, 0.72], [-2.50, 0.32]
    ],
    canopy: { w: 1.76, h: 0.40, l: 1.58, y: 1.08, z: -0.14 },
    head: { x: 0.74, y: 0.76 }, tail: { x: 0.78, y: 0.82 },
    wing: 'duck', splitter: false, scoop: true
  },
  super: {
    halfLength: 2.36, width: 2.08, wheelWidth: 0.34,
    profile: [
      [2.36, 0.26], [2.40, 0.50], [1.85, 0.58], [1.05, 0.66], [0.48, 0.74],
      [0.10, 1.08], [-0.62, 1.10], [-1.05, 0.86], [-1.90, 0.82],
      [-2.36, 0.62], [-2.36, 0.26]
    ],
    canopy: { w: 1.82, h: 0.36, l: 1.60, y: 0.96, z: -0.22 },
    head: { x: 0.78, y: 0.60 }, tail: { x: 0.80, y: 0.70 },
    wing: 'low', splitter: true, scoop: false
  }
}

function extrudeProfile(points, width) {
  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1])
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width, steps: 1, bevelEnabled: true,
    bevelThickness: 0.045, bevelSize: 0.045, bevelSegments: 2
  })
  geo.translate(0, 0, -width / 2)
  geo.rotateY(Math.PI / 2)   // profile +x becomes the nose at -Z
  return geo
}

function cylinderBetween(a, b, radius, material, segments = 10) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, segments), material)
  mesh.position.copy(a).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return mesh
}

function buildWheel({ radius, width, rimColor, spokes = 6, caliperColor = 0xb01e26, caliperSide = 1 }) {
  // group sits on the axle; hub is the steering pivot; spinner rolls the tyre.
  // Keeping the two rotations in separate nodes means steering never tilts the
  // rolling axis, and the brake caliper stays bolted to the upright.
  const group = new THREE.Group()
  const hub = new THREE.Group()
  const spinner = new THREE.Group()

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), TIRE())
  tire.rotation.z = Math.PI / 2
  tire.castShadow = true
  spinner.add(tire)

  const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 1.0, roughness: 0.22 })
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width * 1.02, 20),
    rimMat
  )
  rim.rotation.z = Math.PI / 2
  spinner.add(rim)

  const spokeGeo = new THREE.BoxGeometry(width * 0.85, radius * 1.15, 0.07)
  for (let i = 0; i < spokes; i++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat)
    spoke.rotation.x = (i / spokes) * Math.PI * 2
    spinner.add(spoke)
  }

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.025, 18),
    new THREE.MeshStandardMaterial({ color: 0x8a9199, metalness: 0.9, roughness: 0.35 })
  )
  disc.rotation.z = Math.PI / 2
  spinner.add(disc)

  hub.add(spinner)

  // the caliper is bolted to the upright, so it steers with the wheel but does
  // not spin with it.  The tyre and rim are solid cylinders, so the caliper
  // sits just proud of the wheel's outer face where it stays visible.
  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, radius * 0.44, radius * 0.24),
    new THREE.MeshStandardMaterial({ color: caliperColor, roughness: 0.5 })
  )
  caliper.position.set(width * 0.54 * caliperSide, radius * 0.38, 0)
  hub.add(caliper)

  group.add(hub)

  return { group, hub, spinner }
}

/* ------------------------------------------------------------------ driver */

function buildDriver(crouch = 0.5) {
  const driver = new THREE.Group()
  const suit = new THREE.MeshStandardMaterial({ color: 0x1c232c, roughness: 0.82 })
  const accent = new THREE.MeshStandardMaterial({ color: 0xb01e26, roughness: 0.6 })
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.32, metalness: 0.15 })
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x07141c, roughness: 0.08, metalness: 0.9 })

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 10), suit)
  torso.position.set(0, 1.06, 0.16)
  torso.rotation.x = -0.55 - crouch * 0.4
  torso.scale.set(1.2, 1, 0.8)
  driver.add(torso)

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.02), accent)
  stripe.position.set(0, 1.07, 0.02)
  driver.add(stripe)

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.66),
    helmetMat
  )
  helmet.position.set(0, 1.34, 0.05 + crouch * 0.04)
  driver.add(helmet)

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.157, 18, 10, 0, Math.PI, Math.PI * 0.3, Math.PI * 0.32),
    visorMat
  )
  visor.position.copy(helmet.position)
  driver.add(visor)

  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), suit)
    arm.position.set(sx * 0.16, 1.14, -0.12)
    arm.rotation.x = -1.15
    arm.rotation.z = sx * 0.16
    driver.add(arm)
  }

  return driver
}

/* ------------------------------------------------------------- car builder */

function buildCar(spec) {
  // a spec may override the body style's aero (e.g. the Supra's tall wing)
  const S = {
    ...(CAR_STYLES[spec.model.style] || CAR_STYLES.sports),
    ...(spec.model.wing ? { wing: spec.model.wing } : {})
  }
  const root = new THREE.Group()
  const paintMaterials = []
  const glassMaterials = []
  const wheels = []
  const headlights = []
  const shafts = []
  const taillights = []

  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.paint, metalness: 0.05, roughness: 0.5,
    clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.5
  })
  paintMaterials.push(paint)
  const glass = GLASS()
  glassMaterials.push(glass)
  const carbon = CARBON()
  const chrome = CHROME()
  const half = S.halfLength

  /* body shell */
  const body = new THREE.Mesh(extrudeProfile(S.profile, S.width), paint)
  body.castShadow = true
  body.receiveShadow = true
  root.add(body)

  /* greenhouse */
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(S.canopy.w, S.canopy.h, S.canopy.l), glass
  )
  canopy.position.set(0, S.canopy.y, S.canopy.z)
  root.add(canopy)
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, S.canopy.h * 0.78, S.canopy.l * 0.86), glass)
    win.position.set(sx * (S.canopy.w / 2 + 0.005), S.canopy.y, S.canopy.z)
    root.add(win)
  }

  const wheelBase = spec.physics.wheelBase
  const track = spec.physics.trackWidth
  const radius = spec.physics.wheelRadius
  // sit the tyres at the body's edge so they are not swallowed by the shell
  const wheelX = Math.max(track / 2, S.width / 2 - S.wheelWidth / 2 + 0.02)

  /* underbody, skirts, arches */
  const skirtGeo = new THREE.BoxGeometry(0.14, 0.16, wheelBase * 1.02)
  for (const sx of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, carbon)
    skirt.position.set(sx * (S.width / 2 - 0.02), 0.30, 0)
    root.add(skirt)
  }
  const flareGeo = new THREE.BoxGeometry(0.12, radius * 0.92, radius * 3.1)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const flare = new THREE.Mesh(flareGeo, paint)
      flare.position.set(sx * (S.width / 2 + 0.01), radius + 0.05, sz * wheelBase / 2)
      root.add(flare)
    }
  }
  for (const sz of [-1, 1]) {
    const axle = new THREE.Mesh(new THREE.BoxGeometry(wheelX * 2, 0.12, 0.18), carbon)
    axle.position.set(0, radius, sz * wheelBase / 2)
    root.add(axle)
  }

  /* mirrors */
  for (const sx of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.22), paint)
    mirror.position.set(sx * (S.width / 2 + 0.04), S.canopy.y - 0.12, S.canopy.z - 0.55)
    root.add(mirror)
  }

  /* front / rear aero */
  if (S.splitter) {
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(S.width * 1.02, 0.07, 0.5), carbon)
    splitter.position.set(0, 0.24, -half - 0.12)
    root.add(splitter)
    for (const sx of [-1, 1]) {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.26), carbon)
      canard.position.set(sx * (S.width / 2 - 0.1), 0.44, -half + 0.15)
      canard.rotation.z = sx * 0.16
      root.add(canard)
    }
  }
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(S.width * 0.9, 0.16, 0.4), carbon)
  diffuser.position.set(0, 0.3, half + 0.02)
  root.add(diffuser)

  if (S.wing === 'high') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(S.width * 0.95, 0.08, 0.5), carbon)
    wing.position.set(0, 1.34, half - 0.22)
    wing.rotation.x = -0.12
    wing.castShadow = true
    root.add(wing)
    for (const sx of [-1, 1]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.26), carbon)
      support.position.set(sx * 0.62, 1.1, half - 0.22)
      root.add(support)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.54), carbon)
      plate.position.set(sx * S.width * 0.47, 1.34, half - 0.22)
      root.add(plate)
    }
  } else if (S.wing === 'lip') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(S.width * 0.82, 0.05, 0.24), carbon)
    lip.position.set(0, 0.86, half - 0.12)
    lip.rotation.x = -0.1
    root.add(lip)
  } else if (S.wing === 'low') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(S.width * 0.92, 0.06, 0.42), carbon)
    wing.position.set(0, 0.92, half - 0.14)
    wing.rotation.x = -0.08
    root.add(wing)
  } else if (S.wing === 'duck') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(S.width * 0.9, 0.1, 0.3), carbon)
    duck.position.set(0, 0.82, half - 0.24)
    duck.rotation.x = -0.28
    root.add(duck)
  }

  if (S.scoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.7), carbon)
    scoop.position.set(0, 0.92, -1.05)
    root.add(scoop)
    for (const sx of [-1, 1]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.4), carbon)
      vent.position.set(sx * 0.55, 0.82, -1.1)
      root.add(vent)
    }
  }

  if (S.wing === 'low') {
    // supercar side intakes
    for (const sx of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.64), carbon)
      intake.position.set(sx * (S.width / 2 - 0.02), 0.66, 0.55)
      root.add(intake)
    }
    for (let i = 0; i < 4; i++) {
      const louvre = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.1), carbon)
      louvre.position.set(0, 0.9 + i * 0.03, half - 0.55 - i * 0.1)
      louvre.rotation.x = 0.35
      root.add(louvre)
    }
  }

  /* wheels */
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const { group, hub, spinner } = buildWheel({
        radius,
        width: S.wheelWidth,
        rimColor: spec.rim,
        spokes: spec.model.style === 'muscle' ? 5 : 6,
        caliperColor: 0xb01e26,
        // the caliper faces outwards on both sides of the car
        caliperSide: sx
      })
      group.position.set(sx * wheelX, radius, sz * wheelBase / 2)
      root.add(group)
      // the front axle (nose is -Z) is reported so the wheels can be steered
      wheels.push({ group, hub, spinner, front: sz === -1 })
    }
  }

  /* lamps */
  const headOn = HEAD_ON()
  const headOff = HEAD_OFF()
  const coneGeo = new THREE.ConeGeometry(1.5, 9.0, 16, 1, true)
  for (const sx of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), headOff)
    lens.position.set(sx * S.head.x, S.head.y, -half - 0.03)
    root.add(lens)

    const light = new THREE.SpotLight(0xdff0ff, 0, 90, Math.PI / 6.5, 0.45, 1.1)
    light.position.set(sx * S.head.x, S.head.y, -half - 0.06)
    light.target.position.set(sx * S.head.x, 0.15, -half - 40)
    root.add(light)
    root.add(light.target)
    headlights.push({ lens, light })

    const shaft = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({
        color: 0xdfefff, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    )
    shaft.rotation.x = Math.PI / 2 + 0.08
    shaft.position.set(sx * S.head.x, S.head.y, -half - 4.6)
    shaft.visible = false
    root.add(shaft)
    shafts.push(shaft)
  }

  for (const sx of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.07), RED_LIGHT())
    tail.position.set(sx * S.tail.x, S.tail.y, half + 0.03)
    root.add(tail)
    taillights.push(tail)
  }

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.02), carbon)
  plate.position.set(0, S.tail.y - 0.14, half + 0.04)
  root.add(plate)

  /* exhaust */
  const pipeGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.24, 12)
  pipeGeo.rotateX(Math.PI / 2)
  for (const sx of [-1, 1]) {
    const pipe = new THREE.Mesh(pipeGeo, chrome)
    pipe.position.set(sx * 0.46, radius * 0.95, half + 0.02)
    root.add(pipe)
  }

  /* barely visible driver behind the glass */
  root.add(buildDriver(0.35))

  const fillLight = new THREE.PointLight(0xe4f1ff, 9, 14, 2)
  fillLight.position.set(0, 4.2, -0.4)
  root.add(fillLight)

  return {
    root, wheels, headlights, shafts, taillights,
    paintMaterials, glassMaterials,
    headlightOnMat: headOn, headlightOffMat: headOff,
    wheelRadius: radius
  }
}

/* ------------------------------------------------------------ bike builder */

function buildSportbike(spec) {
  const root = new THREE.Group()
  const paintMaterials = []
  const glassMaterials = []
  const wheels = []
  const headlights = []
  const taillights = []
  const shafts = []

  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.paint, metalness: 0.15, roughness: 0.36, clearcoat: 0.6, envMapIntensity: 0.8
  })
  paintMaterials.push(paint)
  const glass = GLASS()
  glassMaterials.push(glass)
  const carbon = CARBON()
  const chrome = CHROME()
  const black = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.7, metalness: 0.25 })

  const radius = spec.physics.wheelRadius
  const base = spec.physics.wheelBase
  const frontZ = -base / 2
  const rearZ = base / 2
  const rearR = radius + 0.015

  for (const [r, z, w] of [[radius, frontZ, 0.13], [rearR, rearZ, 0.18]]) {
    const { group, spinner } = buildWheel({
      radius: r, width: w, rimColor: spec.rim, spokes: 5, caliperColor: 0xd8b64a
    })
    group.position.set(0, r, z)
    root.add(group)
    // a bike's fork is built separately, so its wheel is not steered on its own
    wheels.push({ group, spinner, front: false })
  }

  /* fork + swingarm */
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * 0.085, radius, frontZ)
    const b = new THREE.Vector3(sx * 0.07, 0.95, frontZ + 0.36)
    const tube = cylinderBetween(a, b, 0.026, chrome)
    tube.castShadow = true
    root.add(tube)
    const arm = cylinderBetween(
      new THREE.Vector3(sx * 0.1, rearR, rearZ),
      new THREE.Vector3(sx * 0.06, 0.62, rearZ - 0.45),
      0.035, black
    )
    root.add(arm)
  }
  root.add(cylinderBetween(
    new THREE.Vector3(0, 0.62, rearZ - 0.45),
    new THREE.Vector3(0, 0.72, 0.05),
    0.05, black
  ))

  /* engine block + radiator */
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.48), black)
  engine.position.set(0, 0.56, 0.0)
  engine.castShadow = true
  root.add(engine)
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.014, 0.44), chrome)
    fin.position.set(0, 0.44 + i * 0.06, 0.0)
    root.add(fin)
  }
  const radiator = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.06), carbon)
  radiator.position.set(0, 0.66, -0.3)
  radiator.rotation.x = 0.15
  root.add(radiator)

  /* tank, seat, tail */
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), paint)
  tank.scale.set(1, 0.62, 1.45)
  tank.position.set(0, 0.92, -0.06)
  tank.castShadow = true
  root.add(tank)

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.075, 0.48), black)
  seat.position.set(0, 0.94, 0.34)
  root.add(seat)

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.46), paint)
  tail.position.set(0, 0.98, 0.62)
  tail.rotation.x = -0.16
  tail.castShadow = true
  root.add(tail)
  const tailUnder = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.2), carbon)
  tailUnder.position.set(0, 0.84, 0.66)
  root.add(tailUnder)

  /* fairing + windscreen + clip-ons */
  const fairing = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 16), paint)
  fairing.scale.set(0.82, 1.0, 1.5)
  fairing.position.set(0, 0.84, -0.5)
  fairing.castShadow = true
  root.add(fairing)
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.6), paint)
    side.position.set(sx * 0.23, 0.78, -0.34)
    side.rotation.z = sx * 0.12
    root.add(side)
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.18), carbon)
    winglet.position.set(sx * 0.28, 0.84, -0.36)
    root.add(winglet)
  }
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.02), glass)
  screen.position.set(0, 1.08, -0.67)
  screen.rotation.x = 0.62
  root.add(screen)

  root.add(cylinderBetween(
    new THREE.Vector3(-0.32, 1.0, -0.34), new THREE.Vector3(0.32, 1.0, -0.34), 0.018, black
  ))
  for (const sx of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.13, 8), black)
    grip.rotation.z = Math.PI / 2
    grip.position.set(sx * 0.29, 1.0, -0.34)
    root.add(grip)
  }

  /* front fender */
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.46), paint)
  fender.position.set(0, radius + 0.3, frontZ)
  root.add(fender)

  /* exhaust */
  root.add(cylinderBetween(
    new THREE.Vector3(0.1, 0.46, 0.02),
    new THREE.Vector3(0.17, 0.44, 0.58),
    0.048, chrome
  ))
  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.3, 12), chrome)
  muffler.rotation.x = Math.PI / 2 - 0.12
  muffler.position.set(0.18, 0.45, 0.78)
  root.add(muffler)

  /* lamps */
  const headOn = HEAD_ON()
  const headOff = HEAD_OFF()
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.06), headOff)
  lens.position.set(0, 0.96, -0.82)
  root.add(lens)
  const light = new THREE.SpotLight(0xdff0ff, 0, 70, Math.PI / 7, 0.5, 1.1)
  light.position.set(0, 0.96, -0.84)
  light.target.position.set(0, 0.2, -40)
  root.add(light)
  root.add(light.target)
  headlights.push({ lens, light })

  const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.04), RED_LIGHT())
  tailLamp.position.set(0, 1.0, 0.86)
  root.add(tailLamp)
  taillights.push(tailLamp)

  root.add(buildRider(spec, 'sport'))

  const fillLight = new THREE.PointLight(0xe4f1ff, 5, 10, 2)
  fillLight.position.set(0, 3.2, 0)
  root.add(fillLight)

  return {
    root, wheels, headlights, shafts, taillights,
    paintMaterials, glassMaterials,
    headlightOnMat: headOn, headlightOffMat: headOff,
    wheelRadius: radius
  }
}

function buildCruiser(spec) {
  const root = new THREE.Group()
  const paintMaterials = []
  const glassMaterials = []
  const wheels = []
  const headlights = []
  const taillights = []
  const shafts = []

  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.paint, metalness: 0.55, roughness: 0.3, clearcoat: 0.7, envMapIntensity: 1.0
  })
  paintMaterials.push(paint)
  const glass = GLASS()
  glassMaterials.push(glass)
  const carbon = CARBON()
  const chrome = CHROME()
  const black = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.6, metalness: 0.4 })

  const radius = spec.physics.wheelRadius
  const base = spec.physics.wheelBase
  const frontZ = -base / 2
  const rearZ = base / 2
  const rearR = radius + 0.02

  for (const [r, z, w] of [[radius, frontZ, 0.16], [rearR, rearZ, 0.22]]) {
    const { group, spinner } = buildWheel({
      radius: r, width: w, rimColor: spec.rim, spokes: 7, caliperColor: 0x8f969f
    })
    group.position.set(0, r, z)
    root.add(group)
    wheels.push({ group, spinner, front: false })
  }

  /* raked forks */
  for (const sx of [-1, 1]) {
    root.add(cylinderBetween(
      new THREE.Vector3(sx * 0.1, radius, frontZ),
      new THREE.Vector3(sx * 0.085, 1.02, frontZ + 0.5),
      0.03, chrome
    ))
    root.add(cylinderBetween(
      new THREE.Vector3(sx * 0.1, rearR, rearZ),
      new THREE.Vector3(sx * 0.07, 0.52, rearZ - 0.55),
      0.04, black
    ))
  }

  /* frame spine */
  root.add(cylinderBetween(
    new THREE.Vector3(0, 1.0, frontZ + 0.48),
    new THREE.Vector3(0, 0.7, rearZ - 0.55),
    0.06, black
  ))
  root.add(cylinderBetween(
    new THREE.Vector3(0, 0.72, rearZ - 0.55),
    new THREE.Vector3(0, 0.5, rearZ - 0.2),
    0.045, black
  ))

  /* V-twin engine */
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.58), black)
  engine.position.set(0, 0.52, 0.08)
  engine.castShadow = true
  root.add(engine)
  for (const sz of [-1, 1]) {
    const jug = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.24), chrome)
    jug.position.set(0, 0.68, 0.08 + sz * 0.16)
    jug.rotation.x = sz * 0.5
    root.add(jug)
  }
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.012, 0.56), chrome)
    fin.position.set(0, 0.42 + i * 0.045, 0.08)
    root.add(fin)
  }

  /* tank, low seat, tail */
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), paint)
  tank.scale.set(1.0, 0.6, 1.5)
  tank.position.set(0, 0.93, -0.12)
  tank.castShadow = true
  root.add(tank)

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.52), black)
  seat.position.set(0, 0.82, 0.4)
  root.add(seat)

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.42), paint)
  tail.position.set(0, 0.9, 0.74)
  tail.rotation.x = -0.22
  root.add(tail)

  /* fenders */
  const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.56), paint)
  frontFender.position.set(0, radius + 0.33, frontZ)
  root.add(frontFender)
  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.6), paint)
  rearFender.position.set(0, rearR + 0.34, rearZ - 0.04)
  root.add(rearFender)
  for (const sx of [-1, 1]) {
    const fenderSide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.5), paint)
    fenderSide.position.set(sx * 0.14, rearR + 0.2, rearZ - 0.04)
    root.add(fenderSide)
  }

  /* bars + headlight + screen */
  root.add(cylinderBetween(
    new THREE.Vector3(-0.4, 1.04, frontZ + 0.46),
    new THREE.Vector3(0.4, 1.04, frontZ + 0.46),
    0.02, chrome
  ))
  for (const sx of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8), black)
    grip.rotation.z = Math.PI / 2
    grip.position.set(sx * 0.38, 1.04, frontZ + 0.46)
    root.add(grip)
  }

  const headShell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 18), chrome)
  headShell.rotation.x = Math.PI / 2
  headShell.position.set(0, 0.94, frontZ + 0.3)
  root.add(headShell)
  const headOn = HEAD_ON()
  const headOff = HEAD_OFF()
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.105, 20), headOff)
  lens.position.set(0, 0.94, frontZ + 0.365)
  lens.rotation.y = Math.PI
  root.add(lens)

  const light = new THREE.SpotLight(0xdff0ff, 0, 70, Math.PI / 7, 0.5, 1.1)
  light.position.set(0, 0.94, frontZ + 0.35)
  light.target.position.set(0, 0.2, frontZ - 40)
  root.add(light)
  root.add(light.target)
  headlights.push({ lens, light })

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.02), glass)
  screen.position.set(0, 1.16, frontZ + 0.4)
  screen.rotation.x = 0.45
  root.add(screen)

  /* dual exhaust */
  for (const sx of [-1, 1]) {
    root.add(cylinderBetween(
      new THREE.Vector3(sx * 0.12, 0.44, 0.2),
      new THREE.Vector3(sx * 0.22, 0.4, rearZ - 0.02),
      0.045, chrome
    ))
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.3, 12), chrome)
    tip.rotation.x = Math.PI / 2
    tip.position.set(sx * 0.23, 0.4, rearZ + 0.1)
    root.add(tip)
  }

  const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), RED_LIGHT())
  tailLamp.position.set(0, 0.9, 0.96)
  root.add(tailLamp)
  taillights.push(tailLamp)

  root.add(buildRider(spec, 'cruiser'))

  const fillLight = new THREE.PointLight(0xe4f1ff, 5, 10, 2)
  fillLight.position.set(0, 3.2, 0)
  root.add(fillLight)

  void carbon

  return {
    root, wheels, headlights, shafts, taillights,
    paintMaterials, glassMaterials,
    headlightOnMat: headOn, headlightOffMat: headOff,
    wheelRadius: radius
  }
}

/* ------------------------------------------------------------------- rider */

function buildRider(spec, style) {
  const rider = new THREE.Group()
  const sport = style === 'sport'
  const suitColor = sport ? 0x14181d : 0x241d18
  const suit = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.72 })
  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.paint), roughness: 0.5, metalness: 0.2
  })
  const helmetMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.paint), roughness: 0.3, metalness: 0.3
  })
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x05090d, roughness: 0.08, metalness: 0.95 })
  const boot = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.8 })

  const hip = new THREE.Vector3(0, sport ? 0.95 : 0.88, sport ? 0.36 : 0.4)
  const shoulder = new THREE.Vector3(0, sport ? 1.24 : 1.28, sport ? -0.02 : 0.16)
  const head = new THREE.Vector3(0, sport ? 1.4 : 1.48, sport ? -0.1 : 0.18)

  const torso = cylinderBetween(hip, shoulder, 0.15, suit)
  torso.castShadow = true
  rider.add(torso)
  const stripe = cylinderBetween(
    hip.clone().add(new THREE.Vector3(0, 0.05, -0.13)),
    shoulder.clone().add(new THREE.Vector3(0, -0.02, -0.13)),
    0.05, accent
  )
  rider.add(stripe)

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 14), helmetMat)
  helmet.position.copy(head)
  helmet.castShadow = true
  rider.add(helmet)
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.148, 18, 10, 0, Math.PI), visorMat)
  visor.position.copy(head)
  visor.rotation.y = -Math.PI / 2
  rider.add(visor)

  const barY = sport ? 1.0 : 1.04
  const barZ = sport ? -0.34 : -0.36
  for (const sx of [-1, 1]) {
    const hand = new THREE.Vector3(sx * 0.3, barY, barZ)
    const shoulderSide = shoulder.clone().add(new THREE.Vector3(sx * 0.16, -0.02, 0))
    const upper = cylinderBetween(shoulderSide, shoulderSide.clone().lerp(hand, 0.55), 0.055, suit)
    rider.add(upper)
    rider.add(cylinderBetween(shoulderSide.clone().lerp(hand, 0.55), hand, 0.045, suit))

    const knee = new THREE.Vector3(sx * 0.2, sport ? 0.7 : 0.55, sport ? 0.05 : 0.12)
    const foot = new THREE.Vector3(sx * 0.23, 0.4, sport ? 0.3 : 0.12)
    rider.add(cylinderBetween(hip.clone().add(new THREE.Vector3(sx * 0.09, -0.02, 0.05)), knee, 0.07, suit))
    rider.add(cylinderBetween(knee, foot, 0.06, boot))
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.14), boot)
    peg.position.set(foot.x, foot.y, foot.z)
    rider.add(peg)
  }

  return rider
}

/* ------------------------------------------------------------------ export */

export function buildVehicle(spec) {
  if (spec.type === 'bike') {
    return spec.model.style === 'cruiser' ? buildCruiser(spec) : buildSportbike(spec)
  }
  return buildCar(spec)
}
