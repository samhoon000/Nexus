import * as THREE from 'three';
import { createGlowTexture } from './Materials';

const MAX_PARTICLES = 2400;

/**
 * Pooled CPU-simulated burst particles rendered as one additive Points draw call.
 * Used for energy bursts, landings, jumps, teleports, checkpoints, crumble debris, core ignition.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly positions = new Float32Array(MAX_PARTICLES * 3);
  private readonly colors = new Float32Array(MAX_PARTICLES * 3);
  private readonly sizes = new Float32Array(MAX_PARTICLES);
  private readonly alphas = new Float32Array(MAX_PARTICLES);
  private readonly velocities = new Float32Array(MAX_PARTICLES * 3);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  private readonly drag = new Float32Array(MAX_PARTICLES);
  private readonly gravity = new Float32Array(MAX_PARTICLES);
  private readonly baseSize = new Float32Array(MAX_PARTICLES);
  private cursor = 0;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly color = new THREE.Color();

  constructor(private readonly rng: () => number) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: createGlowTexture(64) }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(1.0, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb * 2.0, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.geometry.setDrawRange(0, MAX_PARTICLES);
  }

  setPixelScale(height: number): void {
    this.material.uniforms.uScale.value = height * 0.55;
  }

  burst(options: {
    position: THREE.Vector3;
    count: number;
    color: THREE.ColorRepresentation;
    speed: number;
    spread?: number;
    life?: number;
    size?: number;
    direction?: THREE.Vector3;
    gravity?: number;
    drag?: number;
    colorJitter?: number;
  }): void {
    const {
      position,
      count,
      color,
      speed,
      spread = 1,
      life = 0.8,
      size = 0.18,
      direction,
      gravity = 0,
      drag = 2.5,
      colorJitter = 0.15,
    } = options;
    this.color.set(color);
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const i3 = i * 3;
      this.positions[i3] = position.x;
      this.positions[i3 + 1] = position.y;
      this.positions[i3 + 2] = position.z;
      // Random direction on a sphere, biased by `direction`.
      const u = this.rng() * 2 - 1;
      const theta = this.rng() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      let dx = r * Math.cos(theta) * spread;
      let dy = u * spread;
      let dz = r * Math.sin(theta) * spread;
      if (direction) {
        dx += direction.x;
        dy += direction.y;
        dz += direction.z;
      }
      const s = speed * (0.45 + this.rng() * 0.75);
      this.velocities[i3] = dx * s;
      this.velocities[i3 + 1] = dy * s;
      this.velocities[i3 + 2] = dz * s;
      const jitter = 1 + (this.rng() - 0.5) * colorJitter * 2;
      this.colors[i3] = Math.min(1.5, this.color.r * jitter);
      this.colors[i3 + 1] = Math.min(1.5, this.color.g * jitter);
      this.colors[i3 + 2] = Math.min(1.5, this.color.b * jitter);
      const l = life * (0.6 + this.rng() * 0.6);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.baseSize[i] = size * (0.6 + this.rng() * 0.8);
      this.sizes[i] = this.baseSize[i];
      this.alphas[i] = 1;
      this.drag[i] = drag;
      this.gravity[i] = gravity;
    }
  }

  update(delta: number): void {
    if (delta <= 0) return;
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= delta;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        this.sizes[i] = 0;
        continue;
      }
      const k = this.life[i] / this.maxLife[i];
      const dragFactor = Math.max(0, 1 - this.drag[i] * delta);
      this.velocities[i3] *= dragFactor;
      this.velocities[i3 + 1] = this.velocities[i3 + 1] * dragFactor - this.gravity[i] * delta;
      this.velocities[i3 + 2] *= dragFactor;
      this.positions[i3] += this.velocities[i3] * delta;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * delta;
      this.alphas[i] = k < 0.5 ? k * 2 : 1;
      this.sizes[i] = this.baseSize[i] * (0.4 + 0.6 * k);
    }
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.alphas.fill(0);
    this.sizes.fill(0);
    (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material.uniforms.uMap.value as THREE.Texture).dispose();
    this.material.dispose();
  }
}

/**
 * Slow-drifting ambient motes: one Points draw call with a GPU drift shader.
 */
export class AmbientParticles {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(count: number, radius: number, rng: () => number) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (rng() * 2 - 1) * radius;
      positions[i * 3 + 1] = (rng() * 2 - 1) * radius * 0.6;
      positions[i * 3 + 2] = (rng() * 2 - 1) * radius;
      seeds[i] = rng();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x19e6ff) },
        uMap: { value: createGlowTexture(32) },
        uScale: { value: 300 },
        uRadius: { value: radius },
        uCenter: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uScale;
        uniform float uRadius;
        uniform vec3 uCenter;
        varying float vFade;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.12 + aSeed * 31.0) * 1.6;
          p.y += mod(uTime * (0.25 + aSeed * 0.4) + aSeed * 50.0, uRadius * 1.2) - uRadius * 0.6;
          p.z += cos(uTime * 0.1 + aSeed * 17.0) * 1.6;
          // Wrap around the camera-following centre so the field is endless.
          vec3 rel = mod(p - uCenter + uRadius, uRadius * 2.0) - uRadius;
          vec3 world = uCenter + rel;
          vec4 mvPosition = modelViewMatrix * vec4(world, 1.0);
          float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 90.0);
          vFade = twinkle * smoothstep(uRadius, uRadius * 0.4, length(rel));
          gl_PointSize = (0.05 + aSeed * 0.12) * uScale / max(1.0, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor * 1.4, tex.a * vFade * 0.7);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  setColor(color: THREE.ColorRepresentation): void {
    (this.material.uniforms.uColor.value as THREE.Color).set(color);
  }

  getColor(): THREE.Color {
    return this.material.uniforms.uColor.value as THREE.Color;
  }

  setPixelScale(height: number): void {
    this.material.uniforms.uScale.value = height * 0.4;
  }

  update(elapsed: number, center: THREE.Vector3): void {
    this.material.uniforms.uTime.value = elapsed;
    (this.material.uniforms.uCenter.value as THREE.Vector3).copy(center);
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.material.uniforms.uMap.value as THREE.Texture).dispose();
    this.material.dispose();
  }
}
