// ============================================================
// world.js — Génération procédurale + rendu haute qualité
// GRAPHISMES : dégradés par biome, ombres, variation de teinte,
//              eau animée, reliefs, bordures douces entre biomes
// ============================================================

import { BIOME, BIOME_PROPS, getBiomeFromParams } from './biomes.js';

// ——— Bruit de Perlin ——————————————————————————————————————
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function buildPermTable(seed) {
  const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed | 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p];
}

function grad(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export class NoiseGen {
  constructor(seed = 42) { this.perm = buildPermTable(seed); }
  noise2(x, y) {
    const p = this.perm;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X+1] + Y;
    return lerp(
      lerp(grad(p[a],   x,   y),   grad(p[b],   x-1, y),   u),
      lerp(grad(p[a+1], x,   y-1), grad(p[b+1], x-1, y-1), u),
      v
    );
  }
  fractal(x, y, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.noise2(x * freq, y * freq) * amp;
      max += amp; amp *= persistence; freq *= lacunarity;
    }
    return val / max;
  }
}

// ——— Couleurs enrichies par biome (base + variation + ombre) ——
const BIOME_COLORS = {
  [BIOME.OCEAN]:        { base:[18,58,130],   dark:[10,35,90],   light:[30,80,170]  },
  [BIOME.RIVER]:        { base:[30,95,185],   dark:[18,60,140],  light:[50,120,210] },
  [BIOME.LAKE]:         { base:[22,72,148],   dark:[12,45,110],  light:[35,95,185]  },
  [BIOME.BEACH]:        { base:[210,185,100], dark:[180,155,70], light:[230,210,130]},
  [BIOME.PLAIN]:        { base:[130,175,95],  dark:[100,145,65], light:[155,200,115]},
  [BIOME.PRAIRIE]:      { base:[155,195,105], dark:[120,160,75], light:[180,220,130]},
  [BIOME.FOREST]:       { base:[45,110,45],   dark:[25,75,25],   light:[65,140,60]  },
  [BIOME.DENSE_FOREST]: { base:[28,80,28],    dark:[15,50,15],   light:[45,110,40]  },
  [BIOME.JUNGLE]:       { base:[20,85,20],    dark:[10,55,10],   light:[35,115,30]  },
  [BIOME.SWAMP]:        { base:[65,95,50],    dark:[40,65,28],   light:[88,120,65]  },
  [BIOME.DESERT]:       { base:[200,165,70],  dark:[165,130,40], light:[225,195,100]},
  [BIOME.SAVANNA]:      { base:[175,155,55],  dark:[140,120,30], light:[200,180,80] },
  [BIOME.TUNDRA]:       { base:[148,165,175], dark:[115,135,148],light:[175,190,200]},
  [BIOME.TAIGA]:        { base:[75,115,90],   dark:[50,85,62],   light:[100,145,115]},
  [BIOME.HILL]:         { base:[110,130,90],  dark:[80,100,62],  light:[140,160,115]},
  [BIOME.MOUNTAIN]:     { base:[140,135,130], dark:[105,100,95], light:[175,170,165]},
  [BIOME.VOLCANO]:      { base:[155,40,25],   dark:[110,22,10],  light:[195,65,45]  },
};

// Convertit [r,g,b] en string CSS
function rgb(r, g, b) { return `rgb(${r|0},${g|0},${b|0})`; }
// Mélange deux couleurs
function mixColor(c1, c2, t) {
  return [
    c1[0] + (c2[0]-c1[0])*t,
    c1[1] + (c2[1]-c1[1])*t,
    c1[2] + (c2[2]-c1[2])*t,
  ];
}

// ——— Tile ————————————————————————————————————————————————
export class Tile {
  constructor(x, y, biome, noiseVal = 0) {
    this.x = x; this.y = y;
    this.biome    = biome;
    this.props    = BIOME_PROPS[biome];
    this.noiseVal = noiseVal; // 0–1 pour variation visuelle
    this.wood     = Math.round(this.props.wood  * 80 + Math.random() * 20);
    this.stone    = Math.round(this.props.stone * 80 + Math.random() * 20);
    this.food     = Math.round(this.props.food  * 60 + Math.random() * 20);
    this.ore      = Math.round(this.props.ore   * 60 + Math.random() * 20);
    this.water    = this.props.water > 0.5 ? 100 : Math.round(this.props.water * 100);
    this.regenTimer = 0;
  }
  regen(dt) {
    this.regenTimer += dt;
    if (this.regenTimer > 60) {
      this.regenTimer = 0;
      const p = this.props;
      if (this.wood  < p.wood  * 80) this.wood  = Math.min(100, this.wood  + 1);
      if (this.food  < p.food  * 60) this.food  = Math.min(100, this.food  + 1);
      if (this.stone < p.stone * 80) this.stone = Math.min(100, this.stone + 1);
    }
  }
  harvest(type, amount) {
    const cur = this[type] || 0;
    const taken = Math.min(cur, amount);
    this[type] = cur - taken;
    return taken;
  }
}

