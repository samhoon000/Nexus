import * as THREE from 'three';
import type { Game } from '../core/Game';
import { ArmorSystem } from '../combat/ArmorSystem';
import { EnergySword } from '../combat/EnergySword';

/**
 * Stage 6: The Fallen Legion Opening Cinematic.
 * Red lights appear beneath cracks in arena floor, ground trembles, dust rises,
 * robot hands & heads emerge, red robots stand up with eyes & chest cores powering on,
 * turning to face the Cyan Knight.
 */
export class Stage6Opening {
  private time = 0;
  private done = false;
  private skipped = false;
  private spawnedRobots = false;
  private cameraPos = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private readonly arenaCenter = new THREE.Vector3(0, 0, 55);

  constructor(
    private readonly game: Game,
    private readonly onComplete: () => void,
  ) {}

  start(): void {
    const game = this.game;

    // Ensure player has Cyan Knight suit and sword equipped
    if (!game.combat?.awakened) {
      const rig = game.player.model.character;
      if (rig) {
        const armor = new ArmorSystem(rig);
        const sword = new EnergySword(rig);
        armor.snapVisible();
        sword.snapVisible();
        game.combat?.setAwakened(armor, sword);
      }
    } else {
      game.combat.armor?.snapVisible();
      game.combat.sword?.snapVisible();
    }

    // Cinematic camera starts with a dynamic hero shot facing the Cyan Knight
    this.cameraPos.set(
      game.player.position.x - 1.4,
      game.player.position.y + 1.25,
      game.player.position.z - 3.4,
    );
    this.lookAt.set(
      game.player.position.x,
      game.player.position.y + 1.15,
      game.player.position.z,
    );
    game.cameraController.cinematicTarget = this.lookAt;
    game.cameraController.cinematicPosition = this.cameraPos;

    game.audio.setMusicIntensity(0.7);

    showSkipPrompt();
  }

  skip(): void {
    if (this.skipped || this.done) return;
    this.skipped = true;
    hideSkipPrompt();
    hideCinematicBanner();

    if (!this.spawnedRobots) {
      this.game.combat?.initStage6Mission(this.arenaCenter);
      this.spawnedRobots = true;
    }

    this.finish();
  }

  update(delta: number): void {
    if (this.done) return;
    const game = this.game;

    // Skip input
    if (
      this.time > 0.5 &&
      (game.input.keyboard.isDown('Space') ||
        game.input.keyboard.isDown('KeyE') ||
        game.input.keyboard.isDown('Escape'))
    ) {
      this.skip();
      return;
    }

    this.time += delta;
    const t = this.time;

    // 0.0s - 1.2s: Red lights glow beneath arena cracks, ground trembles
    if (t < 2.0 && Math.floor(t * 30) % 3 === 0) {
      game.cameraController.addTrauma(0.18);
      // Red embers rising from floor cracks — spread across larger arena
      game.particles.burst({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 40,
          0.05,
          55 + (Math.random() - 0.5) * 36,
        ),
        count: 6,
        color: 0xff2200,
        speed: 3,
        spread: 0.5,
        life: 0.8,
        size: 0.22,
      });
    }

    // 1.5s: Strong tremor, dust and debris erupt as robots begin emergence
    if (t >= 1.5 && !this.spawnedRobots) {
      this.spawnedRobots = true;
      game.cameraController.addTrauma(0.55);
      game.cameraController.punchFov(5);

      // Dust eruption spread across the expanded arena
      for (let i = 0; i < 7; i++) {
        game.particles.burst({
          position: new THREE.Vector3((i - 3) * 7, 0.1, 40),
          count: 32,
          color: 0x442222,
          speed: 6,
          spread: 1.5,
          life: 1.0,
          size: 0.35,
        });
      }

      // Initialize the mission & spawn the emerging red robots
      game.combat?.initStage6Mission(this.arenaCenter);

      // Show hostile detection banner
      showHostileDetectionBanner();
    }

