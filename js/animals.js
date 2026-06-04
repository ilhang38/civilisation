import { atlas } from './textures.js';
// ============================================================
// animals.js — Herbivores & Prédateurs — rendu HD + IA
// GRAPHISMES : sprites dessinés par type, ombres, animations
// ============================================================

import { BIOME } from './biomes.js';
import { TILE_SIZE } from './world.js';

export const ANIMAL_TYPE = {
  RABBIT:'rabbit', DEER:'deer', GOAT:'goat', SHEEP:'sheep', BOAR:'boar',
  WOLF:'wolf', FOX:'fox', LYNX:'lynx', BEAR:'bear',
};

const ANIMAL_CONFIG = {
  [ANIMAL_TYPE.RABBIT]: { body:'#c8b898', belly:'#e8d8c0', size:3,  speed:1.5, maxHp:20,  foodValue:10, isHerbivore:true,  vision:40, fleeSpeed:2.5, favoredBiomes:[BIOME.PRAIRIE,BIOME.PLAIN,BIOME.FOREST] },
  [ANIMAL_TYPE.DEER]:   { body:'#b07840', belly:'#d0a868', size:5,  speed:1.2, maxHp:40,  foodValue:25, isHerbivore:true,  vision:60, fleeSpeed:2.0, favoredBiomes:[BIOME.FOREST,BIOME.PRAIRIE,BIOME.PLAIN] },
  [ANIMAL_TYPE.GOAT]:   { body:'#c8c0b0', belly:'#e0d8c8', size:4,  speed:1.0, maxHp:35,  foodValue:20, isHerbivore:true,  vision:50, fleeSpeed:1.8, favoredBiomes:[BIOME.HILL,BIOME.MOUNTAIN,BIOME.PLAIN] },
  [ANIMAL_TYPE.SHEEP]:  { body:'#e0dcd0', belly:'#f0ece4', size:4,  speed:0.8, maxHp:30,  foodValue:18, isHerbivore:true,  vision:45, fleeSpeed:1.6, favoredBiomes:[BIOME.PRAIRIE,BIOME.PLAIN,BIOME.HILL] },
  [ANIMAL_TYPE.BOAR]:   { body:'#503828', belly:'#705040', size:5,  speed:1.1, maxHp:60,  foodValue:30, isHerbivore:true,  vision:45, fleeSpeed:1.5, favoredBiomes:[BIOME.FOREST,BIOME.DENSE_FOREST,BIOME.SWAMP] },
  [ANIMAL_TYPE.WOLF]:   { body:'#708090', belly:'#a0b0b8', size:5,  speed:1.4, maxHp:80,  foodValue:0,  isHerbivore:false, vision:80, attackDmg:12, favoredBiomes:[BIOME.FOREST,BIOME.TAIGA,BIOME.PLAIN] },
  [ANIMAL_TYPE.FOX]:    { body:'#c06018', belly:'#e09040', size:4,  speed:1.6, maxHp:40,  foodValue:0,  isHerbivore:false, vision:70, attackDmg:8,  favoredBiomes:[BIOME.FOREST,BIOME.PRAIRIE,BIOME.PLAIN] },
  [ANIMAL_TYPE.LYNX]:   { body:'#a07838', belly:'#c89848', size:5,  speed:1.5, maxHp:60,  foodValue:0,  isHerbivore:false, vision:75, attackDmg:10, favoredBiomes:[BIOME.FOREST,BIOME.TAIGA,BIOME.HILL] },
  [ANIMAL_TYPE.BEAR]:   { body:'#584030', belly:'#785850', size:7,  speed:0.9, maxHp:150, foodValue:0,  isHerbivore:false, vision:60, attackDmg:20, favoredBiomes:[BIOME.FOREST,BIOME.TAIGA,BIOME.MOUNTAIN] },
};

const STATE = { WANDER:'wander', FLEE:'flee', HUNT:'hunt', EAT:'eat', DRINK:'drink', DEAD:'dead' };
let _nextAnimalId = 0;

