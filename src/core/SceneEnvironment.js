import * as THREE from 'three'

export const ROAD_WIDTH = 16
export const LANE_WIDTH = ROAD_WIDTH / 4
export const LANES = [-6, -2, 2, 6]
export const SEGMENT_LENGTH = 120
export const SEGMENT_COUNT = 16
const LAMP_SPACING = 55
const LAMP_COUNT = 12

/* ------------------------------------------------------------------ textures */
function makeAsphaltTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#15181d'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 14000; i++) {
    const v = 15 + Math.random() * 40
    g.fillStyle = `rgba(${v},${v + 2},${v + 5},${Math.random() * 0.5})`
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5)
  }
  // cracks
  g.strokeStyle = 'rgba(0,0,0,0.35)'
  for (let i = 0; i < 25; i++) {
    g.beginPath()
    let x = Math.random() * 512
    let y = Math.random() * 512
    g.moveTo(x, y)
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 30
      y += (Math.random() - 0.5) * 30
      g.lineTo(x, y)
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 14)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function makeWetRoughnessTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#b0b0b0' // fairly rough dry-ish asphalt
  g.fillRect(0, 0, 512, 512)
  // darker = smoother = wet puddles
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const r = 20 + Math.random() * 90
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(20,20,20,0.9)')
    grd.addColorStop(1, 'rgba(180,180,180,0)')
    g.fillStyle = grd
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 14)
  return t
}

function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.5)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makePetalTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.clearRect(0, 0, 64, 64)
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.55, 'rgba(255,255,255,0.85)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.beginPath()
  g.ellipse(32, 32, 22, 13, 0.6, 0, Math.PI * 2)
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ------------------------------------------------------------------ env map */
function createEnvironment(renderer) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#010207')
  grad.addColorStop(0.4, '#061020')
  grad.addColorStop(0.5, '#102638')
  grad.addColorStop(0.56, '#0a1722')
  grad.addColorStop(1, '#020305')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 512)

  // faint warm glow of a distant town on the horizon
  const town = g.createRadialGradient(512, 256, 20, 512, 256, 470)
  town.addColorStop(0, 'rgba(255,196,128,0.18)')
  town.addColorStop(0.55, 'rgba(120,150,180,0.06)')
  town.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = town
  g.fillRect(0, 140, 1024, 220)

  // stars
  for (let i = 0; i < 420; i++) {
    g.fillStyle = `rgba(220,232,255,${0.15 + Math.random() * 0.55})`
    const s = Math.random() < 0.9 ? 1 : 2
    g.fillRect(Math.random() * 1024, Math.random() * 220, s, s)
  }

  // moon
  const moon = g.createRadialGradient(790, 105, 2, 790, 105, 26)
  moon.addColorStop(0, 'rgba(255,255,240,0.95)')
  moon.addColorStop(0.35, 'rgba(230,238,255,0.35)')
  moon.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = moon
  g.beginPath(); g.arc(790, 105, 26, 0, Math.PI * 2); g.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromEquirectangular(tex)
  pmrem.dispose()
  tex.dispose()
  return envRT.texture
}

/* ================================================================== class */
export class SceneEnvironment {
  constructor(renderer) {
    this.renderer = renderer
    this.scene = new THREE.Scene()

    this.scene.environment = createEnvironment(renderer)
    this.scene.background = new THREE.Color(0x04060a)
    this.scene.fog = new THREE.FogExp2(0x04060a, 0.0024)

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2600)
    this.camera.position.set(0, 3.4, 8)
    this.camera.lookAt(0, 1.2, -30)

    this._initLights()
    this._initGround()
    this._initGrass()
    this._initSky()
    this._initRoad()
    this._initTrees()
    this._initLamps()
    this._initAnimals()