// ——— World ——————————————————————————————————————————————
export const TILE_SIZE = 8;

export class World {
  constructor(cols = 180, rows = 120, seed = Date.now()) {
    this.cols = cols;
    this.rows = rows;
    this.seed = seed;
    this.tiles = [];
    this.offscreenCanvas = null;
    this.offscreenCtx    = null;
    this._mapDirty  = true;
    this._waterAnim = 0; // compteur animation eau
    this._elevMap   = []; // stocke élévation pour ombres
    this._generate();
    this._buildOffscreen();
  }

  _generate() {
    const noiseElev  = new NoiseGen(this.seed);
    const noiseMois  = new NoiseGen(this.seed + 9999);
    const noiseTemp  = new NoiseGen(this.seed + 7777);
    const noiseDetail= new NoiseGen(this.seed + 3333); // détail visuel

    this.tiles = [];
    this._elevMap = [];

    for (let y = 0; y < this.rows; y++) {
      this.tiles[y]   = [];
      this._elevMap[y]= [];
      for (let x = 0; x < this.cols; x++) {
        let e = (noiseElev.fractal(x / 60, y / 60, 7, 0.55, 2.0) + 1) / 2;
        let m = (noiseMois.fractal(x / 50, y / 50, 5, 0.5,  2.0) + 1) / 2;
        let t = (noiseTemp.fractal(x / 80, y / 80, 4, 0.45, 2.0) + 1) / 2;
        const d = (noiseDetail.fractal(x / 20, y / 20, 3, 0.5, 2.0) + 1) / 2;

        const nx = (x / this.cols) * 2 - 1;
        const ny = (y / this.rows) * 2 - 1;
        const dist = Math.sqrt(nx*nx + ny*ny);
        e = Math.max(0, e - dist * dist * 0.7);
        t = t * 0.5 + (1 - y / this.rows) * 0.5;

        this._elevMap[y][x] = e;
        const biome = getBiomeFromParams(e, m, t);
        this.tiles[y][x] = new Tile(x, y, biome, d);
      }
    }
    this._carveRivers(6);
  }

  _carveRivers(count) {
    for (let r = 0; r < count; r++) {
      let sx, sy, tries = 0;
      do {
        sx = Math.floor(Math.random() * this.cols);
        sy = Math.floor(Math.random() * this.rows);
        tries++;
      } while (tries < 200 && ![BIOME.MOUNTAIN, BIOME.HILL].includes(this.tiles[sy]?.[sx]?.biome));
      if (tries >= 200) continue;
      let cx = sx, cy2 = sy;
      for (let step = 0; step < 300; step++) {
        const tile = this.tiles[cy2]?.[cx];
        if (!tile || tile.biome === BIOME.OCEAN || tile.biome === BIOME.LAKE) break;
        if (tile.biome !== BIOME.RIVER) this.tiles[cy2][cx] = new Tile(cx, cy2, BIOME.RIVER, Math.random());
        const dx = cx  < this.cols / 2 ? -1 : 1;
        const dy = cy2 < this.rows  / 2 ? -1 : 1;
        if (Math.random() < 0.5) cx  = Math.max(0, Math.min(this.cols-1, cx  + (Math.random() < 0.7 ? dx : (Math.random()<0.5?1:-1))));
        else                      cy2 = Math.max(0, Math.min(this.rows-1, cy2 + (Math.random() < 0.7 ? dy : (Math.random()<0.5?1:-1))));
      }
    }
  }

  // ——— Offscreen canvas HD ————————————————————————————————
  _buildOffscreen() {
    const w = this.cols * TILE_SIZE;
    const h = this.rows * TILE_SIZE;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width  = w;
    this.offscreenCanvas.height = h;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this._redrawMap();

    // Canvas eau animée séparé
    this.waterCanvas = document.createElement('canvas');
    this.waterCanvas.width  = w;
    this.waterCanvas.height = h;
    this.waterCtx = this.waterCanvas.getContext('2d');
  }

