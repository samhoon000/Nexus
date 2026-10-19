import type * as THREE from 'three';
import { PIXEL_BUDGET, type QualityTier } from '../utils/Constants';

export type FormFactor = 'phone' | 'tablet' | 'desktop';

export interface DeviceProfile {
  /** The device has a touch screen. */
  touch: boolean;
  /** The primary pointer is coarse (touch-first device). */
  coarsePointer: boolean;
  formFactor: FormFactor;
  devicePixelRatio: number;
  gpu: string;
  /** WebGL is running on a CPU rasteriser (SwiftShader, llvmpipe…). */
  softwareRenderer: boolean;
  /** Suggested render tier when the quality setting is AUTO. */
  tier: QualityTier;
  /** Render-buffer pixel budget for this form factor. */
  pixelBudget: number;
}

/**
 * Capability-based device classification. Combines pointer media queries, touch points, screen
 * size, DPR, memory/core hints and the WebGL renderer string; user-agent sniffing is not used.
 */
export function detectDevice(renderer?: THREE.WebGLRenderer): DeviceProfile {
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const touch = touchPoints > 0 || matchMedia('(any-pointer: coarse)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  const devicePixelRatio = window.devicePixelRatio || 1;

  let formFactor: FormFactor = 'desktop';
  if (touch && coarsePointer) formFactor = shortSide <= 600 ? 'phone' : shortSide <= 1100 ? 'tablet' : 'desktop';

  const gpu = readGpuString(renderer);
  const softwareRenderer = /swiftshader|llvmpipe|software|microsoft basic render/i.test(gpu);

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const weakGpu = /mali-4|mali-t[0-7]|adreno \(tm\) [1-4]\d\d|powervr|videocore/i.test(gpu);

  let tier: QualityTier = 'high';
  if (softwareRenderer) tier = 'low';
  else if (formFactor === 'phone') tier = memory <= 3 || cores <= 4 || weakGpu ? 'low' : 'medium';
  else if (formFactor === 'tablet') tier = weakGpu ? 'low' : 'medium';

  return {
    touch,
    coarsePointer,
    formFactor,
    devicePixelRatio,
    gpu,
    softwareRenderer,
    tier,
    pixelBudget: PIXEL_BUDGET[formFactor],
  };
}

function readGpuString(renderer?: THREE.WebGLRenderer): string {
  if (!renderer) return '';
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    return String(gl.getParameter(gl.RENDERER));
  } catch {
    return '';
  }
}
