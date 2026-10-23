import type * as THREE from 'three';
import type { EventBus, ObjectiveInfo } from '../core/EventBus';
import type { CombatSystem } from './CombatSystem';

/**
 * Enhanced DOM overlay for the Campaign Combat HUD.
 * Renders:
 *  - Cyan Knight Health bar and Shield status
 *  - Objective Tracker Card (Stage & Wave Progression)
 *  - Hostile count & Legion Companion count
 *  - Boss Health Bar (Top Center) with Phase Badges
 *  - Reboot indicator when near a defeated robot
 *  - Toast alerts for wave completions and warnings
 *  - Mission Victory Overlay with next stage unlock button
 *  - Dedicated Mobile Touch Action Buttons (Attack, Shield, Reboot)
 */
export class CombatHUD {
  private readonly container: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly shieldStatus: HTMLElement;
  private readonly enemyCount: HTMLElement;
  private readonly companionCount: HTMLElement;
  private readonly objectiveCard: HTMLElement;
  private readonly objTitle: HTMLElement;
  private readonly objDesc: HTMLElement;
  private readonly objProgress: HTMLElement;
  private readonly rebootPrompt: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly mobileCombatControls: HTMLElement;

  // Boss bar elements
  private readonly bossBarContainer: HTMLElement;
  private readonly bossNameLabel: HTMLElement;
  private readonly bossPhaseBadge: HTMLElement;
  private readonly bossHealthFill: HTMLElement;
  private readonly bossHealthPct: HTMLElement;

  // Mission Victory Overlay
  private readonly victoryOverlay: HTMLElement;
  private readonly victoryTitle: HTMLElement;
  private readonly victorySubtitle: HTMLElement;
  private readonly victoryStats: HTMLElement;
  private readonly victoryNextBtn: HTMLElement;

  // Skill bar & combo badge
  private readonly skillFill: HTMLElement;
  private readonly skillStatus: HTMLElement;
  private readonly comboBadge: HTMLElement;

  private toastTimeout = 0;
  private attackTouchTriggered = false;
  private gunTouchTriggered = false;
  private shieldTouchHeld = false;
  private rebootTouchTriggered = false;
  private dodgeTouchTriggered = false;
  private nextStageCallback: (() => void) | null = null;

  constructor(private readonly bus: EventBus) {
    this.container = document.createElement('div');
    this.container.id = 'combat-hud';
    this.container.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'bottom:0',
      'pointer-events:none',
      'z-index:400',
      'display:none',
      'font-family:Orbitron,Segoe UI,sans-serif',
    ].join(';');

    // -------------------------------------------------------------------------
    // Player Health & Shield Bar (Bottom Left)
    // -------------------------------------------------------------------------
    const healthContainer = document.createElement('div');
    healthContainer.style.cssText = [
      'position:absolute',
      'bottom:28px',
      'left:28px',
      'width:250px',
      'background:rgba(5,9,18,0.85)',
      'padding:10px 14px',
      'border-radius:4px',
      'border-left:4px solid #00f0ff',
      'box-shadow:0 0 18px rgba(0,240,255,0.25)',
      'pointer-events:none',
    ].join(';');

    const healthHeader = document.createElement('div');
    healthHeader.style.cssText = [
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
      'margin-bottom:6px',
    ].join(';');

    const healthLabel = document.createElement('div');
    healthLabel.textContent = 'CYAN KNIGHT';
    healthLabel.style.cssText = [
      'color:#00f0ff',
      'font-size:11px',
      'letter-spacing:0.2em',
      'font-weight:bold',
      'text-shadow:0 0 8px #00f0ff',
    ].join(';');

    this.shieldStatus = document.createElement('div');
    this.shieldStatus.textContent = 'SHIELD: READY';
    this.shieldStatus.style.cssText = [
      'color:#8a5cff',
      'font-size:9px',
      'letter-spacing:0.12em',
      'text-shadow:0 0 6px #8a5cff',
    ].join(';');

    healthHeader.appendChild(healthLabel);
    healthHeader.appendChild(this.shieldStatus);

    const healthTrack = document.createElement('div');
    healthTrack.style.cssText = [
      'width:100%',
      'height:10px',
      'background:rgba(10,20,35,0.85)',
      'border:1px solid rgba(0,240,255,0.3)',
      'border-radius:2px',
      'overflow:hidden',
    ].join(';');

