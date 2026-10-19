import * as THREE from 'three';
import type { StageDefinition } from './StageTypes';
import type { StageContext } from './StageContext';
import { createPlatform, disposePlatform, type Platform } from '../world/Platforms';
import { DecorKit } from '../world/Decor';
import { Hazards } from '../world/Hazards';
import { MovingPlatforms } from '../mechanics/MovingPlatforms';
import { DisappearingPlatforms } from '../mechanics/DisappearingPlatforms';
import { GravityZones } from '../mechanics/GravityZones';
import { Teleporters } from '../mechanics/Teleporters';
import { EnergySystem } from '../mechanics/EnergySystem';
import { Checkpoints } from '../mechanics/Checkpoints';
import { Portal } from '../mechanics/Portal';
import { createEmissive } from '../effects/Materials';
import { logReachability } from './StageValidation';
import { StaticBatcher } from '../world/StaticBatcher';

const validatedStages = new Set<number>();

/** Everything a built stage owns. `dispose()` returns the world to empty. */
export interface StageInstance {
  def: StageDefinition;
  platforms: Platform[];
  moving: MovingPlatforms;
  disappearing: DisappearingPlatforms;
  gravity: GravityZones;
  teleporters: Teleporters;
  energy: EnergySystem;
  checkpoints: Checkpoints;
  portal: Portal;
  hazards: Hazards;
  bounds: THREE.Box3;
  dispose(): void;
}

export function buildStage(def: StageDefinition, ctx: StageContext): StageInstance {
  const { world, materials } = ctx;
  const platforms: Platform[] = [];
  const platformsByGroup = new Map<string, Platform[]>();
  const moving = new MovingPlatforms(world);
  const disappearing = new DisappearingPlatforms(ctx);

  for (const pdef of def.platforms) {
    const platform = createPlatform(pdef, materials);
    world.addPlatform(platform);
    platforms.push(platform);
    moving.add(platform);
    disappearing.add(platform);
    if (pdef.group) {
      const list = platformsByGroup.get(pdef.group) ?? [];
      list.push(platform);
      platformsByGroup.set(pdef.group, list);
    }
  }

  // Decor uses a per-stage accent material so each stage has its own trim colour.
  const decorKit = new DecorKit(materials);
  const accent = createEmissive(def.theme.accentSecondary, 1.6);
  const decorGroup = new THREE.Group();
  decorGroup.name = 'decor';
  for (const ddef of def.decor ?? []) decorGroup.add(decorKit.create(ddef, accent));
  world.root.add(decorGroup);

  // Batch everything that never moves: static platform bodies (not their trim, which flickers
  // per platform) and all set dressing except the Core (animated by the finale).
  const batcher = new StaticBatcher();
  for (const platform of platforms) {
    const dynamic = platform.def.kind && platform.def.kind !== 'static';
    if (dynamic || platform.def.group) continue;
    batcher.collect(platform.group, (mesh) => mesh !== platform.trim);
  }
  for (const child of [...decorGroup.children]) {
    if (child.name === 'decor-core') continue;
    batcher.collect(child);
  }
  const batchGroup = new THREE.Group();
  batchGroup.name = 'static-batches';
  batcher.build(batchGroup);
  world.root.add(batchGroup);

  const spawn = new THREE.Vector3(...def.spawn);
  const spawnFacing = new THREE.Vector3(Math.sin(def.spawnYaw), 0, Math.cos(def.spawnYaw));
  const gravity = new GravityZones(ctx, def.gravityZones);
  const teleporters = new Teleporters(ctx, def.teleporters);
  const energy = new EnergySystem(ctx, def.orbs, def.energyRequired, def.activators, platformsByGroup);
  const checkpoints = new Checkpoints(ctx, def.checkpoints, spawn, spawnFacing);
  const portal = new Portal(ctx, def.portal);
  const hazards = new Hazards(ctx, def.hazards);
  const bounds = new THREE.Box3(new THREE.Vector3(...def.bounds.min), new THREE.Vector3(...def.bounds.max));

  if (import.meta.env.DEV && !validatedStages.has(def.id) && def.id <= 5) {
    validatedStages.add(def.id);
    validateStage(def);
    logReachability(def);
  }

  return {
    def,
    platforms,
    moving,
    disappearing,
    gravity,
    teleporters,
    energy,
    checkpoints,
    portal,
    hazards,
    bounds,
    dispose() {
      for (const platform of platforms) disposePlatform(platform);
      moving.dispose();
      disappearing.dispose();
      gravity.dispose();
      teleporters.dispose();
      energy.dispose();
      checkpoints.dispose();
      portal.dispose();
      hazards.dispose();
      decorGroup.removeFromParent();
      batcher.dispose();
      batchGroup.removeFromParent();
      decorKit.dispose();
      accent.dispose();
      world.clear();
    },
  };
}

/** Dev-only sanity checks so stage data mistakes surface in the console, not in play. */
function validateStage(def: StageDefinition): void {
  const problems: string[] = [];
  if (def.energyRequired > def.orbs.length) problems.push(`energyRequired ${def.energyRequired} > orbs ${def.orbs.length}`);
  const ids = new Set((def.teleporters ?? []).map((t) => t.id));
  for (const t of def.teleporters ?? []) if (!ids.has(t.to)) problems.push(`teleporter ${t.id} → missing ${t.to}`);
  const groups = new Set(def.platforms.map((p) => p.group).filter(Boolean));
  for (const a of def.activators ?? []) if (!groups.has(a.group)) problems.push(`activator targets missing group ${a.group}`);
  for (const p of def.platforms) {
    if (p.kind === 'moving' && !p.motion) problems.push(`moving platform without motion at ${p.pos}`);
    if (p.kind === 'rotating' && !p.spin) problems.push(`rotating platform without spin at ${p.pos}`);
  }
  if (problems.length) console.warn(`[NEXUS] Stage ${def.id} data problems:\n - ${problems.join('\n - ')}`);
}
