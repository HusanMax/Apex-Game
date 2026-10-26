import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildVehicle } from './VehicleFactory.js'

const glbCache = new Map()

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

/**
 * Player vehicle: owns the transform, lights and wheel animation for whichever
 * machine is currently selected in the garage. Body geometry comes from
 * VehicleFactory; the Chevrolet Cobalt additionally loads its detailed GLB.
 */
export class PlayerVehicle {
  constructor(spec) {
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

    this.headlightsOn = true
    this.wheels = []
    this.headlights = []
    this.lightShafts = []
    this.taillights = []
    this.paintMaterials = []
    this.glassMaterials = []
    this.model = null
    this.procedural = null
    this._glbRoot = null
    this.dayMode = false
    this.onModelLoaded = null
    this.spec = null

    this.setVehicle(spec)
    this._applyTransform()
  }

  /* ------------------------------------------------------------ selection */
  setVehicle(spec) {
    this.spec = spec
    this._clear()

    const built = buildVehicle(spec)
    this.procedural = built.root
    this.group.add(built.root)

    this.wheels = built.wheels
    this.headlights = built.headlights
    this.lightShafts = built.shafts
    this.taillights = built.taillights
    this.paintMaterials = built.paintMaterials
    this.glassMaterials = built.glassMaterials
    this.headlightOnMat = built.headlightOnMat
    this.headlightOffMat = built.headlightOffMat
    this.wheelRadius = built.wheelRadius

    // the overhead fill light has to outlive the procedural body: the Cobalt
    // swaps in a GLB and hides the procedural root, and a light inside a hidden
    // parent stops lighting the scene
    const fill = built.root.children.find((c) => c.isPointLight) || null
    if (fill) {
      built.root.remove(fill)
      this.group.add(fill)
    }
    this.fillLight = fill

    // same for the headlight beams: the Cobalt drives at night with the GLB,
    // so its spotlights must not be switched off along with the hidden body
    for (const hl of built.headlights) {
      const light = hl?.light
      if (!light) continue
      light.parent?.remove(light)
      this.group.add(light)
      const target = light.target
      if (target) {
        target.parent?.remove(target)
        this.group.add(target)
      }
    }

    this._applyLights()
    this.setDayMode(this.dayMode)
    // GLB is NOT loaded automatically — call loadModel() when ready
    // (e.g. after the player clicks START in the garage)
  }

  /**
   * Begin streaming the high-res GLB for the current vehicle (if any).
   * Safe to call multiple times; subsequent calls are no-ops once the model
   * is loading or already loaded.
   */
  loadModel() {
    if (!this.spec?.model || this.spec.model.kind !== 'glb') return
    // already attached or already downloading
    if (this._glbRoot || this._glbLoading) return
    this._glbLoading = true
    this._loadGLB(this.spec.model.url)
  }

  _clear() {
    const glb = this._glbRoot
    for (const child of [...this.group.children]) {
      this.group.remove(child)
      // the GLB lives in glbCache and is reused, so it is detached but never
      // disposed; the procedural body is rebuilt on every selection
      if (child !== glb) this._disposeTree(child)
    }
    this._glbRoot = null
    this._glbLoading = false
    this.procedural = null
    this.model = null
    this.wheels = []
    this.headlights = []
    this.lightShafts = []
    this.taillights = []
    this.paintMaterials = []
    this.glassMaterials = []
    this.fillLight = null
  }

