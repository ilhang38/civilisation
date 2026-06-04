import { Genome } from './genetics.js';
// ============================================================
// human.js — Entité humaine avec IA et système de besoins
// ============================================================

import { BIOME } from './biomes.js';
import { TILE_SIZE } from './world.js';
import { PLANT_TYPE } from './plants.js';

// ——— Constantes ————————————————————————————————————————
const FIRST_NAMES = ['Aldo','Bren','Cara','Dara','Ewan','Fara','Gael','Hera','Ivan','Jana',
                     'Kael','Lira','Morn','Nara','Orin','Pira','Quen','Reva','Sora','Tarn',
                     'Ulva','Vera','Wren','Xara','Yael','Zara','Aric','Bela','Coda','Deva'];

const LAST_NAMES  = ['Stone','Wood','River','Hill','Lake','Forest','Field','Vale','Glen','Moor'];

export const JOB = {
  HUNTER:   'hunter',
  FARMER:   'farmer',
  LUMBERER: 'lumberer',
  MINER:    'miner',
  BUILDER:  'builder',
  SOLDIER:  'soldier',
  ARTISAN:  'artisan',
  IDLE:     'idle',
};

const JOB_COLORS = {
  [JOB.HUNTER]:   '#f5a030',
  [JOB.FARMER]:   '#60c840',
  [JOB.LUMBERER]: '#a07040',
  [JOB.MINER]:    '#9090a0',
  [JOB.BUILDER]:  '#4080d0',
  [JOB.SOLDIER]:  '#d04040',
  [JOB.ARTISAN]:  '#c060c0',
  [JOB.IDLE]:     '#808080',
};

const STATE = {
  IDLE:    'idle',
  GATHER:  'gather',
  EAT:     'eat',
  SLEEP:   'sleep',
  BUILD:   'build',
  MOVE:    'move',
  RETURN:  'return',
  HUNT:    'hunt',
};

let _nextHumanId = 0;

export class Human {
  constructor(x, y, settlement, world) {
    this.id         = _nextHumanId++;
    this.x          = x;
    this.y          = y;
    this.settlement = settlement;
    this.world      = world;

    // Identité
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES [Math.floor(Math.random() * LAST_NAMES.length)];
    this.name = `${fn} ${ln}`;
    this.age  = 18 + Math.floor(Math.random() * 30);
    this.sex  = Math.random() < 0.5 ? 'M' : 'F';

    // Génome génétique
    this.genome = (settlement?._founderGenome1 && settlement?._founderGenome2)
      ? new Genome(settlement._founderGenome1, settlement._founderGenome2)
      : new Genome();

    // Les attributs sont influencés par le génome
    this.intelligence = Math.min(10, Math.round(this.genome.intelligence));
    this.strength     = Math.min(10, Math.round(this.genome.strength));
    this.speed        = Math.min(2.0, this.genome.speed);
    this._parentId1   = null;
    this._parentId2   = null;

    // Attributs (0–10)
    this.intelligence = 3 + Math.floor(Math.random() * 8);
    this.strength     = 3 + Math.floor(Math.random() * 8);
    this.speed        = 0.8 + Math.random() * 0.8;

    // Besoins (0–100, 100 = critique)
    this.hunger = Math.random() * 30;
    this.thirst = Math.random() * 30;
    this.energy = 100 - Math.random() * 20; // 100 = plein d'énergie

    // Inventaire
    this.inventory = { food: 0, wood: 0, stone: 0, ore: 0 };
    this.maxCarry   = 20 + this.strength * 2;

    this.job   = JOB.IDLE;
    this.alive = true;
    this.state = STATE.IDLE;

    // Navigation
    this.targetX = x; this.targetY = y;
    this.homeX   = x; this.homeY   = y;
    this._actionTimer  = 0;
    this._sleepTimer   = 0;
    this._decideTimer  = 0;
    this.age_timer     = 0;
  }

  // ——— Mise à jour ——————————————————————————————————————
  update(dt, plantMgr, animalMgr) {
    if (!this.alive) return;

    this.age_timer += dt;
    if (this.age_timer > 500) { this.age_timer = 0; this.age += 1; }

    // Vieillesse
    if (this.age > 80 && Math.random() < 0.0002 * dt) { this.alive = false; return; }

    // Besoins naturels
    this.hunger += dt * 0.05;
    this.thirst += dt * 0.07;
    this.energy -= dt * 0.03;

    // Dégâts si besoins critiques
    if (this.hunger > 100 || this.thirst > 100) { this.alive = false; return; }

    const tile = this.world.tileAt(this.x, this.y);
    const spd  = this.speed * (tile ? tile.props.speed : 1.0);

    // Machine à états
    this._decideTimer -= dt;
    if (this._decideTimer <= 0) {
      this._decideTimer = 5 + Math.random() * 10;
      this._decide(plantMgr, animalMgr);
    }

    this._executeState(dt, plantMgr, animalMgr, spd, tile);
  }

