// ============================================================
// world.js — Génération procédurale du monde & rendu carte
// ============================================================

import { BIOME, BIOME_PROPS, getBiomeFromParams } from './biomes.js';

// ——— Perlin-like noise (simplifié, sans dépendance) ——————————
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
  return [...p, ...p]; // doubled
}

function grad(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export class NoiseGen {
  constructor(seed = 42) {
    this.perm = buildPermTable(seed);
  }
  noise2(x, y) {
    const p = this.perm;
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a  = p[X] + Y;
    const b  = p[X+1] + Y;
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
      max += amp;
      amp  *= persistence;
      freq *= lacunarity;
    }
    return val / max;
  }
}

// ——— Tile ——————————————————————————————————————————————————
export class Tile {
  constructor(x, y, biome) {
    this.x = x;
    this.y = y;
    this.biome = biome;
    this.props = BIOME_PROPS[biome];
    // Ressources locales (0–100)
    this.wood   = Math.round(this.props.wood  * 80 + Math.random() * 20);
    this.stone  = Math.round(this.props.stone * 80 + Math.random() * 20);
    this.food   = Math.round(this.props.food  * 60 + Math.random() * 20);
    this.ore    = Math.round(this.props.ore   * 60 + Math.random() * 20);
    this.water  = this.props.water > 0.5 ? 100 : Math.round(this.props.water * 100);
    // Régénération
    this.regenTimer = 0;
    this.dirty = true; // à redessiner
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

// ——— World ——————————————————————————————————————————————————
export const TILE_SIZE = 8; // pixels par tuile

export class World {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {number} seed
   */
  constructor(cols = 180, rows = 120, seed = Date.now()) {
    this.cols = cols;
    this.rows = rows;
    this.seed = seed;
    this.tiles = [];
    this.offscreenCanvas = null;
    this.offscreenCtx    = null;
    this._mapDirty = true;
    this._generate();
    this._buildOffscreen();
  }

  // ——— Génération ————————————————————————————————————————
  _generate() {
    const noiseElev = new NoiseGen(this.seed);
    const noiseMois = new NoiseGen(this.seed + 9999);
    const noiseTemp = new NoiseGen(this.seed + 7777);

    this.tiles = [];
    const cx = this.cols / 2, cy = this.rows / 2;

    for (let y = 0; y < this.rows; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.cols; x++) {
        // Normaliser bruit [0,1]
        let e = (noiseElev.fractal(x / 60, y / 60, 7, 0.55, 2.0) + 1) / 2;
        let m = (noiseMois.fractal(x / 50, y / 50, 5, 0.5,  2.0) + 1) / 2;
        let t = (noiseTemp.fractal(x / 80, y / 80, 4, 0.45, 2.0) + 1) / 2;

        // Gradient île : bords = océan
        const nx = (x / this.cols) * 2 - 1;
        const ny = (y / this.rows) * 2 - 1;
        const dist = Math.sqrt(nx*nx + ny*ny);
        e = Math.max(0, e - dist * dist * 0.7);

        // Température latitudinale
        t = t * 0.5 + (1 - y / this.rows) * 0.5;

        const biome = getBiomeFromParams(e, m, t);
        this.tiles[y][x] = new Tile(x, y, biome);
      }
    }

    // Rivières : tracés depuis les collines vers l'océan
    this._carveRivers(6);
  }

  _carveRivers(count) {
    for (let r = 0; r < count; r++) {
      // Trouver une colline ou montagne aléatoire
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
        if (tile.biome !== BIOME.RIVER) {
          this.tiles[cy2][cx] = new Tile(cx, cy2, BIOME.RIVER);
        }
        // Descendre vers l'océan (bord)
        const dx = cx < this.cols / 2 ? -1 : 1;
        const dy = cy2 < this.rows  / 2 ? -1 : 1;
        if (Math.random() < 0.5) cx  = Math.max(0, Math.min(this.cols-1, cx  + (Math.random() < 0.7 ? dx : (Math.random()<0.5?1:-1))));
        else                      cy2 = Math.max(0, Math.min(this.rows-1, cy2 + (Math.random() < 0.7 ? dy : (Math.random()<0.5?1:-1))));
      }
    }
  }

  // ——— Offscreen canvas pour la carte statique ————————————
  _buildOffscreen() {
    const w = this.cols * TILE_SIZE;
    const h = this.rows * TILE_SIZE;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width  = w;
    this.offscreenCanvas.height = h;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this._redrawMap();
  }

  _redrawMap() {
    const ctx = this.offscreenCtx;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tile = this.tiles[y][x];
        ctx.fillStyle = tile.props.color;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    this._mapDirty = false;
  }

  // ——— Mise à jour monde ——————————————————————————————————
  update(dt) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.tiles[y][x].regen(dt);
      }
    }
  }

  // ——— Dessin de la carte (copie offscreen) ————————————————
  draw(ctx, camX, camY, viewW, viewH) {
    if (this._mapDirty) this._redrawMap();
    // Copier la portion visible
    ctx.drawImage(
      this.offscreenCanvas,
      camX, camY, viewW, viewH,
      0, 0, viewW, viewH
    );
  }

  // ——— Utilitaires ——————————————————————————————————————
  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return this.tiles[y][x];
  }

  tileAt(worldX, worldY) {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    return this.getTile(tx, ty);
  }

  /** Trouve les N tuiles les plus proches d'un biome donné depuis (wx,wy) */
  findNearestBiomes(wx, wy, biomeList, maxDist = 30) {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    const results = [];
    const r = Math.ceil(maxDist / TILE_SIZE);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const t = this.getTile(tx + dx, ty + dy);
        if (t && biomeList.includes(t.biome)) {
          results.push({ tile: t, dist: Math.sqrt(dx*dx + dy*dy) });
        }
      }
    }
    results.sort((a, b) => a.dist - b.dist);
    return results.slice(0, 5);
  }

  /** Trouver tuile buildable la plus proche */
  findBuildSpot(wx, wy, radius = 20) {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
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

  /** Stats globales du monde */
  getStats() {
    let totalWood = 0, totalFood = 0, totalStone = 0, totalOre = 0;
    let waterTiles = 0, landTiles = 0;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.tiles[y][x];
        totalWood  += t.wood;
        totalFood  += t.food;
        totalStone += t.stone;
        totalOre   += t.ore;
        if ([BIOME.OCEAN, BIOME.LAKE, BIOME.RIVER].includes(t.biome)) waterTiles++;
        else landTiles++;
      }
    }
    return { totalWood, totalFood, totalStone, totalOre, waterTiles, landTiles };
  }

  toJSON() {
    return { cols: this.cols, rows: this.rows, seed: this.seed };
  }
}
