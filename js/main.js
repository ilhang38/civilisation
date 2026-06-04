// ============================================================
// main.js — CivilSim — Menu + Simulation + Mode Joueur
// ============================================================

import { World, TILE_SIZE }  from './world.js';
import { PlantManager }      from './plants.js';
import { AnimalManager }     from './animals.js';
import { Settlement }        from './city.js';
import { Human, JOB }        from './human.js';
import { UI }                from './ui.js';
import { GraphManager }      from './graphs.js';
import { SaveManager }       from './save.js';
import { SeasonSystem }      from './seasons.js';
import { DiplomacySystem }   from './diplomacy.js';
import { ParticleSystem }    from './particles.js';
import { HistorySystem, EVENT_TYPE } from './history.js';
import { TerritoryRenderer, HeatmapRenderer, RouteRenderer, NotificationSystem } from './renderer.js';
import { HeroRegistry }      from './genetics.js';

const CONFIG = {
  WORLD_COLS:    180,
  WORLD_ROWS:    120,
  MAX_PLANTS:    1200,
  MAX_ANIMALS:   400,
  INITIAL_CAMPS: 3,
};

const VERSION = '2.0.0';

// ============================================================
// MENU PRINCIPAL
// ============================================================
class MainMenu {
  constructor(onStart) {
    this.onStart = onStart;
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.id = 'main-menu';
    overlay.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-box">
        <div class="menu-logo">
          <div class="menu-title">CIVILISATION</div>
          <div class="menu-sub">World Simulator · v${VERSION}</div>
          <div class="menu-tagline">Regarde un monde naître, vivre et évoluer</div>
        </div>

        <div class="menu-modes">

          <div class="mode-card" id="mode-auto">
            <div class="mode-icon">🌍</div>
            <div class="mode-name">Civilisation</div>
            <div class="mode-desc">Le monde évolue seul. Des peuples naissent, construisent des villes et s'étendent. Tu observes et interagis.</div>
            <div class="mode-badge">AUTO</div>
          </div>

          <div class="mode-card" id="mode-player">
            <div class="mode-icon">👑</div>
            <div class="mode-name">Mode Fondateur</div>
            <div class="mode-desc">Tu commences avec un homme et une femme. Donne-leur nourriture, bois, et guide leur survie pour bâtir ta civilisation.</div>
            <div class="mode-badge new">NOUVEAU</div>
          </div>

        </div>

        <div class="menu-footer">
          Glisse pour naviguer · Clic pour sélectionner · Molette pour zoomer
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.el = overlay;

    overlay.querySelector('#mode-auto').addEventListener('click', () => this._start('auto'));
    overlay.querySelector('#mode-player').addEventListener('click', () => this._start('player'));
  }

  _start(mode) {
    // Animation de sortie
    this.el.style.transition = 'opacity 0.6s ease';
    this.el.style.opacity = '0';
    setTimeout(() => {
      this.el.remove();
      this.onStart(mode);
    }, 600);
  }
}

// ============================================================
// PANNEAU JOUEUR (mode fondateur)
// ============================================================
class PlayerPanel {
  constructor(sim) {
    this.sim = sim;
    this.el  = null;
    this._build();
  }

  _build() {
    const panel = document.createElement('div');
    panel.id = 'player-panel';
    panel.innerHTML = `
      <div class="pp-title">👑 Mode Fondateur</div>
      <div class="pp-section">
        <div class="pp-label">Tes pionniers</div>
        <div id="pp-pioneers"></div>
      </div>
      <div class="pp-section">
        <div class="pp-label">Donner des ressources</div>
        <div class="pp-gifts">
          <button class="gift-btn" data-gift="food" data-amt="30">🍖 +30 Nourriture</button>
          <button class="gift-btn" data-gift="food" data-amt="100">🍗 +100 Nourriture</button>
          <button class="gift-btn" data-gift="wood" data-amt="20">🪵 +20 Bois</button>
          <button class="gift-btn" data-gift="stone" data-amt="20">🪨 +20 Pierre</button>
          <button class="gift-btn" data-gift="all" data-amt="50">🎁 Pack survie</button>
        </div>
      </div>
      <div class="pp-section">
        <div class="pp-label">Actions</div>
        <div class="pp-gifts">
          <button class="gift-btn act" data-action="new_human">👶 Nouveau pionnier</button>
          <button class="gift-btn act" data-action="build_farm">🌾 Construire ferme</button>
          <button class="gift-btn act" data-action="build_house">🏠 Construire maison</button>
        </div>
      </div>
      <div class="pp-section">
        <div class="pp-label">Ton empire</div>
        <div id="pp-stats"></div>
      </div>
    `;
    // Insérer dans le panneau droit, pas en floating par-dessus
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel) rightPanel.appendChild(panel);
    else document.body.appendChild(panel);
    this.el = panel;

