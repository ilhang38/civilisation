// ============================================================
// main.js — Point d'entrée : orchestrateur de la simulation
// ============================================================

import { World, TILE_SIZE }      from './world.js';
import { PlantManager }          from './plants.js';
import { AnimalManager }         from './animals.js';
import { Settlement }            from './city.js';
import { UI }                    from './ui.js';
import { GraphManager }          from './graphs.js';
import { SaveManager }           from './save.js';

// ——— Configuration ——————————————————————————————————
const CONFIG = {
  WORLD_COLS:    180,
  WORLD_ROWS:    120,
  MAX_PLANTS:    1200,
  MAX_ANIMALS:   400,
  INITIAL_CAMPS: 3,
  TARGET_FPS:    30,
};

// ——— Classe principale ——————————————————————————————
class CivilSim {
  constructor() {
    // Canvas & ctx
    this.canvas = document.getElementById('main-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resizeCanvas();

    // État
    this.running  = false;
    this.speed    = 1;
    this.tick     = 0;

    // Caméra
    this.camera = { x:0, y:0, targetX:0, targetY:0 };
    this._drag  = { active:false, startX:0, startY:0, camStartX:0, camStartY:0 };

    // Modules (initialisés dans init())
    this.world    = null;
    this.plantMgr = null;
    this.animalMgr= null;
    this.settlements = [];
    this.ui       = null;
    this.graphs   = null;
    this.saveMgr  = null;

    // Debug
    this._fps        = 0;
    this._fpsTimer   = 0;
    this._fpsCounter = 0;
    this._lastTime   = 0;
    this._graphTimer = 0;

    // Date monde
    this._worldDay  = 1;
    this._worldYear = 1;
    this._dayTimer  = 0;

    // Initialiser
    this._init();
  }

  // ——— Initialisation ——————————————————————————————
  _init() {
    console.log('[CivilSim] Initialisation...');

    const seed = Math.floor(Math.random() * 999999);
    this.world     = new World(CONFIG.WORLD_COLS, CONFIG.WORLD_ROWS, seed);
    this.plantMgr  = new PlantManager(this.world, CONFIG.MAX_PLANTS);
    this.animalMgr = new AnimalManager(this.world, CONFIG.MAX_ANIMALS);

    // Créer colonies initiales
    this.settlements = [];
    this._createInitialSettlements(CONFIG.INITIAL_CAMPS);

    // Modules UI
    this.ui      = new UI(this);
    this.graphs  = new GraphManager();
    this.saveMgr = new SaveManager(this);

    // Centre caméra sur milieu du monde
    const midX = (this.world.cols * TILE_SIZE) / 2;
    const midY = (this.world.rows * TILE_SIZE) / 2;
    this.camera.x = midX - this.canvas.width  / 2;
    this.camera.y = midY - this.canvas.height / 2;
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;

    // Événements
    this._bindEvents();
    this._bindControls();

    console.log(`[CivilSim] Monde généré — tuiles:${this.world.cols}×${this.world.rows} | plantes:${this.plantMgr.plants.length} | animaux:${this.animalMgr.animals.length} | colonies:${this.settlements.length}`);

    // Démarrer
    this.running = true;
    this._lastTime = performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  _createInitialSettlements(count) {
    const midX = (this.world.cols * TILE_SIZE) / 2;
    const midY = (this.world.rows * TILE_SIZE) / 2;
    const angles = [0, 2.1, 4.2];

    for (let i = 0; i < count; i++) {
      const angle = angles[i] || Math.random() * Math.PI * 2;
      const dist  = 100 + Math.random() * 150;
      const nx    = midX + Math.cos(angle) * dist;
      const ny    = midY + Math.sin(angle) * dist;

      // Vérifier tuile buildable
      const tile = this.world.findBuildSpot(nx, ny, 25);
      if (!tile) { i--; continue; }

      const sx = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const sy = tile.y * TILE_SIZE + TILE_SIZE / 2;
      const s  = new Settlement(sx, sy, this.world);
      this.settlements.push(s);
    }
  }

  // ——— Boucle principale ————————————————————————————
  _loop(timestamp) {
    requestAnimationFrame(this._loop.bind(this));

    const rawDt = Math.min((timestamp - this._lastTime) / (1000 / 60), 5);
    this._lastTime = timestamp;

    // FPS
    this._fpsCounter++;
    this._fpsTimer += rawDt;
    if (this._fpsTimer >= 60) {
      this._fps = Math.round(this._fpsCounter * 60 / this._fpsTimer);
      this._fpsCounter = 0;
      this._fpsTimer   = 0;
    }

    // Caméra fluide
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.15;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.15;

    if (this.running) {
      const dt = rawDt * this.speed;
      this._update(dt);
    }

    this._render(timestamp);
  }

  // ——— Mise à jour ——————————————————————————————————
  _update(dt) {
    // dtBio = dt biologique plafonné : la vitesse x8 accélère les actions
    // mais PAS les besoins vitaux (faim/soif) pour éviter la mort instantanée
    // Max biologique équivalent à x2 réel pour rester vivable
    const dtBio = Math.min(dt, 2.0);
    this.tick += dt;

    // Temps monde
    this._dayTimer += dt;
    if (this._dayTimer > 200) {
      this._dayTimer = 0;
      this._worldDay++;
      if (this._worldDay > 365) { this._worldDay = 1; this._worldYear++; }
      this.ui?.updateDate(this._worldYear, this._worldDay);
    }

    // Monde
    this.world.update(dtBio);

    // Plantes
    this.plantMgr.update(dtBio);

    // Animaux
    this.animalMgr.update(dtBio, this.plantMgr);

    // Colonies
    const newSettlements = [];
    for (const s of this.settlements) {
      const child = s.update(dtBio, this.plantMgr, this.animalMgr, this.settlements);
      if (child) newSettlements.push(child);
    }
    for (const ns of newSettlements) this.settlements.push(ns);

    // UI
    this.ui?.update(dt);

    // Graphiques (moins fréquent)
    this._graphTimer += dt;
    if (this._graphTimer > 60) {
      this._graphTimer = 0;
      const totalPop = this.settlements.reduce((s, c) => s + c.humans.length, 0);
      const totalFood = this.settlements.reduce((s, c) => s + (c.stockpile.food || 0), 0);
      const totalRes  = this.settlements.reduce((s, c) => s + (c.stockpile.wood || 0) + (c.stockpile.stone || 0) + (c.stockpile.ore || 0), 0);
      this.graphs?.push({
        population: totalPop,
        food:       totalFood,
        animals:    this.animalMgr.animals.length,
        cities:     this.settlements.length,
        resources:  totalRes,
      });
      this.graphs?.draw();
    }

    // Auto-save
    this.saveMgr?.update(dt);

    // Entité count
    const entities = this.plantMgr.plants.length + this.animalMgr.animals.length +
      this.settlements.reduce((s, c) => s + c.humans.length, 0);
    this.ui?.updateFPS(this._fps, entities);
  }

  // ——— Rendu ————————————————————————————————————————
  _render(timestamp = 0) {
    const ctx  = this.ctx;
    const camX = Math.round(this.camera.x);
    const camY = Math.round(this.camera.y);
    const W    = this.canvas.width;
    const H    = this.canvas.height;

    // Effacer
    ctx.clearRect(0, 0, W, H);

    // 1. Carte du monde
    this.world.draw(ctx, camX, camY, W, H, timestamp);

    // 2. Plantes
    this.plantMgr.draw(ctx, camX, camY, W, H, timestamp);

    // 3. Animaux
    this.animalMgr.draw(ctx, camX, camY, W, H);

    // 4. Colonies (bâtiments + humains + icônes)
    for (const s of this.settlements) {
      const sx = s.x - camX, sy = s.y - camY;
      if (sx < -200 || sx > W + 200 || sy < -200 || sy > H + 200) continue;
      s.draw(ctx, camX, camY);
    }
  }

  // ——— Événements ——————————————————————————————————
  _bindEvents() {
    const canvas = this.canvas;

    // Drag pour naviguer
    canvas.addEventListener('mousedown', (e) => {
      this._drag.active    = true;
      this._drag.startX    = e.clientX;
      this._drag.startY    = e.clientY;
      this._drag.camStartX = this.camera.targetX;
      this._drag.camStartY = this.camera.targetY;
    });
    window.addEventListener('mousemove', (e) => {
      if (this._drag.active) {
        const dx = e.clientX - this._drag.startX;
        const dy = e.clientY - this._drag.startY;
        this.camera.targetX = this._drag.camStartX - dx;
        this.camera.targetY = this._drag.camStartY - dy;
        this._clampCamera();
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (!this._drag.active) return;
      const totalDist = Math.hypot(e.clientX - this._drag.startX, e.clientY - this._drag.startY);
      this._drag.active = false;
      if (totalDist < 5) this._handleClick(e);
    });

    // Scroll pour zoom (simple redirection caméra)
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 40 : -40;
      this.camera.targetX = Math.max(0, this.camera.targetX + factor * (e.deltaY > 0 ? 1 : -1));
    }, { passive:false });

    // Resize
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const wx   = mx + this.camera.x;
    const wy   = my + this.camera.y;

    // Chercher entité cliquée
    let found = null;

    // Colonies
    for (const s of this.settlements) {
      if (Math.hypot(wx - s.x, wy - s.y) < 15) {
        found = { type:'city', obj:s };
        break;
      }
      // Humains
      for (const h of s.humans) {
        if (Math.hypot(wx - h.x, wy - h.y) < 8) {
          found = { type:'human', obj:h };
          break;
        }
      }
      if (found) break;
    }

    // Animaux
    if (!found) {
      for (const a of this.animalMgr.animals) {
        if (Math.hypot(wx - a.x, wy - a.y) < 10) {
          found = { type:'animal', obj:a };
          break;
        }
      }
    }

    if (found) {
      this.ui?.selectObject(found);
    } else {
      this.ui?.clearSelection();
    }
  }

  _clampCamera() {
    const maxX = this.world.cols * TILE_SIZE - this.canvas.width;
    const maxY = this.world.rows * TILE_SIZE - this.canvas.height;
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

  // ——— Contrôles speed/pause ————————————————————————
  _bindControls() {
    const setActive = (id) => {
      ['btn-pause','btn-play','btn-x2','btn-x4','btn-x8'].forEach(b => {
        document.getElementById(b)?.classList.remove('active');
      });
      document.getElementById(id)?.classList.add('active');
    };

    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.running = false;
      setActive('btn-pause');
    });
    document.getElementById('btn-play')?.addEventListener('click', () => {
      this.running = true; this.speed = 1;
      setActive('btn-play');
    });
    document.getElementById('btn-x2')?.addEventListener('click', () => {
      this.running = true; this.speed = 2;
      setActive('btn-x2');
    });
    document.getElementById('btn-x4')?.addEventListener('click', () => {
      this.running = true; this.speed = 4;
      setActive('btn-x4');
    });
    document.getElementById('btn-x8')?.addEventListener('click', () => {
      this.running = true; this.speed = 8;
      setActive('btn-x8');
    });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('Réinitialiser le monde ? Toute progression sera perdue.')) {
        localStorage.removeItem('civilsim_v1');
        location.reload();
      }
    });
  }

  // ——— Réinitialisation depuis sauvegarde ——————————
  resetFromSave(data) {
    console.log('[CivilSim] Chargement depuis sauvegarde...');
    // Pour l'instant : recréer le monde avec même seed
    // (reconstruction complète optionnelle pour V2)
    location.reload();
  }
}

// ——— Point d'entrée ———————————————————————————————
window.addEventListener('DOMContentLoaded', () => {
  console.log('[CivilSim] DOM prêt — démarrage simulation');
  try {
    window.sim = new CivilSim();
  } catch(err) {
    console.error('[CivilSim] ERREUR FATALE :', err);
    document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">
      <h2>Erreur CivilSim</h2><pre>${err.stack}</pre>
    </div>`;
  }
});
