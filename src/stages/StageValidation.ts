import type { PlatformDef, StageDefinition } from './StageTypes';
import { PLAYER } from '../utils/Constants';

/**
 * Dev-only reachability check: walks consecutive platforms in definition order and classifies
 * each leg as walk / single / double / UNREACHABLE using the real movement constants.
 * Legs involving rotated walls, gravity zones or activator groups are skipped.
 */
export interface LegReport {
  from: string;
  to: string;
  gap: number;
  rise: number;
  verdict: 'walk' | 'single' | 'double' | 'teleport' | 'UNREACHABLE' | 'skipped';
}

/** Airtime until the jumper returns to height `rise` above the launch point (negative = below). */
function airtime(v0: number, g: number, rise: number): number | null {
  // rise = v0 t - 0.5 g t²  → 0.5 g t² - v0 t + rise = 0
  const disc = v0 * v0 - 2 * g * rise;
  if (disc < 0) return null;
  return (v0 + Math.sqrt(disc)) / g;
}

export function jumpReach(rise: number, gravityScale = 1): { single: number | null; double: number | null } {
  const g = PLAYER.GRAVITY * gravityScale;
  const tSingle = airtime(PLAYER.JUMP_FORCE, g, rise);
  // Double jump at the apex of the first jump.
  const tApex = PLAYER.JUMP_FORCE / g;
  const hApex = (PLAYER.JUMP_FORCE * PLAYER.JUMP_FORCE) / (2 * g);
  const tSecond = airtime(PLAYER.DOUBLE_JUMP_FORCE, g, rise - hApex);
  const tDouble = tSecond === null ? null : tApex + tSecond;
  // Horizontal reach at run speed, plus the capsule radius that still catches the ledge.
  const reach = (t: number | null): number | null => (t === null ? null : t * PLAYER.SPEED + PLAYER.RADIUS * 0.8);
  return { single: reach(tSingle), double: reach(tDouble) };
}

function footprint(def: PlatformDef, pos = def.pos): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const rotY = def.rot?.[1] ?? 0;
  const swap = Math.abs(((rotY % 180) + 180) % 180 - 90) < 1;
  const w = swap ? def.size[2] : def.size[0];
  const d = swap ? def.size[0] : def.size[2];
  return { minX: pos[0] - w / 2, maxX: pos[0] + w / 2, minZ: pos[2] - d / 2, maxZ: pos[2] + d / 2 };
}

function edgeGap(a: ReturnType<typeof footprint>, b: ReturnType<typeof footprint>): number {
  const dx = Math.max(0, b.minX - a.maxX, a.minX - b.maxX);
  const dz = Math.max(0, b.minZ - a.maxZ, a.minZ - b.maxZ);
  return Math.hypot(dx, dz);
}

function isWallOrCeiling(def: PlatformDef): boolean {
  const rx = Math.abs(def.rot?.[0] ?? 0);
  const rz = Math.abs(def.rot?.[2] ?? 0);
  return rx > 30 || rz > 30;
}

function insideZone(def: StageDefinition, pos: [number, number, number]): boolean {
  for (const zone of def.gravityZones ?? []) {
    const inside =
      Math.abs(pos[0] - zone.pos[0]) <= zone.size[0] / 2 &&
      Math.abs(pos[1] - zone.pos[1]) <= zone.size[1] / 2 &&
      Math.abs(pos[2] - zone.pos[2]) <= zone.size[2] / 2;
    if (inside) return true;
  }
  return false;
}

export function validateReachability(def: StageDefinition): LegReport[] {
  const reports: LegReport[] = [];
  const platforms = def.platforms;
  for (let i = 0; i < platforms.length - 1; i += 1) {
    const a = platforms[i];
    const b = platforms[i + 1];
    const name = (p: PlatformDef, index: number): string => p.id ?? `${p.kind ?? 'static'}@${p.pos.join(',')}#${index}`;
    const report: LegReport = { from: name(a, i), to: name(b, i + 1), gap: 0, rise: 0, verdict: 'skipped' };
    if (isWallOrCeiling(a) || isWallOrCeiling(b) || insideZone(def, a.pos) || insideZone(def, b.pos) || a.spin || b.spin) {
      reports.push(report);
      continue;
    }
    if (linkedByTeleporter(def, a, b)) {
      reports.push({ ...report, verdict: 'teleport' });
      continue;
    }
    // Consider every rest position of moving platforms; the leg passes if any pair works.
    const aPositions = a.motion ? [a.pos, a.motion.to] : [a.pos];
    const bPositions = b.motion ? [b.pos, b.motion.to] : [b.pos];
    let best: LegReport | null = null;
    for (const ap of aPositions) {
      for (const bp of bPositions) {
        const gap = edgeGap(footprint(a, ap), footprint(b, bp));
        const rise = bp[1] - ap[1];
        const reach = jumpReach(rise);
        let verdict: LegReport['verdict'] = 'UNREACHABLE';
        if (gap < 0.6 && rise <= 0.4) verdict = 'walk';
        else if (reach.single !== null && gap + 0.3 <= reach.single) verdict = 'single';
        else if (reach.double !== null && gap + 0.3 <= reach.double) verdict = 'double';
        const candidate: LegReport = { ...report, gap, rise, verdict };
        if (!best || rank(candidate.verdict) < rank(best.verdict)) best = candidate;
      }
    }
    reports.push(best ?? report);
  }
  return reports;
}

const rank = (v: LegReport['verdict']): number => ({ walk: 0, single: 1, double: 2, teleport: 2, skipped: 3, UNREACHABLE: 4 })[v];

/** True when a teleporter pad on `a` leads to a pad on `b`. */
function linkedByTeleporter(def: StageDefinition, a: PlatformDef, b: PlatformDef): boolean {
  const fa = footprint(a);
  const fb = footprint(b);
  const onPad = (f: ReturnType<typeof footprint>, pos: [number, number, number]) =>
    pos[0] >= f.minX && pos[0] <= f.maxX && pos[2] >= f.minZ && pos[2] <= f.maxZ;
  for (const t of def.teleporters ?? []) {
    if (!onPad(fa, t.pos)) continue;
    const dest = def.teleporters?.find((o) => o.id === t.to);
    if (dest && onPad(fb, dest.pos)) return true;
  }
  return false;
}

export function logReachability(def: StageDefinition): void {
  const reports = validateReachability(def);
  const bad = reports.filter((r) => r.verdict === 'UNREACHABLE');
  const summary = reports
    .filter((r) => r.verdict !== 'skipped')
    .map((r) => `${r.verdict.padEnd(11)} gap ${r.gap.toFixed(1).padStart(4)} rise ${r.rise >= 0 ? '+' : ''}${r.rise.toFixed(1)}  ${r.from} → ${r.to}`)
    .join('\n');
  if (bad.length) console.warn(`[NEXUS] Stage ${def.id}: ${bad.length} unreachable leg(s)\n${summary}`);
  else console.info(`[NEXUS] Stage ${def.id} reachability OK (${reports.length} legs)\n${summary}`);
}
