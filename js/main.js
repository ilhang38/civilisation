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
// HORROR GAME — LE PUITS DES OUBLIÉS
// Thomas Verne recherche sa famille disparue dans Blackwood
// Raycasting pseudo-3D, z-buffer, minimap, 8 chapitres + fins
// ============================================================
class HorrorGame {
  constructor() {
    this._buildUI();
    this.canvas = document.getElementById('horror-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.W      = this.canvas.width;
    this.H      = this.canvas.height;

    // État
    this.chapter   = 1;
    this.gameState = 'playing';
    this.sanity    = 100;
    this.battery   = 100;
    this.inventory = [];
    this.notes     = [];
    this.endingType= null;
    this._secretDocs = 0; // pour fin secrète (4 requis)

    // Joueur
    this.player = {
      x:3.5, y:3.5, angle:0,
      speed:0.055, turnSpeed:0.04,
      health:100, stamina:100, isRunning:false,
    };

    // Rendu
    this.FOV      = Math.PI/3;
    this.RAYS     = 130;
    this.MAX_DIST = 16;
    this._zBuffer = new Float32Array(this.RAYS);

    // Entités
    this.monsters = [];
    this.objects  = [];
    this.collectedObjects = new Set();

    // Effets
    this.effects = {
      flicker:0, heartbeat:0, vignette:0.4,
      noiseAlpha:0, shake:{x:0,y:0}, shakeTimer:0,
      bloodAlpha:0,
    };

    // Son & narration
    this._soundQueue  = [];
    this._soundTimer  = 0;
    this._narrative   = null;
    this._narrativeTimer = 0;
    this._narrativeQueue = [];

    // Clés input
    this.keys = {};
    this._mouseSensitivity = 0.0018;

    // Timers
    this._exitTimer = 0;
    this._fadeAlpha = 0;
    this._tick      = 0;

    this._bindInputs();
    this._loadChapter(1);

    this._lastTime = performance.now();
    requestAnimationFrame(this._loop.bind(this));

    // Prologue
    setTimeout(() => this._queueNarrative([
      'Novembre 2004.',
      'Thomas Verne, ancien inspecteur.\nSa femme Clara et son fils Lucas ont disparu\nil y a cinq ans.',
      'Ce soir, une cassette VHS était devant sa porte.\nDessus : Lucas, filmé il y a trois jours.\n\nLucas est censé être mort.',
      '"Papa... ils sont encore dans le puits."',
    ]), 600);
  }

  // ============================================================
  // DONNÉES DES CHAPITRES
  // ============================================================
  _getChapterData(n) {
    const maps = {

      // ——— CH.1 BLACKWOOD ———————————————————————————————
      1: {
        name:'Blackwood', subtitle:'Le village abandonné',
        ambience:'Rires d\'enfants dans les rues vides. Vent froid.',
        isNight:true,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,1],
          [1,0,1,1,0,0,1,0,1,1,0,1,0,1,0,1,0,1],
          [1,0,1,0,0,0,0,0,0,1,0,1,0,0,0,1,0,1],
          [1,0,0,0,1,0,1,1,0,0,0,0,0,1,0,0,0,1],
          [1,0,1,0,1,0,0,0,0,1,1,0,0,1,0,1,0,1],
          [1,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,1],
          [1,0,0,0,1,0,1,0,1,1,0,1,0,0,0,0,0,1],
          [1,0,1,0,0,0,0,0,0,1,0,1,0,1,0,1,0,1],
          [1,0,1,1,0,1,0,0,0,0,0,0,0,1,0,0,0,1],
          [1,0,0,0,0,1,0,1,1,0,1,0,0,0,0,1,0,1],
          [1,0,1,0,1,0,0,0,1,0,1,0,1,0,0,0,0,1],
          [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:1.5,y:1.5,angle:0},
        objects:[
          {x:5.5,y:3.5,type:'note',required:true,id:'n1_journal',
           secret:false,
           desc:'"Village évacué 1987. Officiellement : gaz. Officieusement : 47 disparus en une semaine." — Rapport police'},
          {x:9.5,y:6.5,type:'key',required:true,id:'key_redhouse',
           desc:'Clé de la Maison Rouge. Métal rouillé, froide au toucher.'},
          {x:13.5,y:9.5,type:'note',required:false,id:'n1_photo',
           secret:true,
           desc:'Photo brûlée. On devine : une famille devant un puits. Au dos : "Ne les laissez pas descendre."'},
          {x:3.5,y:11.5,type:'battery',desc:'Piles. Presque neuves.'},
        ],
        exits:[{x:16,y:6,toChapter:2}],
        monsterSpawns:[
          {x:10.5,y:4.5,type:'shadow'},
          {x:6.5,y:9.5,type:'shadow'},
        ],
        intro:[
          'Blackwood, 03h12.\nRues désertes. Lumières aux fenêtres.\nQuelque chose observe depuis les ombres.',
          'Trouve la clé de la Maison Rouge.\nLes réponses sont là-bas.',
        ],
      },

      // ——— CH.2 MAISON ROUGE ————————————————————————————
      2: {
        name:'La Maison Rouge', subtitle:'Les secrets enfouis',
        ambience:'Craquements de bois. Murmures derrière les murs.',
        isRed:false, isDark:true,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
          [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,1,0,1],
          [1,0,1,0,1,1,0,0,0,0,1,0,0,0,0,0,0,1],
          [1,0,0,0,1,0,0,1,0,0,1,0,1,1,1,1,0,1],
          [1,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
          [1,0,1,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1],
          [1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1],
          [1,0,1,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1],
          [1,0,1,0,0,0,1,1,0,0,1,0,0,1,0,1,0,1],
          [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:1.5,y:1.5,angle:0},
        objects:[
          {x:5.5,y:4.5,type:'note',required:true,id:'n2_journal1952',
           desc:'"1952. Six enfants ont disparu près du puits. Les parents ont été retrouvés morts.\nLeurs yeux regardaient vers le bas." — Journal curé Moreau'},
          {x:9.5,y:7.5,type:'note',required:true,id:'n2_lettre_clara',
           desc:'"Thomas, si tu lis ça, c\'est que tu es venu.\nNe descends pas dans le puits.\nNe les écoute pas.\nIls ne sont plus eux." — Clara'},
          {x:13.5,y:5.5,type:'note',required:false,id:'n2_secret',
           secret:true,
           desc:'PAGE ARRACHÉE : "...la deuxième cavité... plus profonde... elle n\'était pas seule..."'},
          {x:3.5,y:10.5,type:'battery',desc:'Vieilles piles. Ça ira.'},
          {x:11.5,y:11.5,type:'key',required:true,id:'key_church',
           desc:'Clé de l\'Église. Gravée d\'un symbole : un œil fermé.'},
        ],
        exits:[{x:16,y:6,toChapter:3}],
        monsterSpawns:[
          {x:8.5,y:4.5,type:'faceless'},
          {x:12.5,y:8.5,type:'shadow'},
        ],
        intro:[
          '"Tu aurais dû laisser les morts dormir."\n\nLa vieille femme aveugle disparaît\navant que Thomas puisse répondre.',
          'La Maison Rouge cache des réponses.\nTrouve le journal du sous-sol.',
        ],
      },

      // ——— CH.3 ENFANTS SANS VISAGE ————————————————————
      3: {
        name:'Les Enfants Sans Visage', subtitle:'La nuit prend vie',
        ambience:'Rires. Pleurs. La voix de Lucas entre deux.',
        isNight:true, isMadness:false,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,0,1],
          [1,0,1,0,1,0,1,1,0,0,1,0,1,0,1,0,0,1],
          [1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
          [1,0,0,0,1,1,0,0,0,1,1,1,0,1,0,1,0,1],
          [1,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
          [1,0,1,0,1,0,0,1,0,1,0,1,0,0,0,1,0,1],
          [1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,1],
          [1,0,1,1,0,0,1,0,0,0,0,1,0,1,0,1,0,1],
          [1,0,0,0,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
          [1,0,1,0,1,0,0,0,1,0,1,0,0,1,0,1,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:1.5,y:1.5,angle:0},
        objects:[
          {x:7.5,y:3.5,type:'wallmsg',id:'wm1',desc:'"IL A FAIM."'},
          {x:4.5,y:7.5,type:'wallmsg',id:'wm2',desc:'"IL A FAIM."'},
          {x:12.5,y:5.5,type:'wallmsg',id:'wm3',desc:'"IL A FAIM."'},
          {x:10.5,y:9.5,type:'note',required:true,id:'n3_disparitions',
           desc:'"Les enfants disparus en 1952 ne sont pas morts.\nIls sont devenus autre chose.\nIls gardent l\'accès au puits." — Survivant anonyme'},
          {x:6.5,y:11.5,type:'note',required:false,id:'n3_secret',
           secret:true,
           desc:'Dessin d\'enfant. Deux puits. Deux yeux. En dessous : "ELLE N\'ÉTAIT PAS SEULE."'},
          {x:14.5,y:8.5,type:'battery',desc:'Piles.'},
          {x:3.5,y:5.5,type:'key',required:true,id:'key_tunnel',
           desc:'Trappe rouillée. Accès aux galeries souterraines.'},
        ],
        exits:[{x:16,y:6,toChapter:4}],
        monsterSpawns:[
          {x:9.5,y:4.5,type:'faceless'},
          {x:5.5,y:8.5,type:'faceless'},
          {x:13.5,y:6.5,type:'shadow'},
        ],
        intro:[
          'Ils surgissent du brouillard.\nDes enfants.\nMais leurs visages sont entièrement lisses.',
          '"Il a faim."\n\nIls répètent tous la même phrase.\nPuis disparaissent.',
        ],
      },

      // ——— CH.4 ÉGLISE ENGLOUTIE ————————————————————————
      4: {
        name:'L\'Église Engloutie', subtitle:'Le puits sans fond',
        ambience:'Bougie qui crépitent. Voix montant du sol.',
        isUnderground:true,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,1,1,1,1,0,0,0,1,1,1,1,0,0,0,1],
          [1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1],
          [1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
          [1,0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:1.5,y:6.5,angle:0},
        objects:[
          {x:8.5,y:6.5,type:'well',required:true,id:'well_center',
           desc:'"RAMÈNE-MOI MON CŒUR."\n\nLa voix monte du puits.\nProfonde. Ancienne.\nPas humaine.'},
          {x:4.5,y:3.5,type:'note',required:true,id:'n4_noms',
           desc:'"Sur les murs : des milliers de noms.\nTous les disparus de Blackwood depuis 1911.\nLe nom de Clara. Le nom de Lucas."'},
          {x:12.5,y:9.5,type:'note',required:false,id:'n4_secret',
           secret:true,
           desc:'Derrière l\'autel : une trappe scellée.\n"CAVITÉ B — ACCÈS INTERDIT"\nQuelqu\'un a ajouté en rouge : "TROP TARD."'},
          {x:15.5,y:3.5,type:'battery',desc:'Piles sèches. Presque vides.'},
          {x:2.5,y:10.5,type:'key',required:true,id:'key_galleries',
           desc:'Clé des Galeries Profondes. Gravée du même symbole que l\'église.'},
        ],
        exits:[{x:16,y:6,toChapter:5}],
        monsterSpawns:[
          {x:6.5,y:3.5,type:'faceless'},
          {x:11.5,y:9.5,type:'shadow'},
          {x:14.5,y:6.5,type:'faceless'},
        ],
        intro:[
          'Sous les rues de Blackwood.\nUne église.\nDes centaines de bougies encore allumées.',
          '"Ramène-moi mon cœur."\n\nLa voix monte du puits central.\nElles attend depuis très longtemps.',
        ],
      },

      // ——— CH.5 LE GARDIEN ————————————————————————————
      5: {
        name:'Le Gardien', subtitle:'Ce qui garde le passage',
        ambience:'Racines qui craquent. Voix familières déformées.',
        isRed:true, isUnderground:true,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1],
          [1,0,1,0,1,0,1,1,1,1,0,0,1,0,0,1,0,1],
          [1,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1],
          [1,0,0,0,1,1,0,0,0,1,1,1,0,1,0,0,0,1],
          [1,0,1,0,0,0,0,1,0,0,0,0,0,1,0,1,0,1],
          [1,0,1,0,1,0,0,1,0,1,0,1,0,0,0,0,0,1],
          [1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1,0,1],
          [1,0,1,1,0,0,1,0,0,0,0,1,0,1,0,0,0,1],
          [1,0,0,0,0,0,1,0,1,0,0,1,0,0,0,1,0,1],
          [1,0,1,0,1,0,0,0,1,0,1,0,0,1,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:1.5,y:1.5,angle:0},
        objects:[
          {x:9.5,y:6.5,type:'note',required:true,id:'n5_gardien',
           desc:'"Trois mètres. Corps humain fusionné avec des racines.\nSon visage : des dizaines de bouches.\nIls parlent tous en même temps.\nParmi eux : la voix de Clara."'},
          {x:5.5,y:10.5,type:'note',required:true,id:'n5_archives_hint',
           desc:'"Derrière le Gardien se trouvent les Archives.\nLa vérité sur Blackwood.\nLa vérité sur ta famille."'},
          {x:13.5,y:4.5,type:'battery',desc:'Piles.'},
          {x:3.5,y:7.5,type:'key',required:true,id:'key_archives',
           desc:'Clé des Archives. Le Gardien l\'avait.'},
          {x:11.5,y:11.5,type:'note',required:false,id:'n5_secret',
           secret:true,
           desc:'"Les archives mentionnent une deuxième entité.\nPlus ancienne. Plus profonde.\nLe Gardien ne la connaît même pas."'},
        ],
        exits:[{x:16,y:6,toChapter:6}],
        monsterSpawns:[
          {x:8.5,y:3.5,type:'guardian'},
          {x:5.5,y:8.5,type:'shadow'},
          {x:12.5,y:6.5,type:'shadow'},
          {x:14.5,y:10.5,type:'faceless'},
        ],
        intro:[
          'Les galeries souterraines.\nQuelque chose respire dans l\'obscurité.\nQuelque chose de très grand.',
          '"Thomas..."\n\nLa voix de Clara.\nMais la bouche qui parle n\'est pas la sienne.',
        ],
      },

      // ——— CH.6 LES ARCHIVES ——————————————————————————
      6: {
        name:'Les Archives', subtitle:'La vérité sur tout',
        ambience:'Silence total. Pire que les bruits.',
        isDark:true,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,1,1,1,0,1,1,1,1,0,1,1,1,0,1,0,1],
          [1,0,1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1],
          [1,0,1,0,1,1,0,0,0,1,1,0,0,0,0,1,0,1],
          [1,0,0,0,1,0,0,1,0,0,1,0,1,1,0,1,0,1],
          [1,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
          [1,0,1,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1],
          [1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1],
          [1,0,1,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1],
          [1,0,1,0,0,0,1,1,0,0,1,0,0,1,0,1,0,1],
          [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:1.5,y:1.5,angle:0},
        objects:[
          {x:6.5,y:3.5,type:'note',required:true,id:'n6_entite',
           desc:'"1911. Découverte de la cavité.\nDedans : une entité ancienne.\nNi démon. Ni fantôme.\nElle se nourrit des souvenirs.\nEn échange : des miracles.\nLes habitants ont commencé les sacrifices."'},
          {x:10.5,y:6.5,type:'note',required:true,id:'n6_famille',
           desc:'"Clara est descendue dans le puits volontairement.\nElle voulait ramener Lucas.\nElles n\'est jamais remontée.\nLucas est mort le premier jour.\nTout ce que tu as vu : des illusions.\nL\'entité utilise tes souvenirs."'},
          {x:4.5,y:9.5,type:'wallmsg',id:'wm_truth',
           desc:'"RIEN DE CE QUE TU VOIS N\'EST RÉEL."'},
          {x:13.5,y:4.5,type:'note',required:false,id:'n6_secret',
           secret:true,
           desc:'DOCUMENT CLASSIFIÉ 1987 :\n"Évacuation précipitée.\nRaison réelle : signal détecté à -847m.\nDifférent du premier.\nNous ne savons pas ce que c\'est."'},
          {x:8.5,y:11.5,type:'battery',desc:'Piles.'},
          {x:15.5,y:8.5,type:'key',required:true,id:'key_pit',
           desc:'Accès au Puits. Dernier niveau.'},
        ],
        exits:[{x:16,y:6,toChapter:7}],
        monsterSpawns:[
          {x:9.5,y:4.5,type:'shadow'},
          {x:5.5,y:7.5,type:'faceless'},
        ],
        intro:[
          'Les archives de Blackwood.\nDes décennies de mensonges.\nLa vérité est là.',
          '"Lucas est mort le premier jour."\n\nThomas fixe le document.\nTout était une illusion.',
        ],
      },

      // ——— CH.7 ROYAUME SOUS TERRE ——————————————————————
      7: {
        name:'Le Royaume Sous Terre', subtitle:'La cité des morts',
        ambience:'Milliers de murmures. Tous les morts depuis 1911.',
        isUnderground:true, isMadness:true,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,1],
          [1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1],
          [1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:1.5,y:6.5,angle:0},
        objects:[
          {x:5.5,y:3.5,type:'note',required:true,id:'n7_cite',
           desc:'"Une ville entière sous la terre.\nDes milliers de silhouettes.\nCertaines mortes depuis un siècle.\nAucune ne sait qu\'elle est morte.\nElles revivent leurs souvenirs indéfiniment."'},
          {x:9.5,y:6.5,type:'note',required:true,id:'n7_clara_lucas',
           desc:'"Quelque part dans cette cité.\nClara et Lucas errent.\nIls ne savent pas qu\'ils sont morts.\nLes rejoindre signifie ne jamais repartir."'},
          {x:13.5,y:10.5,type:'key',required:true,id:'key_heart',
           desc:'Accès au Cœur de l\'entité. Métal inconnu. Brûle légèrement.'},
          {x:3.5,y:10.5,type:'battery',desc:'Piles.'},
        ],
        exits:[{x:16,y:6,toChapter:8}],
        monsterSpawns:[
          {x:7.5,y:3.5,type:'shadow'},
          {x:11.5,y:6.5,type:'faceless'},
          {x:5.5,y:9.5,type:'shadow'},
          {x:14.5,y:4.5,type:'faceless'},
        ],
        intro:[
          'Au fond du puits.\nUne cité gigantesque.\nUne ville entière enfouie depuis des décennies.',
          'Des milliers d\'âmes prisonnières.\nElles ne savent pas qu\'elles sont mortes.\nThomas voit Clara au loin.',
        ],
      },

      // ——— CH.8 LE CŒUR — FINAL ——————————————————————
      8: {
        name:'Le Cœur', subtitle:'Le choix final',
        ambience:'Battements. Profonds. Réguliers. Partout.',
        isFinal:true, isRed:true,
        map:[
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,1,1,1,0,0,0,1,1,1,0,0,0,0,1],
          [1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,0,1],
          [1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        playerStart:{x:8.5,y:1.5,angle:Math.PI/2},
        objects:[
          {x:8.5,y:6.5,type:'heart',required:true,id:'heart_center',
           desc:'"Le cœur de l\'entité.\nUne masse organique gigantesque.\nChaque battement provoque des hallucinations."\n\n[APPROCHE POUR FAIRE UN CHOIX]'},
          {x:4.5,y:6.5,type:'ending_tragic',
           desc:'[FIN TRAGIQUE] Rejoindre Clara et Lucas dans la cité.'},
          {x:12.5,y:6.5,type:'ending_good',
           desc:'[FIN LIBÉRATRICE] Détruire le cœur. Les libérer tous.'},
          {x:8.5,y:11.5,type:'ending_secret',
           desc:'[FIN SECRÈTE] Fermer la deuxième cavité. (Requiert 4 documents secrets)'},
        ],
        exits:[],
        monsterSpawns:[],
        intro:[
          '"Papa... reste avec nous."\n\nLucas tend la main.\nClara sourit derrière lui.\nIls semblent réels.',
          'Trois chemins.\nTrois vérités.\nUn seul choix.',
        ],
      },
    };
    return maps[n] || maps[1];
  }

  // ============================================================
  // CHARGEMENT CHAPITRE
  // ============================================================
  _loadChapter(n) {
    this.chapter  = n;
    this.monsters = [];
    this._exitTimer = 0;
    this._fadeAlpha = 0;

    const data = this._getChapterData(n);
    this.mapData  = data;
    this.map      = data.map;
    this.MAP_W    = data.map[0].length;
    this.MAP_H    = data.map.length;
    this.objects  = (data.objects||[]).map(o=>Object.assign({},o));
    this.collectedObjects = new Set();

    for(const sp of (data.monsterSpawns||[])) {
      this.monsters.push(this._createMonster(sp.type, sp.x, sp.y));
    }

    const ps = data.playerStart;
    this.player.x     = ps.x;
    this.player.y     = ps.y;
    this.player.angle = ps.angle||0;

    // Effets de reset
    this.effects.noiseAlpha  = 0;
    this.effects.heartbeat   = 0;
    this.effects.vignette    = 0.4;
    this.effects.flicker     = 0;

    if(data.intro && data.intro.length) {
      this._queueNarrative(data.intro);
    }
  }

  // ============================================================
  // MONSTRES
  // ============================================================
  _createMonster(type, x, y) {
    const cfgs = {
      shadow:   {color:'#220022',size:0.30,speed:0.010,sight:7, label:'Ombre',   hostile:true},
      faceless: {color:'#1a1a2a',size:0.32,speed:0.007,sight:5, label:'Enfant',  hostile:true},
      guardian: {color:'#1a0a00',size:0.50,speed:0.005,sight:9, label:'Gardien', hostile:true},
    };
    const cfg = cfgs[type]||cfgs.shadow;
    return {
      type, x, y, cfg,
      angle:Math.random()*Math.PI*2,
      wanderTimer:0, state:'wander', dead:false,
      _wobble:Math.random()*Math.PI*2,
    };
  }

  // ============================================================
  // RAYCASTING
  // ============================================================
  _cast(angle) {
    const px=this.player.x, py=this.player.y;
    const cos=Math.cos(angle), sin=Math.sin(angle);
    for(let step=1; step<this.MAX_DIST*22; step++){
      const dist=step*0.045;
      const wx=px+cos*dist, wy=py+sin*dist;
      const mx=Math.floor(wx), my=Math.floor(wy);
      if(mx<0||mx>=this.MAP_W||my<0||my>=this.MAP_H)
        return {dist:this.MAX_DIST,hit:1};
      if(this.map[my]&&this.map[my][mx]===1)
        return {dist,hit:1};
    }
    return {dist:this.MAX_DIST,hit:0};
  }

  // ============================================================
  // RENDU 3D
  // ============================================================
  _render3D() {
    const ctx=this.ctx, W=this.W, H=this.H;
    const d = this.mapData||{};
    const sx=this.effects.shake.x, sy=this.effects.shake.y;

    const battPct   = this.battery/100;
    const flickMult = 1-this.effects.flicker*0.8;
    const lampPower = battPct*flickMult;

    // Fond noir absolu
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);

    // Sol
    const fg=ctx.createLinearGradient(0,H/2,0,H);
    if(d.isRed){ fg.addColorStop(0,`rgba(22,2,2,${0.55*lampPower})`); fg.addColorStop(1,'#000'); }
    else if(d.isMadness){ fg.addColorStop(0,`rgba(5,2,15,${0.4*lampPower})`); fg.addColorStop(1,'#000'); }
    else if(d.isUnderground){ fg.addColorStop(0,`rgba(8,6,4,${0.6*lampPower})`); fg.addColorStop(1,'#000'); }
    else { fg.addColorStop(0,`rgba(10,8,6,${0.65*lampPower})`); fg.addColorStop(1,'#000'); }
    ctx.fillStyle=fg; ctx.fillRect(sx,H/2+sy,W,H/2);

    // Plafond
    const cg=ctx.createLinearGradient(0,H/2,0,0);
    if(d.isRed){ cg.addColorStop(0,`rgba(15,0,0,${0.45*lampPower})`); cg.addColorStop(1,'#000'); }
    else { cg.addColorStop(0,`rgba(5,4,3,${0.4*lampPower})`); cg.addColorStop(1,'#000'); }
    ctx.fillStyle=cg; ctx.fillRect(sx,0+sy,W,H/2);

    // Murs
    const rayStep=this.FOV/this.RAYS;
    const startA =this.player.angle-this.FOV/2;
    const centerR=this.RAYS/2;
    this._zBuffer=new Float32Array(this.RAYS);

    for(let r=0;r<this.RAYS;r++){
      const ra=startA+r*rayStep;
      const {dist,hit}=this._cast(ra);
      const cd=Math.max(0.05,dist*Math.cos(ra-this.player.angle));
      const wH=Math.min(H,(1/cd)*H*0.78);
      const wT=(H-wH)/2;
      const x=(r/this.RAYS)*W+sx;
      const rW=W/this.RAYS+1;
      this._zBuffer[r]=cd;
      if(!hit) continue;

      const relR=(r-centerR)/centerR;
      const cone=Math.max(0,1-relR*relR*1.5);
      const dAtt=Math.max(0,1-cd/8);
      const lf  =cone*dAtt*lampPower*flickMult;

      // Couleur mur
      let rb,gb,bb;
      if(d.isRed)         { rb=55+lf*150;gb=2+lf*10;  bb=2+lf*6;    }
      else if(d.isMadness){ rb=6+lf*25;  gb=3+lf*10;  bb=18+lf*70;  }
      else if(d.isUnderground){rb=4+lf*80;gb=3+lf*65; bb=2+lf*55;   }
      else                { rb=3+lf*110; gb=3+lf*95;  bb=3+lf*80;   }

      ctx.fillStyle=`rgb(${rb|0},${gb|0},${bb|0})`;
      ctx.fillRect(x,wT+sy,rW,wH);

      // Joints briques
      if(lf>0.04){
        const bH=H*0.09;
        ctx.fillStyle=`rgba(0,0,0,${0.28*lf})`;
        for(let by=wT;by<wT+wH;by+=bH) ctx.fillRect(x,by|0,rW,1);
        // Taches humidité aléatoires
        if(r%4===0&&lf>0.12){
          ctx.fillStyle=`rgba(0,0,0,${(Math.sin(r*5.3)*0.5+0.5)*0.18*lf})`;
          ctx.fillRect(x,wT+wH*0.25,rW,wH*0.3);
        }
      }
      // Ombre sol/plafond
      ctx.fillStyle='rgba(0,0,0,0.65)';
      ctx.fillRect(x,wT+wH*0.88+sy,rW,wH*0.12);
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.fillRect(x,wT+sy,rW,wH*0.07);
    }

    // Fade transition
    if(this._fadeAlpha>0){
      ctx.fillStyle=`rgba(0,0,0,${Math.min(1,this._fadeAlpha)})`;
      ctx.fillRect(0,0,W,H);
    }
  }

  // ============================================================
  // SPRITES
  // ============================================================
  _renderSprites() {
    // Objets puis monstres (triés par distance décroissante)
    const entities=[];
    for(const obj of this.objects){
      if(!this.collectedObjects.has(obj.id||obj.type+obj.x))
        entities.push({wx:obj.x,wy:obj.y,isObj:true,obj});
    }
    for(const m of this.monsters){
      if(!m.dead) entities.push({wx:m.x,wy:m.y,isObj:false,m});
    }
    entities.sort((a,b)=>{
      const dA=Math.hypot(a.wx-this.player.x,a.wy-this.player.y);
      const dB=Math.hypot(b.wx-this.player.x,b.wy-this.player.y);
      return dB-dA;
    });
    for(const e of entities){
      if(e.isObj) this._drawObject(e.obj);
      else        this._drawMonster(e.m);
    }
  }

  _projectSprite(wx,wy) {
    const px=this.player.x, py=this.player.y;
    const dx=wx-px, dy=wy-py;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>this.MAX_DIST||dist<0.25) return null;
    let relA=Math.atan2(dy,dx)-this.player.angle;
    while(relA> Math.PI) relA-=Math.PI*2;
    while(relA<-Math.PI) relA+=Math.PI*2;
    if(Math.abs(relA)>this.FOV*0.72) return null;
    const screenX=((relA/this.FOV)+0.5)*this.W;
    // Z-buffer check
    if(this._zBuffer){
      const sH=Math.min(this.H*0.8,this.H*0.6/dist)*0.45;
      const c1=Math.floor(((screenX-sH)/this.W)*this.RAYS);
      const c2=Math.floor(((screenX+sH)/this.W)*this.RAYS);
      let blocked=true;
      for(let c=Math.max(0,c1);c<=Math.min(this.RAYS-1,c2);c++){
        if(dist<this._zBuffer[c]+0.12){blocked=false;break;}
      }
      if(blocked) return null;
    }
    return {screenX,dist};
  }

