export class InputHandler {
  constructor(){this.keys=new Set();this.onDown= e=>{this.keys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault()};this.onUp=e=>this.keys.delete(e.code);window.addEventListener('keydown',this.onDown,{passive:false});window.addEventListener('keyup',this.onUp)}
  down(...codes){return codes.some(c=>this.keys.has(c))}
  get steer(){return (this.down('KeyD','ArrowRight')?1:0)-(this.down('KeyA','ArrowLeft')?1:0)}
  get throttle(){return this.down('KeyW','ArrowUp')?1:0}
  get brake(){return this.down('KeyS','ArrowDown')?1:0}
  get boost(){return this.down('KeyQ')}
  dispose(){window.removeEventListener('keydown',this.onDown);window.removeEventListener('keyup',this.onUp)}
}