    // Événements boutons
    panel.querySelectorAll('.gift-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gift   = btn.dataset.gift;
        const amt    = parseInt(btn.dataset.amt || '0');
        const action = btn.dataset.action;

        if (action) {
          this._doAction(action);
        } else if (gift === 'all') {
          this._giveAll(amt);
        } else {
          this._giveResource(gift, amt);
        }

        // Flash feedback
        btn.style.background = 'rgba(68,232,154,0.3)';
        setTimeout(() => btn.style.background = '', 300);
      });
    });
  }

  _getPlayerSettlement() {
    return this.sim.settlements.find(s => s.isPlayerOwned) || this.sim.settlements[0];
  }

  _giveResource(res, amt) {
    const s = this._getPlayerSettlement();
    if (!s) return;
    s.stockpile[res] = (s.stockpile[res] || 0) + amt;
  }

  _giveAll(amt) {
    const s = this._getPlayerSettlement();
    if (!s) return;
    s.stockpile.food  += amt * 2;
    s.stockpile.wood  += amt;
    s.stockpile.stone += amt;
    s.stockpile.ore   += Math.floor(amt / 2);
  }

  _doAction(action) {
    const s = this._getPlayerSettlement();
    if (!s) return;
    if (action === 'new_human' && s.humans.length < s.maxPop + 2) {
      s._spawnHuman();
    } else if (action === 'build_farm' && s.stockpile.wood >= 8) {
      s._buildBuilding('FARM');
    } else if (action === 'build_house' && s.stockpile.wood >= 10) {
      s._buildBuilding('HOUSE');
    }
  }

  update() {
    const s = this._getPlayerSettlement();
    if (!s) return;

    // Pionniers
    const pionEl = document.getElementById('pp-pioneers');
    if (pionEl) {
      pionEl.innerHTML = s.humans.slice(0, 6).map(h => `
        <div class="pp-human">
          <span class="pp-hname">${h.sex === 'M' ? '👨' : '👩'} ${h.name}</span>
          <span class="pp-hstate" style="color:${h.hunger>70?'#f55':'#4e8'}">${h.job}</span>
        </div>
      `).join('');
    }

    // Stats
    const statsEl = document.getElementById('pp-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="pp-stat"><span>👥 Population</span><span>${s.humans.length}</span></div>
        <div class="pp-stat"><span>🏙 Niveau</span><span>${s.level}</span></div>
        <div class="pp-stat"><span>🍖 Nourriture</span><span>${Math.floor(s.stockpile.food)}</span></div>
        <div class="pp-stat"><span>🪵 Bois</span><span>${Math.floor(s.stockpile.wood)}</span></div>
        <div class="pp-stat"><span>🪨 Pierre</span><span>${Math.floor(s.stockpile.stone)}</span></div>
        <div class="pp-stat"><span>🏗 Bâtiments</span><span>${s.buildings.length}</span></div>
      `;
    }
  }
}

// ============================================================
// SIMULATION PRINCIPALE
// ============================================================
class CivilSim {
  constructor(mode = 'auto') {
    this.mode   = mode;
    this.canvas = document.getElementById('main-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resizeCanvas();

    this.running = false;
    this.speed   = 1;
    this.tick    = 0;

    // Zoom
    this.zoom    = 1.0;
    this._minZoom = 0.4;
    this._maxZoom = 3.0;

    // Caméra
    this.camera = { x:0, y:0, targetX:0, targetY:0 };
    this._drag  = { active:false, startX:0, startY:0, camStartX:0, camStartY:0 };

    this.world       = null;
    this.plantMgr    = null;
    this.animalMgr   = null;
    this.settlements = [];
    this.ui          = null;
    this.graphs      = null;
    this.saveMgr     = null;
    this.playerPanel = null;
    this.seasonSys    = null;
    this.diplomacy    = null;
    this.particles    = null;
    this.history      = null;
    this.territory    = null;
    this.heatmap      = null;
    this.routeRend    = null;
    this.notifs       = null;
    this.heroRegistry = null;
    this._showTerr    = true;

    this._fps        = 0;
    this._fpsTimer   = 0;
    this._fpsCounter = 0;
    this._lastTime   = 0;
    this._graphTimer = 0;
    this._worldDay   = 1;
    this._worldYear  = 1;
    this._dayTimer   = 0;

    this._init();
  }

  _init() {
    console.log(`[CivilSim] Mode: ${this.mode}`);
    const seed = Math.floor(Math.random() * 999999);
    this.world     = new World(CONFIG.WORLD_COLS, CONFIG.WORLD_ROWS, seed);
    this.plantMgr  = new PlantManager(this.world, CONFIG.MAX_PLANTS);
    this.animalMgr = new AnimalManager(this.world, CONFIG.MAX_ANIMALS);
    this.settlements = [];

    if (this.mode === 'auto') {
      this._createInitialSettlements(CONFIG.INITIAL_CAMPS);
    } else {
      this._createPlayerStart();
    }

    this.ui      = new UI(this);
    this.graphs  = new GraphManager();
    this.saveMgr = new SaveManager(this);

    if (this.mode === 'player') {
      this.playerPanel = new PlayerPanel(this);
    }

    // Systèmes de base
    this.seasonSys    = new SeasonSystem();
    this.diplomacy    = new DiplomacySystem();
    this.particles    = new ParticleSystem();
    // Systèmes avancés
    this.history      = new HistorySystem();
    this.territory    = new TerritoryRenderer(this.world);
    this.heatmap      = new HeatmapRenderer();
    this.routeRend    = new RouteRenderer();
    this.notifs       = new NotificationSystem();
    this.heroRegistry = new HeroRegistry();
    setTimeout(() => {
      for (const s of this.settlements)
        this.history.logEvent(EVENT_TYPE.FOUNDED, `${s.name} est fondée`, s, { year:1 });
    }, 200);

    // Centrer caméra
    const midX = (this.world.cols * TILE_SIZE) / 2;
    const midY = (this.world.rows * TILE_SIZE) / 2;
    this.camera.x       = midX - this.canvas.width  / 2;
    this.camera.y       = midY - this.canvas.height / 2;
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;

    this._bindEvents();
    this._bindControls();

    // Si mode joueur centrer sur le camp
    if (this.mode === 'player' && this.settlements[0]) {
      const s = this.settlements[0];
      this.camera.x       = s.x - this.canvas.width  / 2;
      this.camera.y       = s.y - this.canvas.height / 2;
      this.camera.targetX = this.camera.x;
      this.camera.targetY = this.camera.y;
    }

    this.running   = true;
    this._lastTime = performance.now();
    requestAnimationFrame(this._loop.bind(this));
    console.log(`[CivilSim] Prêt — plantes:${this.plantMgr.plants.length} animaux:${this.animalMgr.animals.length}`);
  }

  // Mode auto : 3 colonies IA
  _createInitialSettlements(count) {
    const midX = (this.world.cols * TILE_SIZE) / 2;
    const midY = (this.world.rows * TILE_SIZE) / 2;
    const angles = [0, 2.1, 4.2];
    for (let i = 0; i < count; i++) {
      const angle = angles[i] || Math.random() * Math.PI * 2;
      const dist  = 100 + Math.random() * 150;
      const nx    = midX + Math.cos(angle) * dist;
      const ny    = midY + Math.sin(angle) * dist;
      const tile  = this.world.findBuildSpot(nx, ny, 25);
      if (!tile) { i--; continue; }
      const sx = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const sy = tile.y * TILE_SIZE + TILE_SIZE / 2;
      this.settlements.push(new Settlement(sx, sy, this.world));
    }
  }

  // Mode joueur : SEULEMENT Adam et Ève, aucune colonie IA
  _createPlayerStart() {
    const midX = (this.world.cols * TILE_SIZE) / 2;
    const midY = (this.world.rows * TILE_SIZE) / 2;
    const tile  = this.world.findBuildSpot(midX, midY, 30);
    if (!tile) { this._createInitialSettlements(1); return; }

    const sx = tile.x * TILE_SIZE + TILE_SIZE / 2;
    const sy = tile.y * TILE_SIZE + TILE_SIZE / 2;

    // playerMode=true → pas d'humains auto, pas de ferme auto
    const s = new Settlement(sx, sy, this.world, null, true);

    // Adam
    const homme = new Human(sx - 12, sy, s, this.world);
    homme.name = 'Adam'; homme.sex = 'M'; homme.job = JOB.HUNTER;
    s.humans.push(homme);

    // Ève
    const femme = new Human(sx + 12, sy, s, this.world);
    femme.name = 'Ève'; femme.sex = 'F'; femme.job = JOB.FARMER;
    s.humans.push(femme);

    // Stocks de survie minimalistes
    s.stockpile = { food: 40, wood: 20, stone: 10, ore: 0, gold: 0 };

    // Croissance pop bloquée jusqu'à ce que le joueur construise des maisons
    s.maxPop = 2;

    this.settlements.push(s);
    // PAS de colonies IA supplémentaires en mode joueur
  }

  // ——— Boucle ————————————————————————————————————————
  _loop(timestamp) {
    requestAnimationFrame(this._loop.bind(this));

    const rawDt = Math.min((timestamp - this._lastTime) / (1000 / 60), 5);
    this._lastTime = timestamp;

    // FPS
    this._fpsCounter++;
    this._fpsTimer += rawDt;
    if (this._fpsTimer >= 60) {
      this._fps = Math.round(this._fpsCounter * 60 / this._fpsTimer);
      this._fpsCounter = 0; this._fpsTimer = 0;
    }

    // Caméra fluide
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.15;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.15;

    if (this.running) {
      // VRAI FIX VITESSE :
      // dt     = temps accéléré → constructions, déplacements, économie rapides
      // dtBio  = plafonné à 3   → faim/soif/vie restent réalistes même à x8
      const dt    = rawDt * this.speed;
      const dtBio = Math.min(dt, 3.0);
      this._update(dt, dtBio, timestamp);
    }
    this._render(timestamp);
  }

  _update(dt, dtBio, timestamp) {
    this.tick += dt;

    // Temps monde (accéléré)
    this._dayTimer += dt;
    if (this._dayTimer > 200) {
      this._dayTimer = 0;
      this._worldDay++;
      if (this._worldDay > 365) { this._worldDay = 1; this._worldYear++; }
      this.ui?.updateDate(this._worldYear, this._worldDay);
    }

    // Monde et plantes : dt accéléré (regen ressources rapide)
    this.world.update(dt);
    this.plantMgr.update(dtBio);

    // Animaux : dtBio (faim/soif plafonnée)
    this.animalMgr.update(dtBio, this.plantMgr);

    // Colonies : dt pour économie/construction, dtBio pour humains
    const newS = [];
    for (const s of this.settlements) {
      const child = s.update(dt, dtBio, this.plantMgr, this.animalMgr, this.settlements);
      if (child) newS.push(child);
    }
    for (const ns of newS) this.settlements.push(ns);

    this.ui?.update(dt);
    this.playerPanel?.update();

    this._graphTimer += dt;
    if (this._graphTimer > 60) {
      this._graphTimer = 0;
      const totalPop  = this.settlements.reduce((s, c) => s + c.humans.length, 0);
      const totalFood = this.settlements.reduce((s, c) => s + (c.stockpile.food || 0), 0);
      const totalRes  = this.settlements.reduce((s, c) => s + (c.stockpile.wood||0) + (c.stockpile.stone||0) + (c.stockpile.ore||0), 0);
      this.graphs?.push({ population: totalPop, food: totalFood, animals: this.animalMgr.animals.length, cities: this.settlements.length, resources: totalRes });
      this.graphs?.draw();
    }

    this.seasonSys?.update(dt, this.settlements, this.world);
    // Synchroniser météo visuelle avec saison
    if (this.seasonSys && this.world) {
      const s = this.seasonSys.season;
      const mode = s==='winter'?'snow':s==='autumn'?'leaves':s==='summer'&&Math.random()<0.0001?'rain':'none';
      if (mode !== 'none' && this.world._weatherMode !== mode) this.world.setWeather(mode);
      if (s==='spring' && Math.random()<0.00005) this.world.setWeather('rain');
    }
    this.diplomacy?.update(dt, this.settlements, this.world, this.seasonSys);
    this.particles?.update(dt);
    this.particles?.updateSettlements(this.settlements, dt);
    this.history?.update(dt, this);
    this.routeRend?.update(dt, this.diplomacy, this.settlements);
    this.heatmap?.update(dt, this.settlements, this.world.cols*8, this.world.rows*8);
    // Succès
    const ach = this.history?.popAchievementNotification();
    if (ach) this.notifs?.pushAchievement(ach);
    // Héros
    for (const s of this.settlements) {
      for (const h of s.humans) {
        const hero = this.heroRegistry?.checkAndRegister(h, s);
        if (hero) {
          this.notifs?.pushEvent('⭐', `Héros né : ${hero.name}!`, '#ffd060');
          this.history?.logEvent(EVENT_TYPE.HERO, `${hero.name} — ${hero.trait}`, s);
        }
      }
    }
    this.saveMgr?.update(dt);

    // Log nouveaux événements de guerre
    for (const s of this.settlements) {
      if (s._newWarEvent) {
        this.seasonSys?.logExternal('⚔', s._newWarEvent);
        s._newWarEvent = null;
      }
    }

    const entities = this.plantMgr.plants.length + this.animalMgr.animals.length +
      this.settlements.reduce((s, c) => s + c.humans.length, 0);
    this.ui?.updateFPS(this._fps, entities);
  }

  _render(timestamp = 0) {
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Appliquer zoom
    ctx.save();
    ctx.scale(this.zoom, this.zoom);

    const camX = Math.round(this.camera.x);
    const camY = Math.round(this.camera.y);
    const vW   = W / this.zoom;
    const vH   = H / this.zoom;

    const nightAlpha = this.seasonSys?.nightAlpha || 0;
    this.world.draw(ctx, camX, camY, vW, vH, timestamp, nightAlpha);
    this.plantMgr.draw(ctx, camX, camY, vW, vH, timestamp);
    this.animalMgr.draw(ctx, camX, camY, vW, vH);

    // Territoires colorés
    if (this._showTerr) {
      this.territory?.update(this.settlements);
      this.territory?.draw(ctx, camX, camY, vW, vH);
    }
    // Routes commerciales
    this.routeRend?.draw(ctx, camX, camY, this.diplomacy, this.settlements);

    // Colonies
    for (const s of this.settlements) {
      const sx = s.x - camX, sy = s.y - camY;
      if (sx < -200 || sx > vW + 200 || sy < -200 || sy > vH + 200) continue;
s._nightAlpha = this.seasonSys?.nightAlpha || 0;
      s.draw(ctx, camX, camY);
    }

    // Bandits et caravanes
    this.diplomacy?.draw(ctx, camX, camY, vW, vH);

    // Particules
    this.particles?.draw(ctx, camX, camY, vW, vH);

    ctx.restore();

    // Heatmap
    this.heatmap?.draw(ctx, W, H);
    // Overlays saison
    this.seasonSys?.draw(ctx, W, H, camX, camY);

    // Indicateur de zoom
    this._drawZoomIndicator(ctx, W, H);
  }

  _drawZoomIndicator(ctx, W, H) {
    const pct = (this.zoom - this._minZoom) / (this._maxZoom - this._minZoom);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W - 80, H - 18, 70, 12);
    ctx.fillStyle = '#4db8ff';
    ctx.fillRect(W - 78, H - 16, 66 * pct, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.fillText(`×${this.zoom.toFixed(1)}`, W - 78, H - 20);
  }

  // ——— Événements ————————————————————————————————————
  _bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousedown', (e) => {
      this._drag.active    = true;
      this._drag.startX    = e.clientX;
      this._drag.startY    = e.clientY;
      this._drag.camStartX = this.camera.targetX;
      this._drag.camStartY = this.camera.targetY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._drag.active) return;
      const dx = e.clientX - this._drag.startX;
      const dy = e.clientY - this._drag.startY;
      this.camera.targetX = this._drag.camStartX - dx / this.zoom;
      this.camera.targetY = this._drag.camStartY - dy / this.zoom;
      this._clampCamera();
    });

    window.addEventListener('mouseup', (e) => {
      if (!this._drag.active) return;
      const dist = Math.hypot(e.clientX - this._drag.startX, e.clientY - this._drag.startY);
      this._drag.active = false;
      if (dist < 5) this._handleClick(e);
    });

    // ZOOM MOLETTE CORRIGÉ
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect     = canvas.getBoundingClientRect();
      const mouseX   = (e.clientX - rect.left) / this.zoom;
      const mouseY   = (e.clientY - rect.top)  / this.zoom;
      const worldX   = this.camera.x + mouseX;
      const worldY   = this.camera.y + mouseY;

      const delta    = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      const newZoom  = Math.max(this._minZoom, Math.min(this._maxZoom, this.zoom * delta));

      // Garder le point sous la souris fixe
      this.zoom             = newZoom;
      this.camera.targetX   = worldX - (mouseX / newZoom) * newZoom;
      this.camera.targetY   = worldY - (mouseY / newZoom) * newZoom;

      // Recalcul simplifié : point monde reste sous souris
      this.camera.targetX   = worldX - (e.clientX - rect.left) / newZoom;
      this.camera.targetY   = worldY - (e.clientY - rect.top)  / newZoom;
      this._clampCamera();
    }, { passive: false });

    // Touch pinch zoom (mobile)
    let _lastPinchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        _lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist  = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / _lastPinchDist;
        this.zoom = Math.max(this._minZoom, Math.min(this._maxZoom, this.zoom * ratio));
        _lastPinchDist = dist;
        this._clampCamera();
      }
    }, { passive: true });

    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) / this.zoom;
    const my   = (e.clientY - rect.top)  / this.zoom;
    const wx   = mx + this.camera.x;
    const wy   = my + this.camera.y;

    let found = null;

    for (const s of this.settlements) {
      if (Math.hypot(wx - s.x, wy - s.y) < 15) { found = { type:'city', obj:s }; break; }
      for (const h of s.humans) {
        if (Math.hypot(wx - h.x, wy - h.y) < 8) { found = { type:'human', obj:h }; break; }
      }
      if (found) break;
    }

    if (!found) {
      for (const a of this.animalMgr.animals) {
        if (Math.hypot(wx - a.x, wy - a.y) < 10) { found = { type:'animal', obj:a }; break; }
      }
    }

    if (found) this.ui?.selectObject(found);
    else       this.ui?.clearSelection();
  }

  _clampCamera() {
    const vW = this.canvas.width  / this.zoom;
    const vH = this.canvas.height / this.zoom;
    const maxX = Math.max(0, this.world.cols * TILE_SIZE - vW);
    const maxY = Math.max(0, this.world.rows * TILE_SIZE - vH);
    this.camera.targetX = Math.max(0, Math.min(maxX, this.camera.targetX));
    this.camera.targetY = Math.max(0, Math.min(maxY, this.camera.targetY));
  }

  _resizeCanvas() {
    const area = document.getElementById('canvas-area');
    if (!area) return;
    const rect = area.getBoundingClientRect();
    this.canvas.width  = Math.floor(rect.width);
    this.canvas.height = Math.floor(rect.height);
    if (this.world) this._clampCamera();
  }

  // ——— Contrôles ——————————————————————————————————————
  _bindControls() {
    const setActive = (id) => {
      ['btn-pause','btn-play','btn-x2','btn-x4','btn-x8'].forEach(b =>
        document.getElementById(b)?.classList.remove('active')
      );
      document.getElementById(id)?.classList.add('active');
    };
    window.addEventListener('keydown', e => {
      if (e.key==='h'||e.key==='H') this.heatmap?.toggle('population');
      if (e.key==='r'||e.key==='R') this.world?.setWeather('rain');
      if (e.key==='s'||e.key==='S') this.world?.setWeather('snow');
      if (e.key==='c'||e.key==='C') this.world?.setWeather('none');
      if (e.key==='w'||e.key==='W') this.heatmap?.toggle('wealth');
      if (e.key==='m'||e.key==='M') this.heatmap?.toggle('military');
      if (e.key==='t'||e.key==='T') this._showTerr = !this._showTerr;
    });
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      if (confirm('Retourner au menu principal ?')) {
        localStorage.removeItem('civilsim_v1');
        location.reload();
      }
    });
    document.getElementById('btn-pause')?.addEventListener('click', () => { this.running = false; setActive('btn-pause'); });
    document.getElementById('btn-play') ?.addEventListener('click', () => { this.running = true; this.speed = 1; setActive('btn-play'); });
    document.getElementById('btn-x2')  ?.addEventListener('click', () => { this.running = true; this.speed = 2; setActive('btn-x2'); });
    document.getElementById('btn-x4')  ?.addEventListener('click', () => { this.running = true; this.speed = 4; setActive('btn-x4'); });
    document.getElementById('btn-x8')  ?.addEventListener('click', () => { this.running = true; this.speed = 8; setActive('btn-x8'); });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('Réinitialiser ? Toute progression sera perdue.')) {
        localStorage.removeItem('civilsim_v1');
        location.reload();
      }
    });
  }

  _updateWarPanel() {
    const el = document.getElementById('war-stats');
    if (!el) return;
    const wars = this.settlements.filter(s => s.atWarWith && s.atWarWith.size > 0);
    if (wars.length === 0) {
      el.innerHTML = '<p class="muted" style="font-size:10px">Aucune guerre en cours ☮</p>';
      return;
    }
    const seen = new Set();
    let html = '';
    for (const s of wars) {
      for (const eid of s.atWarWith) {
        const key = [s.id,eid].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const enemy = this.settlements.find(x => x.id === eid);
        if (!enemy) continue;
        html += `<div style="padding:3px 0;border-bottom:1px solid #1e2d42;font-size:10px">
          <span style="color:${s.factionColor}">${s.name}</span>
          <span style="color:#ff4444"> ⚔ </span>
          <span style="color:${enemy.factionColor}">${enemy.name}</span>
        </div>`;
      }
    }
    el.innerHTML = html || '<p class="muted" style="font-size:10px">☮ Paix</p>';
  }

  resetFromSave() { location.reload(); }
}

// ============================================================
// STYLES DU MENU (injectés en JS pour rester en 1 fichier)
// ============================================================
function injectMenuStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #main-menu {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .menu-bg {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 30% 40%, #0a1830 0%, #040810 60%, #000 100%);
    }
    .menu-bg::before {
      content:'';
      position:absolute; inset:0;
      background-image:
        radial-gradient(circle at 20% 30%, rgba(77,184,255,0.06) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(255,208,96,0.05) 0%, transparent 50%);
    }
    .menu-box {
      position: relative; z-index: 1;
      width: min(700px, 95vw);
      padding: 40px;
      text-align: center;
    }
    .menu-title {
      font-family: 'Cinzel', serif;
      font-size: clamp(32px, 8vw, 64px);
      font-weight: 700;
      color: #ffd060;
      letter-spacing: 8px;
      text-shadow: 0 0 40px rgba(255,208,96,0.5), 0 0 80px rgba(255,208,96,0.2);
      margin-bottom: 8px;
    }
    .menu-sub {
      font-family: 'Share Tech Mono', monospace;
      color: #4db8ff;
      font-size: 13px;
      letter-spacing: 3px;
      margin-bottom: 6px;
      opacity: 0.8;
    }
    .menu-tagline {
      color: #5a7a9a;
      font-size: 13px;
      margin-bottom: 48px;
      font-style: italic;
    }
    .menu-modes {
      display: flex; gap: 20px; justify-content: center;
      flex-wrap: wrap; margin-bottom: 32px;
    }
    .mode-card {
      background: rgba(13,21,32,0.9);
      border: 1px solid #1e2d42;
      border-radius: 12px;
      padding: 28px 24px;
      width: 260px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    .mode-card::before {
      content:'';
      position:absolute; top:0; left:0; right:0; height:2px;
      background: linear-gradient(90deg, transparent, #4db8ff, transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .mode-card:hover {
      border-color: #4db8ff;
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(77,184,255,0.2);
      background: rgba(20,35,55,0.95);
    }
    .mode-card:hover::before { opacity: 1; }
    .mode-card:active { transform: translateY(-2px); }
    .mode-icon { font-size: 40px; margin-bottom: 12px; }
    .mode-name {
      font-family: 'Cinzel', serif;
      font-size: 18px; font-weight: 700;
      color: #c8d8f0; margin-bottom: 10px;
    }
    .mode-desc {
      font-size: 12px; color: #4a6a8a;
      line-height: 1.6;
    }
    .mode-badge {
      display: inline-block;
      margin-top: 14px;
      background: rgba(77,184,255,0.15);
      border: 1px solid rgba(77,184,255,0.3);
      color: #4db8ff;
      font-size: 10px; font-weight: bold;
      letter-spacing: 2px;
      padding: 3px 10px; border-radius: 20px;
    }
    .mode-badge.new {
      background: rgba(255,208,96,0.15);
      border-color: rgba(255,208,96,0.3);
      color: #ffd060;
    }
    .menu-footer { color: #2a3a50; font-size: 11px; letter-spacing: 1px; }

    /* ——— PANNEAU JOUEUR ——— */
    /* Inséré dans le panneau droit existant, pas en flottant */
    #player-panel {
      width: 100%;
      background: transparent;
      border-top: 2px solid #2a4060;
      padding: 10px;
      font-size: 11px;
      overflow-y: auto;
    }
    .pp-title {
      font-family: 'Cinzel', serif;
      color: #ffd060;
      font-size: 13px;
      margin-bottom: 10px;
      text-align: center;
      text-shadow: 0 0 10px rgba(255,208,96,0.3);
    }
    .pp-section { margin-bottom: 10px; border-bottom: 1px solid #1e2d42; padding-bottom: 8px; }
    .pp-label { color: #4a6a8a; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
    .pp-human { display: flex; justify-content: space-between; padding: 2px 0; }
    .pp-hname { color: #c8d8f0; }
    .pp-hstate { font-size: 10px; color: #5a9a7a; }
    .pp-gifts { display: flex; flex-direction: column; gap: 4px; }
    .gift-btn {
      background: rgba(22,29,42,0.9);
      border: 1px solid #1e2d42;
      color: #8aa0c0;
      padding: 5px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
      text-align: left;
      transition: all 0.15s;
    }
    .gift-btn:hover { border-color: #4db8ff; color: #4db8ff; background: rgba(77,184,255,0.08); }
    .gift-btn.act:hover { border-color: #ffd060; color: #ffd060; background: rgba(255,208,96,0.08); }
    .pp-stat { display: flex; justify-content: space-between; padding: 2px 0; color: #8aa0c0; }
    .pp-stat span:last-child { color: #ffd060; font-family: 'Share Tech Mono', monospace; }
  `;
  document.head.appendChild(style);
}

// ============================================================
// POINT D'ENTRÉE
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  injectMenuStyles();
  try {
    new MainMenu((mode) => {
      window.sim = new CivilSim(mode);
    });
  } catch(err) {
    console.error('[CivilSim] ERREUR:', err);
    document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">
      <h2>Erreur CivilSim</h2><pre>${err.stack}</pre></div>`;
  }
});
