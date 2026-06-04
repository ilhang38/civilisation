// ============================================================
// city.js — Colonies, villes et leur évolution
// CORRECTIONS : nourriture passive depuis biome, expansion plus
//               fréquente, croissance pop plus rapide, stocks de
//               départ plus généreux
// ============================================================

import { Human, JOB } from './human.js';
import { TechTree, TECH_CONFIG } from './technology.js';
import { TILE_SIZE } from './world.js';

export const CITY_LEVEL = {
  CAMP:       { name:'Camp',        icon:'⛺', minPop:1,   color:'#c8a040' },
  VILLAGE:    { name:'Village',     icon:'🏘', minPop:8,   color:'#80c060' },
  TOWN:       { name:'Ville',       icon:'🏙', minPop:25,  color:'#4090d0' },
  CITY:       { name:'Grande Ville',icon:'🌆', minPop:60,  color:'#c060d0' },
  METROPOLIS: { name:'Métropole',   icon:'🌇', minPop:150, color:'#f07030' },
};

const LEVEL_ORDER = ['CAMP','VILLAGE','TOWN','CITY','METROPOLIS'];

export const BUILDING_TYPE = {
  HOUSE:    { name:'Maison',    icon:'🏠', cost:{wood:10,stone:3},  pop:+4,  produces:{ },             requires:'CAMP'    },
  FARM:     { name:'Ferme',     icon:'🌾', cost:{wood:8, stone:0},  pop:0,   produces:{food:12},        requires:'CAMP'    },
  MILL:     { name:'Moulin',    icon:'⚙', cost:{wood:15,stone:8},  pop:0,   produces:{food:6,wood:2},  requires:'VILLAGE' },
  SAWMILL:  { name:'Scierie',   icon:'🪚', cost:{wood:5, stone:12}, pop:0,   produces:{wood:14},        requires:'VILLAGE' },
  QUARRY:   { name:'Carrière',  icon:'🗿', cost:{wood:4, stone:4},  pop:0,   produces:{stone:10},       requires:'CAMP'    },
  MINE:     { name:'Mine',      icon:'⛏', cost:{wood:15,stone:8},  pop:0,   produces:{ore:8,stone:4},  requires:'VILLAGE' },
  WORKSHOP: { name:'Atelier',   icon:'🔨', cost:{wood:12,stone:8},  pop:0,   produces:{gold:3},         requires:'TOWN'    },
  MARKET:   { name:'Marché',    icon:'🏪', cost:{wood:15,stone:15}, pop:0,   produces:{gold:6},         requires:'TOWN'    },
  BARRACKS: { name:'Caserne',   icon:'⚔', cost:{wood:8, stone:20}, pop:0,   produces:{ },              requires:'VILLAGE' },
  WALL:     { name:'Muraille',  icon:'🧱', cost:{wood:4, stone:30}, pop:0,   produces:{ },              requires:'VILLAGE' },
};

let _nextSettlementId = 0;

const CITY_NAMES = ['Avalon','Brest','Calais','Dorin','Embor','Favre','Greva','Helsin',
                    'Irone','Jarven','Kelmar','Lavon','Morvin','Norden','Ostmar','Polhaven',
                    'Querac','Runvik','Sunmar','Torveld','Ulborg','Vardal','Welmore',
                    'Xandor','Yarvil','Zephyr','Aldmar','Birken','Crestol','Dunvale'];

export class Settlement {
  constructor(x, y, world, founder = null, playerMode = false) {
    this.id    = _nextSettlementId++;
    this.x     = x;
    this.y     = y;
    this.world = world;

    this.name  = CITY_NAMES[this.id % CITY_NAMES.length] +
                 (this.id >= CITY_NAMES.length ? ` ${Math.floor(this.id / CITY_NAMES.length) + 1}` : '');
    this.level = 'CAMP';
    this.age   = 0;

    this.humans = [];
    this.maxPop = 6;
    this.popGrowthTimer = 0;

    // CORRECTION : stocks de départ bien plus généreux
    this.stockpile = { food:120, wood:60, stone:40, ore:10, gold:0 };
    this.buildings = [];
    this._buildTimer = 0;

    this.tech      = new TechTree();
    this.knowledge = 0;

    // CORRECTION : expansion possible bien plus tôt
    this.expansionTimer = 300 + Math.random() * 300;
    this.isPlayerOwned  = playerMode;

    if (founder) {
      founder.settlement = this;
      founder.homeX = x; founder.homeY = y;
      this.humans.push(founder);
    }

    // En mode joueur : pas d'humains auto, pas de ferme auto
    if (!playerMode) {
      for (let i = 0; i < 4; i++) this._spawnHuman();
      this.buildings.push({
        type:'FARM', name:'Ferme', icon:'🌾',
        x: x + 20, y: y + 10,
      });
    }
  }