export class Animal {
  constructor(x, y, type, world) {
    this.id     = _nextAnimalId++;
    this.x = x; this.y = y; this.type = type;
    this.config = ANIMAL_CONFIG[type];
    this.world  = world;
    this.hp     = this.config.maxHp;
    this.hunger = 10 + Math.random() * 20;
    this.thirst = 10 + Math.random() * 20;
    this.age    = Math.random() * 200;
    this.alive  = true;
    this.state  = STATE.WANDER;
    this.targetX = x; this.targetY = y;
    this.target  = null;
    this.breedTimer  = 150 + Math.random() * 200;
    this.attackTimer = 0;
    this._wanderTimer  = 0;
    this._eatCooldown  = 0;
    this._facing       = 1; // 1=droite -1=gauche
    this._bobTimer     = Math.random() * Math.PI * 2;
  }

  get name() { return this.type; }

  update(dt, animals, plantMgr) {
    if (!this.alive) return null;
    this.age += dt;
    this.hunger += dt * 0.008;
    this.thirst += dt * 0.010;
    this.breedTimer  -= dt;
    this.attackTimer  = Math.max(0, this.attackTimer - dt);
    this._eatCooldown = Math.max(0, this._eatCooldown - dt);
    this._bobTimer   += dt * 0.08;

    if (this.hunger > 100 || this.thirst > 100) { this.alive = false; return null; }
    const maxAge = this.config.isHerbivore ? 2400 : 3000;
    if (this.age > maxAge) { this.alive = false; return null; }
    if (this.hunger > 92) this.hp -= dt * 0.01;
    if (this.hp <= 0) { this.alive = false; return null; }

    const tile = this.world.tileAt(this.x, this.y);
    if (tile && tile.props.water > 0.3) this.thirst = Math.max(0, this.thirst - dt * 8);
    if (tile && tile.props.fertility > 0.2 && this.config.isHerbivore && this._eatCooldown <= 0) {
      this.hunger = Math.max(0, this.hunger - dt * 3.0);
    }

    const spd = this.config.speed * (tile ? tile.props.speed : 1.0);
    const prevX = this.x;
    const result = this.config.isHerbivore
      ? this._updateHerbivore(dt, animals, plantMgr, spd)
      : this._updatePredator(dt, animals, spd);
    if (this.x > prevX) this._facing = 1;
    else if (this.x < prevX) this._facing = -1;
    return result;
  }

  _updateHerbivore(dt, animals, plantMgr, spd) {
    const threat = this._findThreat(animals);
    if (threat) {
      this.state = STATE.FLEE;
      this.targetX = this.x + (this.x - threat.x) * 3;
      this.targetY = this.y + (this.y - threat.y) * 3;
    } else if (this.thirst > 55) {
      this.state = STATE.DRINK; this._seekWater();
    } else if (this.hunger > 45) {
      this.state = STATE.EAT; this._seekFood(plantMgr);
    } else {
      this._wander(dt);
    }
    const fleeSpd = this.state === STATE.FLEE ? this.config.fleeSpeed : spd;
    this._moveTo(this.targetX, this.targetY, fleeSpd);
    if (this.hunger > 20 && this.state === STATE.EAT && this._eatCooldown <= 0) {
      const harvest = plantMgr?.harvestNearest(this.x, this.y, 18);
      if (harvest && harvest.food > 0) { this.hunger = Math.max(0, this.hunger - harvest.food * 4.0); this._eatCooldown = 15; }
    }
    if (this.breedTimer < 0 && this.hunger < 55 && this.thirst < 55) {
      this.breedTimer = 120 + Math.random() * 150;
      if (Math.random() < 0.012) return this._breed();
    }
    return null;
  }

