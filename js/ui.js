// ============================================================
// ui.js — Interface utilisateur, panneaux, sélection
// ============================================================

import { CITY_LEVEL, BUILDING_TYPE } from './city.js';
import { TECH_CONFIG } from './technology.js';

export class UI {
  constructor(sim) {
    this.sim = sim;
    this._updateTimer = 0;
    this._selected    = null; // { type, obj }

    // Tooltip
    this.tooltip = document.getElementById('tooltip');
  }

  // ——— Mise à jour globale ————————————————————————————
  update(dt) {
    this._updateTimer += dt;
    if (this._updateTimer < 30) return; // Mettre à jour toutes les ~30 ticks
    this._updateTimer = 0;

    this._drawWorldStats();
    this._drawResourceStats();
    this._drawEcologyStats();
    this._drawCityList();
    this._drawTechList();
    if (this._selected) this._drawSelection();
  }

  // ——— Statistiques monde ——————————————————————————
  _drawWorldStats() {
    const el = document.getElementById('world-stats');
    if (!el) return;
    const sim = this.sim;
    const pop = sim.settlements.reduce((s, c) => s + c.humans.length, 0);
    const cities = sim.settlements.length;
    const worldStats = sim.world.getStats();

    el.innerHTML = `
      <div class="stat-row"><span class="stat-label">Population</span><span class="stat-value blue">${pop}</span></div>
      <div class="stat-row"><span class="stat-label">Colonies</span><span class="stat-value orange">${cities}</span></div>
      <div class="stat-row"><span class="stat-label">Animaux</span><span class="stat-value green">${sim.animalMgr.animals.length}</span></div>
      <div class="stat-row"><span class="stat-label">Plantes</span><span class="stat-value green">${sim.plantMgr.plants.length}</span></div>
      <div class="stat-row"><span class="stat-label">Tuiles terre</span><span class="stat-value">${worldStats.landTiles}</span></div>
    `;
  }

  _drawResourceStats() {
    const el = document.getElementById('resource-stats');
    if (!el) return;
    const sim = this.sim;
    const totals = { food:0, wood:0, stone:0, ore:0, gold:0 };
    for (const s of sim.settlements) {
      for (const k of Object.keys(totals)) totals[k] += s.stockpile[k] || 0;
    }

    const bars = [
      { key:'food',  label:'Nourriture', color:'#43d98f', max:2000 },
      { key:'wood',  label:'Bois',       color:'#a07040', max:2000 },
      { key:'stone', label:'Pierre',     color:'#9090a0', max:2000 },
      { key:'ore',   label:'Minerai',    color:'#c060c0', max:1000 },
      { key:'gold',  label:'Or',         color:'#f5c842', max:500  },
    ];

    el.innerHTML = bars.map(b => `
      <div class="res-bar-wrap">
        <div class="res-bar-label"><span>${b.label}</span><span>${Math.floor(totals[b.key])}</span></div>
        <div class="res-bar-bg"><div class="res-bar-fill" style="width:${Math.min(100,(totals[b.key]/b.max)*100).toFixed(1)}%;background:${b.color}"></div></div>
      </div>
    `).join('');
  }

  _drawEcologyStats() {
    const el = document.getElementById('ecology-stats');
    if (!el) return;
    const ps = this.sim.plantMgr.getStats();
    const as = this.sim.animalMgr.getStats();
    el.innerHTML = `
      <div class="stat-row"><span class="stat-label">🌳 Arbres</span><span class="stat-value green">${ps.tree}</span></div>
      <div class="stat-row"><span class="stat-label">🍓 Baies</span><span class="stat-value green">${ps.berry}</span></div>
      <div class="stat-row"><span class="stat-label">🌾 Herbe</span><span class="stat-value green">${ps.grass}</span></div>
      <div class="stat-row"><span class="stat-label">🐇 Herbivores</span><span class="stat-value">${as.herbivores}</span></div>
      <div class="stat-row"><span class="stat-label">🐺 Prédateurs</span><span class="stat-value red">${as.predators}</span></div>
    `;
  }

  _drawCityList() {
    const el = document.getElementById('city-list');
    if (!el) return;
    const sims = this.sim.settlements;
    if (sims.length === 0) { el.innerHTML = '<p class="muted">Aucune colonie</p>'; return; }

    el.innerHTML = sims.map((s, i) => {
      const lvl = CITY_LEVEL[s.level];
      return `<div class="city-card" data-idx="${i}">
        <div class="city-name">${lvl.icon} ${s.name}</div>
        <div class="city-level">${lvl.name}</div>
        <div class="city-pop">👤 ${s.humans.length} / ${s.maxPop} &nbsp; 🍖 ${Math.floor(s.stockpile.food)}</div>
      </div>`;
    }).join('');

    // Clic sur ville
    el.querySelectorAll('.city-card').forEach(card => {
      card.addEventListener('click', () => {
        const i = parseInt(card.dataset.idx);
        this.selectObject({ type:'city', obj: this.sim.settlements[i] });
        // Centrer caméra
        const s = this.sim.settlements[i];
        this.sim.camera.targetX = s.x - this.sim.canvas.width  / 2;
        this.sim.camera.targetY = s.y - this.sim.canvas.height / 2;
      });
    });
  }

