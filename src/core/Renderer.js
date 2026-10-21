import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/* Radial speed blur + subtle vignette, driven by nitro / speed. */
const RadialVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.0 },
    center: { value: new THREE.Vector2(0.5, 0.52) }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform vec2 center;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - center;
      float dist = length(dir);
      float blur = strength * smoothstep(0.15, 0.75, dist);

      vec4 sum = vec4(0.0);
      const int SAMPLES = 10;
      for (int i = 0; i < SAMPLES; i++) {
        float t = float(i) / float(SAMPLES - 1);
        vec2 uv = vUv - dir * blur * t;
        sum += texture2D(tDiffuse, uv);
      }
      vec4 color = sum / float(SAMPLES);

      // vignette
      float vig = smoothstep(0.95, 0.35, dist);
      color.rgb *= mix(0.72, 1.0, vig);

      gl_FragColor = color;
    }
  `
}

export class Renderer {
  constructor({ canvas, width, height }) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setSize(width, height)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.composer = new EffectComposer(this.renderer)
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.5, 0.78)
    this.bloomPass.threshold = 0.78
    this.bloomPass.strength = 0.42
    this.bloomPass.radius = 0.5

    this.radialPass = new ShaderPass(RadialVignetteShader)
    this.radialPass.uniforms.strength.value = 0

    this.outputPass = new OutputPass()

    this._radialTarget = 0
  }

  setScene(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.composer.passes = []
    this.composer.addPass(new RenderPass(scene, camera))
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(this.radialPass)
    this.composer.addPass(this.outputPass)
  }

  setSize(width, height) {
    this.renderer.setSize(width, height)
    this.composer.setSize(width, height)
    if (this.bloomPass) this.bloomPass.size.set(width, height)
    if (this.camera) {
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
  }

  setSpeedEffects(dt, { nitroActive, speedFactor }) {
    // gentle, stable radial blur (no colour shifting)
    const target = nitroActive ? 0.20 : speedFactor * 0.02
    this._radialTarget += (target - this._radialTarget) * Math.min(1, dt * 6)
    this.radialPass.uniforms.strength.value = this._radialTarget

    const bloomTarget = nitroActive ? 0.9 : 0.42
    this.bloomPass.strength += (bloomTarget - this.bloomPass.strength) * Math.min(1, dt * 4)
  }

  render() {
    this.composer.render()
  }

  dispose() {
    this.composer.dispose()
    this.renderer.dispose()
  }
}
