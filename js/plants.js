import { atlas } from './textures.js';
// ============================================================
// plants.js — Plantes avec rendu haute qualité
// GRAPHISMES : arbres avec couronne détaillée, baies colorées,
//              herbe variée, ombres portées, tailles variées
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
  [PLANT_TYPE.GRASS]:    { colors:['#5a9a3a','#6aaa45','#4a8a2a'], size:2.5, foodYield:8,  woodYield:0,  lifespan:600, spreadRate:0.08, favoredBiomes:[BIOME.PRAIRIE,BIOME.PLAIN,BIOME.SAVANNA] },
  [PLANT_TYPE.BERRY]:    { colors:['#c03a6a','#d84a7a','#a02555'], size:4,   foodYield:20, woodYield:0,  lifespan:900, spreadRate:0.05, favoredBiomes:[BIOME.FOREST,BIOME.PRAIRIE,BIOME.PLAIN] },
  [PLANT_TYPE.TREE]:     { colors:['#2a6a2a','#357535','#1e5020'], size:6,   foodYield:5,  woodYield:25, lifespan:2000, spreadRate:0.04, favoredBiomes:[BIOME.FOREST,BIOME.DENSE_FOREST,BIOME.TAIGA,BIOME.PLAIN] },
  [PLANT_TYPE.MUSHROOM]: { colors:['#c87028','#d88038','#a85818'], size:2.5, foodYield:12, woodYield:0,  lifespan:400, spreadRate:0.07, favoredBiomes:[BIOME.FOREST,BIOME.SWAMP,BIOME.DENSE_FOREST] },
  [PLANT_TYPE.CACTUS]:   { colors:['#4a8a40','#5a9a4e','#38703a'], size:4,   foodYield:6,  woodYield:3,  lifespan:600, spreadRate:0.01, favoredBiomes:[BIOME.DESERT,BIOME.SAVANNA] },
  [PLANT_TYPE.REED]:     { colors:['#7a9a3a','#8aaa48','#6a8a2e'], size:3.5, foodYield:7,  woodYield:8,  lifespan:700, spreadRate:0.09, favoredBiomes:[BIOME.SWAMP,BIOME.RIVER] },
};

let _nextPlantId = 0;

export class Plant {
  constructor(x, y, type, world) {
    this.id     = _nextPlantId++;
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.config = PLANT_CONFIG[type];
    this.age    = 0;
    this.mature = false;
    this.alive  = true;
    this.world  = world;
    // Variation visuelle individuelle
    this.sizeVariant  = 0.7 + Math.random() * 0.6;
    this.colorVariant = Math.floor(Math.random() * 3); // index dans colors[]
    this.swayOffset   = Math.random() * Math.PI * 2;   // phase oscillation
    this.spreadTimer  = 0;
  }

  update(dt, plants, maxPlants) {
    if (!this.alive) return null;
    this.age += dt;
    if (!this.mature && this.age > 15) this.mature = true;
    if (this.age > this.config.lifespan) { this.alive = false; return null; }
    this.spreadTimer += dt;
    if (this.spreadTimer > 40 && this.mature && plants.length < maxPlants) {
      this.spreadTimer = 0;
      if (Math.random() < this.config.spreadRate) return this._trySpread(plants);
    }
    return null;
  }