    this.healthFill = document.createElement('div');
    this.healthFill.style.cssText = [
      'height:100%',
      'background:linear-gradient(90deg,#00f0ff,#3c7bff,#8a5cff)',
      'width:100%',
      'transition:width 0.2s ease-out',
      'box-shadow:0 0 10px rgba(0,240,255,0.7)',
    ].join(';');
    healthTrack.appendChild(this.healthFill);

    // Skill Energy Bar
    const skillHeader = document.createElement('div');
    skillHeader.style.cssText = [
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
      'margin-top:6px',
      'margin-bottom:3px',
    ].join(';');

    const skillLabel = document.createElement('div');
    skillLabel.textContent = 'POWER STRIKE';
    skillLabel.style.cssText = [
      'color:#8a5cff',
      'font-size:9px',
      'letter-spacing:0.14em',
      'font-weight:bold',
    ].join(';');

    this.skillStatus = document.createElement('div');
    this.skillStatus.textContent = '0%';
    this.skillStatus.style.cssText = [
      'color:rgba(180,180,255,0.7)',
      'font-size:9px',
      'letter-spacing:0.1em',
    ].join(';');

    skillHeader.appendChild(skillLabel);
    skillHeader.appendChild(this.skillStatus);

    const skillTrack = document.createElement('div');
    skillTrack.style.cssText = [
      'width:100%',
      'height:6px',
      'background:rgba(15,10,30,0.85)',
      'border:1px solid rgba(138,92,255,0.3)',
      'border-radius:2px',
      'overflow:hidden',
    ].join(';');

    this.skillFill = document.createElement('div');
    this.skillFill.style.cssText = [
      'height:100%',
      'background:linear-gradient(90deg,#8a5cff,#d066ff)',
      'width:0%',
      'transition:width 0.15s ease-out',
      'box-shadow:0 0 8px rgba(138,92,255,0.7)',
    ].join(';');
    skillTrack.appendChild(this.skillFill);

    this.comboBadge = document.createElement('div');
    this.comboBadge.style.cssText = [
      'margin-top:6px',
      'color:#ffaa00',
      'font-size:10px',
      'font-weight:bold',
      'letter-spacing:0.16em',
      'display:none',
      'text-shadow:0 0 10px rgba(255,170,0,0.8)',
    ].join(';');

    healthContainer.appendChild(healthHeader);
    healthContainer.appendChild(healthTrack);
    healthContainer.appendChild(skillHeader);
    healthContainer.appendChild(skillTrack);
    healthContainer.appendChild(this.comboBadge);
    this.container.appendChild(healthContainer);

    // -------------------------------------------------------------------------
    // Objective Tracker Card (Top Left)
    // -------------------------------------------------------------------------
    this.objectiveCard = document.createElement('div');
    this.objectiveCard.style.cssText = [
      'position:absolute',
      'top:24px',
      'left:28px',
      'width:min(400px,85vw)',
      'background:rgba(6,10,22,0.85)',
      'border:1px solid rgba(0,240,255,0.35)',
      'border-left:4px solid #00f0ff',
      'padding:10px 16px',
      'border-radius:3px',
      'backdrop-filter:blur(6px)',
      'box-shadow:0 0 20px rgba(0,240,255,0.15)',
      'pointer-events:none',
    ].join(';');

    this.objTitle = document.createElement('div');
    this.objTitle.id = 'combat-obj-title';
    this.objTitle.textContent = 'STAGE 6 · WAVE 1 / 6';
    this.objTitle.style.cssText = [
      'color:#00f0ff',
      'font-size:clamp(11px,1.4vw,13px)',
      'font-weight:bold',
      'letter-spacing:0.18em',
      'margin-bottom:4px',
      'text-shadow:0 0 10px rgba(0,240,255,0.6)',
    ].join(';');

    this.objDesc = document.createElement('div');
    this.objDesc.id = 'combat-obj-desc';
    this.objDesc.textContent = 'Neutralize hostile robotic forces.';
    this.objDesc.style.cssText = [
      'color:rgba(210,235,255,0.85)',
      'font-size:clamp(10px,1.2vw,11px)',
      'letter-spacing:0.08em',
      'margin-bottom:6px',
    ].join(';');

