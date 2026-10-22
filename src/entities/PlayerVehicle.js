import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const PAINT = 0xf4f6f9        // glossy pearl white

function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export class PlayerVehicle {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'PlayerVehicle'
    this.group.rotation.order = 'YXZ'

    this.position = new THREE.Vector3(0, 0, 0)
    this.rotationY = 0
    this.bodyRoll = 0
    this.bodyPitch = 0
    this.speedKmh = 0
    this.rpm = 0
    this.gear = 1
    this.maxSpeed = 420

    this.headlightsOn = true
    this.wheelSpinners = []
    this.headlights = []
    this.lightShafts = []
    this.taillights = []

    this.effects = new Set()
    this.model = null
    this.modelLoaded = false

    this.build()
    this._applyTransform()
  }

  build() {
    const g = this.group

    /* ---------------- materials ---------------- */
    const paint = new THREE.MeshPhysicalMaterial({
      color: PAINT,
      metalness: 0.0,
      roughness: 0.58,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.25
    })
    const carbon = new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.42, metalness: 0.55 })
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x0a141b, metalness: 0.4, roughness: 0.06,
      transparent: true, opacity: 0.72, clearcoat: 1, envMapIntensity: 1.6
    })
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc6ced6, metalness: 1.0, roughness: 0.18 })
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.9 })
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xb01e26, emissive: 0x3a0508, roughness: 0.5 })
    const redLight = new THREE.MeshStandardMaterial({ color: 0xff1a2a, emissive: 0xff1a2a, emissiveIntensity: 2.4 })
    const whiteLight = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const headlightOff = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x111111 })
    const vinyl = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.35, metalness: 0.5 })
    this.headlightOnMat = whiteLight
    this.headlightOffMat = headlightOff

    /* ---------------- body (extruded profile) ---------------- */
    const shape = new THREE.Shape()
    shape.moveTo(2.28, 0.34)
    shape.lineTo(2.32, 0.60)
    shape.lineTo(2.12, 0.76)
    shape.lineTo(1.30, 0.82)
    shape.lineTo(0.62, 0.98)
    shape.lineTo(0.20, 1.42)
    shape.lineTo(-0.50, 1.44)
    shape.lineTo(-1.00, 1.05)
    shape.lineTo(-1.70, 0.92)
    shape.lineTo(-2.15, 0.74)
    shape.lineTo(-2.28, 0.34)
    shape.lineTo(2.28, 0.34)

    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.9, steps: 1, bevelEnabled: true,
      bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3
    })
    bodyGeo.translate(0, 0, -0.95)
    const body = new THREE.Mesh(bodyGeo, paint)
    body.rotation.y = Math.PI / 2
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)

    /* ---------------- greenhouse glass ---------------- */
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.42, 1.75), glass)
    canopy.position.set(0, 1.16, -0.12)
    g.add(canopy)

    // side windows strips
    for (const sx of [-0.87, 0.87]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 1.5), glass)
      win.position.set(sx, 1.16, -0.12)
      g.add(win)
    }

    /* ---------------- widebody flares ---------------- */
    const flareGeo = new THREE.BoxGeometry(0.32, 0.42, 1.15)
    for (const z of [-1.45, 1.45]) {
      for (const sx of [-1, 1]) {
        const f = new THREE.Mesh(flareGeo, paint)
        f.position.set(sx * 0.96, 0.62, z)
        f.castShadow = true
        g.add(f)
      }
    }

    /* ---------------- skirts / splitter / mirrors ---------------- */
    for (const sx of [-0.97, 0.97]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 2.7), carbon)
      skirt.position.set(sx, 0.30, 0)
      g.add(skirt)
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.28), carbon)
      mirror.position.set(sx * 1.02, 1.02, -0.55)
      g.add(mirror)
    }

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.10, 0.55), carbon)
    splitter.position.set(0, 0.26, -2.22)
    g.add(splitter)

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.4), carbon)
    diffuser.position.set(0, 0.28, 2.18)
    g.add(diffuser)

    /* ---------------- rear wing ---------------- */
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.10, 0.58), carbon)
    wing.position.set(0, 1.52, 2.03)
    wing.rotation.x = -0.12
    wing.castShadow = true
    g.add(wing)
    for (const sx of [-0.78, 0.78]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.52, 0.30), carbon)
      support.position.set(sx, 1.24, 2.03)
      g.add(support)
    }
    // wing end plates
    for (const sx of [-1.07, 1.07]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.62), carbon)
      plate.position.set(sx, 1.52, 2.03)
      g.add(plate)
    }

    /* ---------------- vinyl graphics ---------------- */
    for (const sx of [-0.955, 0.955]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.20, 1.55), vinyl)
      stripe.position.set(sx, 0.80, 0.25)
      g.add(stripe)
      const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 1.1), carbon)
      stripe2.position.set(sx, 0.98, 0.35)
      g.add(stripe2)
    }

    /* ---------------- wheels ---------------- */
    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.30, 28)
    tireGeo.rotateZ(Math.PI / 2)
    const rimGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.32, 22)
    rimGeo.rotateZ(Math.PI / 2)
    const spokeGeo = new THREE.BoxGeometry(0.05, 0.42, 0.055)
    const caliperGeo = new THREE.BoxGeometry(0.10, 0.26, 0.20)

    const wheelPositions = [
      [-0.98, 0.38, -1.45],
      [0.98, 0.38, -1.45],
      [-0.98, 0.38, 1.45],
      [0.98, 0.38, 1.45]
    ]

    for (const [x, y, z] of wheelPositions) {
      const wheelGroup = new THREE.Group()
      wheelGroup.position.set(x, y, z)

      const spinner = new THREE.Group()

      const tire = new THREE.Mesh(tireGeo, tireMat)
      tire.castShadow = true
      spinner.add(tire)

      const rim = new THREE.Mesh(rimGeo, chrome)
      spinner.add(rim)

      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(spokeGeo, chrome)
        spoke.rotation.x = (s / 5) * Math.PI * 2
        spinner.add(spoke)
      }

      // brake disc
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.03, 20), chrome)
      disc.rotation.z = Math.PI / 2
      spinner.add(disc)

      wheelGroup.add(spinner)

      // glowing caliper (does not spin)
      const caliper = new THREE.Mesh(caliperGeo, caliperMat)
      caliper.position.set(x > 0 ? -0.12 : 0.12, 0, 0)
      wheelGroup.add(caliper)

      g.add(wheelGroup)
      this.wheelSpinners.push(spinner)
    }

    /* ---------------- soft fill light ---------------- */
    this.fillLight = new THREE.PointLight(0xe4f1ff, 16, 15, 2)
    this.fillLight.position.set(0, 4.6, -0.4)
    g.add(this.fillLight)
    this.effects.add(this.fillLight)

    /* ---------------- headlights + light shafts ---------------- */
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0xdfefff, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
    const shaftGeo = new THREE.ConeGeometry(1.7, 9.5, 18, 1, true)

    for (const sx of [-0.68, 0.68]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.10), headlightOff)
      lens.position.set(sx, 0.70, -2.16)
      g.add(lens)

      const light = new THREE.SpotLight(0xdff0ff, 0, 90, Math.PI / 6.5, 0.45, 1.1)
      light.position.set(sx, 0.70, -2.16)
      light.target.position.set(sx, 0.2, -40)
      light.castShadow = false
      g.add(light)
      g.add(light.target)
      this.effects.add(light)
      this.effects.add(light.target)

      const shaft = new THREE.Mesh(shaftGeo, shaftMat.clone())
      shaft.rotation.x = Math.PI / 2 + 0.1
      shaft.position.set(sx, 0.68, -6.6)
      shaft.visible = false
      g.add(shaft)
      this.effects.add(shaft)

      this.headlights.push({ lens, light })
      this.lightShafts.push(shaft)
    }
    for (const hl of this.headlights) hl.light.intensity = this.headlightsOn ? 9 : 0
    for (const shaft of this.lightShafts) shaft.visible = this.headlightsOn && !this.modelLoaded

    /* ---------------- taillights ---------------- */
    for (const sx of [-0.70, 0.70]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.08), redLight)
      tail.position.set(sx, 0.70, 2.17)
      g.add(tail)
      this.taillights.push(tail)
    }

    /* ---------------- exhaust ---------------- */
    const pipeGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.25, 12)
    pipeGeo.rotateX(Math.PI / 2)
    for (const sx of [-0.5, 0.5]) {
      const pipe = new THREE.Mesh(pipeGeo, chrome)
      pipe.position.set(sx, 0.38, 2.16)
      g.add(pipe)
    }

    /* ---------------- driver (seen through the glass) ---------------- */
    this._buildDriver(g)
  }

  _buildDriver(parent) {
    const driver = new THREE.Group()
    driver.name = 'Driver'

    const suit = new THREE.MeshStandardMaterial({ color: 0x1c232c, roughness: 0.8 })
    const accent = new THREE.MeshStandardMaterial({ color: 0xb01e26, roughness: 0.6 })
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98e63, roughness: 0.85 })
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.32, metalness: 0.15 })
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x07141c, roughness: 0.08, metalness: 0.9
    })

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 10), suit)
    torso.position.set(-0.34, 0.74, 0.18)
    torso.scale.set(1.2, 1, 0.8)
    driver.add(torso)

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), accent)
    stripe.position.set(-0.34, 0.76, 0.05)
    driver.add(stripe)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), skin)
    head.position.set(-0.34, 0.98, 0.1)
    driver.add(head)

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.165, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetMat)
    helmet.position.set(-0.34, 0.99, 0.1)
    driver.add(helmet)

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.156, 18, 10, 0, Math.PI, Math.PI * 0.32, Math.PI * 0.3), visorMat)
    visor.position.set(-0.34, 0.99, 0.1)
    visor.rotation.y = 0
    driver.add(visor)

    for (const sx of [-0.5, -0.18]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 8), suit)
      arm.position.set(sx, 0.72, -0.14)
      arm.rotation.x = -1.02
      arm.rotation.z = sx < -0.34 ? -0.18 : 0.18
      driver.add(arm)
    }

    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 22), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.7 }))
    wheel.position.set(-0.34, 0.7, -0.44)
    wheel.rotation.x = -0.22
    driver.add(wheel)

    parent.add(driver)
    this.effects.add(driver)
  }

  _applyTransform() {
    this.group.position.copy(this.position)
    this.group.rotation.set(this.bodyPitch, this.rotationY, this.bodyRoll)
  }

  /* ------------------------------------------------------------- GLB model */
  loadModel(url, onLoaded) {
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene
        root.updateMatrixWorld(true)

        this._dedupeWheelLods(root)
        this._normalizeModel(root)

        root.traverse((o) => {
          if (!o.isMesh) return
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          const matName = (mats[0]?.name || '').toLowerCase()

          // only the outer shell needs to cast shadows (perf)
          o.castShadow = matName === 'primary' || matName.includes('roda')
          o.receiveShadow = true
          o.frustumCulled = false

          for (const m of mats) {
            if (!m) continue
            if ('envMapIntensity' in m) m.envMapIntensity = 1.35
            if (m.map) m.map.anisotropy = 4
            const name = (m.name || '').toLowerCase()
            if (/glass|windscreen/.test((o.name || '').toLowerCase())) {
              // tame blown-out reflections on the windows
              m.roughness = Math.max(m.roughness ?? 0.2, 0.34)
              m.metalness = Math.min(m.metalness ?? 0, 0.25)
              if ('envMapIntensity' in m) m.envMapIntensity = 0.28
            }
            if (name === 'primary') {
              // flat pearl white: no metallic glints
              m.color.setHex(PAINT)
              m.metalness = 0.0
              m.roughness = 0.58
              m.clearcoat = 0.18
              m.clearcoatRoughness = 0.4
              if ('envMapIntensity' in m) m.envMapIntensity = 0.25
            } else if (name.includes('front_light')) {
              m.color.setHex(0xffffff)
              if (m.emissive) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 1.6 }
            } else if (name.includes('rear_light')) {
              m.color.setHex(0x330000)
              if (m.emissive) { m.emissive.setHex(0xff0505); m.emissiveIntensity = 1.2 }
            }
          }
        })

        // the raw GLB lenses are dark; add emissive glow panels for the lamps
        root.updateMatrixWorld(true)
        const glowTex = makeGlowTexture()
        const meshes = []
        root.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o) })

        const lampSpecs = [
          { re: /ascende_(left|right)/i, kind: 'rear', color: 0xff0a0a, light: 0xff1010 },
          { re: /fara_(left|right)/i, kind: 'front', color: 0xf2fbff, light: 0xdfefff }
        ]

        for (const spec of lampSpecs) {
          for (const o of meshes) {
            if (!spec.re.test(o.name || '')) continue
            o.geometry.computeBoundingBox()
            const bb = o.geometry.boundingBox
            if (!bb) continue

            const corners = []
            for (const x of [bb.min.x, bb.max.x]) {
              for (const y of [bb.min.y, bb.max.y]) {
                for (const z of [bb.min.z, bb.max.z]) {
                  corners.push(root.worldToLocal(new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld)))
                }
              }
            }
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
            for (const c of corners) {
              minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x)
              minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y)
              minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z)
            }

            const cx = (minX + maxX) / 2
            const cy = (minY + maxY) / 2
            const w = Math.min(Math.max((maxX - minX) * 1.1, 0.3), 0.85)
            const h = Math.min(Math.max((maxY - minY) * 1.1, 0.16), 0.5)
            const zPlane = spec.kind === 'rear' ? maxZ + 0.02 : minZ - 0.02

            const panel = new THREE.Mesh(
              new THREE.PlaneGeometry(w, h),
              new THREE.MeshBasicMaterial({
                map: glowTex, color: spec.color, transparent: true, opacity: 0.45,
                blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
              })
            )
            panel.position.set(cx, cy, zPlane)
            panel.renderOrder = 2
            root.add(panel)

            const lamp = new THREE.PointLight(spec.light, spec.kind === 'rear' ? 1.2 : 1.2, 3.5, 2)
            lamp.position.set(cx, cy, zPlane + (spec.kind === 'rear' ? 0.1 : -0.1))
            root.add(lamp)
          }
        }

        this.model = root
        this.group.add(root)
        this.modelLoaded = true
        this._hideProcedural()
        for (const shaft of this.lightShafts) shaft.visible = false
        onLoaded?.(root)
      },
      undefined,
      (err) => {
        console.error('[PlayerVehicle] Failed to load GLB:', err)
      }
    )
  }

  _normalizeModel(root) {
    let box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    box.getSize(size)

    // make the longest horizontal axis the car length (Z)
    if (size.x > size.z) {
      root.rotation.y += Math.PI / 2
      root.updateMatrixWorld(true)
      box.setFromObject(root)
      box.getSize(size)
    }

    // detect the front using the "wheel_rf" dummy; front must point toward -Z
    let frontZ = null
    root.traverse((o) => {
      if (frontZ === null && /wheel_rf/i.test(o.name || '')) {
        const p = new THREE.Vector3()
        o.getWorldPosition(p)
        frontZ = p.z
      }
    })
    if (frontZ !== null && frontZ > 0) {
      root.rotation.y += Math.PI
      root.updateMatrixWorld(true)
      box.setFromObject(root)
      box.getSize(size)
    }

    // uniform scale to ~4.4 m length
    const scale = 4.4 / Math.max(size.z, 0.001)
    root.scale.multiplyScalar(scale)
    root.updateMatrixWorld(true)
    box.setFromObject(root)

    const center = new THREE.Vector3()
    box.getCenter(center)
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= box.min.y
    root.updateMatrixWorld(true)
  }

  _dedupeWheelLods(root) {
    const groups = []
    root.traverse((o) => {
      if (/^roda(\.\d+)?$/.test(o.name || '')) groups.push(o)
    })
    if (groups.length < 2) return

    const clusters = new Map()
    for (const grp of groups) {
      const p = new THREE.Vector3()
      grp.getWorldPosition(p)
      const key = `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`
      if (!clusters.has(key)) clusters.set(key, [])
      clusters.get(key).push(grp)
    }

    for (const arr of clusters.values()) {
      if (arr.length < 2) continue
      let best = arr[0]
      let bestTris = -1
      for (const grp of arr) {
        let tris = 0
        grp.traverse((o) => {
          if (o.isMesh && o.geometry) {
            const pos = o.geometry.attributes.position
            tris += o.geometry.index ? o.geometry.index.count / 3 : (pos ? pos.count / 3 : 0)
          }
        })
        if (tris > bestTris) { bestTris = tris; best = grp }
      }
      for (const grp of arr) if (grp !== best) grp.visible = false
    }
  }

  _hideProcedural() {
    for (const child of this.group.children) {
      if (child === this.model) continue
      if (!this.effects.has(child)) child.visible = false
    }
  }

  setPosition(x, y, z, rotationY) {
    this.position.set(x, y, z)
    this.rotationY = rotationY
    this._applyTransform()
  }

  setBodyAttitude(roll, pitch) {
    this.bodyRoll = roll
    this.bodyPitch = pitch
    this._applyTransform()
  }

  spinWheels(speed) {
    const delta = (speed * 0.06)
    for (const s of this.wheelSpinners) s.rotation.x -= delta
  }

  toggleHeadlights() {
    this.headlightsOn = !this.headlightsOn
    for (const hl of this.headlights) {
      hl.light.intensity = this.headlightsOn ? 9 : 0
      hl.lens.material = this.headlightsOn ? this.headlightOnMat : this.headlightOffMat
    }
    for (const shaft of this.lightShafts) shaft.visible = this.headlightsOn && !this.modelLoaded
    return this.headlightsOn
  }

  setNitroColor(active, boostIntensity = 1) {
    if (this.taillights.length) {
      for (const t of this.taillights) t.material.emissiveIntensity = active ? 3.4 : 2.4
    }
  }

  update(dt, speed) {
    this.spinWheels(speed)
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.dispose()
      }
    })
  }
}