  _disposeTree(root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.dispose()
      }
    })
  }

  /* ------------------------------------------------------------- GLB model */
  _loadGLB(url) {
    const cached = glbCache.get(url)
    if (cached) {
      this._useGLB(cached)
      return
    }

    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene
        root.updateMatrixWorld(true)
        this._dedupeWheelLods(root)
        this._normalizeModel(root)
        glbCache.set(url, root)
        // the player may already have picked another machine while this
        // downloaded — only attach the model if it is still the selection
        if (this.spec?.model?.url === url) {
          this._useGLB(root)
          this.onModelLoaded?.(root)
        }
      },
      undefined,
      (err) => {
        console.error('[PlayerVehicle] Failed to load GLB, keeping procedural body:', err)
      }
    )
  }

  _useGLB(root) {
    if (this._glbRoot && this._glbRoot.parent === this.group) this.group.remove(this._glbRoot)
    this._glbRoot = root
    this.group.add(root)
    this.model = root
    // materials are registered every time, so paint/day-mode applies even when
    // the model comes back from the cache after another machine was selected
    this._registerGLBMaterials(root)
    this._prepareGLB(root)
    if (this.procedural) this.procedural.visible = false
    for (const shaft of this.lightShafts) shaft.visible = false
    this._applyLights()
    this.setDayMode(this.dayMode)
    // keep the cache bounded: a player who arrows through the whole garage would
    // otherwise pin every GLB (some 45 MB) in VRAM forever.  The model that is
    // on screen right now is never a candidate for eviction.
    this._evictGLBCache()
  }

  /** Drop the oldest cached GLBs that are not the one currently on screen. */
  _evictGLBCache() {
    const CAP = 8
    if (glbCache.size <= CAP) return
    for (const [url, root] of glbCache) {
      if (root === this._glbRoot) continue
      if (root.parent === this.group) continue
      glbCache.delete(url)
      this._disposeTree(root)
      if (glbCache.size <= CAP) break
    }
  }

  _registerGLBMaterials(root) {
    root.traverse((o) => {
      if (!o.isMesh) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (!m) continue
        const name = (m.name || '').toLowerCase()
        if (/glass|windscreen/.test((o.name || '').toLowerCase())) {
          if (!this.glassMaterials.includes(m)) this.glassMaterials.push(m)
        }
        if (name === 'primary' && !this.paintMaterials.includes(m)) {
          this.paintMaterials.push(m)
        }
      }
    })
  }

  _prepareGLB(root) {
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
          m.roughness = Math.max(m.roughness ?? 0.2, 0.34)
          m.metalness = Math.min(m.metalness ?? 0, 0.25)
          if ('envMapIntensity' in m) m.envMapIntensity = 0.28
        }
        if (name === 'primary') {
          m.color.setHex(this.spec.paint)
          m.metalness = 0.0
          m.roughness = 0.55
          m.clearcoat = 0.3
          m.clearcoatRoughness = 0.4
          if ('envMapIntensity' in m) m.envMapIntensity = 0.35
        } else if (name.includes('front_light')) {
          m.color.setHex(0xffffff)
          if (m.emissive) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 1.6 }
        } else if (name.includes('rear_light')) {
          m.color.setHex(0x330000)
          if (m.emissive) { m.emissive.setHex(0xff0505); m.emissiveIntensity = 1.2 }
        }
      }
    })

    if (root.userData.lampPanels) return
    root.userData.lampPanels = true

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

        const lamp = new THREE.PointLight(spec.light, 1.2, 3.5, 2)
        lamp.position.set(cx, cy, zPlane + (spec.kind === 'rear' ? 0.1 : -0.1))
        root.add(lamp)
      }
    }
  }

  _normalizeModel(root) {
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    box.getSize(size)

    if (size.x > size.z) {
      root.rotation.y += Math.PI / 2
      root.updateMatrixWorld(true)
      box.setFromObject(root)
      box.getSize(size)
    }

    // The simulator always drives toward -Z, so the car's nose must point that
    // way.  A per-model `flip` override wins (set when an export faces the wrong
    // way and auto-detection cannot tell); otherwise we infer the front from
    // wheel / lamp naming.  If nothing is labelled we default to flipping, since
    // most of these GLB exports ship facing +Z and need to be turned to -Z.
    const explicitFlip = this.spec?.model?.flip
    let needsFlip
    if (explicitFlip === true) needsFlip = true
    else if (explicitFlip === false) needsFlip = false
    else needsFlip = this._frontFacesPlusZ(root)

    if (needsFlip) {
      root.rotation.y += Math.PI
      root.updateMatrixWorld(true)
      box.setFromObject(root)
      box.getSize(size)
    }

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

  /** True if the model's front (by wheel/lamp naming) currently points +Z. */
  _frontFacesPlusZ(root) {
    const centerZOf = (o) => {
      if (o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox
        if (bb) {
          const c = new THREE.Vector3()
          bb.getCenter(c)
          c.applyMatrix4(o.matrixWorld)
          return c.z
        }
      }
      const p = new THREE.Vector3()
      o.getWorldPosition(p)
      return p.z
    }

    const frontWheels = []
    const rearWheels = []
    let frontLampZ = null
    let rearLampZ = null
    root.traverse((o) => {
      const n = (o.name || '').toLowerCase()
      if (/wheel|tire|tyre|roda/.test(n)) {
        const isFront = /(^|[_-])(f|fl|fr|lf|rf|front)([_-]|$)/.test(n)
        const isRear = /(^|[_-])(r|rl|rr|lr|rb|rear)([_-]|$)/.test(n)
        if (isFront || isRear) {
          const z = centerZOf(o)
          ;(isFront ? frontWheels : rearWheels).push(z)
        }
      } else if (/fara|headlight|head|front_light|front.*led|led.*front/.test(n)) {
        if (frontLampZ === null) frontLampZ = centerZOf(o)
      } else if (/rear.*led|led.*rear|rear_light|taillight|ascende|tail.*light/.test(n)) {
        if (rearLampZ === null) rearLampZ = centerZOf(o)
      }
    })
    if (frontWheels.length && rearWheels.length) {
      const fz = frontWheels.reduce((a, b) => a + b, 0) / frontWheels.length
      const rz = rearWheels.reduce((a, b) => a + b, 0) / rearWheels.length
      return fz > rz
    }
    // use front-lamp geometry centre if wheels were ambiguous
    if (frontLampZ !== null) { return frontLampZ > 0 }
    // no usable labels: default to flipping (most exports ship facing +Z)
    console.info('[PV] no labels', this.spec.id, 'default flip')
    return true
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

  /* --------------------------------------------------------------- visuals */
  _applyTransform() {
    this.group.position.copy(this.position)
    this.group.rotation.set(this.bodyPitch, this.rotationY, this.bodyRoll)
  }

  _applyLights() {
    const intensity = this.spec?.type === 'bike' ? 6 : 9
    for (const hl of this.headlights) {
      hl.light.intensity = this.headlightsOn ? intensity : 0
      hl.lens.material = this.headlightsOn ? this.headlightOnMat : this.headlightOffMat
    }
    const shaftsOn = this.headlightsOn && !this._glbRoot
    for (const shaft of this.lightShafts) shaft.visible = shaftsOn
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

  spinWheels(dt, speed) {
    // physical rolling: angular speed = linear speed / tyre radius
    const delta = (speed * dt) / Math.max(this.wheelRadius || 0.35, 0.05)
    for (const w of this.wheels) {
      const spinner = w?.spinner || w
      if (spinner) spinner.rotation.x -= delta
    }
  }

  /** Turn the front wheels with the steering wheel (cosmetic only). */
  setSteerAngle(angle) {
    for (const w of this.wheels) {
      if (!w?.front) continue
      // steer the hub, not the axle group: the rolling spinner inside it keeps
      // its own rotation, and the caliper stays bolted to the upright
      const pivot = w.hub || w.group
      if (pivot) pivot.rotation.y = angle
    }
  }

  toggleHeadlights() {
    this.headlightsOn = !this.headlightsOn
    this._applyLights()
    return this.headlightsOn
  }

  setDayMode(isDay) {
    this.dayMode = isDay

    // daylight washes the paint out a little, but every machine keeps its own
    // colour — only the reflections are tamed (no more grey-everything bug)
    const base = this.spec?.paint ?? 0xe8ecf0
    const dayPaint = this.spec?.dayPaint ??
      new THREE.Color(base).lerp(new THREE.Color(0xffffff), 0.12).getHex()

    for (const m of this.paintMaterials) {
      m.color.setHex(isDay ? dayPaint : base)
      if ('metalness' in m) m.metalness = isDay ? Math.min(m.metalness ?? 0, 0.1) : (this.spec?.type === 'bike' ? 0.5 : 0.05)
      m.roughness = isDay ? 0.72 : 0.45
      if ('clearcoat' in m) {
        m.clearcoat = isDay ? 0.05 : 0.4
        m.clearcoatRoughness = isDay ? 1.0 : 0.35
      }
      if ('envMapIntensity' in m) m.envMapIntensity = isDay ? 0.08 : 0.55
      m.needsUpdate = true
    }

    for (const m of this.glassMaterials) {
      if ('envMapIntensity' in m) m.envMapIntensity = isDay ? 0.12 : 0.28
      m.roughness = Math.max(m.roughness ?? 0.2, isDay ? 0.52 : 0.34)
      m.needsUpdate = true
    }

    if (this.fillLight) this.fillLight.intensity = isDay ? 1.2 : (this.spec?.type === 'bike' ? 5 : 9)
  }

  setNitroColor(active) {
    for (const t of this.taillights) {
      if (t.material?.emissiveIntensity !== undefined) {
        t.material.emissiveIntensity = active ? 3.4 : 2.4
      }
    }
  }

  update(dt, speed) {
    this.spinWheels(dt, speed)
  }

  dispose() {
    const keep = this._glbRoot
    for (const child of [...this.group.children]) {
      this.group.remove(child)
      if (child !== keep) this._disposeTree(child)
    }
    this._glbRoot = null
  }
}
