import * as THREE from 'three';
import type { PlayerModelParts } from './PlayerModel';
import { BoneChannel, type CharacterBoneName, type CharacterRig } from './CharacterRig';
import { addPose, clearPose, createPose, FALL_POSE, idlePose, JUMP_POSE, LAND_POSE, PULSE_POSE, runPose, type Pose } from './CharacterPoses';
import { easeOutBack, type TweenHandle, type TweenManager } from '../effects/Tween';
import { clamp, damp } from '../utils/MathUtils';
import { CHARACTER, PLAYER, PLAYER_CENTER_HEIGHT } from '../utils/Constants';

export interface AnimationInputs {
  grounded: boolean;
  verticalSpeed: number;
  tangentSpeed: number;
  inputMagnitude: number;
  /** Velocity direction in the model's local frame (x = lateral, y = forward). */
  facingLocal: THREE.Vector2;
  energyRatio: number;
  reducedMotion: boolean;
}

const TWO_PI = Math.PI * 2;
type Channels = Record<Exclude<CharacterBoneName, 'Root' | 'Shoulder_L' | 'Shoulder_R' | 'Hand_L' | 'Hand_R'>, BoneChannel>;

/**
 * Procedural character animation driven by the real frame delta. Locomotion states (idle, run,
 * jump, fall) are blended by smoothed weights and layered with a landing crouch and a take-off
 * pulse, then written to the rig's bones; the energy materials, core halo and contact shadow
 * follow the gameplay state. With the fallback robot only the body lean and glow are animated.
 */
export class PlayerAnimation {
  private channels: Channels | null = null;
  private rig: CharacterRig | null = null;
  private readonly pose = createPose();
  private readonly scratchPose = createPose();
  private phase = 0;
  private groundWeight = 1;
  private runWeight = 0;
  private riseWeight = 0;
  private crouch = 0;
  private crouchTween: TweenHandle | null = null;
  private pulse = 0;
  private surge = 0;
  private coreLevel = 0;
  private hoverPhase = 0;
  private sinceGrounded = 0;

  constructor(
    private readonly parts: PlayerModelParts,
    private readonly tweens: TweenManager,
  ) {}

  /** Call after the character rig (or fallback) was attached to the model. */
  attach(): void {
    const rig = this.parts.character;
    this.rig = rig;
    if (!rig) {
      this.channels = null;
      return;
    }
    const channel = (name: CharacterBoneName): BoneChannel => new BoneChannel(rig.bones[name], rig.group);
    this.channels = {
      Hips: channel('Hips'),
      Spine: channel('Spine'),
      Chest: channel('Chest'),
      Neck: channel('Neck'),
      Head: channel('Head'),
      UpperArm_L: channel('UpperArm_L'),
      Forearm_L: channel('Forearm_L'),
      UpperArm_R: channel('UpperArm_R'),
      Forearm_R: channel('Forearm_R'),
      Thigh_L: channel('Thigh_L'),
      Shin_L: channel('Shin_L'),
      Foot_L: channel('Foot_L'),
      Thigh_R: channel('Thigh_R'),
      Shin_R: channel('Shin_R'),
      Foot_R: channel('Foot_R'),
    };
  }

  update(delta: number, elapsed: number, input: AnimationInputs): void {
    // Brief contact dropouts (edges, slopes, platform seams) must not flicker the pose.
    this.sinceGrounded = input.grounded ? 0 : this.sinceGrounded + delta;
    const grounded = input.grounded || this.sinceGrounded < CHARACTER.GROUND_GRACE;
    const speedRatio = clamp(input.tangentSpeed / PLAYER.SPEED, 0, 1);
    const lag = CHARACTER.POSE_LAG;
    this.groundWeight = damp(this.groundWeight, grounded ? 1 : 0, lag, delta);
    this.runWeight = damp(this.runWeight, grounded ? speedRatio : 0, lag, delta);
    this.riseWeight = damp(this.riseWeight, clamp((input.verticalSpeed + 3) / 9, 0, 1), lag, delta);
    this.pulse = Math.max(0, this.pulse - delta / CHARACTER.JUMP_PULSE);
    this.surge = Math.max(0, this.surge - delta * CHARACTER.SURGE_DECAY);
    if (!input.reducedMotion && grounded) {
      this.phase = (this.phase + input.tangentSpeed * CHARACTER.STRIDE_RATE * delta) % TWO_PI;
    }

    // Whole-body lean into the run and into turns; a slight pitch with vertical speed in the air.
    const airWeight = 1 - this.groundWeight;
    const airPitch = clamp(-input.verticalSpeed * CHARACTER.AIR_PITCH, -CHARACTER.AIR_PITCH_MAX, CHARACTER.AIR_PITCH_MAX) * airWeight;
    const pitch = CHARACTER.RUN_LEAN * this.runWeight * Math.max(0, input.facingLocal.y) + airPitch;
    const roll = -input.facingLocal.x * this.runWeight * CHARACTER.TURN_LEAN;
    this.parts.body.rotation.set(pitch, 0, roll);

    if (this.channels) this.updateRig(this.channels, elapsed, airWeight);
    else if (this.parts.fallback) this.updateFallback(delta, elapsed, input);

    this.updateEnergy(delta, elapsed, input);

    const shadow = this.parts.contactShadow.material;
    shadow.opacity = damp(shadow.opacity, input.grounded ? 0.9 : 0.35, 0.1, delta);
  }

