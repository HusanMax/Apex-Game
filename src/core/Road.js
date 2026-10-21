import * as THREE from 'three'

export class Road {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(17, 500), new THREE.MeshStandardMaterial({ color: '#38413e', roughness: .88 }))
    road.rotation.x = -Math.PI / 2; road.position.z = -165; road.receiveShadow = true; road.userData.roadSurface = true; this.group.add(road)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 600), new THREE.MeshStandardMaterial({ color: '#456044', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.08, -150); ground.receiveShadow = true; ground.userData.environmentGround = true; this.group.add(ground)
    const white = new THREE.MeshStandardMaterial({ color: '#f2f2db', emissive: '#26251c', roughness: .6 })
    const cyan = new THREE.MeshStandardMaterial({ color: '#61ead0', emissive: '#0b4037', roughness: .45 })
    for (const x of [-8.15, 8.15]) { const line = new THREE.Mesh(new THREE.BoxGeometry(.16, .025, 500), white); line.position.set(x,.015,-165); this.group.add(line) }
    this.markers = []
    for (const x of [-4, 0, 4]) for (let i = 0; i < 24; i++) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(.09,.025,4.2), cyan); marker.position.set(x,.025,-i*10-4); this.group.add(marker); this.markers.push(marker)
    }
    this.posts = []
    const postMat = new THREE.MeshStandardMaterial({ color: '#a6b0a9', metalness: .65, roughness: .35 })
    for (let i=0;i<24;i++) for (const x of [-10,10]) {
      const g = new THREE.Group(); g.position.set(x,0,-i*11-8)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,1.8,7),postMat); pole.position.y=.9; g.add(pole)
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.45,.12,.22),new THREE.MeshStandardMaterial({color:'#fff1cb',emissive:'#ad8f54',emissiveIntensity:.3})); lamp.position.set(0,1.85,0); g.add(lamp)
      this.group.add(g); this.posts.push(g)
    }
  }
  update(dt, speed) { const dz = speed * dt; for (const o of [...this.markers,...this.posts]) { o.position.z += dz; if (o.position.z > 8) o.position.z -= 240 } }
}