    // Cinematic Camera Choreography:
    // Phase 1 (0.0s - 2.5s): Hero Showcase — slow orbiting pan in front of the Cyan Knight
    if (t < 2.5) {
      const p = t / 2.5;
      this.cameraPos.set(
        game.player.position.x - 1.4 + p * 2.8,
        game.player.position.y + 1.25 + p * 0.15,
        game.player.position.z - 3.4 + p * 0.4,
      );
      this.lookAt.set(
        game.player.position.x,
        game.player.position.y + 1.15,
        game.player.position.z,
      );
    } else if (t < 6.5) {
      // Phase 2 (2.5s - 6.5s): Camera sweeps up and around to dramatic third-person view
      const p = (t - 2.5) / 4.0;
      const smoothP = p * p * (3 - 2 * p); // smoothstep
      const angle = (1 - smoothP) * (-0.3) + smoothP * Math.PI;
      const radius = 3.4 + smoothP * 5.4;
      this.cameraPos.set(
        game.player.position.x + Math.sin(angle) * radius,
        game.player.position.y + 1.4 + smoothP * 1.8,
        game.player.position.z - Math.cos(angle) * radius,
      );
      this.lookAt.set(
        game.player.position.x,
        game.player.position.y + 1.2,
        game.player.position.z - smoothP * 12.0,
      );
    }

    // 6.5s: Cinematic concludes
    if (t >= 6.5) {
      this.finish();
    }
  }

  private finish(): void {
    this.done = true;
    hideSkipPrompt();
    hideCinematicBanner();
    this.game.cameraController.cinematicTarget = null;
    this.game.cameraController.cinematicPosition = null;
    this.onComplete();
  }

  dispose(): void {
    this.done = true;
    hideSkipPrompt();
    hideCinematicBanner();
    this.game.cameraController.cinematicTarget = null;
    this.game.cameraController.cinematicPosition = null;
  }
}

/**
 * Stage 6 Victory Cinematic.
 * Hero and companions stand together as battlefield becomes quiet.
 * Core signal returns with story reveal.
 */
export class Stage6Victory {
  private time = 0;
  private done = false;
  private cameraPos = new THREE.Vector3();
  private lookAt = new THREE.Vector3();

  constructor(
    private readonly game: Game,
    private readonly onComplete: () => void,
  ) {}

  start(): void {
    const game = this.game;
    game.audio.setMusicIntensity(0.5);
    game.cameraController.addTrauma(0.3);

    this.cameraPos.copy(game.player.position).add(new THREE.Vector3(4, 2.2, 7));
    this.lookAt.copy(game.player.position).add(new THREE.Vector3(0, 1.2, 0));
    game.cameraController.cinematicTarget = this.lookAt;
    game.cameraController.cinematicPosition = this.cameraPos;

    showVictoryBanner();
  }

  update(delta: number): void {
    if (this.done) return;
    this.time += delta;
    const t = this.time;
    const game = this.game;

    // Gentle camera orbit around hero & legion companions
    const angle = t * 0.4;
    this.cameraPos.set(
      game.player.position.x + Math.sin(angle) * 6.5,
      game.player.position.y + 2.0 + Math.cos(angle * 0.5) * 0.4,
      game.player.position.z + Math.cos(angle) * 6.5,
    );
    this.lookAt.copy(game.player.position).add(new THREE.Vector3(0, 1.3, 0));

    // Core signal pulsing in sky
    if (Math.floor(t * 10) % 4 === 0) {
      game.particles.burst({
        position: game.player.position.clone().add(new THREE.Vector3(0, 15, -15)),
        count: 10,
        color: 0x00f0ff,
        speed: 4,
        spread: 3.0,
        life: 1.2,
        size: 0.3,
      });
    }

    if (t >= 7.0) {
      this.done = true;
      hideVictoryBanner();
      game.cameraController.cinematicTarget = null;
      game.cameraController.cinematicPosition = null;
      this.onComplete();
    }
  }

  dispose(): void {
    this.done = true;
    hideVictoryBanner();
    this.game.cameraController.cinematicTarget = null;
    this.game.cameraController.cinematicPosition = null;
  }
}

// -----------------------------------------------------------------------------
// UI Banners
// -----------------------------------------------------------------------------