  private updateRig(channels: Channels, elapsed: number, airWeight: number): void {
    const pose = this.pose;
    clearPose(pose);
    runPose(this.scratchPose, this.phase);
    addPose(pose, this.scratchPose, this.runWeight);
    idlePose(this.scratchPose, elapsed);
    addPose(pose, this.scratchPose, Math.max(0, this.groundWeight - this.runWeight));
    addPose(pose, JUMP_POSE, airWeight * this.riseWeight);
    addPose(pose, FALL_POSE, airWeight * (1 - this.riseWeight));
    addPose(pose, LAND_POSE, this.crouch);
    addPose(pose, PULSE_POSE, this.pulse);
    this.applyPose(channels, pose);
  }

  /** Writes pose channels to the bones. See CharacterPoses.ts for the channel conventions. */
  private applyPose(c: Channels, p: Pose): void {
    c.Hips.lift(p.lift);
    c.Hips.rotate(p.hipsPitch);
    c.Spine.rotate(p.spinePitch, 0, p.twist);
    c.Chest.rotate(p.chestPitch);
    c.Head.rotate(p.headPitch, 0, p.headYaw);
    // Downward limbs swing forward with a negative pitch; the knee flexes backwards with a positive one.
    c.Thigh_L.rotate(-p.thighL);
    c.Thigh_R.rotate(-p.thighR);
    c.Shin_L.rotate(p.kneeL);
    c.Shin_R.rotate(p.kneeR);
    c.Foot_L.rotate(p.toeL);
    c.Foot_R.rotate(p.toeR);
    // Spread is mirrored: positive roll moves the left arm outward and the right arm inward.
    c.UpperArm_L.rotate(-p.armL, p.outL);
    c.UpperArm_R.rotate(-p.armR, -p.outR);
    c.Forearm_L.rotate(-p.elbowL);
    c.Forearm_R.rotate(-p.elbowR);
  }

  private updateFallback(delta: number, elapsed: number, input: AnimationInputs): void {
    const fallback = this.parts.fallback!;
    if (!input.reducedMotion) this.hoverPhase += delta * 2.4;
    const idle = input.grounded ? 1 - Math.min(1, input.tangentSpeed / PLAYER.SPEED) : 0;
    fallback.group.position.y = PLAYER_CENTER_HEIGHT + Math.sin(this.hoverPhase) * 0.035 * idle;
    fallback.thrusterRing.material.emissiveIntensity = input.grounded ? 0.8 + input.inputMagnitude * 0.6 : 1.9;
    fallback.visor.material.emissiveIntensity = 1.4 + this.surge;
    fallback.core.material.emissiveIntensity = CHARACTER.ENERGY_CYAN_BASE + this.coreLevel * CHARACTER.ENERGY_CYAN_GAIN + Math.sin(elapsed * 3.2) * CHARACTER.ENERGY_PULSE;
    fallback.coreGlow.material.opacity = 0.45 + this.coreLevel * 0.35;
  }

  /** Energy accents brighten with collected energy, breathe slowly and surge on a double jump. */
  private updateEnergy(delta: number, elapsed: number, input: AnimationInputs): void {
    this.coreLevel = damp(this.coreLevel, input.energyRatio, 0.5, delta);
    const pulse = input.reducedMotion ? 0 : Math.sin(elapsed * 3.2) * CHARACTER.ENERGY_PULSE;
    const rig = this.rig;
    if (rig) {
      rig.materials.energyCyan.emissiveIntensity = CHARACTER.ENERGY_CYAN_BASE + this.coreLevel * CHARACTER.ENERGY_CYAN_GAIN + pulse + this.surge;
      rig.materials.energyBlue.emissiveIntensity = CHARACTER.ENERGY_BLUE + pulse * 0.4 + this.surge * 0.3;
    }
    const glow = this.parts.coreGlow;
    if (glow) {
      glow.material.opacity = 0.35 + this.coreLevel * 0.3 + pulse * 0.1 + this.surge * 0.08;
      glow.scale.setScalar(CHARACTER.GLOW_SCALE * (1 + this.coreLevel * 0.3 + this.surge * 0.05));
    }
  }

  jump(double: boolean): void {
    this.pulse = 1;
    if (double) this.surge += CHARACTER.SURGE;
  }

  land(impact: number): void {
    const amount = clamp(CHARACTER.LAND_CROUCH_MIN + impact * CHARACTER.LAND_CROUCH_IMPACT, 0, 1);
    this.crouchTween?.cancel();
    // easeOutBack overshoots past zero, which reads as a small spring back up.
    this.crouchTween = this.tweens.tween(
      CHARACTER.LAND_RECOVER,
      (t) => {
        this.crouch = amount * (1 - t);
      },
      easeOutBack,
      () => {
        this.crouch = 0;
        this.crouchTween = null;
      },
    );
  }

  /** Snaps the pose to a grounded idle (spawn, respawn, reduced-motion screenshots). */
  stabilize(): void {
    this.phase = 0;
    this.hoverPhase = 0;
    this.sinceGrounded = 0;
    this.groundWeight = 1;
    this.runWeight = 0;
    this.riseWeight = 0;
    this.pulse = 0;
    this.surge = 0;
    this.crouchTween?.cancel();
    this.crouchTween = null;
    this.crouch = 0;
    this.parts.body.rotation.set(0, 0, 0);
  }
}
