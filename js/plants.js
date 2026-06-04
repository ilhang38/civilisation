// ============================================================
// plants.js — Système de plantes et végétation
// ============================================================

import { BIOME, BIOME_PROPS } from './biomes.js';
import { TILE_SIZE } from './world.js';

export const PLANT_TYPE = {
  GRASS:    'grass',
  BERRY:    'berry',
  TREE:     'tree',
  MUSHROOM: 'mushroom',
  CACTUS:   'cactus',
  REED:     'reed',
};

const PLANT_CONFIG = {
  [PLANT_TYPE.GRASS]:    { color:'#5a9a3a', size:3,  foodYield:5,  woodYield:0,  lifespan:200, spreadRate:0.05, favoredBiomes:[BIOME.PRAIRIE,BIOME.PLAIN,BIOME.SAVANNA] },
  [PLANT_TYPE.BERRY]:    { color:'#c03a6a', size:4,  foodYield:15, woodYield:0,  lifespan:400, spreadRate:0.03, favoredBiomes:[BIOME.FOREST,BIOME.PRAIRIE,BIOME.PLAIN] },
  [PLANT_TYPE.TREE]:     { color:'#2a6a2a', size:5,  foodYield:3,  woodYield:20, lifespan:800, spreadRate:0.02, favoredBiomes:[BIOME.FOREST,BIOME.DENSE_FOREST,BIOME.TAIGA,BIOME.PLAIN] },
  [PLANT_TYPE.MUSHROOM]: { color:'#9a6a3a', size:3,  foodYield:8,  woodYield:0,  lifespan:150, spreadRate:0.04, favoredBiomes:[BIOME.FOREST,BIOME.SWAMP,BIOME.DENSE_FOREST] },
  [PLANT_TYPE.CACTUS]:   { color:'#6a9a5a', size:4,  foodYield:6,  woodYield:3,  lifespan:600, spreadRate:0.01, favoredBiomes:[BIOME.DESERT,BIOME.SAVANNA] },
  [PLANT_TYPE.REED]:     { color:'#8aaa4a', size:4,  foodYield:4,  woodYield:5,  lifespan:300, spreadRate:0.06, favoredBiomes:[BIOME.SWAMP,BIOME.RIVER] },
};

let _nextPlantId = 0;

export class Plant {
  constructor(x, y, type, world) {
    this.id     = _nextPlantId++;
    this.x      = x;  // world pixels
    this.y      = y;
    this.type   = type;
    this.config = PLANT_CONFIG[type];
    this.age    = 0;
    this.mature = false;
    this.alive  = true;
    this.world  = world;
    this.growTimer  = 0;
    this.spreadTimer = 0;
  }

  update(dt, plants, maxPlants) {
    if (!this.alive) return null;
    this.age += dt;

    // Maturité
    if (!this.mature && this.age > 30) this.mature = true;

    // Mort naturelle
    if (this.age > this.config.lifespan) {
      this.alive = false;
      return null;
    }

    // Propagation
    this.spreadTimer += dt;
    if (this.spreadTimer > 80 && this.mature && plants.length < maxPlants) {
      this.spreadTimer = 0;
      if (Math.random() < this.config.spreadRate) {
        return this._trySpread(plants);
      }
    }
    return null;
  }

  _trySpread(existingPlants) {
    const angle  = Math.random() * Math.PI * 2;
    const dist   = 8 + Math.random() * 24;
    const nx     = this.x + Math.cos(angle) * dist;
    const ny     = this.y + Math.sin(angle) * dist;
    const tile   = this.world.tileAt(nx, ny);
    if (!tile || !tile.props.passable) return null;
    // Check favoredBiomes
    if (!this.config.favoredBiomes.includes(tile.biome)) {
      if (Math.random() > 0.1) return null;
    }
    // Pas trop proche d'un autre
    for (const p of existingPlants) {
      if (Math.abs(p.x - nx) < 6 && Math.abs(p.y - ny) < 6) return null;
    }
    return new Plant(nx, ny, this.type, this.world);
  }

  harvest() {
    if (!this.mature) return { food: 0, wood: 0 };
    const food = this.config.foodYield;
    const wood = this.config.woodYield;
    if (this.type === PLANT_TYPE.GRASS || this.type === PLANT_TYPE.REED) {
      // Herbe repousse
      this.age = 10;
    } else {
      this.alive = false;
    }
    return { food, wood };
  }