  _decide(plantMgr, animalMgr) {
    // Priorités : survie > besoin > travail
    if (this.hunger > 70) { this.state = STATE.EAT; return; }
    if (this.thirst > 70) { this.state = STATE.EAT; return; }
    if (this.energy < 20) { this.state = STATE.SLEEP; return; }

    const inv = this.inventory;
    const full = (inv.food + inv.wood + inv.stone + inv.ore) >= this.maxCarry - 2;

    if (full) { this.state = STATE.RETURN; return; }

    // Logique par métier
    switch(this.job) {
      case JOB.HUNTER:
        if (animalMgr && animalMgr.animals.some(a => a.alive && a.config.isHerbivore)) {
          this.state = STATE.HUNT;
        } else {
          this.state = STATE.GATHER;
        }
        break;
      case JOB.FARMER:   this.state = STATE.GATHER; break;
      case JOB.LUMBERER: this.state = STATE.GATHER; break;
      case JOB.MINER:    this.state = STATE.GATHER; break;
      case JOB.BUILDER:  this.state = STATE.BUILD;  break;
      default:           this.state = STATE.GATHER;
    }
  }

  _executeState(dt, plantMgr, animalMgr, spd, tile) {
    switch(this.state) {
      case STATE.EAT:
        this._doEat(dt, tile);
        break;
      case STATE.SLEEP:
        this._doSleep(dt);
        break;
      case STATE.GATHER:
        this._doGather(dt, plantMgr);
        break;
      case STATE.HUNT:
        this._doHunt(dt, animalMgr);
        break;
      case STATE.RETURN:
        this._doReturn(spd);
        break;
      case STATE.BUILD:
        this._doBuild(dt);
        break;
      default:
        this._moveTo(this.targetX, this.targetY, spd);
    }
  }

  _doEat(dt, tile) {
    // Manger depuis l'inventaire
    if (this.inventory.food > 0) {
      const eat = Math.min(this.inventory.food, 5);
      this.inventory.food -= eat;
      this.hunger = Math.max(0, this.hunger - eat * 8);
      this.thirst = Math.max(0, this.thirst - eat * 3);
    }
    // Boire depuis tuile eau
    if (tile && tile.props.water > 0.5) {
      this.thirst = Math.max(0, this.thirst - dt * 5);
    }
    // Sinon retourner au camp
    if (this.inventory.food === 0) {
      this.state = STATE.RETURN;
    }
  }

  _doSleep(dt) {
    this.energy = Math.min(100, this.energy + dt * 2);
    if (this.energy >= 95) this.state = STATE.IDLE;
  }

  _doGather(dt, plantMgr) {
    this._actionTimer -= dt;
    // Naviguer vers ressource
    const tileX = Math.floor(this.x / TILE_SIZE);
    const tileY = Math.floor(this.y / TILE_SIZE);
    const tile  = this.world.getTile(tileX, tileY);

    if (this._actionTimer > 0) {
      this._moveTo(this.targetX, this.targetY, this.speed);
      return;
    }
    this._actionTimer = 10 + Math.random() * 5;

    // Récolte selon le métier
    if (this.job === JOB.LUMBERER || this.job === JOB.FARMER) {
      const harvest = plantMgr?.harvestNearest(this.x, this.y, 30);
      if (harvest) {
        this.inventory.food += harvest.food;
        this.inventory.wood += harvest.wood;
      } else {
        // Chercher plante
        if (plantMgr && plantMgr.plants.length > 0) {
          const p = plantMgr.plants.find(p => p.alive && p.mature);
          if (p) { this.targetX = p.x; this.targetY = p.y; }
        }
      }
    }

    if (this.job === JOB.MINER || this.job === JOB.BUILDER) {
      if (tile && tile.stone > 0) {
        const got = tile.harvest('stone', 3);
        this.inventory.stone += got;
        if (tile.ore > 0) this.inventory.ore += tile.harvest('ore', 2);
      } else {
        // Chercher tuile avec stone
        const near = this.world.findNearestBiomes(this.x, this.y, [BIOME.HILL, BIOME.MOUNTAIN], 80);
        if (near.length > 0) {
          this.targetX = near[0].tile.x * TILE_SIZE;
          this.targetY = near[0].tile.y * TILE_SIZE;
        }
      }
    }

    if (this.job === JOB.FARMER || this.job === JOB.IDLE) {
      if (tile && tile.food > 0) {
        this.inventory.food += tile.harvest('food', 3);
      }
    }

    // Récolte générale (food de la tuile)
    if (tile && tile.food > 0 && this.hunger > 40) {
      this.inventory.food += tile.harvest('food', 2);
    }
  }

