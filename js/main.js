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
import { atlas }               from './textures.js';
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

const VERSION = '3.0.0';

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

          <div class="mode-card horror-card" id="mode-horror">
            <div class="mode-icon">👁</div>
            <div class="mode-name">Jeu d'horreur</div>
            <div class="mode-desc">L'Écho des Profondeurs. Ethan Moreau entre dans l'asile Saint Lazarus pour retrouver sa famille disparue. Il ignore qu'il est déjà trop tard.</div>
            <div class="mode-badge horror">HORREUR</div>
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
    overlay.querySelector('#mode-horror').addEventListener('click', () => this._start('horror'));
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

    this.world.draw(ctx, camX, camY, vW, vH, timestamp);
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
    .mode-badge.horror {
      background: rgba(180,20,20,0.25);
      border-color: rgba(220,40,40,0.5);
      color: #ff4444;
      text-shadow: 0 0 8px rgba(255,50,50,0.5);
    }
    .horror-card {
      border-color: #3a0808 !important;
      background: rgba(15,5,5,0.95) !important;
    }
    .horror-card:hover {
      border-color: #cc2222 !important;
      box-shadow: 0 12px 40px rgba(180,20,20,0.4) !important;
      background: rgba(25,8,8,0.98) !important;
    }
    .horror-card::before {
      background: linear-gradient(180deg, #cc2222, #440000) !important;
    }
    .horror-card .mode-name { color: #cc4444 !important; }
    .horror-card .mode-icon { filter: drop-shadow(0 0 8px rgba(255,50,50,0.6)); }
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
// HORROR GAME — L'Écho des Profondeurs
// Survival horror FPS en Canvas 2D pseudo-3D (raycasting)
// ============================================================
class HorrorGame {
  constructor() {
    this._buildUI();
    this.canvas  = document.getElementById('horror-canvas');
    this.ctx     = this.canvas.getContext('2d');
    this.W       = this.canvas.width;
    this.H       = this.canvas.height;

    // ——— État du jeu ———
    this.chapter   = 1;
    this.gameState = 'playing'; // 'playing'|'cutscene'|'menu'|'ending'
    this.sanity    = 100;   // 0=fou, 100=sain
    this.battery   = 100;   // pile lampe
    this.inventory = [];
    this.notes     = [];
    this.endingType= null;

    // ——— Joueur ———
    this.player = {
      x: 3.5, y: 3.5,     // position dans la grille
      angle: 0,             // direction en radians
      speed: 0.06,
      turnSpeed: 0.045,
      health: 100,
      stamina: 100,
      isRunning: false,
    };

    // ——— Caméra / rendu ———
    this.FOV      = Math.PI / 3;   // 60°
    this.RAYS     = 120;
    this.MAX_DIST = 14;

    // ——— Monstres ———
    this.monsters = [];
    this._monsterTimer = 0;

    // ——— Effets ———
    this.effects = {
      flicker: 0,       // scintillement lampe
      heartbeat: 0,     // pulsation écran rouge
      vignette: 0.4,    // vignette permanente
      noiseAlpha: 0,    // grain film
      shake: {x:0,y:0}, // tremblement caméra
      shakeTimer: 0,
    };

    // ——— Sons simulés (texte à l'écran) ———
    this._soundQueue = [];
    this._soundTimer = 0;

    // ——— Narration ———
    this._narrative = null;
    this._narrativeTimer = 0;

    // ——— Inputs ———
    this.keys = {};
    this._bindInputs();

    // ——— Carte du chapitre ———
    this._loadChapter(1);

    // ——— Boucle ———
    this._lastTime = performance.now();
    requestAnimationFrame(this._loop.bind(this));

    // Intro narrative
    setTimeout(() => this._showNarrative(
      '"Viens nous chercher."\n\nEthan fixe l\'écran depuis une heure.\nLa cassette VHS tourne en boucle.\nDehors, la pluie ne s\'arrête plus.',
      5000
    ), 800);
  }

  // ——— CARTES DES CHAPITRES ——————————————————————
  _loadChapter(n) {
    this.chapter = n;
    this.monsters = [];

    // 0=vide, 1=mur, 2=porte, 3=objet, 4=monstre
    const maps = {
      1: {
        name: "L'Arrivée",
        map: [
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
          [1,0,1,1,0,0,1,0,1,1,1,0,1,1,0,1],
          [1,0,1,0,0,0,0,0,0,0,1,0,0,1,0,1],
          [1,0,0,0,1,0,1,1,0,0,0,0,0,0,0,1],
          [1,0,1,0,1,0,0,0,0,1,1,1,0,1,0,1],
          [1,0,1,0,0,0,1,0,0,0,0,0,0,1,0,1],
          [1,0,0,0,1,0,1,0,1,1,0,1,0,0,0,1],
          [1,0,1,0,0,0,0,0,0,1,0,1,0,1,0,1],
          [1,0,1,1,0,1,0,0,0,0,0,0,0,1,0,1],
          [1,0,0,0,0,1,0,1,1,0,1,0,0,0,0,1],
          [1,0,1,0,1,0,0,0,1,0,1,0,1,1,0,1],
          [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { x:1.5, y:1.5, angle:0 },
        objects: [
          { x:8.5, y:2.5, type:'generator', desc:'Générateur électrique. Il faut le réparer.' },
          { x:12.5, y:6.5, type:'note', id:'note_1', desc:'"Ils ont tous disparu. Ne venez pas ici." — Gardien R.' },
          { x:4.5, y:10.5, type:'battery', desc:'Piles AA. La lampe peut continuer.' },
        ],
        exits: [{ x:14, y:6, toChapter:2 }],
        ambience: 'Gouttes d\'eau. Grincements de métal. Vent dans les couloirs.',
      },
      2: {
        name: 'Les Dossiers Oubliés',
        map: [
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,1,1,1,0,1,1,1,0,1,1,1,0,0,1],
          [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,1],
          [1,0,1,0,1,1,0,0,0,0,1,0,0,0,0,1],
          [1,0,0,0,1,0,0,1,0,0,1,0,1,1,0,1],
          [1,0,1,0,0,0,0,1,0,0,0,0,0,0,0,1],
          [1,0,1,1,0,1,0,0,0,1,0,1,0,1,0,1],
          [1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
          [1,0,1,0,1,0,0,1,0,0,0,1,0,0,0,1],
          [1,0,1,0,0,0,1,1,0,0,1,0,0,1,0,1],
          [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { x:1.5, y:1.5, angle:0 },
        objects: [
          { x:6.5, y:3.5, type:'note', id:'note_2', desc:'"Expérience 47 : sujets exposés à l\'entité. Résultat : disparition totale de la conscience." — Dr. Vauss' },
          { x:10.5, y:5.5, type:'note', id:'note_3', desc:'"Le culte a tout planifié. Ils voulaient l\'invoquer. Ils ont réussi. Fuyez."' },
          { x:3.5, y:9.5, type:'key', id:'key_archive', desc:'Clé des Archives Secrètes. Froide au toucher.' },
          { x:13.5, y:10.5, type:'battery', desc:'Piles. Presque vides.' },
        ],
        exits: [{ x:14, y:6, toChapter:3 }],
        ambience: 'Téléphone qui sonne dans le vide. Murmures. Pas lourds au-dessus.',
        monsterSpawns: [{ x:8.5, y:7.5, type:'whisperer' }],
      },
      3: {
        name: 'Le Sous-Sol',
        map: [
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],
          [1,0,1,0,1,0,1,1,1,1,0,0,1,0,0,1],
          [1,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
          [1,0,0,0,1,1,0,0,0,1,1,1,0,1,0,1],
          [1,0,1,0,0,0,0,1,0,0,0,0,0,1,0,1],
          [1,0,1,0,1,0,0,1,0,1,0,1,0,0,0,1],
          [1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1],
          [1,0,1,1,0,0,1,0,0,0,0,1,0,1,0,1],
          [1,0,0,0,0,0,1,0,1,0,0,1,0,0,0,1],
          [1,0,1,0,1,0,0,0,1,0,1,0,0,1,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { x:1.5, y:1.5, angle:0 },
        objects: [
          { x:7.5, y:4.5, type:'note', id:'note_4', desc:'"Le Veilleur est réel. 3 mètres. Sans yeux. Il sent la peur. NE COUREZ PAS."' },
          { x:11.5, y:8.5, type:'note', id:'note_5', desc:'"Ils sont tous là. Sous les dalles. Des centaines. Ils l\'ont nourri."' },
        ],
        exits: [{ x:14, y:6, toChapter:4 }],
        ambience: 'Sirènes lointaines. Générateurs qui crachotent. Quelque chose respire dans le noir.',
        monsterSpawns: [
          { x:9.5, y:5.5, type:'whisperer' },
          { x:5.5, y:9.5, type:'patient' },
        ],
        isRed: true, // lumière rouge
      },
      4: {
        name: 'La Folie',
        map: [
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
          [1,0,1,0,1,0,0,0,1,0,0,0,1,0,0,1],
          [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1],
          [1,0,1,1,0,0,1,0,0,1,1,0,1,1,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1],
          [1,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1],
          [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1],
          [1,0,1,0,1,1,0,1,0,1,1,0,1,1,0,1],
          [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { x:1.5, y:1.5, angle:0 },
        objects: [
          { x:7.5, y:6.5, type:'wallmsg', desc:'"TU LES AS ABANDONNÉES."' },
          { x:3.5, y:10.5, type:'wallmsg', desc:'"ELLES SONT MORTES À CAUSE DE TOI."' },
          { x:12.5, y:3.5, type:'wallmsg', desc:'"IL N\'Y A PAS DE SORTIE."' },
          { x:10.5, y:10.5, type:'note', id:'note_6', desc:'"La vérité : ta femme et ta fille sont mortes il y a 10 ans. Accident de voiture. Tu conduisais. L\'entité utilise ta culpabilité."' },
        ],
        exits: [{ x:14, y:6, toChapter:5 }],
        ambience: 'Voix de ta famille. Rires d\'enfants. Puis des cris.',
        monsterSpawns: [
          { x:8.5, y:3.5, type:'whisperer' },
          { x:6.5, y:9.5, type:'widow' },
          { x:11.5, y:6.5, type:'patient' },
        ],
        isMadness: true,
      },
      5: {
        name: 'La Fin',
        map: [
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,1,1,1,0,0,0,1,1,1,0,0,0,1],
          [1,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1],
          [1,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart: { x:7.5, y:1.5, angle: Math.PI/2 },
        objects: [
          { x:7.5, y:6.5, type:'ending_choice', desc:'Au centre de la cathédrale, la vérité t\'attend. Que choisis-tu ?' },
          { x:4.5, y:6.5, type:'ending_bad',  desc:'[MAUVAISE FIN] Rejoindre ta famille dans les illusions.' },
          { x:10.5, y:6.5, type:'ending_good', desc:'[BONNE FIN] Accepter la vérité. Refuser l\'entité.' },
          { x:7.5, y:10.5, type:'ending_neutral', desc:'[FIN NEUTRE] Détruire le sanctuaire et fuir.' },
        ],
        exits: [],
        ambience: 'Silence. Puis une voix : "Reste avec nous, Ethan."',
        isBoss: true,
      },
    };

    const data = maps[n] || maps[1];
    this.mapData  = data;
    this.map      = data.map;
    this.MAP_W    = this.map[0].length;
    this.MAP_H    = this.map.length;
    this.objects  = [...(data.objects || [])];
    this.collectedObjects = new Set();

    // Spawner monstres
    for(const sp of (data.monsterSpawns || [])) {
      this.monsters.push(this._createMonster(sp.type, sp.x, sp.y));
    }

    // Position joueur
    const ps = data.playerStart;
    this.player.x     = ps.x;
    this.player.y     = ps.y;
    this.player.angle = ps.angle;

    // Annonce chapitre
    this._showNarrative(`Chapitre ${n} : ${data.name}\n\n${data.ambience}`, 3500);
  }

  // ——— MONSTRES ——————————————————————————————————
  _createMonster(type, x, y) {
    const configs = {
      whisperer: { color:'#660000', size:0.3, speed:0.012, sight:6, label:'Murmurant', hostile:true  },
      patient:   { color:'#884400', size:0.35,speed:0.008, sight:5, label:'Patient',   hostile:true  },
      widow:     { color:'#440066', size:0.3, speed:0.015, sight:7, label:'Veuve',     hostile:true  },
    };
    const cfg = configs[type] || configs.whisperer;
    return { type, x, y, cfg, angle:Math.random()*Math.PI*2,
             wanderTimer:0, alertTimer:0, state:'wander',
             dead:false, _wobble:Math.random()*Math.PI*2 };
  }

  // ——— RAYCASTING RENDERER ——————————————————————
  _cast(angle) {
    const px=this.player.x, py=this.player.y;
    const cos=Math.cos(angle), sin=Math.sin(angle);
    let dist=0;
    for(let step=0; step<this.MAX_DIST*20; step++){
      dist=step*0.05;
      const wx=px+cos*dist, wy=py+sin*dist;
      const mx=Math.floor(wx), my=Math.floor(wy);
      if(mx<0||mx>=this.MAP_W||my<0||my>=this.MAP_H) return { dist:this.MAX_DIST, hit:1 };
      if(this.map[my]?.[mx]===1) return { dist, hit:1, wx:wx%1, wy:wy%1 };
    }
    return { dist:this.MAX_DIST, hit:0 };
  }

  _render3D() {
    const ctx=this.ctx, W=this.W, H=this.H;
    const isRed  = this.mapData?.isRed;
    const isMad  = this.mapData?.isMadness;

    // Shake caméra
    const sx=this.effects.shake.x, sy=this.effects.shake.y;

    // ——— SOL et PLAFOND ———
    const ceilColor = isRed?'#1a0000':isMad?'#050010':'#080808';
    const floorColor= isRed?'#1a0505':isMad?'#050010':'#0d0d0d';
    ctx.fillStyle = ceilColor;
    ctx.fillRect(0+sx, 0+sy, W, H/2);
    ctx.fillStyle = floorColor;
    ctx.fillRect(0+sx, H/2+sy, W, H/2);

    // ——— MURS RAYCASTING ———
    const rayStep = this.FOV / this.RAYS;
    const startAngle = this.player.angle - this.FOV/2;

    for(let r=0; r<this.RAYS; r++){
      const rayAngle = startAngle + r*rayStep;
      const { dist } = this._cast(rayAngle);
      const corrDist = dist * Math.cos(rayAngle - this.player.angle);
      const wallH = Math.min(H, (1/corrDist)*H*0.7);
      const x = (r/this.RAYS)*W + sx;

      // Couleur mur selon distance + ambiance
      const bright = Math.max(0, 1 - corrDist/this.RAYS);
      let r2,g2,b2;
      if(isRed){ r2=40+bright*120; g2=bright*8; b2=bright*8; }
      else if(isMad){ r2=bright*20; g2=bright*8; b2=bright*40; }
      else { r2=g2=b2=bright*160+10; }

      // Scintillement lampe
      const flick = 1 - this.effects.flicker*0.4;
      r2*=flick; g2*=flick; b2*=flick;

      ctx.fillStyle = `rgb(${r2|0},${g2|0},${b2|0})`;
      const rayW = W/this.RAYS+1;
      ctx.fillRect(x, (H-wallH)/2+sy, rayW, wallH);

      // Bord bas du mur (ombre)
      ctx.fillStyle = `rgba(0,0,0,0.3)`;
      ctx.fillRect(x, (H+wallH)/2-4+sy, rayW, 4);
    }
  }

  _renderSprites() {
    const ctx=this.ctx, W=this.W, H=this.H;

    // Sprites monstres
    for(const m of this.monsters){
      if(m.dead) continue;
      this._drawSprite(m.x, m.y, m.cfg.color, m.cfg.label, m.cfg.size*2, false);
    }

    // Sprites objets
    for(const obj of this.objects){
      if(this.collectedObjects.has(obj.id||obj.type+obj.x)) continue;
      const colors = { note:'#f5d060', key:'#60c0ff', battery:'#80ff80',
                       generator:'#ff9940', wallmsg:'#ff3030',
                       ending_good:'#60ff80', ending_bad:'#ff4040', ending_neutral:'#ffaa40',
                       ending_choice:'#ffffff' };
      this._drawSprite(obj.x, obj.y, colors[obj.type]||'#ffffff', obj.type==='wallmsg'?'!':obj.type.slice(0,1).toUpperCase(), 0.15, true);
    }
  }

  _drawSprite(wx, wy, color, label, size, isObj) {
    const ctx=this.ctx, W=this.W, H=this.H;
    const px=this.player.x, py=this.player.y;

    const dx=wx-px, dy=wy-py;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>this.MAX_DIST||dist<0.2) return;

    // Angle vers le sprite
    const sprAngle=Math.atan2(dy,dx);
    let relAngle=sprAngle-this.player.angle;
    while(relAngle> Math.PI) relAngle-=Math.PI*2;
    while(relAngle<-Math.PI) relAngle+=Math.PI*2;
    if(Math.abs(relAngle)>this.FOV*0.7) return;

    const screenX = ((relAngle/this.FOV)+0.5)*W;
    const sprH    = Math.min(H*0.8, H*0.6/dist);
    const sprY    = (H-sprH)/2;

    // Dessin sprite
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(1, 0.4+0.6/dist);
    if(isObj){
      // Objets : cercle brillant
      ctx.shadowColor=color; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(screenX, H/2, sprH*0.15, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.font=`${sprH*0.2}px serif`; ctx.textAlign='center';
      ctx.fillText(label, screenX, H/2+4);
    } else {
      // Monstres : silhouette
      ctx.fillRect(screenX-sprH*0.15, sprY, sprH*0.3, sprH);
      // Tête
      ctx.beginPath(); ctx.arc(screenX, sprY-sprH*0.1, sprH*0.15, 0, Math.PI*2); ctx.fill();
      // Lueur yeux
      ctx.fillStyle='#ff2020'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=6;
      ctx.beginPath(); ctx.arc(screenX-sprH*0.05, sprY-sprH*0.1, sprH*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(screenX+sprH*0.05, sprY-sprH*0.1, sprH*0.04, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;
    ctx.textAlign='left';
  }

  // ——— HUD ——————————————————————————————————————
  _renderHUD() {
    const ctx=this.ctx, W=this.W, H=this.H;

    // Vignette (coin sombres permanents)
    const vig=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.85);
    vig.addColorStop(0,'rgba(0,0,0,0)');
    vig.addColorStop(1,`rgba(0,0,0,${0.6+this.effects.vignette*0.3})`);
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

    // Battements de cœur (rouge sur les bords si santé basse ou sanité basse)
    if(this.effects.heartbeat>0.1 || this.player.health<50){
      const hb=Math.max(this.effects.heartbeat, (50-this.player.health)/100);
      const pulse=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.9);
      pulse.addColorStop(0,'rgba(0,0,0,0)');
      pulse.addColorStop(1,`rgba(180,0,0,${hb*0.4})`);
      ctx.fillStyle=pulse; ctx.fillRect(0,0,W,H);
    }

    // Grain film
    if(this.effects.noiseAlpha>0){
      ctx.globalAlpha=this.effects.noiseAlpha*0.12;
      for(let i=0;i<800;i++){
        const nx=Math.random()*W, ny=Math.random()*H;
        ctx.fillStyle=Math.random()<0.5?'#fff':'#000';
        ctx.fillRect(nx,ny,1,1);
      }
      ctx.globalAlpha=1;
    }

    // Lampe torche (cercle de lumière central)
    if(this.battery>0){
      const flick=1-this.effects.flicker*0.5;
      const lampR = ctx.createRadialGradient(W/2,H/2,10,W/2,H/2,H*0.45*flick);
      lampR.addColorStop(0,`rgba(255,240,200,${0.06*flick})`);
      lampR.addColorStop(0.5,'rgba(0,0,0,0)');
      lampR.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=lampR; ctx.fillRect(0,0,W,H);
    }

    // ——— BARRE HUD BAS ———
    const hbY=H-28;
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,hbY-4,W,32);

    // Santé
    ctx.fillStyle='#333'; ctx.fillRect(10,hbY+2,100,12);
    ctx.fillStyle=this.player.health>50?'#cc2222':'#ff4444';
    ctx.fillRect(10,hbY+2,this.player.health,12);
    ctx.fillStyle='#888'; ctx.font='10px monospace';
    ctx.fillText('❤',10,hbY+1);

    // Batterie lampe
    ctx.fillStyle='#333'; ctx.fillRect(120,hbY+2,80,12);
    ctx.fillStyle=this.battery>30?'#44aa44':'#aa4444';
    ctx.fillRect(120,hbY+2,this.battery*0.8,12);
    ctx.fillStyle='#888'; ctx.fillText('🔦',120,hbY+1);

    // Sanité
    ctx.fillStyle='#333'; ctx.fillRect(W-120,hbY+2,100,12);
    ctx.fillStyle=`hsl(${this.sanity*0.6+200},70%,50%)`;
    ctx.fillRect(W-120,hbY+2,this.sanity,12);
    ctx.fillStyle='#888'; ctx.fillText('🧠',W-122,hbY+1);

    // Chapitre
    ctx.fillStyle='rgba(180,180,180,0.6)';
    ctx.font='10px monospace';
    ctx.fillText(`Ch.${this.chapter} · ${this.mapData?.name||''}`, W/2-60, hbY+12);

    // Son ambiant affiché
    if(this._soundQueue.length>0){
      ctx.fillStyle='rgba(180,180,180,0.5)';
      ctx.font='italic 11px serif';
      ctx.textAlign='center';
      ctx.fillText(`♪ ${this._soundQueue[0]}`, W/2, H-40);
      ctx.textAlign='left';
    }

    // Inventaire
    if(this.notes.length>0){
      ctx.fillStyle='rgba(200,180,100,0.7)';
      ctx.font='10px monospace';
      ctx.fillText(`📋 ${this.notes.length} note(s)`, 10, H-40);
    }

    // Narrative overlay
    if(this._narrative){
      ctx.fillStyle='rgba(0,0,0,0.75)';
      ctx.fillRect(W*0.05, H*0.1, W*0.9, H*0.35);
      ctx.strokeStyle='rgba(180,160,100,0.5)';
      ctx.lineWidth=1; ctx.strokeRect(W*0.05, H*0.1, W*0.9, H*0.35);
      ctx.fillStyle='rgba(220,200,150,0.95)';
      ctx.font='13px serif'; ctx.textAlign='center';
      const lines=this._narrative.split('\n');
      lines.forEach((line,i)=>ctx.fillText(line, W/2, H*0.17+i*20));
      ctx.textAlign='left';
    }

    // Message interaction
    const near=this._getNearObject();
    if(near){
      ctx.fillStyle='rgba(0,0,0,0.6)';
      ctx.fillRect(W*0.15,H*0.72,W*0.7,22);
      ctx.fillStyle='rgba(220,200,150,0.9)';
      ctx.font='11px monospace'; ctx.textAlign='center';
      ctx.fillText(`[E] ${near.desc.slice(0,60)}${near.desc.length>60?'…':''}`, W/2, H*0.72+15);
      ctx.textAlign='left';
    }

    // Crosshair minimal
    ctx.strokeStyle='rgba(200,200,200,0.4)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(W/2-6,H/2); ctx.lineTo(W/2+6,H/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W/2,H/2-6); ctx.lineTo(W/2,H/2+6); ctx.stroke();
  }

  // ——— MISE À JOUR ——————————————————————————————
  _update(dt) {
    if(this.gameState!=='playing') return;
    const p=this.player;

    // Mouvement
    p.isRunning = this.keys['ShiftLeft']||this.keys['ShiftRight'];
    const spd = p.isRunning ? p.speed*1.8 : p.speed;

    if(this.keys['KeyW']||this.keys['ArrowUp']){
      const nx=p.x+Math.cos(p.angle)*spd, ny=p.y+Math.sin(p.angle)*spd;
      if(!this._isWall(nx,p.y)) p.x=nx;
      if(!this._isWall(p.x,ny)) p.y=ny;
      if(p.isRunning) p.stamina=Math.max(0,p.stamina-dt*0.04);
    }
    if(this.keys['KeyS']||this.keys['ArrowDown']){
      const nx=p.x-Math.cos(p.angle)*spd*0.6, ny=p.y-Math.sin(p.angle)*spd*0.6;
      if(!this._isWall(nx,p.y)) p.x=nx;
      if(!this._isWall(p.x,ny)) p.y=ny;
    }
    if(this.keys['KeyA']||this.keys['ArrowLeft'])  p.angle-=p.turnSpeed*dt*0.016*60;
    if(this.keys['KeyD']||this.keys['ArrowRight']) p.angle+=p.turnSpeed*dt*0.016*60;

    // Batterie lampe
    this.battery=Math.max(0,this.battery-dt*0.003);
    if(this.battery<=0) this.effects.flicker=Math.random()<0.3?0.8:0;
    else this.effects.flicker=Math.max(0,this.effects.flicker-dt*0.1);

    // Sons d'ambiance aléatoires
    this._soundTimer-=dt;
    if(this._soundTimer<0){
      this._soundTimer=200+Math.random()*400;
      const sounds=['Grincement de métal','Pas dans le couloir','Souffle lointain',
                    'Téléphone qui sonne','Claquement de porte','Murmure incompréhensible',
                    'Gouttes d\'eau','Quelque chose rampe au plafond','Rire d\'enfant',
                    'Sirène lointaine','Bruit de chaînes'];
      if(this._soundQueue.length<3)
        this._soundQueue.push(sounds[Math.floor(Math.random()*sounds.length)]);
      if(this._soundQueue.length>2) this._soundQueue.shift();
    }

    // Monstres
    for(const m of this.monsters){
      if(m.dead) continue;
      const dx=p.x-m.x, dy=p.y-m.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<m.cfg.sight){
        // Alerte : approcher
        m.state='chase';
        const spd2=m.cfg.speed*dt*0.06*60;
        const nx=m.x+Math.cos(Math.atan2(dy,dx))*spd2;
        const ny=m.y+Math.sin(Math.atan2(dy,dx))*spd2;
        if(!this._isWall(nx,m.y)) m.x=nx;
        if(!this._isWall(m.x,ny)) m.y=ny;
        // Dégâts si très proche
        if(dist<0.7){
          p.health-=dt*0.06*60*0.3;
          this.effects.heartbeat=1;
          this.effects.shakeTimer=10;
          this.sanity=Math.max(0,this.sanity-dt*0.02*60);
        }
      } else {
        // Errer
        m.state='wander';
        m.wanderTimer-=dt;
        if(m.wanderTimer<0){ m.wanderTimer=60+Math.random()*120; m.angle=Math.random()*Math.PI*2; }
        const spd3=m.cfg.speed*0.5*dt*0.06*60;
        const nx=m.x+Math.cos(m.angle)*spd3, ny=m.y+Math.sin(m.angle)*spd3;
        if(!this._isWall(nx,m.y)) m.x=nx; else m.angle+=Math.PI/2;
        if(!this._isWall(m.x,ny)) m.y=ny; else m.angle+=Math.PI/2;
      }
    }

    // Effets de folie
    if(this.mapData?.isMadness){
      this.effects.noiseAlpha=Math.min(1,(100-this.sanity)/100);
      this.effects.vignette=0.4+(100-this.sanity)*0.005;
      if(this.sanity<50) this.effects.flicker=Math.random()<0.1?0.6:0;
    }

    // Tremblement caméra
    if(this.effects.shakeTimer>0){
      this.effects.shakeTimer-=dt;
      this.effects.shake={x:(Math.random()-0.5)*6,y:(Math.random()-0.5)*4};
    } else { this.effects.shake={x:0,y:0}; }

    // Heartbeat decay
    this.effects.heartbeat=Math.max(0,this.effects.heartbeat-dt*0.008*60);

    // Récupération stamina
    if(!p.isRunning) p.stamina=Math.min(100,p.stamina+dt*0.02*60);

    // Vérif sanité critique
    if(p.health<=0) this._triggerEnding('dead');

    // Sortie du niveau
    for(const exit of (this.mapData?.exits||[])){
      const dx=p.x-exit.x, dy=p.y-exit.y;
      if(Math.sqrt(dx*dx+dy*dy)<0.8) this._loadChapter(exit.toChapter);
    }

    // Narrative timer
    if(this._narrativeTimer>0){
      this._narrativeTimer-=dt;
      if(this._narrativeTimer<=0) this._narrative=null;
    }
  }

  // ——— INTERACTIONS ——————————————————————————————
  _getNearObject() {
    for(const obj of this.objects){
      if(this.collectedObjects.has(obj.id||obj.type+obj.x)) continue;
      const dx=this.player.x-obj.x, dy=this.player.y-obj.y;
      if(Math.sqrt(dx*dx+dy*dy)<0.9) return obj;
    }
    return null;
  }

  _interact() {
    const obj=this._getNearObject();
    if(!obj) return;
    const id=obj.id||obj.type+obj.x;

    if(obj.type==='note'){ this.notes.push(obj.desc); this._showNarrative(obj.desc,4000); this.collectedObjects.add(id); }
    else if(obj.type==='battery'){ this.battery=Math.min(100,this.battery+40); this._showNarrative('Piles récupérées. La lampe brille à nouveau.',2000); this.collectedObjects.add(id); }
    else if(obj.type==='key'){ this.inventory.push(obj.id); this._showNarrative(obj.desc,2500); this.collectedObjects.add(id); }
    else if(obj.type==='generator'){ this._showNarrative('Générateur réparé.\nL\'électricité revient en grésilllant.',3000); this.collectedObjects.add(id); }
    else if(obj.type==='wallmsg'){ this._showNarrative(obj.desc,3000); this.sanity=Math.max(0,this.sanity-8); this.effects.heartbeat=0.8; }
    else if(obj.type==='ending_bad')  this._triggerEnding('bad');
    else if(obj.type==='ending_good') this._triggerEnding('good');
    else if(obj.type==='ending_neutral') this._triggerEnding('neutral');
    else if(obj.type==='ending_choice') this._showNarrative('Trois chemins s\'offrent à toi.\n\nA gauche : rejoindre les illusions.\nA droite : refuser l\'entité.\nEn bas : tout détruire et fuir.',5000);
  }

  // ——— FINS ——————————————————————————————————————
  _triggerEnding(type) {
    this.gameState='ending';
    this.endingType=type;
    const endings = {
      bad:     { title:'MAUVAISE FIN',  color:'#880000', text:'Ethan accepte les illusions.\nIl rejoint sa famille.\nLa caméra s\'éloigne.\nIl est mort depuis le début.\n\n"Tu es enfin avec nous, papa."' },
      good:    { title:'BONNE FIN',     color:'#006600', text:'Ethan accepte la vérité.\nIl refuse l\'entité.\nL\'hôpital s\'effondre.\nIl sort au lever du soleil.\n\nPour la première fois depuis 10 ans :\nLe silence.' },
      neutral: { title:'FIN NEUTRE',    color:'#664400', text:'Ethan détruit le sanctuaire.\nIl survit.\nMais les apparitions continuent.\n\nIl n\'est jamais vraiment sorti.' },
      dead:    { title:'GAME OVER',     color:'#440000', text:'Ethan n\'a pas survécu.\nL\'asile réclame une âme de plus.\n\n"Il nous appartient maintenant."' },
    };
    const end=endings[type]||endings.neutral;
    const ctx=this.ctx,W=this.W,H=this.H;

    let alpha=0;
    const fade=()=>{
      alpha+=0.015;
      ctx.fillStyle=`rgba(0,0,0,${alpha})`;
      ctx.fillRect(0,0,W,H);
      if(alpha<1){ requestAnimationFrame(fade); return; }
      // Afficher la fin
      ctx.fillStyle=end.color;
      ctx.font='bold 28px serif';
      ctx.textAlign='center';
      ctx.fillText(end.title,W/2,H*0.2);
      ctx.fillStyle='rgba(200,180,150,0.9)';
      ctx.font='14px serif';
      end.text.split('\n').forEach((l,i)=>ctx.fillText(l,W/2,H*0.35+i*24));
      ctx.fillStyle='rgba(140,120,80,0.6)';
      ctx.font='11px monospace';
      ctx.fillText('[Appuie sur R pour revenir au menu]',W/2,H*0.85);
      ctx.textAlign='left';
    };
    requestAnimationFrame(fade);
  }

  // ——— UTILITAIRES ——————————————————————————————
  _isWall(x,y){
    const mx=Math.floor(x),my=Math.floor(y);
    if(mx<0||mx>=this.MAP_W||my<0||my>=this.MAP_H) return true;
    return this.map[my]?.[mx]===1;
  }

  _showNarrative(text,duration){
    this._narrative=text; this._narrativeTimer=duration/16.67;
  }

  // ——— BOUCLE ————————————————————————————————————
  _loop(timestamp) {
    if(this.gameState==='ending') return;
    requestAnimationFrame(this._loop.bind(this));
    const dt=Math.min((timestamp-this._lastTime)/16.67,4);
    this._lastTime=timestamp;
    this._update(dt);
    this._render3D();
    this._renderSprites();
    this._renderHUD();
  }

  // ——— UI ——————————————————————————————————————
  _buildUI(){
    // Masquer l'UI de la simulation
    document.getElementById('topbar')?.style.setProperty('display','none');
    document.getElementById('app-layout')?.style.setProperty('display','none');
    document.getElementById('bottom-panel')?.style.setProperty('display','none');

    // Canvas principal
    const canvas=document.createElement('canvas');
    canvas.id='horror-canvas';
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    canvas.style.cssText='position:fixed;top:0;left:0;background:#000;z-index:500;cursor:none;';
    document.body.appendChild(canvas);

    // Bouton retour
    const btn=document.createElement('button');
    btn.textContent='✕ Menu';
    btn.style.cssText='position:fixed;top:10px;right:10px;z-index:600;background:rgba(0,0,0,0.7);color:#888;border:1px solid #333;padding:5px 12px;font-family:monospace;font-size:11px;cursor:pointer;border-radius:3px;';
    btn.addEventListener('click',()=>this._quit());
    document.body.appendChild(btn);
    this._backBtn=btn;

    // Instructions
    const hint=document.createElement('div');
    hint.style.cssText='position:fixed;bottom:40px;left:50%;transform:translateX(-50%);color:rgba(180,160,100,0.5);font:10px monospace;z-index:600;pointer-events:none;';
    hint.textContent='ZQSD / Flèches = Bouger · E = Interagir · Shift = Courir';
    document.body.appendChild(hint);
    this._hintEl=hint;
    setTimeout(()=>hint.style.opacity='0',5000);

    // Hint pointer lock
    const lockHint = document.createElement('div');
    lockHint.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.8); border:1px solid rgba(180,160,100,0.4);
      color:rgba(200,180,130,0.9); font:14px serif; padding:16px 28px;
      border-radius:6px; z-index:610; text-align:center; pointer-events:none;
      transition:opacity 0.5s;
    `;
    lockHint.innerHTML = '🖱 <b>Clique</b> pour capturer la souris<br><span style="font-size:11px;opacity:0.6">Échap = libérer · ZQSD = bouger · E = interagir</span>';
    document.body.appendChild(lockHint);
    this._lockHint = lockHint;
    // Cacher après 6s si pas de clic
    setTimeout(()=>{ if(lockHint.style.opacity!=='0') lockHint.style.opacity='0.3'; }, 6000);

    window.addEventListener('resize',()=>{
      canvas.width=window.innerWidth; canvas.height=window.innerHeight;
      this.W=canvas.width; this.H=canvas.height;
    });
  }

  _bindInputs(){
    // ——— Clavier ———
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if(e.code==='KeyE') this._interact();
      if(e.code==='KeyR' && this.gameState==='ending') this._quit();
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // ——— Souris : regarder gauche/droite (Pointer Lock) ———
    this._mouseSensitivity = 0.0018;
    const canvas = document.getElementById('horror-canvas');

    // Clic sur canvas = capturer le pointeur
    canvas?.addEventListener('click', () => {
      if(this.gameState !== 'playing') return;
      canvas.requestPointerLock().catch(()=>{});
    });

    // Mouvement souris quand pointer lock actif
    document.addEventListener('mousemove', e => {
      if(document.pointerLockElement !== canvas) return;
      if(this.gameState !== 'playing') return;
      this.player.angle += e.movementX * this._mouseSensitivity;
    });

    // Haut/Bas souris : pas d'effet (FPS sans inclinaison)

    // Maj du hint selon lock
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if(this._lockHint) this._lockHint.style.opacity = locked ? '0' : '1';
    });

    // Clic droit désactivé
    canvas?.addEventListener('contextmenu', e => e.preventDefault());
  }

  _quit(){
    document.getElementById('horror-canvas')?.remove();
    this._backBtn?.remove();
    this._hintEl?.remove();
    document.getElementById('topbar')?.style.removeProperty('display');
    document.getElementById('app-layout')?.style.removeProperty('display');
    document.getElementById('bottom-panel')?.style.removeProperty('display');
    location.reload();
  }
}

// ============================================================
// POINT D'ENTRÉE
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  injectMenuStyles();
  try {
    new MainMenu((mode) => {
      if (mode === 'horror') {
        window.game = new HorrorGame();
      } else {
        window.sim = new CivilSim(mode);
      }
    });
  } catch(err) {
    console.error('[CivilSim] ERREUR:', err);
    document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">
      <h2>Erreur CivilSim</h2><pre>${err.stack}</pre></div>`;
  }
});
