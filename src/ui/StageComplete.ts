import type { StageDefinition } from '../stages/StageTypes';
import { query, setVisible } from '../utils/dom';
import { formatTime } from '../utils/MathUtils';

export class StageCompleteScreen {
  private readonly root = query('#stage-complete');
  private readonly number = query('#sc-number');
  private readonly name = query('#sc-name');
  private readonly time = query('#sc-time');
  private readonly energy = query('#sc-energy');

  show(def: StageDefinition, time: number, energy: number, total: number): void {
    this.number.textContent = String(def.id);
    this.name.textContent = def.name;
    this.time.textContent = formatTime(time);
    this.energy.textContent = `${energy} / ${total}`;
    setVisible(this.root, false);
    void this.root.offsetWidth;
    setVisible(this.root, true);
  }

  hide(): void {
    setVisible(this.root, false);
  }
}
