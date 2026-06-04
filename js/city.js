// ============================================================
// city.js — Colonies, villes et leur évolution
// ============================================================

import { Human, JOB } from './human.js';
import { TechTree, TECH_CONFIG } from './technology.js';
import { TILE_SIZE } from './world.js';

// ——— Niveaux de civilisation ——————————————————————————
export const CITY_LEVEL = {
  CAMP:       { name:'Camp',        icon:'⛺', minPop:1,   color:'#c8a040' },
  VILLAGE:    { name:'Village',     icon:'🏘', minPop:10,  color:'#80c060' },
  TOWN:       { name:'Ville',       icon:'🏙', minPop:30,  color:'#4090d0' },
  CITY:       { name:'Grande Ville',icon:'🌆', minPop:80,  color:'#c060d0' },
  METROPOLIS: { name:'Métropole',   icon:'🌇', minPop:200, color:'#f07030' },
};

const LEVEL_ORDER = ['CAMP','VILLAGE','TOWN','CITY','METROPOLIS'];

// ——— Bâtiments ——————————————————————————————————————
export const BUILDING_TYPE = {
  HOUSE:    { name:'Maison',    icon:'🏠', cost:{wood:15,stone:5},  pop:+4,  produces:{ },            requires:'CAMP'    },
  FARM:     { name:'Ferme',     icon:'🌾', cost:{wood:10,stone:0},  pop:0,   produces:{food:8},       requires:'CAMP'    },
  MILL:     { name:'Moulin',    icon:'⚙', cost:{wood:20,stone:10}, pop:0,   produces:{food:4,wood:2},requires:'VILLAGE' },
  SAWMILL:  { name:'Scierie',   icon:'🪚', cost:{wood:5, stone:15}, pop:0,   produces:{wood:12},      requires:'VILLAGE' },
  QUARRY:   { name:'Carrière',  icon:'🗿', cost:{wood:5, stone:5},  pop:0,   produces:{stone:10},     requires:'CAMP'    },
  MINE:     { name:'Mine',      icon:'⛏', cost:{wood:20,stone:10}, pop:0,   produces:{ore:8,stone:4},requires:'VILLAGE' },
  WORKSHOP: { name:'Atelier',   icon:'🔨', cost:{wood:15,stone:10}, pop:0,   produces:{gold:3},       requires:'TOWN'    },
  MARKET:   { name:'Marché',    icon:'🏪', cost:{wood:20,stone:20}, pop:0,   produces:{gold:6},       requires:'TOWN'    },
  BARRACKS: { name:'Caserne',   icon:'⚔', cost:{wood:10,stone:25}, pop:0,   produces:{ },            requires:'VILLAGE' },
  WALL:     { name:'Muraille',  icon:'🧱', cost:{wood:5, stone:40}, pop:0,   produces:{ },            requires:'VILLAGE' },
};

let _nextSettlementId = 0;

const CITY_NAMES = ['Avalon','Brest','Calais','Dorin','Embor','Favre','Greva','Helsin',
                    'Irone','Jarven','Kelmar','Lavon','Morvin','Norden','Ostmar','Polhaven',
                    'Querac','Runvik','Sunmar','Torveld','Ulborg','Vardal','Welmore'];

export class Settlement {
  constructor(x, y, world, founder = null) {
    this.id    = _nextSettlementId++;
    this.x     = x;
    this.y     = y;
    this.world = world;

    this.name  = CITY_NAMES[this.id % CITY_NAMES.length] + (this.id >= CITY_NAMES.length ? ` ${Math.floor(this.id / CITY_NAMES.length) + 1}` : '');
    this.level = 'CAMP';
    this.age   = 0;

    // Population
    this.humans = [];
    this.maxPop = 5;
    this.popGrowthTimer = 0;

    // Économie
    this.stockpile = { food:50, wood:30, stone:20, ore:5, gold:0 };
    this.buildings = [];
    this._buildProgress = 0;
    this._buildQueue    = [];
    this._buildTimer    = 0;

    // Technologie
    this.tech = new TechTree();
    this.knowledge = 0;

    // Expansion
    this.expansionTimer = 500 + Math.random() * 500;

    // Ajouter fondateur
    if (founder) {
      founder.settlement = this;
      founder.homeX = x; founder.homeY = y;
      this.humans.push(founder);
    }

    // Spawn 3 humains initiaux
    for (let i = 0; i < 3; i++) this._spawnHuman();
  }