  _trySpread(existingPlants) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 8 + Math.random() * 24;
    const nx = this.x + Math.cos(angle) * dist;
    const ny = this.y + Math.sin(angle) * dist;
    const tile = this.world.tileAt(nx, ny);
    if (!tile || !tile.props.passable) return null;
    if (!this.config.favoredBiomes.includes(tile.biome) && Math.random() > 0.1) return null;
    for (const p of existingPlants) {
      if (Math.abs(p.x - nx) < 5 && Math.abs(p.y - ny) < 5) return null;
    }
    return new Plant(nx, ny, this.type, this.world);
  }

  harvest() {
    if (!this.mature) return { food: 0, wood: 0 };
    const food = this.config.foodYield;
    const wood = this.config.woodYield;
    if (this.type === PLANT_TYPE.GRASS || this.type === PLANT_TYPE.REED) {
      this.age = 10;
    } else {
      this.alive = false;
    }
    return { food, wood };
  }

  draw(ctx, camX, camY, timestamp = 0) {
    if (!this.alive) return;
    const sx  = this.x - camX;
    const sy  = this.y - camY;
    const sz  = this.config.size * this.sizeVariant * (this.mature ? 1.0 : 0.5);
    const col = this.config.colors[this.colorVariant];

    // Légère oscillation (vent)
    const sway = Math.sin(timestamp * 0.001 + this.swayOffset) * 0.8;

    if (this.type === PLANT_TYPE.TREE) {
      this._drawTree(ctx, sx + sway * 0.5, sy, sz, col, timestamp);
    } else if (this.type === PLANT_TYPE.CACTUS) {
      this._drawCactus(ctx, sx, sy, sz, col);
    } else if (this.type === PLANT_TYPE.MUSHROOM) {
      this._drawMushroom(ctx, sx, sy, sz, col);
    } else if (this.type === PLANT_TYPE.BERRY) {
      this._drawBerry(ctx, sx + sway * 0.3, sy, sz, col);
    } else if (this.type === PLANT_TYPE.REED) {
      this._drawReed(ctx, sx, sy, sz, col, sway);
    } else {
      this._drawGrass(ctx, sx, sy, sz, col, sway);
    }
  }

  _drawTree(ctx, sx, sy, sz, col, timestamp) {
    // Ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx + sz*0.4, sy + sz*0.3, sz*0.9, sz*0.4, 0, 0, Math.PI*2);
    ctx.fill();
    // Tronc
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(sx - 1.5, sy, 3, sz * 0.85);
    // Couronne — 3 couches pour profondeur
    ctx.fillStyle = this.config.colors[2]; // foncé
    ctx.beginPath(); ctx.arc(sx, sy - sz*0.3, sz*0.95, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = col; // moyen
    ctx.beginPath(); ctx.arc(sx - sz*0.15, sy - sz*0.45, sz*0.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = this.config.colors[0]; // clair (lumière)
    ctx.beginPath(); ctx.arc(sx - sz*0.25, sy - sz*0.6, sz*0.55, 0, Math.PI*2); ctx.fill();
  }

  _drawCactus(ctx, sx, sy, sz, col) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(sx - sz*0.3, sy + sz*1.1, sz*0.6, sz*0.2);
    // Corps principal
    ctx.fillStyle = col;
    ctx.fillRect(sx - sz*0.3, sy - sz, sz*0.6, sz*2);
    // Bras gauche
    ctx.fillRect(sx - sz*0.9, sy - sz*0.3, sz*0.6, sz*0.3);
    ctx.fillRect(sx - sz*0.9, sy - sz*0.6, sz*0.3, sz*0.35);
    // Bras droit
    ctx.fillRect(sx + sz*0.3, sy - sz*0.1, sz*0.6, sz*0.3);
    ctx.fillRect(sx + sz*0.6, sy - sz*0.4, sz*0.3, sz*0.35);
    // Lignes texture
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(sx - sz*0.05, sy - sz, sz*0.1, sz*2);
  }

  _drawMushroom(ctx, sx, sy, sz, col) {
    // Pied blanc
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(sx - sz*0.25, sy - sz*0.5, sz*0.5, sz*0.55);
    // Chapeau
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(sx, sy - sz*0.5, sz, sz*0.65, 0, Math.PI, 0);
    ctx.fill();
    // Points blancs
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(sx - sz*0.3, sy - sz*0.8, sz*0.18, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + sz*0.2, sy - sz*0.65, sz*0.12, 0, Math.PI*2); ctx.fill();
  }

  _drawBerry(ctx, sx, sy, sz, col) {
    // Buisson vert
    ctx.fillStyle = '#2a6a20';
    ctx.beginPath(); ctx.arc(sx, sy, sz*0.85, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3a7a30';
    ctx.beginPath(); ctx.arc(sx - sz*0.3, sy - sz*0.2, sz*0.6, 0, Math.PI*2); ctx.fill();
    // Baies rouges/roses
    const berryPositions = [[-0.3,-0.1],[0.2,0.1],[0,-0.3],[0.35,-0.2],[-0.1,0.25]];
    for (const [dx, dy] of berryPositions) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(sx + dx*sz, sy + dy*sz, sz*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(sx + dx*sz - sz*0.06, sy + dy*sz - sz*0.06, sz*0.07, 0, Math.PI*2); ctx.fill();
    }
  }

  _drawReed(ctx, sx, sy, sz, col, sway) {
    // 3 roseaux décalés
    for (let i = -1; i <= 1; i++) {
      const ox = i * sz * 0.5 + sway * 0.6;
      ctx.strokeStyle = col;
      ctx.lineWidth = sz * 0.2;
      ctx.beginPath();
      ctx.moveTo(sx + ox, sy + sz);
      ctx.quadraticCurveTo(sx + ox + sway*0.3, sy, sx + ox + sway*0.5, sy - sz);
      ctx.stroke();
      // Épi
      ctx.fillStyle = '#8a6030';
      ctx.beginPath(); ctx.ellipse(sx + ox + sway*0.5, sy - sz*1.1, sz*0.15, sz*0.4, 0, 0, Math.PI*2); ctx.fill();
    }
  }

  _drawGrass(ctx, sx, sy, sz, col, sway) {
    ctx.strokeStyle = col;
    ctx.lineWidth   = sz * 0.25;
    // 4 brins d'herbe
    const offsets = [[-0.4,0],[0,0],[0.4,0],[-0.2,0.2]];
    for (const [ox, oy] of offsets) {
      ctx.beginPath();
      ctx.moveTo(sx + ox*sz, sy + oy*sz + sz);
      ctx.quadraticCurveTo(
        sx + ox*sz + sway*0.4, sy + oy*sz,
        sx + ox*sz + sway*0.7, sy + oy*sz - sz
      );
      ctx.stroke();
    }
  }
}

// ——— PlantManager ———————————————————————————————————————
export class PlantManager {
  constructor(world, maxPlants = 1200) {
    this.world     = world;
    this.maxPlants = maxPlants;
    this.plants    = [];
    this._seed(world);
  }

  _seed(world) {
    const types = Object.values(PLANT_TYPE);
    for (let i = 0; i < this.maxPlants * 0.95; i++) {
      const tx = Math.floor(Math.random() * world.cols);
      const ty = Math.floor(Math.random() * world.rows);
      const tile = world.getTile(tx, ty);
      if (!tile || !tile.props.passable || tile.props.fertility < 0.05) continue;
      let type = types[Math.floor(Math.random() * types.length)];
      const fav = Object.entries(PLANT_CONFIG).filter(([k,v]) => v.favoredBiomes.includes(tile.biome));
      if (fav.length > 0) type = fav[Math.floor(Math.random() * fav.length)][0];
      const wx = tx * TILE_SIZE + TILE_SIZE/2;
      const wy = ty * TILE_SIZE + TILE_SIZE/2;
      const p = new Plant(wx, wy, type, world);
      p.age = Math.random() * 200; p.mature = p.age > 30;
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

  draw(ctx, camX, camY, viewW, viewH, timestamp = 0) {
    // Trier par Y pour profondeur (les plantes du bas devant)
    const visible = this.plants.filter(p =>
      p.alive &&
      p.x >= camX - 15 && p.x <= camX + viewW + 15 &&
      p.y >= camY - 15 && p.y <= camY + viewH + 15
    );
    visible.sort((a, b) => a.y - b.y);
    for (const p of visible) p.draw(ctx, camX, camY, timestamp);
  }

  harvestNearest(wx, wy, radius = 20) {
    let best = null, bestDist = radius * radius;
    for (const p of this.plants) {
      if (!p.alive || !p.mature) continue;
      const d = (p.x - wx)**2 + (p.y - wy)**2;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best ? best.harvest() : null;
  }

  getStats() {
    let grass=0, berry=0, tree=0, mushroom=0, cactus=0, reed=0;
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
    return this.plants.map(p => ({ x:p.x, y:p.y, type:p.type, age:p.age }));
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