  update(dt, plantMgr, animalMgr, allSettlements) {
    this.age += dt;

    for (let i = this.humans.length - 1; i >= 0; i--) {
      const h = this.humans[i];
      h.update(dt, plantMgr, animalMgr);
      if (!h.alive) this.humans.splice(i, 1);
    }

    // CORRECTION : consommation plus faible
    const consumption = this.humans.length * 0.012 * dt;
    this.stockpile.food -= consumption;

    if (this.stockpile.food < 0) {
      this.stockpile.food = 0;
      // Famine : mort très rare
      if (Math.random() < 0.0002 * dt && this.humans.length > 2) {
        this.humans.splice(Math.floor(Math.random() * this.humans.length), 1);
      }
    }

    // CORRECTION : production passive depuis le biome environnant
    this._biomeProduce(dt);

    this._runBuildings(dt);
    this._growPopulation(dt);
    this._assignJobs();
    this._autoBuild(dt);

    this.knowledge += dt * 0.15 * (1 + this.humans.length * 0.02);
    this.tech.autoResearch();
    this.tech.update(dt, 0.06 * (1 + this.humans.length * 0.01));

    this._evolveLevel();

    // CORRECTION : expansion plus facile (pop 12 au lieu de 20, moins de food requise)
    this.expansionTimer -= dt;
    if (this.expansionTimer < 0 && this.humans.length >= 12 && this.stockpile.food > 80) {
      this.expansionTimer = 500 + Math.random() * 400;
      return this._tryExpand(allSettlements);
    }
    return null;
  }

  // CORRECTION : production naturelle depuis le biome (sans bâtiment)
  _biomeProduce(dt) {
    const tile = this.world.tileAt(this.x, this.y);
    if (!tile) return;
    const p = tile.props;
    // Nourriture naturelle du terrain
    this.stockpile.food  += p.fertility * 1.2 * dt * 0.04;
    this.stockpile.wood  += p.wood      * 0.8 * dt * 0.03;
    this.stockpile.stone += p.stone     * 0.6 * dt * 0.02;
  }

  _runBuildings(dt) {
    const s = this.tech.stats;
    for (const b of this.buildings) {
      if (b.type === 'HOUSE') continue;
      const prod = BUILDING_TYPE[b.type]?.produces || {};
      for (const [res, amt] of Object.entries(prod)) {
        let mult = 1.0;
        if (res === 'food')  mult = s.foodMult   || 1;
        if (res === 'wood')  mult = s.gatherMult || 1;
        if (res === 'stone') mult = s.stoneMult  || 1;
        // CORRECTION : taux de production x1.5 par rapport à avant
        this.stockpile[res] = (this.stockpile[res] || 0) + amt * dt * 0.015 * mult;
      }
    }
    for (const k of Object.keys(this.stockpile)) {
      this.stockpile[k] = Math.max(0, Math.min(9999, this.stockpile[k]));
    }
  }

  _growPopulation(dt) {
    this.popGrowthTimer += dt;
    // CORRECTION : croissance toutes les 120 ticks (au lieu de 200)
    if (this.popGrowthTimer < 120) return;
    this.popGrowthTimer = 0;

    const s = this.tech.stats;
    const growthRate = s.popGrowth || 1.0;
    const houseCount = this.buildings.filter(b => b.type === 'HOUSE').length;
    this.maxPop = 6 + houseCount * 4;

    // CORRECTION : seuil de nourriture plus bas pour croître
    if (this.humans.length < this.maxPop && this.stockpile.food > 30 * growthRate) {
      // CORRECTION : chance plus haute (0.6 au lieu de 0.4)
      if (Math.random() < 0.6 * growthRate) {
        this._spawnHuman();
      }
    }
  }

  _spawnHuman() {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 5 + Math.random() * 25;
    const h     = new Human(
      this.x + Math.cos(angle) * dist,
      this.y + Math.sin(angle) * dist,
      this, this.world
    );
    this.humans.push(h);
  }

