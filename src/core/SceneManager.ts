import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PostPipeline } from '../effects/PostPipeline';
import { CAMERA, RENDER } from '../utils/Constants';

/**
 * Owns the renderer, scene, camera and post pipeline, plus resize / DPR handling.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly post: PostPipeline;
  private maxDpr: number = RENDER.MAX_DPR;
  private postEnabled = true;
  private width = 1;
  private height = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = RENDER.EXPOSURE;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The composer renders several passes per frame; reset the stats once per frame ourselves so
    // diagnostics report the whole frame rather than the final output quad.
    this.renderer.info.autoReset = false;

    this.camera = new THREE.PerspectiveCamera(CAMERA.FOV, 1, RENDER.CAMERA_NEAR, RENDER.CAMERA_FAR);
    this.camera.position.set(0, 4, 10);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.post = new PostPipeline(this.renderer, this.scene, this.camera);
    this.resize();
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  get pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.maxDpr);
  }

  setMaxDpr(value: number): void {
    this.maxDpr = value;
    this.resize(true);
  }

  setPostEnabled(enabled: boolean): void {
    this.postEnabled = enabled;
  }

  /** Resizes when the canvas CSS size or DPR changed. Returns true when a resize happened. */
  resize(force = false): boolean {
    const width = Math.max(1, Math.floor(this.canvas.clientWidth || window.innerWidth));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight || window.innerHeight));
    const dpr = this.pixelRatio;
    const bufferWidth = Math.floor(width * dpr);
    const bufferHeight = Math.floor(height * dpr);
    const changed = force || this.canvas.width !== bufferWidth || this.canvas.height !== bufferHeight;
    if (!changed) return false;

    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.post.setSize(width, height, dpr);
    return true;
  }

  render(): void {
    this.renderer.info.reset();
    if (this.postEnabled) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.post.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
