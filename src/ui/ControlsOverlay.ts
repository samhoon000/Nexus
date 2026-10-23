/**
 * ControlsOverlay: PC keyboard & mouse combat and traversal controls overlay.
 * Presented upon entering Level 6 and accessible via the Pause menu.
 */
export class ControlsOverlay {
  private readonly root: HTMLElement;
  private isVisible = false;
  private onDismissCallback: (() => void) | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'nexus-controls-overlay';
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(2,6,14,0.92)',
      'display:none',
      'flex-direction:column',
      'justify-content:center',
      'align-items:center',
      'z-index:960',
      'font-family:Orbitron,Segoe UI,sans-serif',
      'padding:20px',
      'backdrop-filter:blur(10px)',
      'opacity:0',
      'transition:opacity 0.3s ease',
      'pointer-events:auto',
      'user-select:none',
    ].join(';');

    this.root.innerHTML = `
      <div style="
        width:min(680px,94vw);
        background:linear-gradient(180deg,rgba(8,16,32,0.95),rgba(4,8,18,0.98));
        border:1px solid rgba(0,240,255,0.4);
        border-top:3px solid #00f0ff;
        border-radius:6px;
        box-shadow:0 0 35px rgba(0,240,255,0.25), inset 0 0 20px rgba(0,240,255,0.05);
        padding:26px 32px;
        color:#dff6ff;
        display:flex;
        flex-direction:column;
        gap:18px;
      ">
        <div style="text-align:center;">
          <div style="color:#00f0ff;font-size:11px;letter-spacing:0.35em;font-weight:700;margin-bottom:4px;text-shadow:0 0 10px rgba(0,240,255,0.7);">
            CYAN KNIGHT COMBAT SYSTEMS
          </div>
          <div style="color:#ffffff;font-size:clamp(18px,3vw,26px);letter-spacing:0.25em;font-weight:900;text-shadow:0 0 18px rgba(0,240,255,0.5);">
            TACTICAL PC CONTROLS
          </div>
        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));
          gap:10px 18px;
          margin-top:6px;
        ">
          <!-- WASD Move -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #00f0ff;">
            <div style="display:flex;gap:4px;">
              <span class="ctrl-key">W</span><span class="ctrl-key">A</span><span class="ctrl-key">S</span><span class="ctrl-key">D</span>
            </div>
            <div style="font-size:12px;letter-spacing:0.12em;color:#e8f4fc;text-align:right;">Move / Sprint</div>
          </div>

          <!-- Mouse Aim -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #00f0ff;">
            <span class="ctrl-key">MOUSE</span>
            <div style="font-size:12px;letter-spacing:0.12em;color:#e8f4fc;text-align:right;">Aim / Combat Direction</div>
          </div>

          <!-- LMB Strike -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #00f0ff;">
            <div style="display:flex;gap:4px;align-items:center;">
              <span class="ctrl-key">LMB</span>
              <span style="color:#7ab5d6;font-size:11px;">/</span>
              <span class="ctrl-key">F</span>
            </div>
            <div style="font-size:12px;letter-spacing:0.12em;color:#e8f4fc;text-align:right;">Normal Strike / 3-Hit Combo</div>
          </div>

          <!-- Hold LMB Power Attack -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #ffaa00;">
            <div style="display:flex;gap:4px;align-items:center;">
              <span class="ctrl-key" style="border-color:#ffaa00;color:#ffaa00;">HOLD LMB</span>
            </div>
            <div style="font-size:12px;letter-spacing:0.12em;color:#ffaa00;text-align:right;font-weight:700;">Charged Power Attack</div>
          </div>

          <!-- RMB Shield -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #00f0ff;">
            <div style="display:flex;gap:4px;align-items:center;">
              <span class="ctrl-key">RMB</span>
              <span style="color:#7ab5d6;font-size:11px;">/</span>
              <span class="ctrl-key">Q</span>
            </div>
            <div style="font-size:12px;letter-spacing:0.12em;color:#e8f4fc;text-align:right;">Energy Shield (Hold to Block)</div>
          </div>

          <!-- Space Jump -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #00f0ff;">
            <span class="ctrl-key" style="min-width:68px;">SPACE</span>
            <div style="font-size:12px;letter-spacing:0.12em;color:#e8f4fc;text-align:right;">Jump / Double Jump</div>
          </div>

          <!-- Shift Dodge -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #00f0ff;">
            <div style="display:flex;gap:4px;align-items:center;">
              <span class="ctrl-key" style="min-width:60px;">SHIFT</span>
              <span style="color:#7ab5d6;font-size:11px;">/</span>
              <span class="ctrl-key">C</span>
            </div>
            <div style="font-size:12px;letter-spacing:0.12em;color:#e8f4fc;text-align:right;">Dodge Roll (Invulnerability)</div>
          </div>

          <!-- E Reboot -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #8a5cff;">
            <span class="ctrl-key" style="border-color:#8a5cff;color:#c89aff;">E</span>
            <div style="font-size:12px;letter-spacing:0.12em;color:#d8b8ff;text-align:right;">Reboot Defeated Robot as Ally</div>
          </div>

          <!-- Esc Pause -->
          <div class="ctrl-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(10,20,38,0.5);padding:8px 12px;border-radius:4px;border-left:2px solid #7ab5d6;">
            <span class="ctrl-key">ESC</span>
            <div style="font-size:12px;letter-spacing:0.12em;color:#a8cce4;text-align:right;">Pause Menu / Help</div>
          </div>
        </div>

        <div style="display:flex;justify-content:center;margin-top:8px;">
          <button id="btn-controls-dismiss" style="
            background:linear-gradient(90deg,#00f0ff,#3c7bff);
            color:#050914;
            font-family:Orbitron,sans-serif;
            font-size:14px;
            font-weight:900;
            letter-spacing:0.25em;
            padding:12px 42px;
            border:none;
            border-radius:3px;
            cursor:pointer;
            box-shadow:0 0 24px rgba(0,240,255,0.6);
            transition:transform 0.15s,box-shadow 0.15s;
          ">CONTINUE</button>
        </div>
      </div>
    `;

    // Inject styles for ctrl-key badges
    const style = document.createElement('style');
    style.textContent = `
      .ctrl-key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 26px;
        height: 24px;
        padding: 0 6px;
        background: rgba(14, 28, 52, 0.85);
        border: 1px solid rgba(0, 240, 255, 0.6);
        border-radius: 3px;
        color: #00f0ff;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 0 6px rgba(0, 240, 255, 0.25);
      }
      #btn-controls-dismiss:hover {
        transform: scale(1.03);
        box-shadow: 0 0 32px rgba(0, 240, 255, 0.9);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.root);

    const btn = this.root.querySelector('#btn-controls-dismiss');
    btn?.addEventListener('click', () => this.hide());
  }

  show(onDismiss?: () => void): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.onDismissCallback = onDismiss ?? null;

    this.root.style.display = 'flex';
    requestAnimationFrame(() => {
      this.root.style.opacity = '1';
    });

    // Handle space / enter / escape to dismiss
    this.keyListener = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    };
    window.addEventListener('keydown', this.keyListener, { capture: true });
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener, { capture: true });
      this.keyListener = null;
    }

    this.root.style.opacity = '0';
    setTimeout(() => {
      if (!this.isVisible) this.root.style.display = 'none';
    }, 300);

    const cb = this.onDismissCallback;
    this.onDismissCallback = null;
    if (cb) {
      setTimeout(() => {
        if (!this.isVisible) cb();
      }, 300);
    }
  }

  get isOpen(): boolean {
    return this.isVisible;
  }
}