  _assignJobs() {
    const pop = this.humans.length;
    if (pop === 0) return;
    const jobs = [];
    // CORRECTION : plus de fermiers (40%) pour assurer la nourriture
    const farmers   = Math.max(2, Math.floor(pop * 0.40));
    const hunters   = Math.max(1, Math.floor(pop * 0.18));
    const lumberers = Math.max(1, Math.floor(pop * 0.15));
    const miners    = Math.max(1, Math.floor(pop * 0.10));
    const builders  = Math.max(1, Math.floor(pop * 0.10));
    const soldiers  = Math.floor(pop * 0.04);
    const artisans  = Math.max(0, pop - farmers - hunters - lumberers - miners - builders - soldiers);

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
    // CORRECTION : construire plus souvent (toutes les 60 ticks)
    if (this._buildTimer > 0) return;
    this._buildTimer = 60 + Math.random() * 60;

    const s   = this.stockpile;
    const lvl = this.level;

    // Toujours construire des fermes en priorité si nourriture basse
    if (s.food < 150 && s.wood >= 8) {
      const farmCount = this.buildings.filter(b => b.type === 'FARM').length;
      // Max 1 ferme par 3 habitants
      if (farmCount < Math.ceil(this.humans.length / 3)) {
        this._buildBuilding('FARM'); return;
      }
    }
    // Maison si besoin de place
    if (this.humans.length >= this.maxPop - 1 && s.wood >= 10 && s.stone >= 3) {
      this._buildBuilding('HOUSE'); return;
    }
    // Ferme supplémentaire si vraiment peu de nourriture
    if (s.food < 80 && s.wood >= 8) {
      this._buildBuilding('FARM'); return;
    }
    // Carrière si peu de pierre
    if (s.stone < 40 && s.wood >= 4) {
      this._buildBuilding('QUARRY'); return;
    }
    // Scierie si village
    if (lvl !== 'CAMP' && s.wood >= 15 && s.stone >= 12) {
      if (!this.buildings.some(b => b.type === 'SAWMILL')) {
        this._buildBuilding('SAWMILL'); return;
      }
    }
    // Mine si ville
    if (['TOWN','CITY','METROPOLIS'].includes(lvl) && s.wood >= 15 && s.stone >= 8) {
      if (!this.buildings.some(b => b.type === 'MINE')) {
        this._buildBuilding('MINE'); return;
      }
    }
    // Marché si grande ville
    if (['CITY','METROPOLIS'].includes(lvl) && s.wood >= 15 && s.stone >= 15) {
      if (!this.buildings.some(b => b.type === 'MARKET')) {
        this._buildBuilding('MARKET'); return;
      }
    }
  }

  _buildBuilding(type) {
    const cfg = BUILDING_TYPE[type];
    if (!cfg) return;
    const s = this.stockpile;
    if ((s.wood  || 0) < (cfg.cost.wood  || 0)) return;
    if ((s.stone || 0) < (cfg.cost.stone || 0)) return;
    s.wood  -= (cfg.cost.wood  || 0);
    s.stone -= (cfg.cost.stone || 0);
    const angle = Math.random() * Math.PI * 2;
    const dist  = 12 + Math.random() * 35;
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
          // Bonus généreux à chaque montée de niveau
          this.stockpile.food  += 100;
          this.stockpile.wood  += 60;
          this.stockpile.stone += 40;
        }
        break;
      }
    }
  }

  _tryExpand(allSettlements) {
    for (let tries = 0; tries < 25; tries++) {
      const angle = Math.random() * Math.PI * 2;
      // CORRECTION : distance d'expansion réduite (plus facile à atteindre)
      const dist  = 150 + Math.random() * 250;
      const nx    = this.x + Math.cos(angle) * dist;
      const ny    = this.y + Math.sin(angle) * dist;

      if (nx < 20 || nx >= this.world.cols * TILE_SIZE - 20) continue;
      if (ny < 20 || ny >= this.world.rows * TILE_SIZE - 20) continue;

      const tile = this.world.tileAt(nx, ny);
      if (!tile || !tile.props.buildable) continue;

      // CORRECTION : distance minimale réduite entre settlements
      const tooClose = allSettlements.some(s => Math.hypot(s.x - nx, s.y - ny) < 120);
      if (tooClose) continue;

      this.stockpile.food -= 40;
      this.stockpile.wood -= 15;
      return new Settlement(nx, ny, this.world);
    }
    return null;
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const lvlCfg = CITY_LEVEL[this.level];
    const radius = this._getLevelRadius();

    ctx.strokeStyle = lvlCfg.color + '55';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();

    for (const b of this.buildings) {
      const bx = b.x - camX;
      const by = b.y - camY;
      ctx.fillStyle = '#444';
      ctx.fillRect(bx - 3, by - 3, 6, 6);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(bx - 2, by - 2, 4, 4);
    }

    for (const h of this.humans) {
      h.draw(ctx, camX, camY);
    }

    ctx.fillStyle = lvlCfg.color;
    ctx.fillRect(sx - 6, sy - 6, 12, 12);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 5, sy - 5, 10, 10);
    ctx.fillStyle = lvlCfg.color;
    ctx.fillRect(sx - 4, sy - 4, 8, 8);

    ctx.font      = 'bold 9px Courier New';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, sx, sy + 14);
    ctx.fillText(`${lvlCfg.icon} ${this.humans.length}👤`, sx, sy + 23);
    ctx.textAlign = 'left';
  }

  _getLevelRadius() {
    return { CAMP:20, VILLAGE:35, TOWN:55, CITY:80, METROPOLIS:120 }[this.level] || 20;
  }

  getInfo() {
    return {
      name: this.name,
      level: CITY_LEVEL[this.level].name,
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
