// ============================================================
// animals.js — Herbivores & Prédateurs avec IA comportementale
// ============================================================

import { BIOME } from './biomes.js';
import { TILE_SIZE } from './world.js';

// ——— Types ————————————————————————————————————————————————
export const ANIMAL_TYPE = {
  // Herbivores
  RABBIT:  'rabbit',
  DEER:    'deer',
  GOAT:    'goat',
  SHEEP:   'sheep',
  BOAR:    'boar',
  // Prédateurs
  WOLF:    'wolf',
  FOX:     'fox',
  LYNX:    'lynx',
  BEAR:    'bear',
};

const ANIMAL_CONFIG = {
  [ANIMAL_TYPE.RABBIT]: { color:'#c8b898', size:3,  speed:1.5, maxHp:20,  foodValue:10, isHerbivore:true,  vision:40, fleeSpeed:2.5, favoredBiomes:[BIOME.PRAIRIE,BIOME.PLAIN,BIOME.FOREST] },
  [ANIMAL_TYPE.DEER]:   { color:'#b88850', size:5,  speed:1.2, maxHp:40,  foodValue:25, isHerbivore:true,  vision:60, fleeSpeed:2.0, favoredBiomes:[BIOME.FOREST,BIOME.PRAIRIE,BIOME.PLAIN] },
  [ANIMAL_TYPE.GOAT]:   { color:'#d0c8b8', size:4,  speed:1.0, maxHp:35,  foodValue:20, isHerbivore:true,  vision:50, fleeSpeed:1.8, favoredBiomes:[BIOME.HILL,BIOME.MOUNTAIN,BIOME.PLAIN] },
  [ANIMAL_TYPE.SHEEP]:  { color:'#e8e4d8', size:4,  speed:0.8, maxHp:30,  foodValue:18, isHerbivore:true,  vision:45, fleeSpeed:1.6, favoredBiomes:[BIOME.PRAIRIE,BIOME.PLAIN,BIOME.HILL] },
  [ANIMAL_TYPE.BOAR]:   { color:'#5a4030', size:5,  speed:1.1, maxHp:60,  foodValue:30, isHerbivore:true,  vision:45, fleeSpeed:1.5, favoredBiomes:[BIOME.FOREST,BIOME.DENSE_FOREST,BIOME.SWAMP] },
  [ANIMAL_TYPE.WOLF]:   { color:'#788888', size:5,  speed:1.4, maxHp:80,  foodValue:0,  isHerbivore:false, vision:80, attackDmg:12, favoredBiomes:[BIOME.FOREST,BIOME.TAIGA,BIOME.PLAIN] },
  [ANIMAL_TYPE.FOX]:    { color:'#c86820', size:4,  speed:1.6, maxHp:40,  foodValue:0,  isHerbivore:false, vision:70, attackDmg:8,  favoredBiomes:[BIOME.FOREST,BIOME.PRAIRIE,BIOME.PLAIN] },
  [ANIMAL_TYPE.LYNX]:   { color:'#a87840', size:5,  speed:1.5, maxHp:60,  foodValue:0,  isHerbivore:false, vision:75, attackDmg:10, favoredBiomes:[BIOME.FOREST,BIOME.TAIGA,BIOME.HILL] },
  [ANIMAL_TYPE.BEAR]:   { color:'#604030', size:7,  speed:0.9, maxHp:150, foodValue:0,  isHerbivore:false, vision:60, attackDmg:20, favoredBiomes:[BIOME.FOREST,BIOME.TAIGA,BIOME.MOUNTAIN] },
};

const STATE = { WANDER:'wander', FLEE:'flee', HUNT:'hunt', EAT:'eat', DRINK:'drink', DEAD:'dead', BREED:'breed' };

let _nextAnimalId = 0;

export class Animal {
  constructor(x, y, type, world) {
    this.id     = _nextAnimalId++;
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.config = ANIMAL_CONFIG[type];
    this.world  = world;
    this.hp     = this.config.maxHp;
    this.hunger = 0;      // 0–100 (100 = mort de faim)
    this.thirst = 0;      // 0–100
    this.age    = 0;
    this.alive  = true;
    this.state  = STATE.WANDER;
    this.targetX = x; this.targetY = y;
    this.target  = null; // animal cible (prédateur)
    this.breedTimer = 200 + Math.random() * 200;
    this.attackTimer = 0;
    this._wanderTimer = 0;
  }

  get name() { return this.type; }

  update(dt, animals, plantMgr) {
    if (!this.alive) return null;
    this.age     += dt;
    this.hunger  += dt * 0.08;
    this.thirst  += dt * 0.1;
    this.breedTimer -= dt;
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    // Mort de faim/soif/âge
    if (this.hunger > 100 || this.thirst > 100 || this.age > 1200) {
      this.alive = false;
      return null;
    }

    // Dégâts de faim
    if (this.hunger > 80) this.hp -= dt * 0.05;
    if (this.hp <= 0) { this.alive = false; return null; }

    const cfg = this.config;
    const tile = this.world.tileAt(this.x, this.y);
    const spd  = cfg.speed * (tile ? tile.props.speed : 1.0);

    if (cfg.isHerbivore) {
      return this._updateHerbivore(dt, animals, plantMgr, spd);
    } else {
      return this._updatePredator(dt, animals, spd);
    }
  }

