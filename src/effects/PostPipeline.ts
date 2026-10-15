import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RENDER } from '../utils/Constants';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uStrength: { value: RENDER.VIGNETTE_STRENGTH },
    uSize: { value: 0.78 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uGlitch: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uSize;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    uniform float uGlitch;
    uniform float uTime;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      if (uGlitch > 0.001) {
        float row = floor(uv.y * 48.0);
        float jitter = (hash(row + floor(uTime * 24.0)) - 0.5) * uGlitch * 0.05;
        float gate = step(0.72, hash(row * 3.1 + floor(uTime * 18.0)));
        uv.x += jitter * gate;
      }
      vec4 c = texture2D(tDiffuse, uv);
      if (uGlitch > 0.001) {
        float shift = uGlitch * 0.004;
        c.r = texture2D(tDiffuse, uv + vec2(shift, 0.0)).r;
        c.b = texture2D(tDiffuse, uv - vec2(shift, 0.0)).b;
      }
      float d = distance(vUv, vec2(0.5));
      c.rgb *= mix(1.0, smoothstep(uSize, uSize - 0.5, d), uStrength);
      c.rgb = mix(c.rgb, uFlashColor, uFlash);
      gl_FragColor = c;
    }
  `,
};

/**
 * Render → bloom → vignette/flash/glitch → output (tone mapping + sRGB).
 * Bloom can be disabled from settings; the composer still runs the cheap finishing pass.
 */
export class PostPipeline {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly finish: ShaderPass;
  private bloomEnabled = true;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      RENDER.BLOOM_STRENGTH,
      RENDER.BLOOM_RADIUS,
      RENDER.BLOOM_THRESHOLD,
    );
    this.composer.addPass(this.bloom);
    this.finish = new ShaderPass(VignetteShader);
    this.composer.addPass(this.finish);
    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.bloom.enabled = enabled;
  }

  get isBloomEnabled(): boolean {
    return this.bloomEnabled;
  }

  setBloomStrength(strength: number): void {
    this.bloom.strength = strength;
  }

  /** 0..1 full-screen tint mix (used for death fade and the core ignition). */
  setFlash(amount: number, color?: THREE.ColorRepresentation): void {
    this.finish.uniforms.uFlash.value = amount;
    if (color !== undefined) (this.finish.uniforms.uFlashColor.value as THREE.Color).set(color);
  }

  setGlitch(amount: number): void {
    this.finish.uniforms.uGlitch.value = amount;
  }

  setTime(seconds: number): void {
    this.finish.uniforms.uTime.value = seconds;
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.bloom.dispose();
    this.renderer.setRenderTarget(null);
  }
}