    this.objProgress = document.createElement('div');
    this.objProgress.id = 'combat-obj-progress';
    this.objProgress.textContent = '0 / 4 NEUTRALIZED';
    this.objProgress.style.cssText = [
      'color:#8a5cff',
      'font-size:clamp(10px,1.2vw,11px)',
      'font-weight:bold',
      'letter-spacing:0.15em',
    ].join(';');

    this.objectiveCard.appendChild(this.objTitle);
    this.objectiveCard.appendChild(this.objDesc);
    this.objectiveCard.appendChild(this.objProgress);
    this.container.appendChild(this.objectiveCard);

    // -------------------------------------------------------------------------
    // Force Counters (Top Right)
    // -------------------------------------------------------------------------
    const counterBox = document.createElement('div');
    counterBox.style.cssText = [
      'position:absolute',
      'top:24px',
      'right:28px',
      'display:flex',
      'flex-direction:column',
      'gap:6px',
      'align-items:flex-end',
      'pointer-events:none',
    ].join(';');

    this.enemyCount = document.createElement('div');
    this.enemyCount.textContent = 'HOSTILE FORCES: 0';
    this.enemyCount.style.cssText = [
      'color:#ff3300',
      'font-size:clamp(11px,1.4vw,13px)',
      'font-weight:bold',
      'letter-spacing:0.16em',
      'text-shadow:0 0 10px rgba(255,51,0,0.8)',
      'background:rgba(20,5,5,0.75)',
      'padding:4px 12px',
      'border-radius:3px',
      'border-right:3px solid #ff3300',
    ].join(';');

    this.companionCount = document.createElement('div');
    this.companionCount.textContent = 'LEGION COMPANIONS: 0 / 4';
    this.companionCount.style.cssText = [
      'color:#00f0ff',
      'font-size:clamp(11px,1.4vw,13px)',
      'font-weight:bold',
      'letter-spacing:0.16em',
      'text-shadow:0 0 10px rgba(0,240,255,0.8)',
      'background:rgba(5,15,25,0.75)',
      'padding:4px 12px',
      'border-radius:3px',
      'border-right:3px solid #00f0ff',
    ].join(';');

    counterBox.appendChild(this.enemyCount);
    counterBox.appendChild(this.companionCount);
    this.container.appendChild(counterBox);

    // -------------------------------------------------------------------------
    // Boss Health Bar (Top Center)
    // -------------------------------------------------------------------------
    this.bossBarContainer = document.createElement('div');
    this.bossBarContainer.id = 'boss-bar-container';
    this.bossBarContainer.style.cssText = [
      'position:absolute',
      'top:24px',
      'left:50%',
      'transform:translateX(-50%)',
      'width:min(500px,88vw)',
      'background:rgba(12,4,8,0.88)',
      'border:1px solid rgba(255,34,0,0.45)',
      'padding:10px 16px',
      'border-radius:4px',
      'box-shadow:0 0 24px rgba(255,34,0,0.3)',
      'display:none',
      'flex-direction:column',
      'gap:6px',
      'pointer-events:none',
    ].join(';');

    const bossHeader = document.createElement('div');
    bossHeader.style.cssText = [
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
    ].join(';');

    this.bossNameLabel = document.createElement('div');
    this.bossNameLabel.textContent = 'THE WARLORD';
    this.bossNameLabel.style.cssText = [
      'color:#ff2200',
      'font-size:12px',
      'font-weight:bold',
      'letter-spacing:0.25em',
      'text-shadow:0 0 10px #ff2200',
    ].join(';');

    this.bossPhaseBadge = document.createElement('div');
    this.bossPhaseBadge.textContent = 'PHASE 1';
    this.bossPhaseBadge.style.cssText = [
      'color:#ffaa00',
      'font-size:10px',
      'letter-spacing:0.15em',
      'background:rgba(255,170,0,0.15)',
      'padding:2px 8px',
      'border-radius:2px',
      'border:1px solid rgba(255,170,0,0.4)',
    ].join(';');

    bossHeader.appendChild(this.bossNameLabel);
    bossHeader.appendChild(this.bossPhaseBadge);