  _updateHerbivore(dt, animals, plantMgr, spd) {
    // Chercher menace
    const threat = this._findThreat(animals);
    if (threat) {
      this.state  = STATE.FLEE;
      this.targetX = this.x + (this.x - threat.x) * 3;
      this.targetY = this.y + (this.y - threat.y) * 3;
    } else if (this.thirst > 60) {
      this.state = STATE.DRINK;
      this._seekWater();
    } else if (this.hunger > 50) {
      this.state = STATE.EAT;
      this._seekFood(plantMgr);
    } else {
      this._wander(dt);
    }

    const fleeSpd = this.state === STATE.FLEE ? this.config.fleeSpeed : spd;
    this._moveTo(this.targetX, this.targetY, fleeSpd);

    // Boire sur tuile eau
    const tile = this.world.tileAt(this.x, this.y);
    if (tile && tile.props.water > 0.5) this.thirst = Math.max(0, this.thirst - dt * 2);

    // Manger plante
    if (this.hunger > 30 && this.state === STATE.EAT) {
      const harvest = plantMgr?.harvestNearest(this.x, this.y, 15);
      if (harvest) this.hunger = Math.max(0, this.hunger - harvest.food * 1.5);
    }

    // Reproduction
    if (this.breedTimer < 0 && this.hunger < 40 && Math.random() < 0.002) {
      this.breedTimer = 300 + Math.random() * 200;
      return this._breed();
    }
    return null;
  }

  _updatePredator(dt, animals, spd) {
    // Chercher proie
    if (!this.target || !this.target.alive) {
      this.target = this._findPrey(animals);
    }

    if (this.target && this.hunger > 25) {
      this.state   = STATE.HUNT;
      this.targetX = this.target.x;
      this.targetY = this.target.y;
      this._moveTo(this.targetX, this.targetY, spd);

      // Attaquer si proche
      const dist = Math.hypot(this.x - this.target.x, this.y - this.target.y);
      if (dist < 10 && this.attackTimer <= 0) {
        this.target.hp -= (this.config.attackDmg || 10);
        this.attackTimer = 30;
        if (!this.target.alive || this.target.hp <= 0) {
          this.target.alive = false;
          this.hunger = Math.max(0, this.hunger - this.target.config.foodValue * 2);
          this.target = null;
        }
      }
    } else {
      this._wander(dt);
      this._moveTo(this.targetX, this.targetY, spd * 0.7);
    }

    const tile = this.world.tileAt(this.x, this.y);
    if (tile && tile.props.water > 0.5) this.thirst = Math.max(0, this.thirst - dt * 2);

    if (this.breedTimer < 0 && this.hunger < 40 && Math.random() < 0.001) {
      this.breedTimer = 400 + Math.random() * 300;
      return this._breed();
    }
    return null;
  }

  _findThreat(animals) {
    const v = this.config.vision;
    for (const a of animals) {
      if (!a.alive || a.config.isHerbivore) continue;
      const d = Math.hypot(a.x - this.x, a.y - this.y);
      if (d < v) return a;
    }
    return null;
  }

  _findPrey(animals) {
    const v = this.config.vision;
    let best = null, bestDist = v;
    for (const a of animals) {
      if (!a.alive || !a.config.isHerbivore) continue;
      const d = Math.hypot(a.x - this.x, a.y - this.y);
      if (d < bestDist) { bestDist = d; best = a; }
    }
    return best;
  }

  _seekWater() {
    const near = this.world.findNearestBiomes(this.x, this.y, [BIOME.RIVER, BIOME.LAKE, BIOME.OCEAN], 80);
    if (near.length > 0) {
      const t = near[0].tile;
      this.targetX = t.x * TILE_SIZE + TILE_SIZE / 2;
      this.targetY = t.y * TILE_SIZE + TILE_SIZE / 2;
    }
  }

  _seekFood(plantMgr) {
    if (!plantMgr) return;
    let best = null, bestDist = 60;
    for (const p of plantMgr.plants) {
      if (!p.alive || !p.mature) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    if (best) { this.targetX = best.x; this.targetY = best.y; }
  }

  _wander(dt) {
    this._wanderTimer -= dt;
    if (this._wanderTimer <= 0) {
      this._wanderTimer = 30 + Math.random() * 60;
      this.state = STATE.WANDER;
      const angle = Math.random() * Math.PI * 2;
      const dist  = 20 + Math.random() * 60;
      this.targetX = this.x + Math.cos(angle) * dist;
      this.targetY = this.y + Math.sin(angle) * dist;
    }
  }

  _moveTo(tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 2) return;
    const nx = dx / dist, ny = dy / dist;
    const nx2 = this.x + nx * speed;
    const ny2 = this.y + ny * speed;
    const tile = this.world.tileAt(nx2, ny2);
    if (tile && tile.props.passable) {
      this.x = Math.max(0, Math.min(this.world.cols * TILE_SIZE - 1, nx2));
      this.y = Math.max(0, Math.min(this.world.rows * TILE_SIZE - 1, ny2));
    } else {
      // Rebondir
      this.targetX = this.x + (Math.random() - 0.5) * 40;
      this.targetY = this.y + (Math.random() - 0.5) * 40;
    }
  }

