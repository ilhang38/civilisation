// ============================================================
// technology.js — Arbre technologique des civilisations
// ============================================================

export const TECH = {
  AGRICULTURE:  'agriculture',
  HUSBANDRY:    'husbandry',
  TOOLS:        'tools',
  METALLURGY:   'metallurgy',
  ARCHITECTURE: 'architecture',
  TRADE:        'trade',
  ENGINEERING:  'engineering',
  WRITING:      'writing',
  MASONRY:      'masonry',
};

export const TECH_CONFIG = {
  [TECH.AGRICULTURE]:  { name:'Agriculture',  icon:'🌾', requires:[], cost:100, effect: s => { s.foodMult += 0.3; }, desc:'Augmente la production de nourriture de 30%' },
  [TECH.HUSBANDRY]:    { name:'Élevage',      icon:'🐄', requires:[TECH.AGRICULTURE], cost:150, effect: s => { s.foodMult += 0.2; }, desc:'Permet l\'élevage et +20% nourriture' },
  [TECH.TOOLS]:        { name:'Outils',       icon:'⛏', requires:[], cost:80,  effect: s => { s.gatherMult += 0.4; }, desc:'Améliore la récolte de 40%' },
  [TECH.METALLURGY]:   { name:'Métallurgie',  icon:'⚙', requires:[TECH.TOOLS], cost:200, effect: s => { s.gatherMult += 0.5; s.buildSpeed += 0.3; }, desc:'Meilleurs outils, construction plus rapide' },
  [TECH.ARCHITECTURE]: { name:'Architecture', icon:'🏛', requires:[TECH.TOOLS], cost:180, effect: s => { s.housingMult += 0.5; s.buildSpeed += 0.2; }, desc:'Bâtiments plus grands et résistants' },
  [TECH.TRADE]:        { name:'Commerce',     icon:'💰', requires:[TECH.AGRICULTURE], cost:160, effect: s => { s.goldMult += 0.5; }, desc:'Génère de l\'or et du commerce' },
  [TECH.ENGINEERING]:  { name:'Ingénierie',   icon:'🔧', requires:[TECH.ARCHITECTURE, TECH.METALLURGY], cost:300, effect: s => { s.gatherMult += 0.3; s.buildSpeed += 0.5; }, desc:'Toutes les productions +30%' },
  [TECH.WRITING]:      { name:'Écriture',     icon:'📜', requires:[TECH.TRADE], cost:220, effect: s => { s.popGrowth += 0.2; }, desc:'Croissance pop +20%, archives' },
  [TECH.MASONRY]:      { name:'Maçonnerie',   icon:'🧱', requires:[TECH.ARCHITECTURE], cost:250, effect: s => { s.stoneMult += 0.6; s.defenseBonus += 0.3; }, desc:'Pierre +60%, défense +30%' },
};

export class TechTree {
  constructor() {
    this.researched = new Set();
    this.inProgress = null; // { tech, progress, cost }
    // Buffs cumulatifs du settlement
    this.stats = {
      foodMult:    1.0,
      gatherMult:  1.0,
      housingMult: 1.0,
      buildSpeed:  1.0,
      goldMult:    0.0,
      popGrowth:   1.0,
      stoneMult:   1.0,
      defenseBonus:0.0,
    };
  }

  getAvailable() {
    return Object.keys(TECH_CONFIG).filter(t => {
      if (this.researched.has(t)) return false;
      const cfg = TECH_CONFIG[t];
      return cfg.requires.every(r => this.researched.has(r));
    });
  }

  startResearch(tech, knowledgePoints) {
    if (this.inProgress) return false;
    if (this.researched.has(tech)) return false;
    const cfg = TECH_CONFIG[tech];
    if (!cfg) return false;
    if (!cfg.requires.every(r => this.researched.has(r))) return false;
    this.inProgress = { tech, progress: 0, cost: cfg.cost };
    return true;
  }

  update(dt, knowledgeRate) {
    if (!this.inProgress) return null;
    this.inProgress.progress += dt * knowledgeRate;
    if (this.inProgress.progress >= this.inProgress.cost) {
      const completed = this.inProgress.tech;
      this.researched.add(completed);
      TECH_CONFIG[completed].effect(this.stats);
      this.inProgress = null;
      return completed;
    }
    return null;
  }

  autoResearch() {
    if (this.inProgress) return;
    const available = this.getAvailable();
    if (available.length > 0) {
      const pick = available[0]; // Prendre le premier disponible
      this.startResearch(pick, 0);
    }
  }

  getProgress() {
    if (!this.inProgress) return null;
    return {
      tech: this.inProgress.tech,
      name: TECH_CONFIG[this.inProgress.tech].name,
      pct: this.inProgress.progress / this.inProgress.cost,
    };
  }

  toJSON() {
    return {
      researched: [...this.researched],
      inProgress: this.inProgress,
    };
  }

  static fromJSON(data) {
    const tt = new TechTree();
    for (const t of (data.researched || [])) {
      tt.researched.add(t);
      TECH_CONFIG[t]?.effect(tt.stats);
    }
    tt.inProgress = data.inProgress || null;
    return tt;
  }
}
