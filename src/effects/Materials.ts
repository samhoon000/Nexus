import * as THREE from 'three';
import { COLORS } from '../utils/Constants';

/**
 * Shared material library. Roles are reused across every mesh that plays the same part so the
 * world reads as one material language and draw calls can batch. Never dispose these per stage.
 */
export class MaterialLibrary {
  readonly shellDark = new THREE.MeshStandardMaterial({
    color: COLORS.shellDark,
    metalness: 0.75,
    roughness: 0.42,
    envMapIntensity: 0.9,
  });

  readonly shellMid = new THREE.MeshStandardMaterial({
    color: COLORS.shellMid,
    metalness: 0.6,
    roughness: 0.5,
    envMapIntensity: 0.8,
  });

  readonly shellLight = new THREE.MeshStandardMaterial({
    color: COLORS.shellLight,
    metalness: 0.55,
    roughness: 0.38,
    envMapIntensity: 1.0,
  });

  readonly trim = new THREE.MeshStandardMaterial({
    color: COLORS.trim,
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 1.1,
  });

  readonly deckTop = new THREE.MeshStandardMaterial({
    color: 0x1b2334,
    metalness: 0.35,
    roughness: 0.62,
    envMapIntensity: 0.6,
  });

  readonly groundContact = new THREE.MeshStandardMaterial({
    color: 0x080b14,
    metalness: 0.2,
    roughness: 0.9,
    envMapIntensity: 0.2,
  });

  readonly emissiveCyan = createEmissive(COLORS.cyan, 1.7);
  readonly emissiveBlue = createEmissive(COLORS.blue, 1.6);
  readonly emissiveViolet = createEmissive(COLORS.violet, 1.7);
  readonly emissiveMagenta = createEmissive(COLORS.magenta, 1.7);
  readonly emissiveOrange = createEmissive(COLORS.orange, 1.8);
  readonly emissiveWhite = createEmissive(COLORS.white, 1.3);
  /** Dim emissive used for "unpowered" structures. */
  readonly emissiveDim = createEmissive(0x1b3a4a, 0.6);

  readonly hazardStripe = new THREE.MeshStandardMaterial({
    color: 0x2a1408,
    emissive: COLORS.orange,
    emissiveIntensity: 1.1,
    metalness: 0.4,
    roughness: 0.6,
  });

  readonly glass = new THREE.MeshPhysicalMaterial({
    color: 0x8fd8ff,
    metalness: 0,
    roughness: 0.12,
    transparent: true,
    opacity: 0.32,
    clearcoat: 1,
    envMapIntensity: 1.4,
    depthWrite: false,
  });

  /** Holographic surface with scrolling scanlines. uTime is written by `update()`. */
  readonly holo = createHoloMaterial(COLORS.cyan);
  readonly holoViolet = createHoloMaterial(COLORS.violet);

  /** Additive glow sprite material for orbs and soft halos. */
  readonly glowSprite = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color: COLORS.cyan,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.85,
  });

  readonly all: THREE.Material[] = [
    this.shellDark,
    this.shellMid,
    this.shellLight,
    this.trim,
    this.deckTop,
    this.groundContact,
    this.emissiveCyan,
    this.emissiveBlue,
    this.emissiveViolet,
    this.emissiveMagenta,
    this.emissiveOrange,
    this.emissiveWhite,
    this.emissiveDim,
    this.hazardStripe,
    this.glass,
    this.holo,
    this.holoViolet,
    this.glowSprite,
  ];

  update(elapsed: number): void {
    setHoloTime(this.holo, elapsed);
    setHoloTime(this.holoViolet, elapsed);
  }

  dispose(): void {
    for (const material of this.all) material.dispose();
    this.glowSprite.map?.dispose();
  }
}

export function createEmissive(color: THREE.ColorRepresentation, intensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x0a0d16,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.1,
    roughness: 0.45,
  });
}

type HoloMaterial = THREE.MeshStandardMaterial & { userData: { shader?: THREE.WebGLProgramParametersWithUniforms } };

function createHoloMaterial(color: THREE.ColorRepresentation): HoloMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0x061018,
    emissive: color,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.55,
    metalness: 0,
    roughness: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  }) as HoloMaterial;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    material.userData.shader = shader;
    shader.vertexShader = 'varying vec2 vHoloUv;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n vHoloUv = uv;',
    );
    shader.fragmentShader =
      'uniform float uTime;\nvarying vec2 vHoloUv;\n' +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        float scan = fract(vHoloUv.y * 18.0 - uTime * 0.9);
        float line = smoothstep(0.0, 0.08, scan) * smoothstep(0.35, 0.12, scan);
        float sweep = smoothstep(0.0, 0.06, fract(vHoloUv.y * 1.2 - uTime * 0.18)) * smoothstep(0.2, 0.06, fract(vHoloUv.y * 1.2 - uTime * 0.18));
        float grid = step(0.94, fract(vHoloUv.x * 10.0)) + step(0.94, fract(vHoloUv.y * 10.0));
        totalEmissiveRadiance *= 0.55 + line * 0.9 + sweep * 1.6 + grid * 0.5;`,
      );
  };
  material.customProgramCacheKey = () => 'nexus-holo';
  return material;
}

function setHoloTime(material: HoloMaterial, elapsed: number): void {
  const shader = material.userData.shader;
  if (shader) shader.uniforms.uTime.value = elapsed;
}

export function createGlowTexture(size = 128): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft radial shadow disc texture used under hovering objects. */
export function createContactShadowTexture(size = 128): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