  _updatePredator(dt, animals, spd) {
    if (!this.target || !this.target.alive) this.target = this._findPrey(animals);
    if (this.target && this.hunger > 20) {
      this.state = STATE.HUNT;
      this.targetX = this.target.x; this.targetY = this.target.y;
      this._moveTo(this.targetX, this.targetY, spd);
      const dist = Math.hypot(this.x - this.target.x, this.y - this.target.y);
      if (dist < 10 && this.attackTimer <= 0) {
        this.target.hp -= (this.config.attackDmg || 10);
        this.attackTimer = 30;
        if (this.target.hp <= 0) {
          this.target.alive = false;
          this.hunger = Math.max(0, this.hunger - this.target.config.foodValue * 3);
          this.target = null;
        }
      }
    } else {
      this._wander(dt); this._moveTo(this.targetX, this.targetY, spd * 0.7);
    }
    if (this.breedTimer < 0 && this.hunger < 50) {
      this.breedTimer = 350 + Math.random() * 300;
      if (Math.random() < 0.003) return this._breed();
    }
    return null;
  }

  _findThreat(animals) {
    const v = this.config.vision;
    for (const a of animals) {
      if (!a.alive || a.config.isHerbivore) continue;
      if (Math.hypot(a.x - this.x, a.y - this.y) < v) return a;
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
    const near = this.world.findNearestBiomes(this.x, this.y, [BIOME.RIVER, BIOME.LAKE], 120);
    if (near.length > 0) { const t = near[0].tile; this.targetX = t.x * TILE_SIZE + 4; this.targetY = t.y * TILE_SIZE + 4; }
  }
  _seekFood(plantMgr) {
    if (!plantMgr) return;
    let best = null, bestDist = 80;
    for (const p of plantMgr.plants) {
      if (!p.alive || !p.mature) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    if (best) { this.targetX = best.x; this.targetY = best.y; }
    else {
      const f = this.world.findNearestBiomes(this.x, this.y, [BIOME.PRAIRIE,BIOME.PLAIN,BIOME.FOREST], 60);
      if (f.length > 0) { this.targetX = f[0].tile.x * TILE_SIZE; this.targetY = f[0].tile.y * TILE_SIZE; }
    }
  }
  _wander(dt) {
    this._wanderTimer -= dt;
    if (this._wanderTimer <= 0) {
      this._wanderTimer = 40 + Math.random() * 80;
      this.state = STATE.WANDER;
      const a = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 80;
      this.targetX = this.x + Math.cos(a) * d;
      this.targetY = this.y + Math.sin(a) * d;
    }
  }
  _moveTo(tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 2) return;
    const nx2 = this.x + (dx/dist)*speed, ny2 = this.y + (dy/dist)*speed;
    const tile = this.world.tileAt(nx2, ny2);
    if (tile && tile.props.passable) {
      this.x = Math.max(0, Math.min(this.world.cols * TILE_SIZE - 1, nx2));
      this.y = Math.max(0, Math.min(this.world.rows * TILE_SIZE - 1, ny2));
    } else {
      this.targetX = this.x + (Math.random()-0.5)*60;
      this.targetY = this.y + (Math.random()-0.5)*60;
    }
  }
  _breed() {
    const a = Math.random() * Math.PI * 2;
    const child = new Animal(this.x + Math.cos(a)*14, this.y + Math.sin(a)*14, this.type, this.world);
    child.hunger = 15; child.thirst = 15; child.age = 0;
    return child;
  }

  // ——— Rendu HD par type ——————————————————————————————
  draw(ctx, camX, camY) {
    if (!this.alive) return;
    const sx = this.x - camX;
    const sy = this.y - camY;
    const sz = this.config.size;
    const bob = Math.sin(this._bobTimer) * (this.state === STATE.WANDER ? 0.5 : 1.2);
    const f   = this._facing;

    // Ombre au sol
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + sz*0.8, sz*0.9, sz*0.3, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, sy + bob);

    switch(this.type) {
      case ANIMAL_TYPE.RABBIT: this._drawRabbit(ctx, sz, f); break;
      case ANIMAL_TYPE.DEER:   this._drawDeer(ctx, sz, f);   break;
      case ANIMAL_TYPE.SHEEP:  this._drawSheep(ctx, sz, f);  break;
      case ANIMAL_TYPE.GOAT:   this._drawGoat(ctx, sz, f);   break;
      case ANIMAL_TYPE.BOAR:   this._drawBoar(ctx, sz, f);   break;
      case ANIMAL_TYPE.WOLF:   this._drawWolf(ctx, sz, f);   break;
      case ANIMAL_TYPE.FOX:    this._drawFox(ctx, sz, f);    break;
      case ANIMAL_TYPE.LYNX:   this._drawLynx(ctx, sz, f);   break;
      case ANIMAL_TYPE.BEAR:   this._drawBear(ctx, sz, f);   break;
    }
    ctx.restore();

    // HP bar
    if (this.hp < this.config.maxHp) {
      const pct = this.hp / this.config.maxHp;
      ctx.fillStyle = '#111'; ctx.fillRect(sx-sz, sy-sz-5, sz*2, 3);
      ctx.fillStyle = pct > 0.5 ? '#3c3' : '#c33';
      ctx.fillRect(sx-sz, sy-sz-5, sz*2*pct, 3);
    }
  }