  // ——— Update ——————————————————————————————————————————
  update(dt, plantMgr, animalMgr, allSettlements) {
    this.age += dt;

    // Update humains
    for (let i = this.humans.length - 1; i >= 0; i--) {
      const h = this.humans[i];
      h.update(dt, plantMgr, animalMgr);
      if (!h.alive) this.humans.splice(i, 1);
    }

    // Consommation nourriture
    const consumption = this.humans.length * 0.02 * dt;
    this.stockpile.food -= consumption;
    if (this.stockpile.food < 0) {
      this.stockpile.food = 0;
      // Famine : tuer humain aléatoire
      if (Math.random() < 0.0005 * dt && this.humans.length > 1) {
        this.humans.splice(Math.floor(Math.random() * this.humans.length), 1);
      }
    }

    // Production des bâtiments
    this._runBuildings(dt);

    // Croissance population
    this._growPopulation(dt);

    // Assigner métiers
    this._assignJobs();

    // Construction automatique
    this._autoBuild(dt);

    // Recherche technologique
    this.knowledge += dt * 0.1 * (1 + this.humans.length * 0.01);
    this.tech.autoResearch();
    this.tech.update(dt, 0.05 * (1 + this.humans.length * 0.01));

    // Évolution de niveau
    this._evolveLevel();

    // Expansion : créer nouvelle colonie
    this.expansionTimer -= dt;
    if (this.expansionTimer < 0 && this.humans.length >= 20 && this.stockpile.food > 200) {
      this.expansionTimer = 800 + Math.random() * 600;
      return this._tryExpand(allSettlements);
    }
    return null;
  }

  _runBuildings(dt) {
    const s = this.tech.stats;
    for (const b of this.buildings) {
      if (b.type === 'HOUSE') continue;
      const prod = BUILDING_TYPE[b.type]?.produces || {};
      for (const [res, amt] of Object.entries(prod)) {
        let mult = 1.0;
        if (res === 'food')  mult = s.foodMult  || 1;
        if (res === 'wood')  mult = (s.gatherMult || 1);
        if (res === 'stone') mult = (s.stoneMult || 1);
        this.stockpile[res] = (this.stockpile[res] || 0) + amt * dt * 0.01 * mult;
      }
    }
    // Limites
    for (const k of Object.keys(this.stockpile)) {
      this.stockpile[k] = Math.max(0, Math.min(9999, this.stockpile[k]));
    }
  }

  _growPopulation(dt) {
    this.popGrowthTimer += dt;
    if (this.popGrowthTimer < 200) return;
    this.popGrowthTimer = 0;

    const s = this.tech.stats;
    const growthRate = (s.popGrowth || 1.0);
    const houseCount = this.buildings.filter(b => b.type === 'HOUSE').length;
    this.maxPop = 5 + houseCount * 4;

    if (this.humans.length < this.maxPop && this.stockpile.food > 50 * growthRate) {
      if (Math.random() < 0.4 * growthRate) {
        this._spawnHuman();
      }
    }
  }

  _spawnHuman() {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 5 + Math.random() * 20;
    const nx    = this.x + Math.cos(angle) * dist;
    const ny    = this.y + Math.sin(angle) * dist;
    const h     = new Human(nx, ny, this, this.world);
    this.humans.push(h);
  }

  _assignJobs() {
    const pop = this.humans.length;
    if (pop === 0) return;
    // Distribution selon taille
    const jobs = [];
    const farmers   = Math.max(1, Math.floor(pop * 0.35));
    const hunters   = Math.max(1, Math.floor(pop * 0.20));
    const lumberers = Math.max(1, Math.floor(pop * 0.15));
    const miners    = Math.max(1, Math.floor(pop * 0.10));
    const builders  = Math.max(1, Math.floor(pop * 0.10));
    const soldiers  = Math.floor(pop * 0.05);
    const artisans  = pop - farmers - hunters - lumberers - miners - builders - soldiers;

    for (let i = 0; i < farmers;   i++) jobs.push(JOB.FARMER);
    for (let i = 0; i < hunters;   i++) jobs.push(JOB.HUNTER);
    for (let i = 0; i < lumberers; i++) jobs.push(JOB.LUMBERER);
    for (let i = 0; i < miners;    i++) jobs.push(JOB.MINER);
    for (let i = 0; i < builders;  i++) jobs.push(JOB.BUILDER);
    for (let i = 0; i < soldiers;  i++) jobs.push(JOB.SOLDIER);
    for (let i = 0; i < artisans;  i++) jobs.push(JOB.ARTISAN);

    for (let i = 0; i < this.humans.length; i++) {
      this.humans[i].job = jobs[i] || JOB.IDLE;
    }
  }