  draw(ctx, camX, camY) {
    if (!this.alive) return;
    const sx = this.x - camX;
    const sy = this.y - camY;
    const sz = this.config.size * (this.mature ? 1.0 : 0.5);
    ctx.fillStyle = this.config.color;
    if (this.type === PLANT_TYPE.TREE) {
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
      // Tronc
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(sx - 1, sy, 2, sz);
    } else if (this.type === PLANT_TYPE.CACTUS) {
      ctx.fillRect(sx - 1, sy - sz, 2, sz * 2);
      ctx.fillRect(sx - sz, sy - 1, sz * 2, 2);
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, sz * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ——— Gestionnaire de plantes ————————————————————————————
export class PlantManager {
  constructor(world, maxPlants = 800) {
    this.world     = world;
    this.maxPlants = maxPlants;
    this.plants    = [];
    this._seed(world);
  }

  _seed(world) {
    const types = Object.values(PLANT_TYPE);
    for (let i = 0; i < this.maxPlants * 0.7; i++) {
      const tx = Math.floor(Math.random() * world.cols);
      const ty = Math.floor(Math.random() * world.rows);
      const tile = world.getTile(tx, ty);
      if (!tile || !tile.props.passable || tile.props.fertility < 0.2) continue;

      // Choisir plante adaptée au biome
      let type = types[Math.floor(Math.random() * types.length)];
      const fav = Object.entries(PLANT_CONFIG).filter(([k, v]) => v.favoredBiomes.includes(tile.biome));
      if (fav.length > 0) type = fav[Math.floor(Math.random() * fav.length)][0];

      const wx = tx * TILE_SIZE + TILE_SIZE / 2;
      const wy = ty * TILE_SIZE + TILE_SIZE / 2;
      const p = new Plant(wx, wy, type, world);
      p.age = Math.random() * 200; // démarrage varié
      p.mature = p.age > 30;
      this.plants.push(p);
    }
  }

  update(dt) {
    const newPlants = [];
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      const child = p.update(dt, this.plants, this.maxPlants);
      if (!p.alive) { this.plants.splice(i, 1); continue; }
      if (child) newPlants.push(child);
    }
    for (const np of newPlants) this.plants.push(np);
  }

  draw(ctx, camX, camY, viewW, viewH) {
    for (const p of this.plants) {
      // Culling basique
      if (p.x < camX - 10 || p.x > camX + viewW + 10) continue;
      if (p.y < camY - 10 || p.y > camY + viewH + 10) continue;
      p.draw(ctx, camX, camY);
    }
  }

  /** Récolter la plante la plus proche de (wx,wy) dans rayon */
  harvestNearest(wx, wy, radius = 20) {
    let best = null, bestDist = radius * radius;
    for (const p of this.plants) {
      if (!p.alive || !p.mature) continue;
      const d = (p.x - wx) ** 2 + (p.y - wy) ** 2;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best ? best.harvest() : null;
  }

  getStats() {
    let grass = 0, berry = 0, tree = 0, mushroom = 0, cactus = 0, reed = 0;
    for (const p of this.plants) {
      if (!p.alive) continue;
      switch(p.type) {
        case PLANT_TYPE.GRASS:    grass++;    break;
        case PLANT_TYPE.BERRY:    berry++;    break;
        case PLANT_TYPE.TREE:     tree++;     break;
        case PLANT_TYPE.MUSHROOM: mushroom++; break;
        case PLANT_TYPE.CACTUS:   cactus++;   break;
        case PLANT_TYPE.REED:     reed++;     break;
      }
    }
    return { total: this.plants.length, grass, berry, tree, mushroom, cactus, reed };
  }

  toJSON() {
    return this.plants.map(p => ({ x: p.x, y: p.y, type: p.type, age: p.age }));
  }

  static fromJSON(data, world) {
    const pm = new PlantManager(world, 800);
    pm.plants = [];
    for (const d of data) {
      const p = new Plant(d.x, d.y, d.type, world);
      p.age = d.age; p.mature = p.age > 30;
      pm.plants.push(p);
    }
    return pm;
  }
}
