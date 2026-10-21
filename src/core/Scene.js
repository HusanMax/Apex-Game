import * as THREE from 'three'

export function createWorld(canvas) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#a9cbd1')
  scene.fog = new THREE.Fog('#a9cbd1', 70, 260)
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7))
  renderer.setSize(innerWidth, innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  const hemi = new THREE.HemisphereLight('#d9f3ff', '#43533e', 2.0); scene.add(hemi)
  const sun = new THREE.DirectionalLight('#fff1cf', 3.2); sun.position.set(-30, 55, 24); sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024); scene.add(sun)
  const fill = new THREE.PointLight('#31f7d4', 20, 30); fill.position.set(0, 3, -3); scene.add(fill)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(350, 24, 16), new THREE.MeshBasicMaterial({ color: '#a9cbd1', side: THREE.BackSide }))
  scene.add(sky)
  const snowPositions = new Float32Array(720 * 3)
  for (let i=0;i<720;i++) { snowPositions[i*3]=(Math.random()-.5)*34; snowPositions[i*3+1]=Math.random()*24; snowPositions[i*3+2]=(Math.random()-.5)*100 }
  const snowGeometry = new THREE.BufferGeometry(); snowGeometry.setAttribute('position',new THREE.BufferAttribute(snowPositions,3))
  const snow = new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:'#f2fbff',size:.14,transparent:true,opacity:.8,depthWrite:false})); snow.visible=false; scene.add(snow)
  return { scene, camera, renderer, sun, hemi, sky, snow, updateSnow(dt) { const a=snow.geometry.attributes.position; for(let i=0;i<a.count;i++){a.array[i*3+1]-=dt*3.2;if(a.array[i*3+1]<0)a.array[i*3+1]=24}a.needsUpdate=true }, resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)) } }
}

export function applyEnvironment(world, season, time) {
  const palettes = {
    Summer: ['#a9cbd1', '#456044', '#38413e'], Autumn: ['#d7a477', '#8c5833', '#3c3935'],
    Winter: ['#d7e8ed', '#d8e5df', '#46505a'], Rainy: ['#788d99', '#46585a', '#303b44'],
  }
  const [sky, ground, road] = palettes[season] || palettes.Summer
  const night = time === 'Cyberpunk Night'
  const sunset = time === 'Sunset'
  world.scene.background.set(night ? '#101329' : sunset ? '#dc9267' : sky)
  world.scene.fog.color.set(night ? '#171b31' : sunset ? '#dc9267' : sky)
  world.scene.traverse((o) => { if (o.userData.environmentGround && o.material) o.material.color.set(ground); if (o.userData.roadSurface && o.material) { o.material.color.set(road); o.material.roughness = season === 'Rainy' ? 0.22 : 0.88 } })
  world.sun.color.set(night ? '#748dff' : sunset ? '#ffad6d' : '#fff1cf'); world.sun.intensity = night ? 0.55 : 3.2
  world.hemi.intensity = night ? 0.35 : 2
  world.sky.material.color.set(night ? '#101329' : sunset ? '#dc9267' : sky)
  world.snow.visible = season === 'Winter'
}