  _autoBuild(dt) {
    this._buildTimer -= dt;
    if (this._buildTimer > 0) return;
    this._buildTimer = 100 + Math.random() * 100;

    // Décider quoi construire
    const s = this.stockpile;
    const lvl = this.level;

    // Maison si besoin
    if (this.humans.length >= this.maxPop - 1 && s.wood >= 15 && s.stone >= 5) {
      this._buildBuilding('HOUSE');
      return;
    }
    // Ferme si manque nourriture
    if (s.food < 100 && s.wood >= 10) {
      this._buildBuilding('FARM');
      return;
    }
    // Carrière si manque pierre
    if (s.stone < 50 && s.wood >= 5) {
      this._buildBuilding('QUARRY');
      return;
    }
    // Scierie si village
    if (lvl !== 'CAMP' && s.wood >= 20 && s.stone >= 15) {
      const hasIt = this.buildings.some(b => b.type === 'SAWMILL');
      if (!hasIt) { this._buildBuilding('SAWMILL'); return; }
    }
    // Mine si ville
    if ((lvl === 'TOWN' || lvl === 'CITY' || lvl === 'METROPOLIS') && s.wood >= 20 && s.stone >= 10) {
      const hasIt = this.buildings.some(b => b.type === 'MINE');
      if (!hasIt) { this._buildBuilding('MINE'); return; }
    }
  }

  _buildBuilding(type) {
    const cfg = BUILDING_TYPE[type];
    if (!cfg) return;
    const s = this.stockpile;
    if ((s.wood || 0) < (cfg.cost.wood || 0)) return;
    if ((s.stone || 0) < (cfg.cost.stone || 0)) return;
    s.wood  -= (cfg.cost.wood  || 0);
    s.stone -= (cfg.cost.stone || 0);
    const angle = Math.random() * Math.PI * 2;
    const dist  = 15 + Math.random() * 30;
    this.buildings.push({
      type, name: cfg.name, icon: cfg.icon,
      x: this.x + Math.cos(angle) * dist,
      y: this.y + Math.sin(angle) * dist,
    });
  }

  _evolveLevel() {
    const pop = this.humans.length;
    for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
      const key = LEVEL_ORDER[i];
      if (pop >= CITY_LEVEL[key].minPop) {
        if (this.level !== key) {
          this.level = key;
          // Bonus de montée
          this.stockpile.food  += 50;
          this.stockpile.wood  += 30;
          this.stockpile.stone += 20;
        }
        break;
      }
    }
  }

  _tryExpand(allSettlements) {
    // Chercher tuile loin des autres settlements
    for (let tries = 0; tries < 20; tries++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 200 + Math.random() * 300;
      const nx    = this.x + Math.cos(angle) * dist;
      const ny    = this.y + Math.sin(angle) * dist;

      if (nx < 0 || nx >= this.world.cols * TILE_SIZE) continue;
      if (ny < 0 || ny >= this.world.rows * TILE_SIZE) continue;

      const tile = this.world.tileAt(nx, ny);
      if (!tile || !tile.props.buildable) continue;

      // Pas trop près d'un autre
      const tooClose = allSettlements.some(s => Math.hypot(s.x - nx, s.y - ny) < 150);
      if (tooClose) continue;

      // Dépenser ressources
      this.stockpile.food  -= 50;
      this.stockpile.wood  -= 20;

      return new Settlement(nx, ny, this.world);
    }
    return null;
  }

  // ——— Rendu ——————————————————————————————————————————
  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const lvlCfg = CITY_LEVEL[this.level];
    const radius = this._getLevelRadius();

    // Cercle de territoire
    ctx.strokeStyle = lvlCfg.color + '55';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Bâtiments
    for (const b of this.buildings) {
      const bx = b.x - camX;
      const by = b.y - camY;
      ctx.fillStyle = '#444';
      ctx.fillRect(bx - 3, by - 3, 6, 6);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(bx - 2, by - 2, 4, 4);
    }

    // Humains
    for (const h of this.humans) {
      h.draw(ctx, camX, camY);
    }

    // Icône centrale
    ctx.fillStyle = lvlCfg.color;
    ctx.fillRect(sx - 6, sy - 6, 12, 12);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 5, sy - 5, 10, 10);
    ctx.fillStyle = lvlCfg.color;
    ctx.fillRect(sx - 4, sy - 4, 8, 8);

    // Nom
    ctx.font      = 'bold 9px Courier New';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, sx, sy + 14);
    ctx.fillText(`${lvlCfg.icon} ${this.humans.length}👤`, sx, sy + 23);
    ctx.textAlign = 'left';
  }

  _getLevelRadius() {
    const r = { CAMP:20, VILLAGE:35, TOWN:55, CITY:80, METROPOLIS:120 };
    return r[this.level] || 20;
  }

  getInfo() {
    const lvl = CITY_LEVEL[this.level];
    return {
      name: this.name,
      level: lvl.name,
      population: this.humans.length,
      maxPop: this.maxPop,
      stockpile: { ...this.stockpile },
      buildings: this.buildings.length,
      techs: [...this.tech.researched],
      techProgress: this.tech.getProgress(),
    };
  }

  toJSON() {
    return {
      id: this.id, x: this.x, y: this.y, name: this.name,
      level: this.level, age: this.age,
      stockpile: this.stockpile,
      buildings: this.buildings,
      humans: this.humans.map(h => h.toJSON()),
      tech: this.tech.toJSON(),
    };
  }
}