  _drawRabbit(ctx, sz, f) {
    const c = this.config;
    ctx.fillStyle = c.body;
    // Corps ovale
    ctx.beginPath(); ctx.ellipse(0, 0, sz*0.9, sz*0.65, 0, 0, Math.PI*2); ctx.fill();
    // Tête
    ctx.beginPath(); ctx.ellipse(f*sz*0.7, -sz*0.3, sz*0.55, sz*0.5, 0, 0, Math.PI*2); ctx.fill();
    // Oreilles
    ctx.fillRect(f*sz*0.55 - sz*0.12, -sz*1.2, sz*0.18, sz*0.7);
    ctx.fillRect(f*sz*0.85 - sz*0.12, -sz*1.1, sz*0.18, sz*0.65);
    // Ventre clair
    ctx.fillStyle = c.belly;
    ctx.beginPath(); ctx.ellipse(0, sz*0.1, sz*0.5, sz*0.38, 0, 0, Math.PI*2); ctx.fill();
    // Œil
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(f*sz*0.85, -sz*0.4, sz*0.12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f*sz*0.88, -sz*0.43, sz*0.04, 0, Math.PI*2); ctx.fill();
  }

  _drawDeer(ctx, sz, f) {
    const c = this.config;
    // Corps
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(0, 0, sz*1.1, sz*0.7, 0, 0, Math.PI*2); ctx.fill();
    // Pattes
    ctx.fillStyle = c.body;
    for (const [ox, oy] of [[-sz*0.6,sz*0.4],[sz*0.6,sz*0.4],[-sz*0.2,sz*0.5],[sz*0.2,sz*0.5]]) {
      ctx.fillRect(ox - sz*0.12, oy, sz*0.22, sz*0.6);
    }
    // Cou + tête
    ctx.beginPath(); ctx.ellipse(f*sz*0.9, -sz*0.3, sz*0.5, sz*0.45, 0.3*f, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(f*sz*0.65, -sz*0.55, sz*0.28*f, sz*0.5);
    // Bois
    ctx.strokeStyle = '#7a5020'; ctx.lineWidth = sz*0.15;
    ctx.beginPath(); ctx.moveTo(f*sz*0.8, -sz*0.7); ctx.lineTo(f*sz*0.65, -sz*1.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f*sz*0.65, -sz*1.0); ctx.lineTo(f*sz*0.35, -sz*1.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f*sz*1.0, -sz*0.7); ctx.lineTo(f*sz*1.15, -sz*1.25); ctx.stroke();
    // Ventre
    ctx.fillStyle = c.belly;
    ctx.beginPath(); ctx.ellipse(0, sz*0.2, sz*0.6, sz*0.3, 0, 0, Math.PI*2); ctx.fill();
    // Œil
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(f*sz, -sz*0.35, sz*0.12, 0, Math.PI*2); ctx.fill();
  }

  _drawSheep(ctx, sz, f) {
    const c = this.config;
    // Toison
    ctx.fillStyle = c.body;
    for (const [ox, oy, r] of [[0,0,sz*1.1],[sz*0.6,-sz*0.3,sz*0.7],[-sz*0.6,-sz*0.2,sz*0.7],[0,-sz*0.5,sz*0.6],[sz*0.4,sz*0.3,sz*0.6],[-sz*0.4,sz*0.3,sz*0.6]]) {
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI*2); ctx.fill();
    }
    // Pattes
    ctx.fillStyle = '#888';
    for (const ox of [-sz*0.5, sz*0.5]) { ctx.fillRect(ox - sz*0.1, sz*0.5, sz*0.2, sz*0.55); }
    // Tête foncée
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.ellipse(f*sz*0.9, -sz*0.3, sz*0.42, sz*0.38, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(f*sz, -sz*0.35, sz*0.1, 0, Math.PI*2); ctx.fill();
  }

  _drawBoar(ctx, sz, f) {
    const c = this.config;
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(0, 0, sz*1.15, sz*0.75, 0, 0, Math.PI*2); ctx.fill();
    // Pattes courtes
    for (const ox of [-sz*0.6,-sz*0.1,sz*0.4,sz*0.8]) {
      ctx.fillRect(ox, sz*0.45, sz*0.22, sz*0.45);
    }
    // Tête + groin
    ctx.beginPath(); ctx.ellipse(f*sz*0.9, -sz*0.1, sz*0.6, sz*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#704030';
    ctx.beginPath(); ctx.ellipse(f*sz*1.35, -sz*0.1, sz*0.3, sz*0.22, 0, 0, Math.PI*2); ctx.fill();
    // Défenses
    ctx.fillStyle = '#e8d080';
    ctx.beginPath(); ctx.moveTo(f*sz*1.3, sz*0.05); ctx.lineTo(f*sz*1.6, sz*0.2); ctx.lineTo(f*sz*1.2, sz*0.18); ctx.fill();
    // Yeux
    ctx.fillStyle='#c00'; ctx.beginPath(); ctx.arc(f*sz*0.9, -sz*0.22, sz*0.11, 0, Math.PI*2); ctx.fill();
  }

  _drawWolf(ctx, sz, f) {
    const c = this.config;
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(0, 0, sz*1.1, sz*0.65, 0, 0, Math.PI*2); ctx.fill();
    // Queue touffue
    ctx.beginPath(); ctx.moveTo(-f*sz, 0); ctx.quadraticCurveTo(-f*sz*1.6, -sz*0.6, -f*sz*1.1, -sz*0.9); ctx.lineWidth=sz*0.4; ctx.strokeStyle=c.body; ctx.stroke();
    // Pattes
    for (const [ox, oy] of [[-sz*0.5,sz*0.3],[sz*0.5,sz*0.3],[-sz*0.1,sz*0.4],[sz*0.1,sz*0.4]]) {
      ctx.fillRect(ox-sz*0.12, oy, sz*0.24, sz*0.55);
    }
    // Tête
    ctx.beginPath(); ctx.ellipse(f*sz*0.85, -sz*0.25, sz*0.6, sz*0.5, 0, 0, Math.PI*2); ctx.fill();
    // Oreilles pointues
    ctx.beginPath(); ctx.moveTo(f*sz*0.6,-sz*0.65); ctx.lineTo(f*sz*0.45,-sz*1.1); ctx.lineTo(f*sz*0.8,-sz*0.75); ctx.fill();
    ctx.beginPath(); ctx.moveTo(f*sz*1.0,-sz*0.55); ctx.lineTo(f*sz*0.9,-sz*1.0); ctx.lineTo(f*sz*1.2,-sz*0.65); ctx.fill();
    // Ventre clair
    ctx.fillStyle=c.belly; ctx.beginPath(); ctx.ellipse(0,sz*0.15,sz*0.55,sz*0.28,0,0,Math.PI*2); ctx.fill();
    // Yeux jaunes
    ctx.fillStyle='#e8b020'; ctx.beginPath(); ctx.arc(f*sz*0.9,-sz*0.3,sz*0.14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(f*sz*0.9,-sz*0.3,sz*0.07,0,Math.PI*2); ctx.fill();
  }

  _drawFox(ctx, sz, f) {
    const c = this.config;
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(0, 0, sz, sz*0.6, 0, 0, Math.PI*2); ctx.fill();
    // Queue blanche au bout
    ctx.lineWidth=sz*0.35; ctx.strokeStyle=c.body;
    ctx.beginPath(); ctx.moveTo(-f*sz,0); ctx.quadraticCurveTo(-f*sz*1.5,-sz*0.5,-f*sz*1.1,-sz*0.8); ctx.stroke();
    ctx.lineWidth=sz*0.15; ctx.strokeStyle='#f0f0f0';
    ctx.beginPath(); ctx.moveTo(-f*sz*1.2,-sz*0.65); ctx.lineTo(-f*sz*1.05,-sz*0.82); ctx.stroke();
    // Tête avec museau
    ctx.fillStyle=c.body; ctx.beginPath(); ctx.ellipse(f*sz*0.8,-sz*0.2,sz*0.55,sz*0.45,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(f*sz*1.25,-sz*0.18,sz*0.3,sz*0.2,0,0,Math.PI*2); ctx.fill();
    // Oreilles orange pointues
    ctx.fillStyle=c.body;
    ctx.beginPath(); ctx.moveTo(f*sz*0.6,-sz*0.55); ctx.lineTo(f*sz*0.4,-sz*1.05); ctx.lineTo(f*sz*0.85,-sz*0.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(f*sz*0.95,-sz*0.45); ctx.lineTo(f*sz*0.85,-sz*0.95); ctx.lineTo(f*sz*1.15,-sz*0.5); ctx.fill();
    // Nez noir
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(f*sz*1.4,-sz*0.2,sz*0.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#e0b030'; ctx.beginPath(); ctx.arc(f*sz*0.82,-sz*0.25,sz*0.13,0,Math.PI*2); ctx.fill();
  }

  _drawLynx(ctx, sz, f) {
    const c = this.config;
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(0, 0, sz*1.05, sz*0.62, 0, 0, Math.PI*2); ctx.fill();
    // Pattes
    for (const [ox, oy] of [[-sz*0.55,sz*0.3],[sz*0.55,sz*0.3],[-sz*0.15,sz*0.38],[sz*0.15,sz*0.38]]) {
      ctx.fillRect(ox-sz*0.13, oy, sz*0.26, sz*0.55);
    }
    // Tête ronde
    ctx.beginPath(); ctx.ellipse(f*sz*0.82,-sz*0.22,sz*0.58,sz*0.52,0,0,Math.PI*2); ctx.fill();
    // Oreilles avec touffe
    ctx.fillStyle=c.body;
    ctx.beginPath(); ctx.moveTo(f*sz*0.55,-sz*0.62); ctx.lineTo(f*sz*0.4,-sz*1.08); ctx.lineTo(f*sz*0.78,-sz*0.68); ctx.fill();
    ctx.beginPath(); ctx.moveTo(f*sz*0.98,-sz*0.52); ctx.lineTo(f*sz*0.88,-sz*1.0); ctx.lineTo(f*sz*1.18,-sz*0.58); ctx.fill();
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.moveTo(f*sz*0.55,-sz*0.68); ctx.lineTo(f*sz*0.46,-sz*1.0); ctx.lineTo(f*sz*0.72,-sz*0.72); ctx.fill();
    ctx.beginPath(); ctx.moveTo(f*sz*0.98,-sz*0.58); ctx.lineTo(f*sz*0.9,-sz*0.96); ctx.lineTo(f*sz*1.12,-sz*0.62); ctx.fill();
    // Motifs (taches)
    ctx.fillStyle='rgba(100,70,20,0.3)';
    for (const [ox,oy] of [[sz*0.3,-sz*0.2],[-sz*0.3,sz*0.1],[sz*0.6,sz*0.1]]) {
      ctx.beginPath(); ctx.ellipse(ox,oy,sz*0.18,sz*0.12,0,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='#30b050'; ctx.beginPath(); ctx.arc(f*sz*0.88,-sz*0.28,sz*0.14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(f*sz*0.88,-sz*0.28,sz*0.07,0,Math.PI*2); ctx.fill();
  }

  _drawBear(ctx, sz, f) {
    const c = this.config;
    // Corps massif
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(0, 0, sz*1.2, sz*0.9, 0, 0, Math.PI*2); ctx.fill();
    // Pattes épaisses
    for (const [ox,oy,w,h] of [[-sz*0.7,sz*0.4,sz*0.5,sz*0.7],[sz*0.7,sz*0.4,sz*0.5,sz*0.7],[-sz*0.7,-sz*0.2,sz*0.45,sz*0.55],[sz*0.7,-sz*0.2,sz*0.45,sz*0.55]]) {
      ctx.fillRect(ox-w/2, oy, w, h);
    }
    // Tête ronde grosse
    ctx.beginPath(); ctx.ellipse(f*sz*0.9,-sz*0.2,sz*0.72,sz*0.65,0,0,Math.PI*2); ctx.fill();
    // Oreilles rondes
    ctx.beginPath(); ctx.arc(f*sz*0.65,-sz*0.8,sz*0.28,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(f*sz*1.1,-sz*0.8,sz*0.28,0,Math.PI*2); ctx.fill();
    // Museau
    ctx.fillStyle=c.belly;
    ctx.beginPath(); ctx.ellipse(f*sz*1.35,-sz*0.18,sz*0.32,sz*0.26,0,0,Math.PI*2); ctx.fill();
    // Nez
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(f*sz*1.52,-sz*0.2,sz*0.12,0,Math.PI*2); ctx.fill();
    // Yeux petits
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(f*sz*0.95,-sz*0.38,sz*0.12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(f*sz*0.97,-sz*0.4,sz*0.04,0,Math.PI*2); ctx.fill();
    // Ventre clair
    ctx.fillStyle=c.belly; ctx.beginPath(); ctx.ellipse(0,sz*0.2,sz*0.55,sz*0.38,0,0,Math.PI*2); ctx.fill();
  }

  _drawGoat(ctx, sz, f) {
    const c = this.config;
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(0, 0, sz*1.05, sz*0.65, 0, 0, Math.PI*2); ctx.fill();
    for (const ox of [-sz*0.55,sz*0.55,-sz*0.15,sz*0.15]) {
      ctx.fillRect(ox-sz*0.1, sz*0.38, sz*0.2, sz*0.6);
    }
    ctx.beginPath(); ctx.ellipse(f*sz*0.82,-sz*0.25,sz*0.52,sz*0.46,0,0,Math.PI*2); ctx.fill();
    // Cornes
    ctx.strokeStyle='#a08040'; ctx.lineWidth=sz*0.15;
    ctx.beginPath(); ctx.moveTo(f*sz*0.6,-sz*0.62); ctx.quadraticCurveTo(f*sz*0.3,-sz*1.1,f*sz*0.55,-sz*1.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f*sz*0.95,-sz*0.6); ctx.quadraticCurveTo(f*sz*0.75,-sz*1.05,f*sz*0.9,-sz*0.98); ctx.stroke();
    // Barbe
    ctx.strokeStyle=c.body; ctx.lineWidth=sz*0.18;
    ctx.beginPath(); ctx.moveTo(f*sz*1.25,-sz*0.1); ctx.lineTo(f*sz*1.25,sz*0.3); ctx.stroke();
    ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(f*sz*0.92,-sz*0.32,sz*0.1,0,Math.PI*2); ctx.fill();
  }

  getInfo() {
    return {
      type: this.type, age: Math.floor(this.age),
      hp: `${Math.floor(this.hp)}/${this.config.maxHp}`,
      hunger: Math.floor(this.hunger), thirst: Math.floor(this.thirst),
      state: this.state, herbivore: this.config.isHerbivore,
    };
  }
}

// ——— AnimalManager ——————————————————————————————————————
export class AnimalManager {
  constructor(world, maxAnimals = 400) {
    this.world = world; this.maxAnimals = maxAnimals;
    this.animals = []; this._respawnTimer = 0;
    this._seed();
  }
  _seed() {
    const herbi = Object.values(ANIMAL_TYPE).filter(t => ANIMAL_CONFIG[t].isHerbivore);
    const preda = Object.values(ANIMAL_TYPE).filter(t => !ANIMAL_CONFIG[t].isHerbivore);
    for (let i = 0; i < 160; i++) this._spawnRandom(herbi[Math.floor(Math.random() * herbi.length)]);
    for (let i = 0; i < 8;   i++) this._spawnRandom(preda[Math.floor(Math.random() * preda.length)]);
  }
  _spawnRandom(type) {
    const cfg = ANIMAL_CONFIG[type];
    for (let tries = 0; tries < 40; tries++) {
      const tx = Math.floor(Math.random() * this.world.cols);
      const ty = Math.floor(Math.random() * this.world.rows);
      const tile = this.world.getTile(tx, ty);
      if (!tile || !tile.props.passable) continue;
      if (cfg.favoredBiomes && !cfg.favoredBiomes.includes(tile.biome) && Math.random() > 0.3) continue;
      const wx = tx * TILE_SIZE + 4 + (Math.random()-0.5)*4;
      const wy = ty * TILE_SIZE + 4 + (Math.random()-0.5)*4;
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
    this._respawnTimer += dt;
    if (this._respawnTimer > 30) {
      this._respawnTimer = 0;
      const herbi = Object.values(ANIMAL_TYPE).filter(t => ANIMAL_CONFIG[t].isHerbivore);
      const preda = Object.values(ANIMAL_TYPE).filter(t => !ANIMAL_CONFIG[t].isHerbivore);
      const th = this.animals.filter(a => a.config.isHerbivore).length;
      const tp = this.animals.filter(a => !a.config.isHerbivore).length;
      if (th < 80) for (let i=0;i<5;i++) this._spawnRandom(herbi[Math.floor(Math.random()*herbi.length)]);
      if (tp < 5)  this._spawnRandom(preda[Math.floor(Math.random()*preda.length)]);
      if (Math.random() < 0.30 && this.animals.length < this.maxAnimals)
        this._spawnRandom(herbi[Math.floor(Math.random()*herbi.length)]);
    }
  }
  draw(ctx, camX, camY, viewW, viewH) {
    const visible = this.animals.filter(a =>
      a.alive &&
      a.x >= camX - 20 && a.x <= camX + viewW + 20 &&
      a.y >= camY - 20 && a.y <= camY + viewH + 20
    );
    visible.sort((a, b) => a.y - b.y);
    for (const a of visible) a.draw(ctx, camX, camY);
  }
  getStats() {
    let herbivores=0, predators=0; const byType={};
    for (const a of this.animals) {
      if (!a.alive) continue;
      byType[a.type]=(byType[a.type]||0)+1;
      if (a.config.isHerbivore) herbivores++; else predators++;
    }
    return { total: this.animals.length, herbivores, predators, byType };
  }
  toJSON() {
    return this.animals.map(a => ({ x:a.x, y:a.y, type:a.type, hp:a.hp, hunger:a.hunger, age:a.age }));
  }
}