  _drawTechList() {
    const el = document.getElementById('tech-list');
    if (!el || this.sim.settlements.length === 0) return;
    // Prendre le settlement le plus avancé
    const s = [...this.sim.settlements].sort((a,b) => b.tech.researched.size - a.tech.researched.size)[0];
    if (!s) return;

    const items = Object.entries(TECH_CONFIG).map(([key, cfg]) => {
      let cls = 'tech-locked', status = '🔒';
      if (s.tech.researched.has(key)) { cls = 'tech-done'; status = '✅'; }
      else {
        const avail = cfg.requires.every(r => s.tech.researched.has(r));
        if (avail) { cls = 'tech-progress'; status = '🔬'; }
      }
      return `<div class="tech-item ${cls}"><span>${cfg.icon} ${cfg.name}</span><span>${status}</span></div>`;
    }).join('');

    const prog = s.tech.getProgress();
    el.innerHTML = (prog ? `<div class="tech-item tech-progress"><span>⏳ ${prog.name}</span><span>${Math.round(prog.pct * 100)}%</span></div>` : '') + items;
  }

  // ——— Sélection ——————————————————————————————————————
  selectObject(sel) {
    this._selected = sel;
    this._drawSelection();
  }

  _drawSelection() {
    const el = document.getElementById('selection-info');
    if (!el || !this._selected) return;
    const { type, obj } = this._selected;

    if (type === 'human') {
      const info = obj.getInfo();
      el.innerHTML = `
        <div class="sel-name">👤 ${info.name}</div>
        <div class="sel-type">Humain — ${info.job}</div>
        <div class="sel-stat"><span>Âge</span><span>${info.age}</span></div>
        <div class="sel-stat"><span>État</span><span>${info.state}</span></div>
        <div class="sel-stat"><span>Faim</span><span style="color:${info.hunger>70?'#d04':'#4d4'}">${info.hunger}%</span></div>
        <div class="sel-stat"><span>Soif</span><span style="color:${info.thirst>70?'#d04':'#4d4'}">${info.thirst}%</span></div>
        <div class="sel-stat"><span>Énergie</span><span>${info.energy}%</span></div>
        <div class="sel-stat"><span>Intelligence</span><span>${info.intelligence}</span></div>
        <div class="sel-stat"><span>Force</span><span>${info.strength}</span></div>
        <div class="sel-stat"><span>🍖 Nourriture</span><span>${Math.floor(info.inventory.food)}</span></div>
        <div class="sel-stat"><span>🪵 Bois</span><span>${Math.floor(info.inventory.wood)}</span></div>
        <div class="sel-stat"><span>🪨 Pierre</span><span>${Math.floor(info.inventory.stone)}</span></div>
      `;
    } else if (type === 'animal') {
      const info = obj.getInfo();
      el.innerHTML = `
        <div class="sel-name">${info.herbivore ? '🐇' : '🐺'} ${info.type}</div>
        <div class="sel-type">${info.herbivore ? 'Herbivore' : 'Prédateur'}</div>
        <div class="sel-stat"><span>Âge</span><span>${info.age}</span></div>
        <div class="sel-stat"><span>HP</span><span>${info.hp}</span></div>
        <div class="sel-stat"><span>Faim</span><span style="color:${info.hunger>70?'#d04':'#4d4'}">${info.hunger}%</span></div>
        <div class="sel-stat"><span>État</span><span>${info.state}</span></div>
      `;
    } else if (type === 'city') {
      const info = obj.getInfo();
      el.innerHTML = `
        <div class="sel-name">🏙 ${info.name}</div>
        <div class="sel-type">${info.level}</div>
        <div class="sel-stat"><span>Population</span><span>${info.population}/${info.maxPop}</span></div>
        <div class="sel-stat"><span>Bâtiments</span><span>${info.buildings}</span></div>
        <div class="sel-stat"><span>🍖 Nourriture</span><span>${Math.floor(info.stockpile.food)}</span></div>
        <div class="sel-stat"><span>🪵 Bois</span><span>${Math.floor(info.stockpile.wood)}</span></div>
        <div class="sel-stat"><span>🪨 Pierre</span><span>${Math.floor(info.stockpile.stone)}</span></div>
        <div class="sel-stat"><span>⛏ Minerai</span><span>${Math.floor(info.stockpile.ore)}</span></div>
        <div class="sel-stat"><span>💰 Or</span><span>${Math.floor(info.stockpile.gold)}</span></div>
        ${info.techProgress ? `<div class="sel-stat pulse"><span>⏳ Recherche</span><span>${info.techProgress.name} (${Math.round(info.techProgress.pct*100)}%)</span></div>` : ''}
        <div class="sel-stat"><span>Technologies</span><span>${info.techs.length}</span></div>
      `;
    }
  }

  clearSelection() {
    this._selected = null;
    const el = document.getElementById('selection-info');
    if (el) el.innerHTML = '<p class="muted">Cliquez sur une entité</p>';
  }

  // ——— Tooltip ——————————————————————————————————————
  showTooltip(x, y, text) {
    if (!this.tooltip) return;
    this.tooltip.classList.remove('hidden');
    this.tooltip.textContent = text;
    this.tooltip.style.left = (x + 12) + 'px';
    this.tooltip.style.top  = (y + 12) + 'px';
  }

  hideTooltip() {
    if (this.tooltip) this.tooltip.classList.add('hidden');
  }

  updateFPS(fps, entities) {
    const el = document.getElementById('fps-overlay');
    if (el) el.textContent = `FPS: ${fps} | Entités: ${entities}`;
  }

  updateDate(year, day) {
    const el = document.getElementById('world-date');
    if (el) el.textContent = `Année ${year} — Jour ${day}`;
  }
}