    const bossTrack = document.createElement('div');
    bossTrack.style.cssText = [
      'width:100%',
      'height:12px',
      'background:rgba(25,5,5,0.9)',
      'border:1px solid rgba(255,34,0,0.3)',
      'border-radius:2px',
      'overflow:hidden',
      'position:relative',
    ].join(';');

    this.bossHealthFill = document.createElement('div');
    this.bossHealthFill.style.cssText = [
      'height:100%',
      'width:100%',
      'background:linear-gradient(90deg,#ff1100,#ff6600,#ffaa00)',
      'transition:width 0.25s ease-out',
      'box-shadow:0 0 12px rgba(255,34,0,0.8)',
    ].join(';');

    this.bossHealthPct = document.createElement('div');
    this.bossHealthPct.textContent = '100%';
    this.bossHealthPct.style.cssText = [
      'position:absolute',
      'top:0',
      'right:6px',
      'font-size:9px',
      'color:#ffffff',
      'line-height:12px',
      'font-weight:bold',
      'letter-spacing:0.1em',
    ].join(';');

    bossTrack.appendChild(this.bossHealthFill);
    bossTrack.appendChild(this.bossHealthPct);

    this.bossBarContainer.appendChild(bossHeader);
    this.bossBarContainer.appendChild(bossTrack);
    this.container.appendChild(this.bossBarContainer);

    // -------------------------------------------------------------------------
    // Reboot Interaction Prompt
    // -------------------------------------------------------------------------
    this.rebootPrompt = document.createElement('div');
    this.rebootPrompt.style.cssText = [
      'position:absolute',
      'bottom:15%',
      'left:50%',
      'transform:translateX(-50%)',
      'color:#00f0ff',
      'font-size:clamp(13px,1.8vw,16px)',
      'font-weight:bold',
      'letter-spacing:0.18em',
      'text-align:center',
      'text-shadow:0 0 14px #00f0ff',
      'background:rgba(3,8,18,0.85)',
      'padding:10px 24px',
      'border-radius:4px',
      'border:1px solid #00f0ff',
      'opacity:0',
      'transition:opacity 0.25s',
      'pointer-events:none',
    ].join(';');
    this.rebootPrompt.textContent = '[ E ] REBOOT HOSTILE UNIT';
    this.container.appendChild(this.rebootPrompt);

    // -------------------------------------------------------------------------
    // Toast Notification Banner
    // -------------------------------------------------------------------------
    this.toastEl = document.createElement('div');
    this.toastEl.style.cssText = [
      'position:absolute',
      'top:22%',
      'left:50%',
      'transform:translateX(-50%)',
      'color:#ffffff',
      'font-size:clamp(12px,2vw,16px)',
      'letter-spacing:0.2em',
      'text-align:center',
      'background:rgba(5,10,22,0.92)',
      'border:1px solid rgba(0,240,255,0.6)',
      'padding:12px 28px',
      'border-radius:4px',
      'box-shadow:0 0 24px rgba(0,240,255,0.4)',
      'opacity:0',
      'transition:opacity 0.35s',
      'pointer-events:none',
      'z-index:950',
    ].join(';');
    this.container.appendChild(this.toastEl);

