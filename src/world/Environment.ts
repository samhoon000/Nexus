import * as THREE from 'three';
import type { StageTheme } from '../stages/StageTypes';
import { RENDER } from '../utils/Constants';
import { dampFactor } from '../utils/MathUtils';
import { AmbientParticles } from '../effects/Particles';
import type { MaterialLibrary } from '../effects/Materials';
import { createBackgroundStructures, type BackgroundStructures } from './Background';

/**
 * Sky dome, fog, lighting rig, ambient particles and distant megastructures.
 * Theme colours tween smoothly when a new stage loads.
 */
export class Environment {
  readonly group = new THREE.Group();
  private readonly sky: THREE.Mesh;
  private readonly skyUniforms = {
    uTop: { value: new THREE.Color(0x0a1230) },
    uHorizon: { value: new THREE.Color(0x05070f) },
    uAccent: { value: new THREE.Color(0x19e6ff) },
    uTime: { value: 0 },
    uPower: { value: 0 },
  };
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly key: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  readonly ambient: AmbientParticles;
  private readonly background: BackgroundStructures;
  private readonly fog: THREE.Fog;

  private readonly targetBackground = new THREE.Color();
  private readonly targetFog = new THREE.Color();
  private readonly targetSkyTop = new THREE.Color();
  private readonly targetSkyHorizon = new THREE.Color();
  private readonly targetAccent = new THREE.Color();
  private readonly targetKey = new THREE.Color();
  private readonly targetFill = new THREE.Color();
  private readonly targetParticle = new THREE.Color();
  private targetFogNear = 30;
  private targetFogFar = 160;
  private readonly keyOffset = new THREE.Vector3(14, 22, 10);
  private readonly scratch = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    materials: MaterialLibrary,
    rng: () => number,
  ) {
    scene.background = new THREE.Color(0x05070f);
    this.fog = new THREE.Fog(0x05070f, 30, 160);
    scene.fog = this.fog;

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(RENDER.CAMERA_FAR * 0.9, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.skyUniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          uniform vec3 uTop, uHorizon, uAccent;
          uniform float uTime, uPower;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.75));
            // Faint latitude bands, like a data grid far away.
            float band = smoothstep(0.985, 1.0, sin(vDir.y * 60.0 + uTime * 0.05) * 0.5 + 0.5);
            col += uAccent * band * 0.035 * (1.0 - h);
            // Sparse stars.
            vec2 cell = floor(vDir.xz * 90.0 + vDir.y * 40.0);
            float star = step(0.995, hash(cell)) * smoothstep(0.1, 0.6, vDir.y);
            col += vec3(star) * 0.35;
            // Horizon glow, strengthened when the Core powers up.
            float glow = exp(-abs(vDir.y) * 7.0);
            col += uAccent * glow * (0.08 + uPower * 0.6);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    this.hemisphere = new THREE.HemisphereLight(0x5f7fbf, 0x05070f, 0.9);
    this.group.add(this.hemisphere);

    this.key = new THREE.DirectionalLight(0xbfd8ff, 2.2);
    this.key.position.copy(this.keyOffset);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(RENDER.SHADOW_MAP_SIZE, RENDER.SHADOW_MAP_SIZE);
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 80;
    this.key.shadow.camera.left = -RENDER.SHADOW_EXTENT;
    this.key.shadow.camera.right = RENDER.SHADOW_EXTENT;
    this.key.shadow.camera.top = RENDER.SHADOW_EXTENT;
    this.key.shadow.camera.bottom = -RENDER.SHADOW_EXTENT;
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.02;
    this.group.add(this.key);
    this.group.add(this.key.target);

    this.rim = new THREE.DirectionalLight(0x19e6ff, 0.6);
    this.rim.position.set(-20, 6, -24);
    this.group.add(this.rim);

    this.ambient = new AmbientParticles(900, 42, rng);
    this.group.add(this.ambient.points);

    this.background = createBackgroundStructures(materials, rng);
    this.group.add(this.background.group);

    scene.add(this.group);
  }

  applyTheme(theme: StageTheme, instant = false): void {
    this.targetBackground.set(theme.background);
    this.targetFog.set(theme.fogColor);
    this.targetSkyTop.set(theme.skyTop);
    this.targetSkyHorizon.set(theme.skyHorizon);
    this.targetAccent.set(theme.accent);
    this.targetKey.set(theme.keyLight);
    this.targetFill.set(theme.fillLight);
    this.targetParticle.set(theme.ambientParticleColor);
    this.targetFogNear = theme.fogNear;
    this.targetFogFar = theme.fogFar;
    this.background.setTheme(theme, instant);
    if (instant) this.blend(1);
  }

  /** 0..1 — Core activation power level (sky horizon glow, background illumination). */
  setPower(power: number): void {
    this.skyUniforms.uPower.value = power;
    this.background.setPower(power);
  }

  update(delta: number, elapsed: number, focus: THREE.Vector3, scene: THREE.Scene): void {
    this.skyUniforms.uTime.value = elapsed;
    this.blend(dampFactor(delta, 0.8));
    (scene.background as THREE.Color).copy(this.fog.color);

    // Shadow frustum and sky follow the player so the whole world never needs one giant map.
    this.key.target.position.copy(focus);
    this.scratch.copy(focus).add(this.keyOffset);
    this.key.position.copy(this.scratch);
    this.sky.position.copy(focus);
    this.ambient.update(elapsed, focus);
    this.background.update(delta, elapsed, focus);
  }

  private blend(t: number): void {
    this.fog.color.lerp(this.targetFog, t);
    this.fog.near += (this.targetFogNear - this.fog.near) * t;
    this.fog.far += (this.targetFogFar - this.fog.far) * t;
    this.skyUniforms.uTop.value.lerp(this.targetSkyTop, t);
    this.skyUniforms.uHorizon.value.lerp(this.targetSkyHorizon, t);
    this.skyUniforms.uAccent.value.lerp(this.targetAccent, t);
    this.key.color.lerp(this.targetKey, t);
    this.hemisphere.color.lerp(this.targetFill, t);
    this.rim.color.lerp(this.targetAccent, t);
    this.ambient.getColor().lerp(this.targetParticle, t);
  }

  setPixelScale(height: number): void {
    this.ambient.setPixelScale(height);
  }

  /** Re-allocates the key light's shadow map at a new resolution (quality tiers). */
  setShadowMapSize(size: number): void {
    if (this.key.shadow.mapSize.x === size) return;
    this.key.shadow.mapSize.set(size, size);
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
    this.key.shadow.needsUpdate = true;
  }

  /** Fraction (0..1) of the ambient particle field that is drawn. */
  setAmbientDensity(fraction: number): void {
    this.ambient.setDensity(fraction);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    this.ambient.dispose();
    this.background.dispose();
    this.key.shadow.dispose();
  }
}