  _doHunt(dt, animalMgr) {
    if (!animalMgr) { this.state = STATE.GATHER; return; }
    // Trouver proie
    let prey = null, bestDist = 200;
    for (const a of animalMgr.animals) {
      if (!a.alive || !a.config.isHerbivore) continue;
      const d = Math.hypot(a.x - this.x, a.y - this.y);
      if (d < bestDist) { bestDist = d; prey = a; }
    }
    if (!prey) { this.state = STATE.GATHER; return; }

    this.targetX = prey.x; this.targetY = prey.y;
    this._moveTo(this.targetX, this.targetY, this.speed);

    // Tuer si assez proche
    if (bestDist < 12) {
      prey.alive = false;
      this.inventory.food += prey.config.foodValue;
    }
  }

  _doReturn(spd) {
    // Rentrer au camp
    if (!this.settlement) { this.state = STATE.IDLE; return; }
    this.targetX = this.settlement.x;
    this.targetY = this.settlement.y;
    const dist = Math.hypot(this.x - this.targetX, this.y - this.targetY);
    this._moveTo(this.targetX, this.targetY, spd);
    if (dist < 20) {
      // Déposer ressources
      this.settlement.stockpile.food  += this.inventory.food;
      this.settlement.stockpile.wood  += this.inventory.wood;
      this.settlement.stockpile.stone += this.inventory.stone;
      this.settlement.stockpile.ore   += this.inventory.ore;
      this.inventory = { food: 0, wood: 0, stone: 0, ore: 0 };
      this.state = STATE.IDLE;
    }
  }

  _doBuild(dt) {
    if (this.settlement) {
      this.settlement._buildProgress = (this.settlement._buildProgress || 0) + dt * 0.1;
    }
    this.state = STATE.IDLE;
  }

  _moveTo(tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 2) return;
    const nx2 = this.x + (dx/dist) * speed;
    const ny2 = this.y + (dy/dist) * speed;
    const tile = this.world.tileAt(nx2, ny2);
    if (tile && tile.props.passable) {
      this.x = Math.max(0, Math.min(this.world.cols * TILE_SIZE - 1, nx2));
      this.y = Math.max(0, Math.min(this.world.rows * TILE_SIZE - 1, ny2));
    }
  }

  // ——— Rendu ——————————————————————————————————————————
  draw(ctx, camX, camY) {
    if (!this.alive) return;
    const sx = this.x - camX;
    const sy = this.y - camY;
    const col = JOB_COLORS[this.job] || '#ffffff';

    // Corps
    ctx.fillStyle = col;
    ctx.fillRect(sx - 3, sy - 3, 6, 6);

    // Point tête
    ctx.fillStyle = '#f5d0a0';
    ctx.beginPath();
    ctx.arc(sx, sy - 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // Barre faim rouge si critique
    if (this.hunger > 60) {
      ctx.fillStyle = '#333';
      ctx.fillRect(sx - 3, sy - 8, 6, 2);
      ctx.fillStyle = '#d04040';
      ctx.fillRect(sx - 3, sy - 8, 6 * (1 - this.hunger / 100), 2);
    }
  }

  getInfo() {
    return {
      name: this.name,
      age: this.age,
      sex: this.sex,
      job: this.job,
      state: this.state,
      hunger: Math.floor(this.hunger),
      thirst: Math.floor(this.thirst),
      energy: Math.floor(this.energy),
      intelligence: this.intelligence,
      strength: this.strength,
      inventory: { ...this.inventory },
    };
  }

  toJSON() {
    return {
      id: this.id, x: this.x, y: this.y,
      name: this.name, age: this.age, sex: this.sex,
      job: this.job, hunger: this.hunger, thirst: this.thirst, energy: this.energy,
      inventory: this.inventory,
    };
  }
}
