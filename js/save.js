// ============================================================
// save.js — Sauvegarde/chargement localStorage + JSON
// ============================================================

const SAVE_KEY = 'civilsim_v1';
const AUTO_SAVE_INTERVAL = 300; // ticks

export class SaveManager {
  constructor(sim) {
    this.sim = sim;
    this._autoTimer = 0;
    this._setupButtons();
  }

  _setupButtons() {
    document.getElementById('btn-save')?.addEventListener('click', () => this.save());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportJSON());

    const importInput = document.getElementById('import-file');
    importInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          this.loadFromData(data);
          console.log('[SaveManager] Import réussi');
        } catch (err) {
          console.error('[SaveManager] Erreur import :', err);
          alert('Erreur lors de l\'import : JSON invalide.');
        }
      };
      reader.readAsText(file);
    });
  }

  update(dt) {
    this._autoTimer += dt;
    if (this._autoTimer >= AUTO_SAVE_INTERVAL) {
      this._autoTimer = 0;
      this.save(true);
    }
  }

  // ——— Sauvegarde locale ————————————————————————————
  save(silent = false) {
    try {
      const data = this._serialize();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) console.log('[SaveManager] Sauvegarde locale OK');
    } catch (err) {
      console.warn('[SaveManager] Erreur sauvegarde :', err);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.loadFromData(data);
      console.log('[SaveManager] Chargement local OK');
      return true;
    } catch (err) {
      console.warn('[SaveManager] Erreur chargement :', err);
      return false;
    }
  }

  // ——— Export JSON ———————————————————————————————————
  exportJSON() {
    try {
      const data = this._serialize();
      const json  = JSON.stringify(data, null, 2);
      const blob  = new Blob([json], { type: 'application/json' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href      = url;
      a.download  = `civilsim_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[SaveManager] Erreur export :', err);
    }
  }

  // ——— Sérialisation ————————————————————————————————
  _serialize() {
    const sim = this.sim;
    return {
      version: 1,
      timestamp: Date.now(),
      tick: sim.tick,
      world: sim.world.toJSON(),
      settlements: sim.settlements.map(s => s.toJSON()),
      plants: sim.plantMgr.toJSON(),
      animals: sim.animalMgr.toJSON(),
    };
  }

  loadFromData(data) {
    // Reconstruction complète — on réinitialise la sim
    this.sim.resetFromSave(data);
  }
}