  _drawObject(obj) {
    const proj=this._projectSprite(obj.x,obj.y);
    if(!proj) return;
    const {screenX,dist}=proj;
    const ctx=this.ctx, H=this.H;
    const sprH=Math.min(H*0.7,H*0.45/dist);
    const sprY=H/2-sprH*0.4;

    const colors={
      note:'#f5d060',key:'#60d0ff',battery:'#60ff90',
      generator:'#ffaa30',wallmsg:'#ff2020',
      well:'#8844ff',heart:'#ff1040',
      ending_tragic:'#cc2020',ending_good:'#20cc40',ending_secret:'#aa20cc',
    };
    const icons={
      note:'📄',key:'🗝',battery:'🔋',generator:'⚡',wallmsg:'⚠',
      well:'〇',heart:'♦',
      ending_tragic:'☠',ending_good:'☀',ending_secret:'🌀',
    };

    const col=colors[obj.type]||'#fff';
    const icon=icons[obj.type]||'?';
    const lampF=Math.max(0.1,1-dist/7)*(this.battery/100);
    ctx.globalAlpha=Math.min(0.95,0.3+0.7*lampF);

    // Lueur
    ctx.shadowColor=col; ctx.shadowBlur=12;
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(screenX,sprY,sprH*0.18,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;

    // Icône
    ctx.font=`${sprH*0.28}px serif`; ctx.textAlign='center';
    ctx.fillText(icon,screenX,sprY+sprH*0.1);

    // Pulsation pour objets importants
    if(obj.required||obj.type==='heart'||obj.type==='well'){
      const pulse=Math.sin(Date.now()*0.004)*0.5+0.5;
      ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.globalAlpha=pulse*0.5;
      ctx.beginPath(); ctx.arc(screenX,sprY,sprH*0.28,0,Math.PI*2); ctx.stroke();
    }

    ctx.globalAlpha=1; ctx.textAlign='left';
  }

  _drawMonster(m) {
    const proj=this._projectSprite(m.x,m.y);
    if(!proj) return;
    const {screenX,dist}=proj;
    const ctx=this.ctx, H=this.H;
    const sprH=Math.min(H*0.9,H*0.65/dist);
    const sprY=(H-sprH)/2;
    const lampF=Math.max(0,1-dist/8)*(this.battery/100);
    const a=Math.min(0.92,(0.2+0.8*lampF)*(1-dist/this.MAX_DIST+0.1));
    if(a<0.02) return;
    ctx.globalAlpha=a;

    const bW=sprH*0.26;
    // Corps
    ctx.fillStyle=m.cfg.color;
    ctx.fillRect(screenX-bW/2,sprY+sprH*0.22,bW,sprH*0.58);
    // Bras déformés
    if(m.type==='guardian'){
      // Bras très longs et racines
      ctx.fillRect(screenX-bW*2.5,sprY+sprH*0.2,bW*2,sprH*0.35);
      ctx.fillRect(screenX+bW*0.5,sprY+sprH*0.2,bW*2,sprH*0.35);
      ctx.fillStyle='rgba(30,15,5,0.7)';
      for(let i=0;i<4;i++){
        const rx=screenX-bW*3+i*bW*1.5;
        ctx.fillRect(rx,sprY+sprH*0.5,bW*0.3,sprH*0.45);
      }
    } else {
      ctx.fillRect(screenX-bW*1.5,sprY+sprH*0.25,bW*0.9,sprH*0.38);
      ctx.fillRect(screenX+bW*0.6, sprY+sprH*0.25,bW*0.9,sprH*0.38);
    }
    // Jambes
    ctx.fillStyle=m.cfg.color;
    ctx.fillRect(screenX-bW*0.5,sprY+sprH*0.76,bW*0.44,sprH*0.24);
    ctx.fillRect(screenX+bW*0.06,sprY+sprH*0.76,bW*0.44,sprH*0.24);

    // Tête
    const hR=sprH*(m.type==='guardian'?0.18:0.13);
    ctx.beginPath(); ctx.arc(screenX,sprY+hR*1.1,hR,0,Math.PI*2); ctx.fill();

    // Yeux ou bouches
    if(m.type==='faceless'){
      // Pas de visage — juste du vide lisse
      ctx.fillStyle='rgba(200,200,220,0.15)';
      ctx.beginPath(); ctx.ellipse(screenX,sprY+hR*1.1,hR*0.9,hR*0.85,0,0,Math.PI*2); ctx.fill();
    } else if(m.type==='guardian'){
      // Multiples bouches
      ctx.fillStyle='rgba(200,60,60,0.8)'; ctx.shadowColor='#ff2020'; ctx.shadowBlur=4;
      for(let i=-1;i<=1;i++){
        ctx.beginPath();
        ctx.ellipse(screenX+i*hR*0.6,sprY+hR*(1.0+i*0.3),hR*0.35,hR*0.15,0,0,Math.PI*2);
        ctx.fill();
      }
      ctx.shadowBlur=0;
    } else {
      // Yeux rouges
      const ec='#cc1010';
      ctx.fillStyle=ec; ctx.shadowColor=ec; ctx.shadowBlur=dist<4?10:5;
      ctx.beginPath(); ctx.arc(screenX-hR*0.35,sprY+hR*0.95,hR*0.25,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(screenX+hR*0.35,sprY+hR*0.95,hR*0.25,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }

    // Brume si très proche
    if(dist<2.5){
      ctx.globalAlpha=(2.5-dist)/2.5*0.12;
      ctx.fillStyle=m.type==='guardian'?'#401a00':'#220022';
      ctx.beginPath(); ctx.arc(screenX,sprY+sprH*0.5,sprH*0.65,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // ============================================================
  // HUD
  // ============================================================
  _renderHUD() {
    const ctx=this.ctx, W=this.W, H=this.H;

    // Vignette permanente + battements
    const vig=ctx.createRadialGradient(W/2,H/2,H*0.18,W/2,H/2,H*0.88);
    vig.addColorStop(0,'rgba(0,0,0,0)');
    vig.addColorStop(1,`rgba(0,0,0,${0.65+this.effects.vignette*0.25})`);
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

    // Rouge bords si santé basse
    if(this.effects.heartbeat>0.05||this.player.health<50){
      const hb=Math.max(this.effects.heartbeat,(50-this.player.health)/100);
      const hr=ctx.createRadialGradient(W/2,H/2,H*0.28,W/2,H/2,H*0.92);
      hr.addColorStop(0,'rgba(0,0,0,0)');
      hr.addColorStop(1,`rgba(160,0,0,${hb*0.45})`);
      ctx.fillStyle=hr; ctx.fillRect(0,0,W,H);
    }

    // Grain film
    if(this.effects.noiseAlpha>0){
      ctx.globalAlpha=this.effects.noiseAlpha*0.10;
      for(let i=0;i<700;i++){
        ctx.fillStyle=Math.random()<0.5?'#fff':'#000';
        ctx.fillRect(Math.random()*W,Math.random()*H,1,1);
      }
      ctx.globalAlpha=1;
    }

    // Noir si batterie morte
    if(this.battery<=0){
      ctx.fillStyle='rgba(0,0,0,0.97)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle='rgba(180,20,20,0.55)';
      ctx.font='italic 13px serif'; ctx.textAlign='center';
      ctx.fillText('La lampe est morte. Cherche des piles.',W/2,H*0.58);
      ctx.textAlign='left';
    }

    // ——— Barre HUD bas ———
    const hY=H-30;
    ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(0,hY-4,W,34);

    // Santé
    ctx.fillStyle='#2a0000'; ctx.fillRect(10,hY+2,100,12);
    ctx.fillStyle=this.player.health>50?'#aa2020':'#ff3030';
    ctx.fillRect(10,hY+2,this.player.health,12);
    ctx.fillStyle='rgba(180,100,100,0.5)'; ctx.font='9px monospace';
    ctx.fillText('VIE',12,hY+12);

    // Batterie
    ctx.fillStyle='#001a00'; ctx.fillRect(120,hY+2,80,12);
    ctx.fillStyle=this.battery>30?'#208820':'#882020';
    ctx.fillRect(120,hY+2,this.battery*0.8,12);
    ctx.fillStyle='rgba(100,180,100,0.5)';
    ctx.fillText('PILE',122,hY+12);

    // Sanité
    ctx.fillStyle='#00001a'; ctx.fillRect(W-120,hY+2,100,12);
    ctx.fillStyle=`hsl(${220+this.sanity*0.6},60%,45%)`;
    ctx.fillRect(W-120,hY+2,this.sanity,12);
    ctx.fillStyle='rgba(100,100,200,0.5)';
    ctx.fillText('ESPRIT',W-118,hY+12);

    // Chapitre + nom
    ctx.fillStyle='rgba(160,140,100,0.55)';
    ctx.font='10px monospace'; ctx.textAlign='center';
    ctx.fillText(`Ch.${this.chapter} — ${this.mapData&&this.mapData.name||''}`,W/2,hY+12);
    ctx.textAlign='left';

    // Sons d'ambiance
    if(this._soundQueue.length>0){
      ctx.fillStyle='rgba(160,150,130,0.45)';
      ctx.font='italic 10px serif'; ctx.textAlign='center';
      ctx.fillText('\u266a '+this._soundQueue[0],W/2,H-38);
      ctx.textAlign='left';
    }

    // Prompt interaction
    const near=this._getNearObject();
    if(near){
      ctx.fillStyle='rgba(0,0,0,0.65)';
      ctx.fillRect(W*0.12,H*0.70,W*0.76,24);
      ctx.strokeStyle='rgba(180,160,100,0.4)'; ctx.lineWidth=1;
      ctx.strokeRect(W*0.12,H*0.70,W*0.76,24);
      ctx.fillStyle='rgba(220,200,150,0.9)';
      ctx.font='11px monospace'; ctx.textAlign='center';
      const preview=near.desc.split('\n')[0];
      ctx.fillText('[E]  '+preview.slice(0,58)+(preview.length>58?'…':''),W/2,H*0.70+16);
      ctx.textAlign='left';
    }

    // Crosshair
    ctx.strokeStyle='rgba(200,200,200,0.35)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(W/2-7,H/2); ctx.lineTo(W/2+7,H/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W/2,H/2-7); ctx.lineTo(W/2,H/2+7); ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2,H/2,3,0,Math.PI*2); ctx.stroke();

    // Narrative
    if(this._narrative) this._drawNarrative();

    // Minimap
    this._drawMinimap(ctx,W,H);

    // Notes collectées
    if(this.notes.length>0){
      ctx.fillStyle='rgba(200,180,100,0.55)';
      ctx.font='9px monospace';
      ctx.fillText('📋 '+this.notes.length+' note(s)',10,H-38);
    }
  }

  _drawNarrative() {
    const ctx=this.ctx, W=this.W, H=this.H;
    const lines=this._narrative.split('\n');
    const bH=Math.min(H*0.42, lines.length*22+40);
    const bY=H*0.08;
    ctx.fillStyle='rgba(0,0,0,0.82)';
    ctx.beginPath(); ctx.roundRect(W*0.06,bY,W*0.88,bH,6); ctx.fill();
    ctx.strokeStyle='rgba(160,140,80,0.4)'; ctx.lineWidth=1; ctx.stroke();
    // Ligne déco haut
    ctx.fillStyle='rgba(160,140,80,0.3)';
    ctx.fillRect(W*0.06+8,bY+1,W*0.88-16,1);
    ctx.fillStyle='rgba(220,200,155,0.92)';
    ctx.font='13px serif'; ctx.textAlign='center';
    lines.forEach((l,i)=>ctx.fillText(l,W/2,bY+28+i*21));
    // Indicateur de suite
    if(this._narrativeQueue.length>0){
      ctx.fillStyle='rgba(160,140,80,0.5)';
      ctx.font='9px monospace';
      ctx.fillText('[Espace / clic pour continuer]',W/2,bY+bH-8);
    }
    ctx.textAlign='left';
  }

  // ============================================================
  // MINIMAP
  // ============================================================
  _drawMinimap(ctx,W,H){
    const CELL=8, MROWS=this.MAP_H, MCOLS=this.MAP_W;
    const mW=MCOLS*CELL, mH=MROWS*CELL;
    const MX=W-mW-10, MY=H-mH-36;

    ctx.fillStyle='rgba(0,0,0,0.82)';
    ctx.beginPath(); ctx.roundRect(MX-4,MY-4,mW+8,mH+20,5); ctx.fill();
    ctx.strokeStyle='rgba(180,160,100,0.3)'; ctx.lineWidth=1; ctx.stroke();

    const isR=this.mapData&&this.mapData.isRed;
    for(let y=0;y<MROWS;y++){
      for(let x=0;x<MCOLS;x++){
        const cell=this.map[y]&&this.map[y][x];
        const px2=MX+x*CELL, py2=MY+y*CELL;
        if(cell===1){
          ctx.fillStyle=isR?'rgba(90,18,18,0.92)':'rgba(105,100,90,0.92)';
          ctx.fillRect(px2,py2,CELL,CELL);
          ctx.fillStyle='rgba(255,255,255,0.06)';
          ctx.fillRect(px2,py2,CELL,1); ctx.fillRect(px2,py2,1,CELL);
        } else {
          ctx.fillStyle='rgba(15,12,10,0.88)';
          ctx.fillRect(px2,py2,CELL,CELL);
        }
      }
    }

    // Sorties
    const exits=(this.mapData&&this.mapData.exits)||[];
    for(const exit of exits){
      const required=this.objects.filter(function(o){return o.required||o.type==='key'||o.type==='note';});
      const allDone=required.every(function(o){return this.collectedObjects.has(o.id||o.type+o.x);},this);
      const ex=MX+exit.x*CELL, ey=MY+exit.y*CELL;
      ctx.fillStyle=allDone?'rgba(255,220,50,0.9)':'rgba(70,60,15,0.6)';
      ctx.fillRect(ex,ey,CELL,CELL);
      ctx.fillStyle=allDone?'#fff':'#555';
      ctx.font=(CELL-1)+'px serif'; ctx.textAlign='center';
      ctx.fillText('\u2605',ex+CELL/2,ey+CELL-1); ctx.textAlign='left';
    }

    // Objets (toujours visibles)
    const oColors={note:'#f5d060',key:'#60d0ff',battery:'#60ff90',
      generator:'#ffa030',wallmsg:'#ff3030',well:'#9050ff',
      heart:'#ff1040',ending_tragic:'#cc2020',ending_good:'#20cc40',ending_secret:'#cc20cc'};
    const oLabels={note:'N',key:'K',battery:'B',generator:'G',wallmsg:'!',
      well:'O',heart:'\u2665',ending_tragic:'\u2620',ending_good:'\u2606',ending_secret:'\u2734'};
    for(const obj of this.objects){
      if(this.collectedObjects.has(obj.id||obj.type+obj.x)) continue;
      const ox=MX+obj.x*CELL, oy=MY+obj.y*CELL;
      ctx.fillStyle=oColors[obj.type]||'rgba(200,200,200,0.9)';
      ctx.beginPath(); ctx.arc(ox+CELL/2,oy+CELL/2,CELL*0.42,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#000'; ctx.font='bold '+(CELL-2)+'px monospace'; ctx.textAlign='center';
      ctx.fillText(oLabels[obj.type]||'?',ox+CELL/2,oy+CELL*0.76); ctx.textAlign='left';
    }

    // Monstres (toujours visibles)
    for(const m of this.monsters){
      if(m.dead) continue;
      const mx2=MX+m.x*CELL, my2=MY+m.y*CELL;
      const ch=m.state==='chase';
      const pulse=ch?(0.55+Math.sin(Date.now()*0.012)*0.45):0.65;
      ctx.fillStyle=ch?'rgba(255,25,25,'+pulse+')':'rgba(160,50,50,0.6)';
      ctx.beginPath(); ctx.arc(mx2,my2,ch?5:3.5,0,Math.PI*2); ctx.fill();
      if(ch){
        ctx.strokeStyle='rgba(255,60,60,0.85)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(mx2-5,my2-5); ctx.lineTo(mx2+5,my2+5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx2+5,my2-5); ctx.lineTo(mx2-5,my2+5); ctx.stroke();
      }
    }

    // Joueur + cône FOV
    const px2=MX+this.player.x*CELL, py2=MY+this.player.y*CELL;
    ctx.save(); ctx.globalAlpha=0.14;
    ctx.fillStyle='rgba(255,250,180,1)';
    ctx.beginPath(); ctx.moveTo(px2,py2);
    ctx.arc(px2,py2,CELL*3.5,this.player.angle-this.FOV/2,this.player.angle+this.FOV/2);
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.shadowColor='rgba(255,255,255,0.5)'; ctx.shadowBlur=4;
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(px2,py2,4,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(px2,py2);
    ctx.lineTo(px2+Math.cos(this.player.angle)*CELL,py2+Math.sin(this.player.angle)*CELL);
    ctx.stroke();

    ctx.fillStyle='rgba(130,115,75,0.5)'; ctx.font='7px monospace'; ctx.textAlign='center';
    ctx.fillText('N=note  K=cle  \u2665=coeur  rouge=monstre',MX+mW/2,MY+mH+14);
    ctx.textAlign='left';
  }

  // ============================================================
  // MISE À JOUR
  // ============================================================
  _update(dt) {
    if(this.gameState!=='playing') return;
    this._tick+=dt;
    const p=this.player;

    // Mouvement
    p.isRunning=this.keys['ShiftLeft']||this.keys['ShiftRight'];
    const spd=p.isRunning?p.speed*1.75:p.speed;

    if(this.keys['KeyW']){
      const nx=p.x+Math.cos(p.angle)*spd, ny=p.y+Math.sin(p.angle)*spd;
      if(!this._isWall(nx,p.y)) p.x=nx;
      if(!this._isWall(p.x,ny)) p.y=ny;
      if(p.isRunning) p.stamina=Math.max(0,p.stamina-dt*0.035);
    }
    if(this.keys['KeyS']){
      const nx=p.x-Math.cos(p.angle)*spd*0.6, ny=p.y-Math.sin(p.angle)*spd*0.6;
      if(!this._isWall(nx,p.y)) p.x=nx;
      if(!this._isWall(p.x,ny)) p.y=ny;
    }
    if(this.keys['KeyA']){
      const sa=p.angle-Math.PI/2;
      const nx=p.x+Math.cos(sa)*spd*0.8, ny=p.y+Math.sin(sa)*spd*0.8;
      if(!this._isWall(nx,p.y)) p.x=nx;
      if(!this._isWall(p.x,ny)) p.y=ny;
    }
    if(this.keys['KeyD']){
      const sa=p.angle+Math.PI/2;
      const nx=p.x+Math.cos(sa)*spd*0.8, ny=p.y+Math.sin(sa)*spd*0.8;
      if(!this._isWall(nx,p.y)) p.x=nx;
      if(!this._isWall(p.x,ny)) p.y=ny;
    }

    // Batterie
    this.battery=Math.max(0,this.battery-dt*0.0025);
    if(this.battery<=0){ this.effects.flicker=Math.random()<0.4?1:0; }
    else { this.effects.flicker=Math.max(0,this.effects.flicker-dt*0.12); }

    // Sons d'ambiance
    this._soundTimer-=dt;
    if(this._soundTimer<0){
      this._soundTimer=180+Math.random()*380;
      const pools = {
        1:['Rires d\'enfants','Pas dans la boue','Lumières aux fenêtres','Vent froid'],
        2:['Craquements de bois','Murmure derrière le mur','Quelque chose griffe la porte'],
        3:['Voix de Lucas... déformée','Ils murmurent tous en même temps','Brouillard qui avance'],
        4:['Voix du puits','Bougies qui s\'éteignent une par une','Gémissement lointain'],
        5:['Racines qui craquent','Voix de Clara parmi d\'autres','Respiration massive'],
        6:['Silence absolu','Pages qui se tournent seules','Quelque chose lit avec toi'],
        7:['Milliers de murmures','Quelqu\'un répète ton nom','Pleurs sans source'],
        8:['Battement du cœur','Entité qui observe','Dernier choix...'],
      };
      const sounds=pools[this.chapter]||pools[1];
      if(this._soundQueue.length<2) this._soundQueue.push(sounds[Math.floor(Math.random()*sounds.length)]);
      if(this._soundQueue.length>2) this._soundQueue.shift();
    }

    // Monstres
    for(const m of this.monsters){
      if(m.dead) continue;
      const dx=p.x-m.x, dy=p.y-m.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const chaseRange=m.cfg.sight*(p.isRunning?1.4:1);

      if(dist<chaseRange){
        m.state='chase';
        const spd2=m.cfg.speed*0.42*dt*0.06*60;
        const a=Math.atan2(dy,dx);
        const nx=m.x+Math.cos(a)*spd2, ny=m.y+Math.sin(a)*spd2;
        if(!this._isWall(nx,m.y)) m.x=nx;
        if(!this._isWall(m.x,ny)) m.y=ny;
        if(dist<0.65){
          p.health-=dt*0.06*60*0.10;
          this.effects.heartbeat=1;
          this.effects.shakeTimer=8;
          this.sanity=Math.max(0,this.sanity-dt*0.015*60);
        }
      } else {
        m.state='wander';
        m.wanderTimer-=dt;
        if(m.wanderTimer<0){ m.wanderTimer=50+Math.random()*110; m.angle=Math.random()*Math.PI*2; }
        const spd3=m.cfg.speed*0.20*dt*0.06*60;
        const nx=m.x+Math.cos(m.angle)*spd3, ny=m.y+Math.sin(m.angle)*spd3;
        if(!this._isWall(nx,m.y)) m.x=nx; else m.angle+=Math.PI*0.5+Math.random()*0.5;
        if(!this._isWall(m.x,ny)) m.y=ny; else m.angle+=Math.PI*0.5+Math.random()*0.5;
      }
    }

    // Effets folie
    if(this.mapData&&this.mapData.isMadness){
      this.effects.noiseAlpha=Math.min(0.8,(100-this.sanity)/100);
      this.effects.vignette=0.4+(100-this.sanity)*0.004;
    }

    // Shake
    if(this.effects.shakeTimer>0){
      this.effects.shakeTimer-=dt;
      this.effects.shake={x:(Math.random()-0.5)*5,y:(Math.random()-0.5)*3};
    } else { this.effects.shake={x:0,y:0}; }

    this.effects.heartbeat=Math.max(0,this.effects.heartbeat-dt*0.007*60);
    if(!p.isRunning) p.stamina=Math.min(100,p.stamina+dt*0.022*60);

    if(p.health<=0) this._triggerEnding('dead');

    // Sortie
    for(const exit of (this.mapData&&this.mapData.exits||[])){
      const dx=p.x-exit.x, dy=p.y-exit.y;
      if(Math.sqrt(dx*dx+dy*dy)<1.1){
        const req=this.objects.filter(function(o){return o.required||o.type==='key'||o.type==='note';});
        const done=req.every(function(o){return this.collectedObjects.has(o.id||o.type+o.x);},this);
        if(done||req.length===0){
          if(!this._exitTimer){
            this._exitTimer=90;
            this._queueNarrative(['...']);
          }
        } else {
          const rem=req.filter(function(o){return !this.collectedObjects.has(o.id||o.type+o.x);},this).length;
          this._showNarrative('La sortie est bloquée.\n'+rem+' élément(s) à trouver.',2200);
        }
      }
    }
    if(this._exitTimer>0){
      this._exitTimer--;
      this._fadeAlpha=(this._fadeAlpha||0)+0.011;
      if(this._exitTimer<=0){
        this._exitTimer=0; this._fadeAlpha=0;
        const ex=this.mapData&&this.mapData.exits&&this.mapData.exits[0];
        if(ex) this._loadChapter(ex.toChapter);
      }
    }

    // Narrative timer
    if(this._narrativeTimer>0){
      this._narrativeTimer-=dt;
      if(this._narrativeTimer<=0) this._nextNarrative();
    }
  }

  // ============================================================
  // INTERACTIONS
  // ============================================================
  _getNearObject(){
    for(const obj of this.objects){
      if(this.collectedObjects.has(obj.id||obj.type+obj.x)) continue;
      const dx=this.player.x-obj.x, dy=this.player.y-obj.y;
      if(Math.sqrt(dx*dx+dy*dy)<0.95) return obj;
    }
    return null;
  }

  _interact(){
    // D'abord avancer la narrative si active
    if(this._narrative&&this._narrativeQueue.length>0){
      this._nextNarrative(); return;
    }
    if(this._narrative){ this._narrative=null; return; }

    const obj=this._getNearObject();
    if(!obj) return;
    const id=obj.id||obj.type+obj.x;

    if(obj.type==='note'){
      if(obj.secret) this._secretDocs++;
      this.notes.push(obj.desc);
      this._showNarrative(obj.desc,5000);
      this.collectedObjects.add(id);
    } else if(obj.type==='key'){
      this.inventory.push(id);
      this._showNarrative('Clé récupérée.\n'+obj.desc,2500);
      this.collectedObjects.add(id);
    } else if(obj.type==='battery'){
      this.battery=Math.min(100,this.battery+45);
      this._showNarrative('Piles récupérées. La lampe brille à nouveau.',1800);
      this.collectedObjects.add(id);
    } else if(obj.type==='wallmsg'){
      this._showNarrative(obj.desc,2800);
      this.sanity=Math.max(0,this.sanity-10);
      this.effects.heartbeat=0.9; this.effects.shakeTimer=12;
    } else if(obj.type==='generator'){
      this._showNarrative('Générateur réparé.\nL\'électricité revient.',2200);
      this.collectedObjects.add(id);
    } else if(obj.type==='well'){
      this._showNarrative(obj.desc,4500);
      this.collectedObjects.add(id);
      this.sanity=Math.max(0,this.sanity-15);
    } else if(obj.type==='heart'){
      this.collectedObjects.add(id);
      this._showNarrative(obj.desc,5000);
    } else if(obj.type==='ending_tragic'){
      this._triggerEnding('tragic');
    } else if(obj.type==='ending_good'){
      this._triggerEnding('good');
    } else if(obj.type==='ending_secret'){
      if(this._secretDocs>=4) this._triggerEnding('secret');
      else this._showNarrative('Il manque encore des documents secrets.\n('+this._secretDocs+'/4 trouvés)\n\nCherche mieux dans chaque chapitre.',3500);
    }
  }

  // ============================================================
  // FINS
  // ============================================================
  _triggerEnding(type){
    this.gameState='ending'; this.endingType=type;
    const E={
      tragic:{
        title:'FIN TRAGIQUE',color:'#660000',
        lines:[
          'Thomas accepte l\'illusion.',
          'Il prend la main de Lucas.',
          'Il sourit à Clara.',
          '"Nous sommes enfin réunis."',
          '',
          'La caméra s\'éloigne lentement.',
          'Thomas est devenu une nouvelle âme',
          'prisonnière du puits des oubliés.',
          '',
          'Il revivre ce moment pour l\'éternité.',
        ],
      },
      good:{
        title:'FIN LIBÉRATRICE',color:'#003300',
        lines:[
          'Thomas détruit le cœur.',
          'L\'entité hurle.',
          '',
          'La cité s\'effondre.',
          'Les âmes prisonnières depuis des décennies',
          'sont enfin libérées.',
          '',
          'Clara et Lucas apparaissent une dernière fois.',
          'Ils sourient.',
          'Puis disparaissent.',
          '',
          'Thomas remonte à la surface.',
          'Le soleil se lève sur Blackwood.',
          '',
          'Pour la première fois depuis cinq ans :',
          'le silence.',
        ],
      },
      secret:{
        title:'FIN SECRÈTE',color:'#220044',
        lines:[
          'Thomas comprend.',
          'L\'entité n\'était pas seule.',
          '',
          'Sous les ruines de Blackwood,',
          'une deuxième cavité.',
          'Encore plus profonde.',
          '',
          'Thomas ferme la porte.',
          'Pour toujours.',
          '',
          'Ecran noir.',
          '',
          '"Nous avons entendu ton appel."',
          '',
          '... quelque chose ouvre les yeux.',
        ],
      },
      dead:{
        title:'GAME OVER',color:'#330000',
        lines:[
          'Thomas n\'a pas survécu.',
          '',
          'Blackwood réclame une âme de plus.',
          '',
          '"Il nous appartient maintenant."',
        ],
      },
    };
    const end=E[type]||E.dead;
    const ctx=this.ctx, W=this.W, H=this.H;
    let alpha=0;
    const showEnding=()=>{
      ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=end.color;
      ctx.font='bold 30px serif'; ctx.textAlign='center';
      ctx.fillText(end.title,W/2,H*0.14);
      ctx.fillStyle='rgba(210,190,150,0.90)';
      ctx.font='14px serif';
      end.lines.forEach(function(l,i){ ctx.fillText(l,W/2,H*0.28+i*22); });
      ctx.fillStyle='rgba(140,120,80,0.55)';
      ctx.font='11px monospace';
      ctx.fillText('[R] Retour au menu',W/2,H*0.90);
      ctx.textAlign='left';
    };
    const fade=()=>{
      alpha+=0.018;
      ctx.fillStyle='rgba(0,0,0,'+alpha+')';
      ctx.fillRect(0,0,W,H);
      if(alpha<1){ requestAnimationFrame(fade); }
      else { showEnding(); }
    };
    requestAnimationFrame(fade);
  }

  // ============================================================
  // NARRATION
  // ============================================================
  _queueNarrative(lines){
    this._narrativeQueue=lines.slice(1);
    this._showNarrative(lines[0], lines.length>1?99999:3500);
  }

  _nextNarrative(){
    if(this._narrativeQueue.length>0){
      const next=this._narrativeQueue.shift();
      this._showNarrative(next, this._narrativeQueue.length>0?99999:3500);
    } else {
      this._narrative=null;
    }
  }

  _showNarrative(text,duration){
    this._narrative=text;
    this._narrativeTimer=duration/16.67;
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================
  _isWall(x,y){
    const mx=Math.floor(x), my=Math.floor(y);
    if(mx<0||mx>=this.MAP_W||my<0||my>=this.MAP_H) return true;
    return this.map[my]&&this.map[my][mx]===1;
  }

  // ============================================================
  // BOUCLE
  // ============================================================
  _loop(timestamp){
    if(this.gameState==='ending') return;
    requestAnimationFrame(this._loop.bind(this));
    const dt=Math.min((timestamp-this._lastTime)/16.67,4);
    this._lastTime=timestamp;
    this._update(dt);
    this._render3D();
    this._renderSprites();
    this._renderHUD();
  }

  // ============================================================
  // UI & INPUTS
  // ============================================================
  _buildUI(){
    document.getElementById('topbar')&&document.getElementById('topbar').style.setProperty('display','none');
    document.getElementById('app-layout')&&document.getElementById('app-layout').style.setProperty('display','none');
    document.getElementById('bottom-panel')&&document.getElementById('bottom-panel').style.setProperty('display','none');

    const canvas=document.createElement('canvas');
    canvas.id='horror-canvas';
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    canvas.style.cssText='position:fixed;top:0;left:0;background:#000;z-index:500;cursor:none;';
    document.body.appendChild(canvas);

    const btn=document.createElement('button');
    btn.textContent='\u2715 Menu';
    btn.style.cssText='position:fixed;top:10px;right:10px;z-index:600;background:rgba(0,0,0,0.7);color:#666;border:1px solid #2a2a2a;padding:5px 12px;font-family:monospace;font-size:11px;cursor:pointer;border-radius:3px;';
    btn.addEventListener('click',function(){ this._quit(); }.bind(this));
    document.body.appendChild(btn);
    this._backBtn=btn;

    const hint=document.createElement('div');
    hint.style.cssText='position:fixed;bottom:38px;left:50%;transform:translateX(-50%);color:rgba(160,140,90,0.45);font:10px monospace;z-index:600;pointer-events:none;transition:opacity 1s;';
    hint.textContent='W/S=Avancer/Reculer  A/D=Latéral  Souris=Regarder  E=Interagir  Shift=Courir';
    document.body.appendChild(hint);
    this._hintEl=hint;
    setTimeout(function(){ hint.style.opacity='0'; },6000);

    const lockHint=document.createElement('div');
    lockHint.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);border:1px solid rgba(160,140,80,0.35);color:rgba(200,180,130,0.9);font:14px serif;padding:18px 30px;border-radius:6px;z-index:610;text-align:center;pointer-events:none;transition:opacity 0.5s;';
    lockHint.innerHTML='&#128270; <b>Clique</b> pour capturer la souris<br><span style="font-size:11px;opacity:0.6">\'Éch\' pour libérer  ·  E = interagir  ·  Espace = passer le texte</span>';
    document.body.appendChild(lockHint);
    this._lockHint=lockHint;
    setTimeout(function(){ if(lockHint.style.opacity!=='0') lockHint.style.opacity='0.25'; },7000);

    window.addEventListener('resize',function(){
      canvas.width=window.innerWidth; canvas.height=window.innerHeight;
      this.W=canvas.width; this.H=canvas.height;
    }.bind(this));
  }

  _bindInputs(){
    var self=this;
    window.addEventListener('keydown',function(e){
      self.keys[e.code]=true;
      if(e.code==='KeyE') self._interact();
      if(e.code==='Space'){ self._interact(); e.preventDefault(); }
      if(e.code==='KeyR'&&self.gameState==='ending') self._quit();
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup',function(e){ self.keys[e.code]=false; });

    var canvas=document.getElementById('horror-canvas');
    canvas&&canvas.addEventListener('click',function(){
      if(self.gameState==='playing') canvas.requestPointerLock&&canvas.requestPointerLock();
    });
    document.addEventListener('mousemove',function(e){
      if(document.pointerLockElement!==canvas) return;
      if(self.gameState!=='playing') return;
      self.player.angle+=e.movementX*self._mouseSensitivity;
    });
    document.addEventListener('pointerlockchange',function(){
      var locked=document.pointerLockElement===canvas;
      if(self._lockHint) self._lockHint.style.opacity=locked?'0':'0.25';
    });
    canvas&&canvas.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  }

  _quit(){
    document.getElementById('horror-canvas')&&document.getElementById('horror-canvas').remove();
    this._backBtn&&this._backBtn.remove();
    this._hintEl&&this._hintEl.remove();
    this._lockHint&&this._lockHint.remove();
    document.getElementById('topbar')&&document.getElementById('topbar').style.removeProperty('display');
    document.getElementById('app-layout')&&document.getElementById('app-layout').style.removeProperty('display');
    document.getElementById('bottom-panel')&&document.getElementById('bottom-panel').style.removeProperty('display');
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