function showHostileDetectionBanner(): void {
  let el = document.getElementById('nexus-threat-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nexus-threat-banner';
    el.style.cssText = [
      'position:fixed', 'top:20%', 'left:50%', 'transform:translateX(-50%)',
      'text-align:center', 'pointer-events:none', 'z-index:900',
      'font-family:Orbitron,Segoe UI,monospace', 'background:rgba(12,2,4,0.85)',
      'padding:16px 36px', 'border-radius:4px', 'border:1px solid #ff2200',
      'box-shadow:0 0 30px rgba(255,34,0,0.5)', 'max-width:90vw',
      'transition:opacity 0.5s',
    ].join(';');
    document.body.appendChild(el);
  }

  el.innerHTML = `
    <div style="color:#ff3300;font-size:clamp(10px,1.4vw,12px);letter-spacing:0.35em;font-weight:bold;margin-bottom:6px;">
      UNKNOWN SYSTEM: MULTIPLE HOSTILE UNITS DETECTED
    </div>
    <div style="color:#ff2200;font-size:clamp(16px,3vw,24px);letter-spacing:0.4em;font-weight:900;text-shadow:0 0 16px #ff2200;margin-bottom:6px;">
      THREAT LEVEL: CRITICAL
    </div>
    <div style="color:#ffffff;font-size:clamp(12px,1.8vw,16px);letter-spacing:0.25em;">
      THE FALLEN LEGION HAS AWAKENED
    </div>
  `;
  el.style.opacity = '1';

  clearTimeout((el as unknown as { _timer?: number })._timer);
  (el as unknown as { _timer?: number })._timer = window.setTimeout(() => {
    if (el) el.style.opacity = '0';
  }, 4200);
}

function hideCinematicBanner(): void {
  const el = document.getElementById('nexus-threat-banner');
  if (el) el.style.opacity = '0';
}

function showVictoryBanner(): void {
  let el = document.getElementById('nexus-victory-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nexus-victory-banner';
    el.style.cssText = [
      'position:fixed', 'top:22%', 'left:50%', 'transform:translateX(-50%)',
      'text-align:center', 'pointer-events:none', 'z-index:900',
      'font-family:Orbitron,Segoe UI,monospace', 'background:rgba(4,10,22,0.88)',
      'padding:20px 42px', 'border-radius:4px', 'border:1px solid #00f0ff',
      'box-shadow:0 0 35px rgba(0,240,255,0.45)', 'max-width:90vw',
      'transition:opacity 0.6s',
    ].join(';');
    document.body.appendChild(el);
  }

  el.innerHTML = `
    <div style="color:#00f0ff;font-size:clamp(18px,3.2vw,26px);letter-spacing:0.4em;font-weight:900;text-shadow:0 0 18px #00f0ff;margin-bottom:8px;">
      MISSION COMPLETE
    </div>
    <div style="color:#8a5cff;font-size:clamp(12px,1.8vw,15px);letter-spacing:0.3em;font-weight:bold;margin-bottom:8px;">
      LEGION LINK ESTABLISHED
    </div>
    <div style="color:#dff6ff;font-size:clamp(11px,1.5vw,13px);letter-spacing:0.25em;margin-bottom:10px;">
      UNKNOWN SIGNAL DETECTED
    </div>
    <div style="color:rgba(210,235,255,0.75);font-size:clamp(10px,1.3vw,12px);letter-spacing:0.18em;font-style:italic;">
      "The awakening has only just begun."
    </div>
  `;
  el.style.opacity = '1';
}

function hideVictoryBanner(): void {
  const el = document.getElementById('nexus-victory-banner');
  if (el) el.style.opacity = '0';
}

function showSkipPrompt(): void {
  let skip = document.getElementById('nexus-skip-prompt');
  if (!skip) {
    skip = document.createElement('div');
    skip.id = 'nexus-skip-prompt';
    skip.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:28px',
      'color:rgba(210,240,255,0.65)', 'font-family:Orbitron,Segoe UI,sans-serif',
      'font-size:11px', 'letter-spacing:0.18em', 'z-index:910',
      'background:rgba(5,10,20,0.6)', 'padding:6px 14px',
      'border-radius:3px', 'border:1px solid rgba(0,240,255,0.25)',
      'pointer-events:auto', 'cursor:pointer',
    ].join(';');
    skip.textContent = 'PRESS [SPACE] OR [E] TO SKIP';
    document.body.appendChild(skip);
  }
  skip.style.display = 'block';
}

function hideSkipPrompt(): void {
  const skip = document.getElementById('nexus-skip-prompt');
  if (skip) skip.style.display = 'none';
}