  // ——— Rendu carte haute qualité —————————————————————————
  _redrawMap() {
    const ctx  = this.offscreenCtx;
    const TS   = TILE_SIZE;

    // Passe 1 : couleur de base avec variation de bruit
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile  = this.tiles[y][x];
        const bc    = BIOME_COLORS[tile.biome] || BIOME_COLORS[BIOME.PLAIN];
        const noise = tile.noiseVal;

        // Variation de couleur selon bruit local (±15%)
        let col;
        if (noise < 0.35) col = mixColor(bc.dark, bc.base, noise / 0.35);
        else if (noise < 0.65) col = bc.base;
        else col = mixColor(bc.base, bc.light, (noise - 0.65) / 0.35);

        ctx.fillStyle = rgb(col[0], col[1], col[2]);
        ctx.fillRect(x * TS, y * TS, TS, TS);
      }
    }

    // Passe 2 : ombres de relief (nord-ouest = lumière)
    for (let y = 1; y < this.rows - 1; y++) {
      for (let x = 1; x < this.cols - 1; x++) {
        const e  = this._elevMap[y][x];
        const eN = this._elevMap[y-1]?.[x] ?? e;
        const eW = this._elevMap[y]?.[x-1] ?? e;
        const slope = (e - eN) + (e - eW);

        if (slope > 0.04) {
          // Ombre (pente montante depuis NW)
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, slope * 2.5)})`;
          ctx.fillRect(x * TS, y * TS, TS, TS);
        } else if (slope < -0.04) {
          // Lumière (pente descendante = versant éclairé)
          ctx.fillStyle = `rgba(255,255,220,${Math.min(0.25, -slope * 1.5)})`;
          ctx.fillRect(x * TS, y * TS, TS, TS);
        }
      }
    }

    // Passe 3 : détails visuels par biome
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.tiles[y][x];
        const px   = x * TS, py = y * TS;
        const rng  = tile.noiseVal;

        if (tile.biome === BIOME.BEACH) {
          // Lignes de vagues sur la plage
          if (rng > 0.7) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(px, py + TS - 2, TS, 1);
          }
        }
        else if (tile.biome === BIOME.DESERT) {
          // Dunes — stries horizontales
          if (rng > 0.6) {
            ctx.fillStyle = 'rgba(255,220,100,0.25)';
            ctx.fillRect(px, py + 2, TS, 2);
          }
        }
        else if (tile.biome === BIOME.MOUNTAIN || tile.biome === BIOME.VOLCANO) {
          // Neige au sommet
          if (this._elevMap[y]?.[x] > 0.88) {
            ctx.fillStyle = 'rgba(240,240,255,0.65)';
            ctx.fillRect(px, py, TS, TS / 2);
          }
          // Lignes rocheuses
          if (rng > 0.75) {
            ctx.fillStyle = 'rgba(80,70,60,0.3)';
            ctx.fillRect(px + 1, py + 1, TS - 2, 2);
          }
        }
        else if (tile.biome === BIOME.TUNDRA) {
          // Glace parsemée
          if (rng > 0.72) {
            ctx.fillStyle = 'rgba(200,230,255,0.4)';
            ctx.fillRect(px + 1, py + 1, TS - 2, TS - 2);
          }
        }
        else if (tile.biome === BIOME.SWAMP) {
          // Eau stagnante
          if (rng > 0.65) {
            ctx.fillStyle = 'rgba(30,60,20,0.35)';
            ctx.fillRect(px + 2, py + 2, TS - 4, TS - 4);
          }
        }
        else if (tile.biome === BIOME.HILL) {
          // Pierres
          if (rng > 0.78) {
            ctx.fillStyle = 'rgba(100,90,80,0.3)';
            ctx.fillRect(px + 2, py + 3, TS - 4, 2);
          }
        }
      }
    }

    // Passe 4 : bordures douces entre biomes (anti-aliasing biome)
    this._drawBiomeBorders(ctx);

    this._mapDirty = false;
  }

  _drawBiomeBorders(ctx) {
    const TS = TILE_SIZE;
    // Légère ligne sombre entre biomes différents pour définition
    ctx.globalAlpha = 0.18;
    for (let y = 0; y < this.rows - 1; y++) {
      for (let x = 0; x < this.cols - 1; x++) {
        const t  = this.tiles[y][x];
        const tr = this.tiles[y][x+1];
        const tb = this.tiles[y+1][x];
        if (t.biome !== tr.biome) {
          ctx.fillStyle = '#000';
          ctx.fillRect((x+1)*TS - 1, y*TS, 1, TS);
        }
        if (t.biome !== tb.biome) {
          ctx.fillStyle = '#000';
          ctx.fillRect(x*TS, (y+1)*TS - 1, TS, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // ——— Animation eau (appelée chaque frame) ———————————————
  _animateWater(time) {
    const ctx = this.waterCtx;
    const TS  = TILE_SIZE;
    ctx.clearRect(0, 0, this.waterCanvas.width, this.waterCanvas.height);

    const wave = Math.sin(time * 0.002) * 0.5 + 0.5; // 0–1

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const b = this.tiles[y][x].biome;
        if (b !== BIOME.OCEAN && b !== BIOME.LAKE && b !== BIOME.RIVER) continue;

        const px = x * TS, py = y * TS;
        const localWave = Math.sin(time * 0.003 + x * 0.4 + y * 0.3) * 0.5 + 0.5;

        if (b === BIOME.OCEAN || b === BIOME.LAKE) {
          // Reflet lumineux sur l'eau
          ctx.fillStyle = `rgba(120,180,255,${0.08 + localWave * 0.12})`;
          ctx.fillRect(px, py, TS, TS);
          // Petite vague blanche
          if (localWave > 0.75) {
            ctx.fillStyle = `rgba(255,255,255,${(localWave - 0.75) * 0.6})`;
            ctx.fillRect(px + 1, py + 2, TS - 2, 1);
          }
        } else if (b === BIOME.RIVER) {
          // Courant rivière : lignes animées
          ctx.fillStyle = `rgba(80,160,255,${0.1 + localWave * 0.15})`;
          ctx.fillRect(px, py, TS, TS);
        }
      }
    }
  }

  // ——— Update ——————————————————————————————————————————
  update(dt) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.tiles[y][x].regen(dt);
      }
    }
  }

  // ——— Draw (appelle animation eau chaque frame) ——————————
  draw(ctx, camX, camY, viewW, viewH, timestamp = 0) {
    if (this._mapDirty) this._redrawMap();

    // Fond : carte statique
    ctx.drawImage(this.offscreenCanvas, camX, camY, viewW, viewH, 0, 0, viewW, viewH);

    // Surcouche : eau animée
    this._animateWater(timestamp);
    ctx.drawImage(this.waterCanvas, camX, camY, viewW, viewH, 0, 0, viewW, viewH);
  }

  // ——— Utilitaires ——————————————————————————————————————
  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return this.tiles[y][x];
  }
  tileAt(worldX, worldY) {
    return this.getTile(Math.floor(worldX / TILE_SIZE), Math.floor(worldY / TILE_SIZE));
  }
  findNearestBiomes(wx, wy, biomeList, maxDist = 30) {
    const tx = Math.floor(wx / TILE_SIZE), ty = Math.floor(wy / TILE_SIZE);
    const results = [];
    const r = Math.ceil(maxDist / TILE_SIZE);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const t = this.getTile(tx + dx, ty + dy);
        if (t && biomeList.includes(t.biome)) results.push({ tile: t, dist: Math.sqrt(dx*dx + dy*dy) });
      }
    }
    results.sort((a, b) => a.dist - b.dist);
    return results.slice(0, 5);
  }
  findBuildSpot(wx, wy, radius = 20) {
    const tx = Math.floor(wx / TILE_SIZE), ty = Math.floor(wy / TILE_SIZE);
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const t = this.getTile(tx + dx, ty + dy);
          if (t && t.props.buildable) return t;
        }
      }
    }
    return null;
  }
  getStats() {
    let totalWood = 0, totalFood = 0, totalStone = 0, totalOre = 0, waterTiles = 0, landTiles = 0;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.tiles[y][x];
        totalWood += t.wood; totalFood += t.food; totalStone += t.stone; totalOre += t.ore;
        if ([BIOME.OCEAN, BIOME.LAKE, BIOME.RIVER].includes(t.biome)) waterTiles++;
        else landTiles++;
      }
    }
    return { totalWood, totalFood, totalStone, totalOre, waterTiles, landTiles };
  }
  toJSON() { return { cols: this.cols, rows: this.rows, seed: this.seed }; }
}