    // -------------------------------------------------------------------------
    // Mission Victory Overlay Modal
    // -------------------------------------------------------------------------
    this.victoryOverlay = document.createElement('div');
    this.victoryOverlay.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:min(480px,90vw)',
      'background:rgba(4,8,18,0.95)',
      'border:2px solid #00f0ff',
      'box-shadow:0 0 36px rgba(0,240,255,0.4)',
      'padding:28px 24px',
      'border-radius:6px',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'gap:16px',
      'pointer-events:auto',
      'z-index:980',
    ].join(';');

    this.victoryTitle = document.createElement('div');
    this.victoryTitle.style.cssText = [
      'color:#00f0ff',
      'font-size:clamp(18px,2.8vw,26px)',
      'font-weight:bold',
      'letter-spacing:0.25em',
      'text-shadow:0 0 16px #00f0ff',
      'text-align:center',
    ].join(';');
    this.victoryTitle.textContent = 'SECTOR LIBERATED';

    this.victorySubtitle = document.createElement('div');
    this.victorySubtitle.style.cssText = [
      'color:rgba(210,240,255,0.85)',
      'font-size:clamp(11px,1.4vw,13px)',
      'letter-spacing:0.12em',
      'text-align:center',
    ].join(';');
    this.victorySubtitle.textContent = 'Hostile robotic forces neutralized. Sector secured.';

    this.victoryStats = document.createElement('div');
    this.victoryStats.style.cssText = [
      'width:100%',
      'background:rgba(8,16,32,0.6)',
      'padding:12px',
      'border-radius:4px',
      'border:1px solid rgba(0,240,255,0.2)',
      'color:#8a5cff',
      'font-size:11px',
      'letter-spacing:0.1em',
      'text-align:center',
    ].join(';');

    this.victoryNextBtn = document.createElement('button');
    this.victoryNextBtn.style.cssText = [
      'background:linear-gradient(90deg,#00f0ff,#3c7bff)',
      'border:none',
      'color:#02060e',
      'font-family:Orbitron,sans-serif',
      'font-size:12px',
      'font-weight:bold',
      'letter-spacing:0.2em',
      'padding:12px 28px',
      'border-radius:3px',
      'cursor:pointer',
      'box-shadow:0 0 20px rgba(0,240,255,0.5)',
      'transition:transform 0.15s,box-shadow 0.15s',
    ].join(';');
    this.victoryNextBtn.textContent = 'ADVANCE TO NEXT ZONE';
    this.victoryNextBtn.addEventListener('click', () => {
      this.hideVictoryModal();
      this.nextStageCallback?.();
    });

    this.victoryOverlay.appendChild(this.victoryTitle);
    this.victoryOverlay.appendChild(this.victorySubtitle);
    this.victoryOverlay.appendChild(this.victoryStats);
    this.victoryOverlay.appendChild(this.victoryNextBtn);
    this.container.appendChild(this.victoryOverlay);

    // -------------------------------------------------------------------------
    // Mobile Touch Buttons
    // -------------------------------------------------------------------------
    this.mobileCombatControls = document.createElement('div');
    this.mobileCombatControls.id = 'mobile-combat-controls';
    this.mobileCombatControls.style.cssText = [
      'position:absolute',
      'bottom:32px',
      'right:120px',
      'display:none',
      'gap:14px',
      'pointer-events:auto',
    ].join(';');

    // Attack Button
    const btnAttack = document.createElement('button');
    btnAttack.textContent = 'ATTACK';
    btnAttack.style.cssText = [
      'width:72px',
      'height:72px',
      'border-radius:50%',
      'background:radial-gradient(circle,rgba(0,240,255,0.35) 0%,rgba(6,14,30,0.8) 80%)',
      'border:2px solid #00f0ff',
      'color:#ffffff',
      'font-family:Orbitron,sans-serif',
      'font-size:10px',
      'font-weight:bold',
      'letter-spacing:0.12em',
      'box-shadow:0 0 16px rgba(0,240,255,0.5)',
      'touch-action:none',
    ].join(';');
    btnAttack.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.attackTouchTriggered = true;
    });

    // Shield Button
    const btnShield = document.createElement('button');
    btnShield.textContent = 'SHIELD';
    btnShield.style.cssText = [
      'width:68px',
      'height:68px',
      'border-radius:50%',
      'background:radial-gradient(circle,rgba(138,92,255,0.35) 0%,rgba(14,6,30,0.8) 80%)',
      'border:2px solid #8a5cff',
      'color:#ffffff',
      'font-family:Orbitron,sans-serif',
      'font-size:10px',
      'font-weight:bold',
      'letter-spacing:0.12em',
      'box-shadow:0 0 16px rgba(138,92,255,0.5)',
      'touch-action:none',
    ].join(';');
    btnShield.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.shieldTouchHeld = true;
    });
    const releaseShield = (e: Event): void => {
      e.stopPropagation();
      this.shieldTouchHeld = false;
    };
    btnShield.addEventListener('pointerup', releaseShield);
    btnShield.addEventListener('pointercancel', releaseShield);

    // Reboot Button
    const btnReboot = document.createElement('button');
    btnReboot.textContent = 'REBOOT';
    btnReboot.style.cssText = [
      'width:68px',
      'height:68px',
      'border-radius:50%',
      'background:radial-gradient(circle,rgba(0,240,255,0.4) 0%,rgba(6,14,30,0.8) 80%)',
      'border:2px solid #00f0ff',
      'color:#00f0ff',
      'font-family:Orbitron,sans-serif',
      'font-size:10px',
      'font-weight:bold',
      'letter-spacing:0.12em',
      'box-shadow:0 0 16px rgba(0,240,255,0.6)',
      'touch-action:none',
    ].join(';');
    btnReboot.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.rebootTouchTriggered = true;
    });

    // Gun Button
    const btnGun = document.createElement('button');
    btnGun.textContent = 'GUN';
    btnGun.style.cssText = [
      'width:68px',
      'height:68px',
      'border-radius:50%',
      'background:radial-gradient(circle,rgba(255,170,0,0.35) 0%,rgba(30,14,6,0.8) 80%)',
      'border:2px solid #ffaa00',
      'color:#ffffff',
      'font-family:Orbitron,sans-serif',
      'font-size:10px',
      'font-weight:bold',
      'letter-spacing:0.12em',
      'box-shadow:0 0 16px rgba(255,170,0,0.5)',
      'touch-action:none',
    ].join(';');
    btnGun.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.gunTouchTriggered = true;
    });

    // Dodge Button
    const btnDodge = document.createElement('button');
    btnDodge.textContent = 'DODGE';
    btnDodge.style.cssText = [
      'width:68px',
      'height:68px',
      'border-radius:50%',
      'background:radial-gradient(circle,rgba(0,240,255,0.3) 0%,rgba(6,25,35,0.8) 80%)',
      'border:2px solid #00f0ff',
      'color:#ffffff',
      'font-family:Orbitron,sans-serif',
      'font-size:10px',
      'font-weight:bold',
      'letter-spacing:0.12em',
      'box-shadow:0 0 16px rgba(0,240,255,0.5)',
      'touch-action:none',
    ].join(';');
    btnDodge.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.dodgeTouchTriggered = true;
    });

    this.mobileCombatControls.appendChild(btnShield);
    this.mobileCombatControls.appendChild(btnAttack);
    this.mobileCombatControls.appendChild(btnDodge);
    this.mobileCombatControls.appendChild(btnGun);
    this.mobileCombatControls.appendChild(btnReboot);
    this.container.appendChild(this.mobileCombatControls);

    document.body.appendChild(this.container);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.bus.on('combat:shield:start', () => {
      this.shieldStatus.textContent = 'SHIELD: ACTIVE';
      this.shieldStatus.style.color = '#00f0ff';
    });

    this.bus.on('combat:shield:end', () => {
      this.shieldStatus.textContent = 'SHIELD: READY';
      this.shieldStatus.style.color = '#8a5cff';
    });

    this.bus.on('companion:limit', ({ limit }) => {
      this.showToast(`COMPANION LIMIT REACHED (${limit}/${limit})`);
    });

    this.bus.on('objective:updated', (info) => {
      this.updateObjective(info);
    });

    this.bus.on('combat:wave:start', ({ wave, totalWaves, title }) => {
      this.showToast(`${title} — WAVE ${wave} / ${totalWaves}`);
    });

    this.bus.on('combat:wave:cleared', ({ wave, totalWaves }) => {
      if (wave < totalWaves) {
        this.showToast(`WAVE ${wave} CLEARED — REINFORCEMENTS INCOMING`);
      }
    });

    this.bus.on('toast', ({ text }) => {
      this.showToast(text);
    });

    this.bus.on('combat:boss:update', ({ name, hp, maxHp, phase, title }) => {
      this.showBossBar(name, title, hp, maxHp, phase);
    });
  }

  showBossBar(name: string, title: string, hp: number, maxHp: number, phase: number): void {
    this.bossBarContainer.style.display = 'flex';
    this.bossNameLabel.textContent = `${name} — ${title}`;
    this.bossPhaseBadge.textContent = `PHASE ${phase}`;

    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    this.bossHealthFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.bossHealthPct.textContent = `${Math.ceil(ratio * 100)}%`;
  }

  hideBossBar(): void {
    this.bossBarContainer.style.display = 'none';
  }

  showVictoryModal(
    stageId: number,
    nextStageId: number,
    statsText: string,
    onContinue: () => void,
  ): void {
    this.nextStageCallback = onContinue;
    this.victoryOverlay.style.display = 'flex';

    if (stageId === 10) {
      this.victoryTitle.textContent = 'CAMPAIGN VICTORY';
      this.victorySubtitle.textContent = 'The Warlord has fallen. The NEXUS Core is fully restored.';
      this.victoryNextBtn.textContent = 'VIEW CAMPAIGN SUMMARY';
    } else {
      this.victoryTitle.textContent = `STAGE ${stageId} LIBERATED`;
      this.victorySubtitle.textContent = `Sector cleared. Stage ${nextStageId} unlocked.`;
      this.victoryNextBtn.textContent = `ADVANCE TO STAGE ${nextStageId}`;
    }
    this.victoryStats.textContent = statsText;
  }

  hideVictoryModal(): void {
    this.victoryOverlay.style.display = 'none';
    this.nextStageCallback = null;
  }

  showToast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.toastEl.style.opacity = '0';
    }, 2800);
  }

  updateObjective(info: ObjectiveInfo): void {
    this.objTitle.textContent = info.title;
    this.objDesc.textContent = info.description;
    this.objProgress.textContent = info.progress;
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
    this.hideBossBar();
    this.hideVictoryModal();
  }

  setTouchControlsVisible(visible: boolean): void {
    this.mobileCombatControls.style.display = visible ? 'flex' : 'none';
  }

  consumeTouchAttack(): boolean {
    const val = this.attackTouchTriggered;
    this.attackTouchTriggered = false;
    return val;
  }

  consumeTouchGun(): boolean {
    const val = this.gunTouchTriggered;
    this.gunTouchTriggered = false;
    return val;
  }

  isTouchShieldHeld(): boolean {
    return this.shieldTouchHeld;
  }

  consumeTouchReboot(): boolean {
    const val = this.rebootTouchTriggered;
    this.rebootTouchTriggered = false;
    return val;
  }

  consumeTouchDodge(): boolean {
    const val = this.dodgeTouchTriggered;
    this.dodgeTouchTriggered = false;
    return val;
  }

  update(combat: CombatSystem, playerPos: THREE.Vector3): void {
    // Health bar fill
    const hpRatio = Math.max(0, Math.min(1, combat.playerHealth / combat.playerMaxHealth));
    this.healthFill.style.width = `${(hpRatio * 100).toFixed(1)}%`;

    // Skill energy fill
    const skillRatio = Math.max(0, Math.min(1, combat.skillEnergy / combat.skillMaxEnergy));
    this.skillFill.style.width = `${(skillRatio * 100).toFixed(1)}%`;
    if (combat.isSkillActive) {
      this.skillStatus.textContent = 'POWER STRIKE ACTIVE!';
      this.skillStatus.style.color = '#00f0ff';
    } else if (combat.skillEnergy >= 50) {
      this.skillStatus.textContent = 'READY (PASSIVE BOOST)';
      this.skillStatus.style.color = '#ffaa00';
    } else {
      this.skillStatus.textContent = `${Math.floor(combat.skillEnergy)}%`;
      this.skillStatus.style.color = 'rgba(180,180,255,0.7)';
    }

    // Combo badge
    if (combat.comboHits > 1) {
      this.comboBadge.style.display = 'block';
      this.comboBadge.textContent = combat.comboHits >= 3 ? 'FINISHER STRIKE READY!' : `${combat.comboHits}x COMBO`;
      this.comboBadge.style.color = combat.comboHits >= 3 ? '#ff3300' : '#ffaa00';
    } else {
      this.comboBadge.style.display = 'none';
    }

    // Counts
    this.enemyCount.textContent = `HOSTILE FORCES: ${combat.hostileCount}`;
    this.companionCount.textContent = `LEGION COMPANIONS: ${combat.companionCount} / 4`;

    // Near defeated robot prompt
    const defeatedNearby = combat.getDefeatedNearby(playerPos);
    this.rebootPrompt.style.opacity = defeatedNearby ? '1' : '0';
  }

  dispose(): void {
    this.container.remove();
  }
}