    this.weather = null
    this.weatherType = 'spring'
    this.season = 'spring'
    this.isNight = true
    this.setNight(true)
    this.setWeather('spring')
  }

  /* -------------------------------------------------------------- lights */
  _initLights() {
    this.ambient = new THREE.AmbientLight(0x2a3a55, 1.45)
    this.scene.add(this.ambient)

    this.hemi = new THREE.HemisphereLight(0x223355, 0x05070a, 0.9)
    this.scene.add(this.hemi)

    this.moon = new THREE.DirectionalLight(0xbfd4ff, 0.75)
    this.moon.position.set(80, 140, -160)
    this.moon.castShadow = true
    this.moon.shadow.mapSize.set(2048, 2048)
    this.moon.shadow.camera.near = 10
    this.moon.shadow.camera.far = 600
    this.moon.shadow.camera.left = -140
    this.moon.shadow.camera.right = 140
    this.moon.shadow.camera.top = 140
    this.moon.shadow.camera.bottom = -140
    this.moon.shadow.bias = -0.0004
    this.moon.shadow.normalBias = 0.03
    this.scene.add(this.moon)
    this.scene.add(this.moon.target)
  }

  /* -------------------------------------------------------------- ground */
  _initGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 4000),
      new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 0.55, metalness: 0.35 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.06
    ground.receiveShadow = true
    this.scene.add(ground)
    this.ground = ground
  }

  /* -------------------------------------------------------------- road */
  _initRoad() {
    this.asphaltTex = makeAsphaltTexture()
    this.wetRough = makeWetRoughnessTexture()

    this.asphaltMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.asphaltTex,
      roughnessMap: this.wetRough,
      roughness: 1.0,
      metalness: 0.62,
      envMapIntensity: 1.1
    })

    const whiteLine = new THREE.MeshStandardMaterial({
      color: 0xd5dade, roughness: 0.6, metalness: 0.0
    })
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.45, metalness: 0.6 })
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.7 })
    const studMat = new THREE.MeshStandardMaterial({ color: 0xffc16a, emissive: 0xff8a1f, emissiveIntensity: 1.1, roughness: 0.4 })
    const studGeo = new THREE.BoxGeometry(0.1, 0.07, 0.24)
    const studMat4 = new THREE.Matrix4()

    this.roadSegments = []
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const grp = new THREE.Group()

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH), this.asphaltMat)
      plane.rotation.x = -Math.PI / 2
      plane.receiveShadow = true
      grp.add(plane)

      // longitudinal lane dividers (dashed)
      const lineGeo = new THREE.BoxGeometry(0.14, 0.03, SEGMENT_LENGTH)
      const dashLen = 4
      const dashGap = 4
      const dashesPerSegment = Math.floor(SEGMENT_LENGTH / (dashLen + dashGap))
      const dashGeo = new THREE.BoxGeometry(0.14, 0.03, dashLen)
      const dashMesh = new THREE.InstancedMesh(dashGeo, whiteLine, 3 * dashesPerSegment)
      const dashM = new THREE.Matrix4()
      let di = 0
      for (let l = 1; l < 4; l++) {
        const x = -ROAD_WIDTH / 2 + l * LANE_WIDTH
        for (let d = 0; d < dashesPerSegment; d++) {
          const z = -SEGMENT_LENGTH / 2 + dashLen / 2 + d * (dashLen + dashGap)
          dashM.makeTranslation(x, 0.03, z)
          dashMesh.setMatrixAt(di++, dashM)
        }
      }
      dashMesh.instanceMatrix.needsUpdate = true
      dashMesh.receiveShadow = true
      grp.add(dashMesh)

      // edge lines
      for (const sx of [-ROAD_WIDTH / 2 + 0.25, ROAD_WIDTH / 2 - 0.25]) {
        const line = new THREE.Mesh(lineGeo, whiteLine)
        line.position.set(sx, 0.03, 0)
        grp.add(line)
      }

      // barriers
      const barGeo = new THREE.BoxGeometry(0.7, 1.0, SEGMENT_LENGTH)
      for (const sx of [-ROAD_WIDTH / 2 - 0.55, ROAD_WIDTH / 2 + 0.55]) {
        const b = new THREE.Mesh(barGeo, barrierMat)
        b.position.set(sx, 0.5, 0)
        b.castShadow = true
        b.receiveShadow = true
        grp.add(b)
      }

      // curbs
      const curbGeo = new THREE.BoxGeometry(1.6, 0.16, SEGMENT_LENGTH)
      for (const sx of [-ROAD_WIDTH / 2 - 1.6, ROAD_WIDTH / 2 + 1.6]) {
        const curb = new THREE.Mesh(curbGeo, curbMat)
        curb.position.set(sx, 0.05, 0)
        curb.receiveShadow = true
        grp.add(curb)
      }

      // amber road studs on top of the barriers
      for (const sx of [-ROAD_WIDTH / 2 - 0.55, ROAD_WIDTH / 2 + 0.55]) {
        const studs = new THREE.InstancedMesh(studGeo, studMat, 12)
        for (let k = 0; k < 12; k++) {
          studMat4.makeTranslation(sx, 1.04, -55 + k * 10)
          studs.setMatrixAt(k, studMat4)
        }
        studs.instanceMatrix.needsUpdate = true
        grp.add(studs)
      }

      const z = -(i * SEGMENT_LENGTH)
      grp.position.z = z
      this.scene.add(grp)
      this.roadSegments.push({ mesh: grp, z })
    }
  }

  /* ------------------------------------------------------------ roadside */
  _initGrass() {
    this.grassMat = new THREE.MeshStandardMaterial({ color: 0x1d3b22, roughness: 1 })
    const geo = new THREE.PlaneGeometry(70, 4200)
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(geo, this.grassMat)
      strip.rotation.x = -Math.PI / 2
      strip.position.set(side * (ROAD_WIDTH / 2 + 37), -0.015, -1200)
      strip.receiveShadow = true
      this.scene.add(strip)
    }
  }

  _initSky() {
    const count = 900
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const y = 80 + Math.pow(Math.random(), 0.7) * 820
      const r = 700 + Math.random() * 900
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 1.7, sizeAttenuation: false,
      transparent: true, opacity: 0.8, depthWrite: false, fog: false
    })
    this.stars = new THREE.Points(geo, mat)
    this.stars.frustumCulled = false
    this.scene.add(this.stars)
  }

  _initTrees() {
    this.treeCount = 200
    this.treeData = []

    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.28, 3.4, 6)
    trunkGeo.translate(0, 1.7, 0)
    this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 })
    this.trunkMesh = new THREE.InstancedMesh(trunkGeo, this.trunkMat, this.treeCount)
    this.trunkMesh.castShadow = true
    this.trunkMesh.receiveShadow = true
    this.trunkMesh.frustumCulled = false
    this.scene.add(this.trunkMesh)

    const leafGeo = new THREE.IcosahedronGeometry(1, 1)
    this.leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })
    this.leafMesh = new THREE.InstancedMesh(leafGeo, this.leafMat, this.treeCount)
    this.leafMesh.castShadow = true
    this.leafMesh.frustumCulled = false
    this.scene.add(this.leafMesh)

    this.leafMesh2 = new THREE.InstancedMesh(leafGeo, this.leafMat, this.treeCount)
    this.leafMesh2.castShadow = true
    this.leafMesh2.frustumCulled = false
    this.scene.add(this.leafMesh2)

    this._m4 = new THREE.Matrix4()
    this._q = new THREE.Quaternion()
    this._color = new THREE.Color()
    this._pos = new THREE.Vector3()
    this._scl = new THREE.Vector3()

    for (let i = 0; i < this.treeCount; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const data = {
        x: side * (ROAD_WIDTH / 2 + 5 + Math.random() * 20),
        z: -40 - i * 7 - Math.random() * 6,
        h: 0.8 + Math.random() * 1.2,
        r: 0.9 + Math.random() * 1.0,
        blossom: Math.random() < 0.12,
        side
      }
      this.treeData.push(data)
      this._placeTree(i)
    }
    this._applySeason('spring')
  }

  _placeTree(i) {
    const t = this.treeData[i]

    this._pos.set(t.x, 0, t.z)
    this._scl.set(t.h, t.h, t.h)
    this._m4.compose(this._pos, this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2), this._scl)
    this.trunkMesh.setMatrixAt(i, this._m4)

    this._pos.set(t.x, 3.0 * t.h + t.r * 0.5, t.z)
    this._scl.set(t.r, t.r * 1.15, t.r)
    this._m4.compose(this._pos, this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2), this._scl)
    this.leafMesh.setMatrixAt(i, this._m4)

    this._pos.set(t.x + t.r * 0.5, 3.0 * t.h + t.r * 1.05, t.z + t.r * 0.35)
    this._scl.set(t.r * 0.62, t.r * 0.72, t.r * 0.62)
    this._m4.compose(this._pos, this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2), this._scl)
    this.leafMesh2.setMatrixAt(i, this._m4)

    this.trunkMesh.instanceMatrix.needsUpdate = true
    this.leafMesh.instanceMatrix.needsUpdate = true
    this.leafMesh2.instanceMatrix.needsUpdate = true
  }

  _applySeason(season) {
    this.season = season
    const palettes = {
      spring: [0x4fbf5a, 0x63cf6a, 0x3da84c],
      summer: [0x2f7d3a, 0x3a9445, 0x256b31],
      autumn: [0xc4691c, 0xd98a22, 0xa94e17],
      rain: [0x335f3a, 0x3f7047, 0x2a5131]
    }
    const pal = palettes[season] || palettes.spring
    const grass = { spring: 0x1d4a24, summer: 0x173d1f, autumn: 0x3a2b16, rain: 0x18331e }[season]
    this.grassMat.color.setHex(grass)

    for (let i = 0; i < this.treeCount; i++) {
      const t = this.treeData[i]
      if (season === 'spring' && t.blossom) this._color.setHex(0xffe4ee)
      else this._color.setHex(pal[i % pal.length])
      this._color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)
      this.leafMesh.setColorAt(i, this._color)
      this.leafMesh2.setColorAt(i, this._color)
    }
    this.leafMesh.instanceColor.needsUpdate = true
    this.leafMesh2.instanceColor.needsUpdate = true
  }

  /* -------------------------------------------------------------- lamps */
  _initLamps() {
    this.lamps = []
    this.lampGlowTex = makeGlowTexture()
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f26, emissive: 0x0a0e13, emissiveIntensity: 0.8,
      roughness: 0.55, metalness: 0.75
    })
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 10.5, 8)
    const armGeo = new THREE.BoxGeometry(2.6, 0.12, 0.12)
    const bulbGeo = new THREE.SphereGeometry(0.22, 10, 10)

    for (let i = 0; i < LAMP_COUNT; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const pair = Math.floor(i / 2)
      const warm = pair % 3 !== 0
      const col = warm ? 0xffd9a3 : 0xcfe6ff
      const grp = new THREE.Group()

      const pole = new THREE.Mesh(poleGeo, poleMat)
      pole.position.set(0, 5.25, 0)
      pole.castShadow = true
      grp.add(pole)

      const arm = new THREE.Mesh(armGeo, poleMat)
      arm.position.set(-side * 1.25, 10.35, 0)
      grp.add(arm)

      const bulbMat = new THREE.MeshBasicMaterial({ color: col })
      const bulb = new THREE.Mesh(bulbGeo, bulbMat)
      bulb.position.set(-side * 2.45, 10.2, 0)
      grp.add(bulb)

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.lampGlowTex, color: col, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false
      }))
      halo.position.copy(bulb.position)
      halo.scale.set(2.6, 2.6, 1)
      grp.add(halo)

      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 20),
        new THREE.MeshBasicMaterial({
          map: this.lampGlowTex, color: col, transparent: true, opacity: 0.2,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      )
      pool.rotation.x = -Math.PI / 2
      pool.position.set(-side * 2.45, 0.05, 0)
      grp.add(pool)

      const light = new THREE.PointLight(col, 60, 48, 2)
      light.position.copy(bulb.position)
      grp.add(light)

      grp.position.set(side * (ROAD_WIDTH / 2 + 2.4), 0, -pair * LAMP_SPACING)
      this.scene.add(grp)
      this.lamps.push({ grp, light, bulb, side, z: grp.position.z })
    }
  }

  /* ------------------------------------------------------------ animals */
  _initAnimals() {
    const mats = this.animalMats = {
      deer: new THREE.MeshStandardMaterial({ color: 0xa06a40, roughness: 0.92 }),
      deerDark: new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.95 }),
      rabbit: new THREE.MeshStandardMaterial({ color: 0xc9b99e, roughness: 0.95 }),
      fox: new THREE.MeshStandardMaterial({ color: 0xd06622, roughness: 0.9 }),
      foxDark: new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.95 })
    }

    const makeDeer = () => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.52, 1.15), mats.deer)
      body.position.y = 0.92
      g.add(body)
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.65, 0.28), mats.deer)
      neck.position.set(0, 1.28, -0.5)
      neck.rotation.x = -0.25
      g.add(neck)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.48), mats.deer)
      head.position.set(0, 1.6, -0.72)
      g.add(head)
      for (const sx of [-0.08, 0.08]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), mats.deerDark)
        ear.position.set(sx, 1.76, -0.62)
        ear.rotation.z = sx > 0 ? 0.35 : -0.35
        g.add(ear)
        const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.4, 4), mats.deerDark)
        antler.position.set(sx, 1.88, -0.66)
        antler.rotation.z = sx > 0 ? 0.25 : -0.25
        g.add(antler)
      }
      const legGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.72, 5)
      for (const sx of [-0.18, 0.18]) {
        for (const sz of [-0.38, 0.38]) {
          const leg = new THREE.Mesh(legGeo, mats.deerDark)
          leg.position.set(sx, 0.36, sz)
          g.add(leg)
        }
      }
      return g
    }

    const makeRabbit = () => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 7), mats.rabbit)
      body.scale.set(0.8, 0.75, 1.25)
      body.position.y = 0.34
      g.add(body)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 7), mats.rabbit)
      head.position.set(0, 0.55, -0.28)
      g.add(head)
      for (const sx of [-0.06, 0.06]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mats.rabbit)
        ear.scale.set(0.6, 2.4, 0.45)
        ear.position.set(sx, 0.78, -0.24)
        g.add(ear)
      }
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), mats.rabbit)
      tail.position.set(0, 0.38, 0.36)
      g.add(tail)
      return g
    }

    const makeFox = () => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.85), mats.fox)
      body.position.y = 0.48
      g.add(body)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.36), mats.fox)
      head.position.set(0, 0.62, -0.52)
      g.add(head)
      for (const sx of [-0.1, 0.1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), mats.foxDark)
        ear.position.set(sx, 0.8, -0.5)
        g.add(ear)
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 6), mats.fox)
      tail.position.set(0, 0.55, 0.62)
      tail.rotation.x = Math.PI / 2 + 0.25
      g.add(tail)
      const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.4, 5)
      for (const sx of [-0.12, 0.12]) {
        for (const sz of [-0.3, 0.3]) {
          const leg = new THREE.Mesh(legGeo, mats.foxDark)
          leg.position.set(sx, 0.2, sz)
          g.add(leg)
        }
      }
      return g
    }

    const factories = { deer: makeDeer, rabbit: makeRabbit, fox: makeFox }
    const build = ['deer', 'rabbit', 'deer', 'fox', 'rabbit', 'deer', 'fox', 'rabbit']
    this.animals = []

    for (let i = 0; i < build.length; i++) {
      const type = build[i]
      const grp = factories[type]()
      const side = i % 2 === 0 ? 1 : -1
      grp.position.set(
        side * (ROAD_WIDTH / 2 + 5 + Math.random() * 6),
        0,
        -80 - i * 90 - Math.random() * 60
      )
      grp.scale.setScalar(type === 'deer' ? 1.15 : 1)
      grp.rotation.y = side > 0 ? Math.PI : 0
      grp.visible = false
      this.scene.add(grp)
      this.animals.push({ grp, type, side, phase: Math.random() * Math.PI * 2 })
    }
    this._seasonAnimals('spring')
    const first = this.animals.find((a) => a.type === 'deer')
    if (first) {
      first.grp.visible = true
      first.grp.position.set(-11.8, 0, -38)
      first.grp.rotation.y = -Math.PI / 2
      first.grp.scale.setScalar(1.3)
      first.grp.rotation.y = Math.PI / 2
    }
  }

  _seasonAnimals(season) {
    const allowed = {
      spring: ['deer', 'rabbit'],
      summer: ['deer', 'rabbit', 'fox'],
      autumn: ['deer', 'fox'],
      rain: ['deer']
    }[season] || ['deer']
    this.animalsAllowed = allowed
    for (const a of this.animals) {
      a.grp.visible = allowed.includes(a.type) && Math.random() < 0.55
    }
    const first = this.animals.find((a) => allowed.includes(a.type))
    if (first) first.grp.visible = true
  }

  /* -------------------------------------------------------------- weather */
  setWeather(type) {
    if (this.weather) {
      this.scene.remove(this.weather.obj)
      this.weather.obj.geometry.dispose()
      this.weather.obj.material.dispose()
      this.weather = null
    }

    this.weatherType = type
    const season = type === 'rain' ? 'rain' : type
    this._applySeason(season)
    this._seasonAnimals(season)

    const makeFall = (count, colors, size) => {
      const positions = new Float32Array(count * 3)
      const colorArr = new Float32Array(count * 3)
      const speeds = new Float32Array(count)
      const c = new THREE.Color()
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 90
        positions[i * 3 + 1] = Math.random() * 40
        positions[i * 3 + 2] = (Math.random() - 0.5) * 160
        c.setHex(colors[(Math.random() * colors.length) | 0])
        colorArr[i * 3] = c.r; colorArr[i * 3 + 1] = c.g; colorArr[i * 3 + 2] = c.b
        speeds[i] = 1.2 + Math.random() * 2.2
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))
      const mat = new THREE.PointsMaterial({
        map: this._petalTex, size, transparent: true, opacity: 0.9,
        vertexColors: true, depthWrite: false, alphaTest: 0.05
      })
      const obj = new THREE.Points(geo, mat)
      obj.frustumCulled = false
      this.scene.add(obj)
      return { obj, geo, count, type, speeds }
    }

    if (!this._petalTex) this._petalTex = makePetalTexture()

    if (type === 'rain') {
      const count = 4200
      const positions = new Float32Array(count * 6)
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 160
        const y = Math.random() * 90
        const z = (Math.random() - 0.5) * 220
        positions[i * 6] = x
        positions[i * 6 + 1] = y
        positions[i * 6 + 2] = z
        positions[i * 6 + 3] = x + 0.06
        positions[i * 6 + 4] = y - 1.4
        positions[i * 6 + 5] = z
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const mat = new THREE.LineBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.3 })
      const obj = new THREE.LineSegments(geo, mat)
      obj.frustumCulled = false
      this.scene.add(obj)
      this.weather = { obj, geo, count, type, speeds: new Float32Array(count).map(() => 55 + Math.random() * 40) }
      this.scene.fog.density = 0.006
    } else if (type === 'spring') {
      this.weather = makeFall(1100, [0xffc4dd, 0xffe1ec, 0xff9fc4, 0xf2f7ff], 0.2)
      this.scene.fog.density = 0.0032
    } else if (type === 'autumn') {
      this.weather = makeFall(1000, [0xd4771f, 0xe0a020, 0xa94e17, 0xc9b13a], 0.26)
      this.scene.fog.density = 0.0036
    } else {
      this.scene.fog.density = 0.0024
    }

    // road surface reacts to the season / rain
    const wet = type === 'rain'
    this.asphaltMat.metalness = wet ? 0.62 : 0.24
    this.asphaltMat.roughness = wet ? 1.0 : 0.9
    this.asphaltMat.envMapIntensity = wet ? 1.15 : 0.65
  }

  updateWeather(dt, carZ) {
    if (!this.weather) return
    const { geo, count, type, speeds, obj } = this.weather
    const pos = geo.attributes.position.array
    const time = performance.now() * 0.001

    if (type === 'rain') {
      for (let i = 0; i < count; i++) {
        const idx = i * 6
        const fall = speeds[i] * dt
        pos[idx + 1] -= fall
        pos[idx + 4] -= fall
        if (pos[idx + 4] < 0) {
          const x = (Math.random() - 0.5) * 150
          const z = carZ + (Math.random() - 0.5) * 200 - 50
          const y = 60 + Math.random() * 40
          pos[idx] = x; pos[idx + 1] = y; pos[idx + 2] = z
          pos[idx + 3] = x + 0.08; pos[idx + 4] = y - 1.5; pos[idx + 5] = z
        }
      }
    } else if (type === 'spring' || type === 'autumn') {
      for (let i = 0; i < count; i++) {
        const idx = i * 3
        pos[idx + 1] -= speeds[i] * dt
        pos[idx] += (Math.sin(time * 1.1 + i) * 0.9 + 0.35) * dt
        pos[idx + 2] += Math.cos(time * 0.8 + i * 1.7) * dt * 0.5
        if (pos[idx + 1] < 0) {
          pos[idx] = (Math.random() - 0.5) * 90
          pos[idx + 1] = 26 + Math.random() * 22
          pos[idx + 2] = carZ + (Math.random() - 0.5) * 170
        }
      }
    }
    geo.attributes.position.needsUpdate = true
    obj.position.z = carZ
  }

  /* -------------------------------------------------------------- day/night */
  setNight(isNight) {
    this.isNight = isNight
    const rainy = this.weatherType === 'rain'
    if (isNight) {
      this.scene.background.setHex(rainy ? 0x05080d : 0x060910)
      this.scene.fog.color.setHex(rainy ? 0x05080d : 0x060910)
      this.ambient.color.setHex(0x2a3a55); this.ambient.intensity = 1.4
      this.hemi.intensity = 0.98
      this.moon.color.setHex(0xbfd4ff); this.moon.intensity = 0.8
      this.renderer.toneMappingExposure = 1.05
      for (const l of this.lamps) l.light.intensity = 60
    } else {
      this.scene.background.setHex(rainy ? 0x8b99a6 : 0x8fb8d8)
      this.scene.fog.color.setHex(rainy ? 0x96a2ac : 0x9fc3dd)
      this.ambient.color.setHex(0xffffff); this.ambient.intensity = 1.55
      this.hemi.intensity = 1.35
      this.moon.color.setHex(0xfff2dd); this.moon.intensity = 2.2
      this.renderer.toneMappingExposure = 0.9
      for (const l of this.lamps) l.light.intensity = 0.6
    }
    if (this.stars) this.stars.visible = isNight
    if (this.weather) this.setWeather(this.weatherType)
  }

  /* -------------------------------------------------------------- endless */
  updateRoad(carZ) {
    this.carZ = carZ

    // road segments
    let minZ = Infinity
    for (const s of this.roadSegments) minZ = Math.min(minZ, s.z)
    for (const s of this.roadSegments) {
      if (s.z > carZ + SEGMENT_LENGTH * 1.5) {
        s.z = minZ - SEGMENT_LENGTH
        minZ = s.z
        s.mesh.position.z = s.z
      }
    }

    // lamps (kept in left/right pairs so both shoulders stay evenly lit)
    let lampMin = Infinity
    for (const l of this.lamps) lampMin = Math.min(lampMin, l.z)
    for (let p = 0; p < this.lamps.length; p += 2) {
      const a = this.lamps[p]
      const b = this.lamps[p + 1]
      if (a.z > carZ + 120) {
        const z = lampMin - LAMP_SPACING
        lampMin = z
        for (const l of [a, b]) {
          if (!l) continue
          l.z = z
          l.grp.position.z = z
        }
      }
    }

    // trees
    let treeMin = Infinity
    for (const t of this.treeData) treeMin = Math.min(treeMin, t.z)
    for (let i = 0; i < this.treeData.length; i++) {
      const t = this.treeData[i]
      if (t.z > carZ + 100) {
        t.z = treeMin - (10 + Math.random() * 12)
        treeMin = t.z
        t.side = Math.random() < 0.5 ? 1 : -1
        t.x = t.side * (ROAD_WIDTH / 2 + 7 + Math.random() * 26)
        t.h = 0.8 + Math.random() * 0.9
        t.r = 1.15 + Math.random() * 1.05
        t.blossom = Math.random() < 0.2
        this._placeTree(i)
        const pal = {
          spring: [0x4fbf5a, 0x63cf6a, 0x3da84c],
          summer: [0x2f7d3a, 0x3a9445, 0x256b31],
          autumn: [0xc4691c, 0xd98a22, 0xa94e17],
          rain: [0x335f3a, 0x3f7047, 0x2a5131]
        }[this.season] || [0x4fbf5a]
        this._color.setHex(this.season === 'spring' && t.blossom ? 0xffe4ee : pal[i % pal.length])
        this.leafMesh.setColorAt(i, this._color)
        this.leafMesh2.setColorAt(i, this._color)
        this.leafMesh.instanceColor.needsUpdate = true
        this.leafMesh2.instanceColor.needsUpdate = true
      }
    }

    // roadside animals: appear, wander a little, recycle ahead
    const allowed = this.animalsAllowed || ['deer']
    for (const a of this.animals) {
      if (!a.grp.visible) {
        if (Math.random() < 0.0008) a.grp.visible = allowed.includes(a.type)
        continue
      }
      a.grp.position.y = Math.abs(Math.sin(performance.now() * 0.0015 + a.phase)) * 0.03
      a.grp.rotation.y += Math.sin(performance.now() * 0.0004 + a.phase) * 0.0015
      if (a.grp.position.z > carZ + 45) {
        const side = Math.random() < 0.5 ? 1 : -1
        a.side = side
        a.grp.position.x = side * (ROAD_WIDTH / 2 + 5 + Math.random() * 7)
        a.grp.position.z = carZ - (160 + Math.random() * 320)
        a.grp.rotation.y = side > 0 ? Math.PI : 0
        a.grp.visible = allowed.includes(a.type) && Math.random() < 0.6
      }
    }

    // keep ground & moon following for consistent shadows
    this.ground.position.z = carZ - 800
    if (this.stars) this.stars.position.z = carZ
    this.moon.position.set(80, 140, carZ - 160)
    this.moon.target.position.set(0, 0, carZ - 40)
    this.moon.target.updateMatrixWorld()
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.dispose()
      }
    })
  }
}
