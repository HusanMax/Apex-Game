import * as THREE from 'three'

export class Traffic {
  constructor(scene){this.scene=scene;this.cars=[];this.rate=0.42;this.timer=1;this.lanes=[-6,-2,2,6];this.materials=['#e6a344','#e5edf0','#dc554c','#588eaa','#acb4b0'].map(c=>new THREE.MeshStandardMaterial({color:c,metalness:.38,roughness:.34}));this.wire=new THREE.MeshStandardMaterial({color:'#182226',metalness:.5,roughness:.3})}
  spawn(){if(this.cars.length>=12)return;const lane=this.lanes[Math.floor(Math.random()*4)];const dir=Math.random()<.2?-1:1;const g=new THREE.Group();g.position.set(lane,.03,-160);g.userData={dir,speed:dir<0?18+Math.random()*18:6+Math.random()*12};const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,.65,3.7),this.materials[Math.floor(Math.random()*this.materials.length)]);body.position.y=.64;g.add(body);const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.45,.55,1.65),this.wire);cabin.position.set(0,1.2,-.12);g.add(cabin);this.scene.add(g);this.cars.push(g)}
  update(dt,speed,density){this.rate=.12+density*.8;this.timer-=dt;if(this.timer<=0){this.spawn();this.timer=1/this.rate}for(let i=this.cars.length-1;i>=0;i--){const c=this.cars[i];c.position.z+=(speed-c.userData.speed*c.userData.dir)*dt;if(c.position.z>12||c.position.z< -230){this.scene.remove(c);this.cars.splice(i,1)}}}
  dispose(){this.cars.forEach(c=>this.scene.remove(c));this.cars=[]}
}
