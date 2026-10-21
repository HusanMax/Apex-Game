import * as THREE from 'three'

const LANES = [-6, -2, 2, 6]
const MAX_CARS = 20

const CAR_COLORS = [0x9aa3ad, 0x1f2a3a, 0x8a1f28, 0xd8d8d8, 0x243b55, 0x5a4632, 0x101214, 0x3a5a40]

export class TrafficSystem {
  constructor(scene) {
    this.scene = scene
    this.cars = []
    this.density = 6
    this._initPool()
  }

  _initPool() {
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 4.0)
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.55, 2.0)
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14)
    wheelGeo.rotateZ(Math.PI / 2)
    const tailGeo = new THREE.BoxGeometry(0.4, 0.14, 0.06)

    for (let i = 0; i < MAX_CARS; i++) {
      const grp = new THREE.Group()

      const color = CAR_COLORS[i % CAR_COLORS.length]
      const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.3 })
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.y = 0.62
      body.castShadow = true
      grp.add(body)

      const cabin = new THREE.Mesh(
        cabinGeo,
        new THREE.MeshStandardMaterial({ color: 0x0a1016, metalness: 0.5, roughness: 0.15 })
      )
      cabin.position.set(0, 1.12, 0.1)
      grp.add(cabin)

      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x070809, roughness: 0.9 })
      for (const [wx, wz] of [[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat)
        w.position.set(wx, 0.33, wz)
        grp.add(w)
      }

      const tailMat = new THREE.MeshStandardMaterial({
        color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.0
      })
      for (const sx of [-0.6, 0.6]) {
        const tail = new THREE.Mesh(tailGeo, tailMat)
        tail.position.set(sx, 0.7, 2.02)
        grp.add(tail)
      }

      grp.visible = false
      this.scene.add(grp)

      this.cars.push({ group: grp, lane: i % 4, z: -(i * 90 + 100), speed: 20, active: false })
    }
  }

  setDensity(n) {
    this.density = THREE.MathUtils.clamp(n, 0, MAX_CARS)
  }

  _respawn(car, playerZ) {
    car.lane = Math.floor(Math.random() * 4)
    car.z = playerZ - (170 + Math.random() * 650)
    car.speed = 16 + Math.random() * 14
    car.group.position.set(LANES[car.lane], 0, car.z)
    // vary body color a little
    car.active = true
    car.group.visible = true
  }

  update(dt, playerZ, playerX) {
    let collided = false

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i]
      const shouldBeActive = i < this.density

      if (!shouldBeActive) {
        if (car.active) { car.active = false; car.group.visible = false }
        continue
      }

      if (!car.active || car.z > playerZ + 60) {
        this._respawn(car, playerZ)
      }

      car.z -= car.speed * dt
      car.group.position.z = car.z
      car.group.position.x = LANES[car.lane]

      // collision test with player
      if (Math.abs(car.z - playerZ) < 3.4 && Math.abs(LANES[car.lane] - playerX) < 2.0) {
        collided = true
        this._respawn(car, playerZ) // move it away
      }
    }

    return collided
  }
}
