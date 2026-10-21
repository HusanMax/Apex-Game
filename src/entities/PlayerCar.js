import * as THREE from 'three'

export class PlayerCar {
  constructor(scene) {
    this.scene=scene; this.root=new THREE.Group(); scene.add(this.root); this.root.position.set(0,0,3)
    const paint=new THREE.MeshPhysicalMaterial({color:'#a6f542',metalness:.72,roughness:.22,clearcoat:1,clearcoatRoughness:.12})
    const dark=new THREE.MeshStandardMaterial({color:'#111a1a',metalness:.65,roughness:.28})
    const glass=new THREE.MeshPhysicalMaterial({color:'#142831',metalness:.55,roughness:.12,clearcoat:1})
    const body=this.box(2.05,.55,4.15,paint,0,.75,0); body.castShadow=true
    this.box(1.56,.62,1.85,paint,0,1.22,-.24)
    this.box(1.42,.47,1.58,glass,0,1.28,-.26)
    this.box(1.96,.18,1.0,paint,0,1.48,-1.68)
    this.box(.12,.48,.12,dark,-.78,1.77,-1.66); this.box(.12,.48,.12,dark,.78,1.77,-1.66)
    this.box(1.98,.16,.22,dark,0,.49,-2.02); this.box(2.12,.14,3.45,dark,0,.48,.02)
    this.box(.24,.2,.42,dark,-1.04,.54,0); this.box(.24,.2,.42,dark,1.04,.54,0)
    for (const x of [-.72,.72]) {
      const head=new THREE.Mesh(new THREE.BoxGeometry(.42,.16,.08),new THREE.MeshStandardMaterial({color:'#e8fff2',emissive:'#eafff2',emissiveIntensity:1.8})); head.position.set(x,.89,2.08); this.root.add(head)
      const tail=new THREE.Mesh(new THREE.BoxGeometry(.45,.13,.08),new THREE.MeshStandardMaterial({color:'#ff3548',emissive:'#c40022',emissiveIntensity:1.4})); tail.position.set(x,.88,-2.08); this.root.add(tail)
    }
    this.headlights=[]
    for(const x of [-.67,.67]) { const light=new THREE.SpotLight('#dffff3',0,28,.32,.5,1.5); light.position.set(x,.9,2.1); light.target.position.set(x,.2,18); this.root.add(light,light.target); this.headlights.push(light) }
    this.wheels=[]
    for (const x of [-1.08,1.08]) for (const z of [-1.35,1.35]) {
      const tire=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.28,20),dark); tire.rotation.z=Math.PI/2; tire.position.set(x,.47,z); tire.castShadow=true; this.root.add(tire); this.wheels.push(tire)
      const rim=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.3,12),new THREE.MeshStandardMaterial({color:'#b4c6c4',metalness:.9,roughness:.2})); rim.rotation.z=Math.PI/2; rim.position.copy(tire.position); this.root.add(rim)
    }
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(2.5,3.7),new THREE.MeshBasicMaterial({color:'#38ffe1',transparent:true,opacity:.24,side:THREE.DoubleSide})); glow.rotation.x=-Math.PI/2; glow.position.y=.08; this.root.add(glow)
    this.nitro=new THREE.Group(); this.root.add(this.nitro)
    for(let i=0;i<16;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.07+Math.random()*.08,6,5),new THREE.MeshBasicMaterial({color:i%2?'#38ffe1':'#a6f542',transparent:true,opacity:.8})); this.nitro.add(p); p.userData.phase=Math.random()*Math.PI*2}
    this.steer=0; this.headlightsOn=false
  }
  box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);this.root.add(m);return m}
  setHeadlights(on){this.headlightsOn=on;this.headlights.forEach(l=>l.intensity=on?90:0)}
  update(dt, input, speed, nitroActive){this.steer=THREE.MathUtils.damp(this.steer,input.steer,8,dt);this.root.position.x=THREE.MathUtils.clamp(this.root.position.x+this.steer*dt*5,-5.9,5.9);this.root.rotation.z=-this.steer*.055;this.root.rotation.y=-this.steer*.025;this.wheels.forEach(w=>w.rotation.x+=speed*dt*.04);this.nitro.visible=nitroActive;this.nitro.children.forEach(p=>{p.position.set((Math.random()-.5)*.7,.58+Math.random()*.22,-2.4-Math.random()*1.4);p.scale.setScalar(.6+Math.random()*.9)})}
}