  _breed() {
    const angle = Math.random() * Math.PI * 2;
    const child = new Animal(
      this.x + Math.cos(angle) * 12,
      this.y + Math.sin(angle) * 12,
      this.type, this.world
    );
    child.hunger = 20;
    return child;
  }

  draw(ctx, camX, camY) {
    if (!this.alive) return;
    const sx = this.x - camX;
    const sy = this.y - camY;
    const sz = this.config.size;
    ctx.fillStyle = this.config.color;
    ctx.beginPath();
    ctx.arc(sx, sy, sz, 0, Math.PI * 2);
    ctx.fill();
    // Contour prédateur
    if (!this.config.isHerbivore) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // HP bar si blessé
    if (this.hp < this.config.maxHp) {
      const pct = this.hp / this.config.maxHp;
      ctx.fillStyle = '#333';
      ctx.fillRect(sx - sz, sy - sz - 4, sz * 2, 2);
      ctx.fillStyle = pct > 0.5 ? '#4a4' : '#a44';
      ctx.fillRect(sx - sz, sy - sz - 4, sz * 2 * pct, 2);
    }
  }

  getInfo() {
    return {
      type: this.type,
      age: Math.floor(this.age),
      hp: `${Math.floor(this.hp)}/${this.config.maxHp}`,
      hunger: Math.floor(this.hunger),
      thirst: Math.floor(this.thirst),
      state: this.state,
      herbivore: this.config.isHerbivore,
    };
  }
}

// ——— Gestionnaire d'animaux —————————————————————————————
export class AnimalManager {
  constructor(world, maxAnimals = 300) {
    this.world      = world;
    this.maxAnimals = maxAnimals;
    this.animals    = [];
    this._seed();
  }

  _seed() {
    const types = Object.values(ANIMAL_TYPE);
    const herbi = types.filter(t => ANIMAL_CONFIG[t].isHerbivore);
    const preda = types.filter(t => !ANIMAL_CONFIG[t].isHerbivore);

    // 80% herbivores
    for (let i = 0; i < 80; i++) this._spawnRandom(herbi[Math.floor(Math.random() * herbi.length)]);
    for (let i = 0; i < 20; i++) this._spawnRandom(preda[Math.floor(Math.random() * preda.length)]);
  }

  _spawnRandom(type) {
    const cfg = ANIMAL_CONFIG[type];
    for (let tries = 0; tries < 30; tries++) {
      const tx = Math.floor(Math.random() * this.world.cols);
      const ty = Math.floor(Math.random() * this.world.rows);
      const tile = this.world.getTile(tx, ty);
      if (!tile || !tile.props.passable) continue;
      if (cfg.favoredBiomes && !cfg.favoredBiomes.includes(tile.biome) && Math.random() > 0.2) continue;
      const wx = tx * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE;
      const wy = ty * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE;
      this.animals.push(new Animal(wx, wy, type, this.world));
      return;
    }
  }

  update(dt, plantMgr) {
    const newborns = [];
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const child = a.update(dt, this.animals, plantMgr);
      if (!a.alive) { this.animals.splice(i, 1); continue; }
      if (child && this.animals.length < this.maxAnimals) newborns.push(child);
    }
    for (const nb of newborns) this.animals.push(nb);

    // Maintenir population minimale
    if (Math.random() < 0.001) {
      const herbi = Object.values(ANIMAL_TYPE).filter(t => ANIMAL_CONFIG[t].isHerbivore);
      this._spawnRandom(herbi[Math.floor(Math.random() * herbi.length)]);
    }
  }

  draw(ctx, camX, camY, viewW, viewH) {
    for (const a of this.animals) {
      if (a.x < camX - 20 || a.x > camX + viewW + 20) continue;
      if (a.y < camY - 20 || a.y > camY + viewH + 20) continue;
      a.draw(ctx, camX, camY);
    }
  }

  getStats() {
    let herbivores = 0, predators = 0;
    const byType = {};
    for (const a of this.animals) {
      if (!a.alive) continue;
      byType[a.type] = (byType[a.type] || 0) + 1;
      if (a.config.isHerbivore) herbivores++;
      else predators++;
    }
    return { total: this.animals.length, herbivores, predators, byType };
  }

  toJSON() {
    return this.animals.map(a => ({ x:a.x, y:a.y, type:a.type, hp:a.hp, hunger:a.hunger, age:a.age }));
  }
}
