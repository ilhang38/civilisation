// ============================================================
// renderer.js — Rendu HD avancé : frontières, heatmap, routes,
//               territoires colorés, spatial hash grid
// ============================================================

import { TILE_SIZE } from './world.js';

// ——— SPATIAL HASH GRID (optimisation) ————————————————
export class SpatialHash {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.cells    = new Map();
  }
  _key(x, y) {
    return `${Math.floor(x/this.cellSize)},${Math.floor(y/this.cellSize)}`;
  }
  insert(entity) {
    const k = this._key(entity.x, entity.y);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push(entity);
  }
  query(x, y, radius) {
    const results = [];
    const r = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const k = `${cx+dx},${cy+dy}`;
        const cell = this.cells.get(k);
        if (cell) results.push(...cell);
      }
    }
    return results;
  }
  clear() { this.cells.clear(); }
}

// ——— TERRITOIRE & FRONTIÈRES ——————————————————————————
export class TerritoryRenderer {
  constructor(world) {
    this.world      = world;
    this.canvas     = document.createElement('canvas');
    this.canvas.width  = world.cols * TILE_SIZE;
    this.canvas.height = world.rows * TILE_SIZE;
    this.ctx        = this.canvas.getContext('2d');
    this._dirty     = true;
    this._lastHash  = '';
  }

  _hash(settlements) {
    return settlements.map(s=>`${s.id}:${s.humans.length}:${s.level}`).join('|');
  }

  update(settlements) {
    const h = this._hash(settlements);
    if (h === this._lastHash) return;
    this._lastHash = h;
    this._redraw(settlements);
  }

  _redraw(settlements) {
    const ctx = this.ctx;
    const W   = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (settlements.length === 0) return;

    // Voronoi simplifié : pour chaque tuile, trouver la colonie la plus proche
    const TS = TILE_SIZE;
    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return [r,g,b];
    };

    // Pré-calculer couleurs
    const colors = settlements.map(s => hexToRgb(s.factionColor || '#4488ff'));
    const radii  = settlements.map(s => {
      const r = { CAMP:80, VILLAGE:140, TOWN:220, CITY:320, METROPOLIS:480 };
      return r[s.level] || 80;
    });

    // Sous-échantillonnage : calculer 1 pixel sur 4 pour les performances
    const step = 4;
    for (let py = 0; py < H; py += step) {
      for (let px = 0; px < W; px += step) {
        let bestDist = Infinity, bestIdx = -1;
        for (let i = 0; i < settlements.length; i++) {
          const s = settlements[i];
          const dist = Math.hypot(px - s.x, py - s.y);
          if (dist < radii[i] && dist < bestDist) {
            bestDist = dist; bestIdx = i;
          }
        }
        if (bestIdx < 0) continue;

        const alpha = Math.max(0, 1 - bestDist / radii[bestIdx]);
        const [r,g,b] = colors[bestIdx];
        const a = Math.floor(alpha * 38); // très transparent

        // Remplir le bloc step×step
        for (let dy = 0; dy < step && py+dy < H; dy++) {
          for (let dx = 0; dx < step && px+dx < W; dx++) {
            const idx = ((py+dy)*W + (px+dx)) * 4;
            data[idx]   = r;
            data[idx+1] = g;
            data[idx+2] = b;
            data[idx+3] = a;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Frontières : dessiner cercles épais aux limites de territoire
    for (let i = 0; i < settlements.length; i++) {
      const s = settlements[i];
      const [r,g,b] = colors[i];
      const atWar = s.atWarWith?.size > 0;
      ctx.strokeStyle = atWar
        ? `rgba(255,50,50,0.7)`
        : `rgba(${r},${g},${b},0.6)`;
      ctx.lineWidth = atWar ? 2.5 : 1.5;
      if (atWar) ctx.setLineDash([8,4]);
      else       ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, radii[i], 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  draw(ctx, camX, camY, viewW, viewH) {
    ctx.drawImage(this.canvas, camX, camY, viewW, viewH, 0, 0, viewW, viewH);
  }
}

// ——— HEATMAP DE POPULATION ——————————————————————————
export class HeatmapRenderer {
  constructor() {
    this._canvas  = null;
    this._ctx     = null;
    this._timer   = 0;
    this._visible = false;
    this._mode    = 'population'; // 'population' | 'wealth' | 'military'
  }

  toggle(mode = 'population') {
    if (this._mode === mode && this._visible) {
      this._visible = false;
    } else {
      this._mode    = mode;
      this._visible = true;
    }
    this._canvas = null; // force redraw
  }

  update(dt, settlements, worldW, worldH) {
    if (!this._visible) return;
    this._timer += dt;
    if (this._timer < 120) return;
    this._timer = 0;
    this._build(settlements, worldW, worldH);
  }

  _build(settlements, W, H) {
    if (!this._canvas) {
      this._canvas = document.createElement('canvas');
      this._canvas.width  = Math.floor(W / 8);
      this._canvas.height = Math.floor(H / 8);
      this._ctx = this._canvas.getContext('2d');
    }
    const ctx   = this._ctx;
    const cW    = this._canvas.width;
    const cH    = this._canvas.height;
    ctx.clearRect(0, 0, cW, cH);

    for (const s of settlements) {
      let value = 0;
      if (this._mode === 'population') value = s.humans.length;
      else if (this._mode === 'wealth') value = (s.stockpile.gold||0) + s.stockpile.food/10;
      else if (this._mode === 'military') value = s.humans.filter(h=>h.job==='soldier').length;

      if (value < 1) continue;
      const cx = (s.x / (W)) * cW;
      const cy = (s.y / (H)) * cH;
      const r  = Math.min(cW * 0.15, 10 + value * 0.5);
      const alpha = Math.min(0.7, 0.2 + value * 0.01);

      let color;
      if (this._mode === 'military') color = `rgba(220,50,50,${alpha})`;
      else if (this._mode === 'wealth') color = `rgba(255,200,50,${alpha})`;
      else color = `rgba(50,150,255,${alpha})`;

      const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    }
  }

  draw(ctx, viewW, viewH) {
    if (!this._visible || !this._canvas) return;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this._canvas, 0, 0, viewW, viewH);
    ctx.globalAlpha = 1.0;

    // Légende
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, viewH - 28, 120, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    const labels = { population:'Heatmap Population', wealth:'Heatmap Richesse', military:'Heatmap Militaire' };
    ctx.fillText(labels[this._mode] || '', 14, viewH - 14);
  }
}

// ——— ROUTES COMMERCIALES ——————————————————————————————
export class RouteRenderer {
  constructor() {
    this._routes  = []; // { from, to, active, goods }
    this._timer   = 0;
    this._offsets = new Map(); // animOffset par route
  }

  update(dt, diplomacy, settlements) {
    this._timer += dt;
    // Extraire routes depuis caravanes actives
    this._routes = (diplomacy?.caravans || []).map(c => ({
      fromX: settlements.find(s=>s.id===c.fromId)?.x || c.x,
      fromY: settlements.find(s=>s.id===c.fromId)?.y || c.y,
      toX:   c.destX, toY: c.destY,
      cx: c.x, cy: c.y,
      color: c.color || '#ffa030',
    }));
  }

  draw(ctx, camX, camY, diplomacy, settlements) {
    if (!diplomacy) return;
    const t = this._timer * 0.02;

    // Routes fixes entre alliés
    for (const [key, rel] of (diplomacy.relations || new Map())) {
      if (rel.type !== 'ally') continue;
      const [id1,id2] = key.split('-').map(Number);
      const a = settlements.find(s=>s.id===id1);
      const b = settlements.find(s=>s.id===id2);
      if (!a||!b) continue;

      const ax=a.x-camX, ay=a.y-camY, bx=b.x-camX, by=b.y-camY;

      // Route dessinée avec tirets animés
      ctx.save();
      ctx.strokeStyle = 'rgba(255,200,80,0.35)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Caravanes en transit
    for (const r of this._routes) {
      const cx = r.cx-camX, cy = r.cy-camY;
      ctx.fillStyle = r.color;
      ctx.beginPath(); ctx.arc(cx,cy,3.5,0,Math.PI*2); ctx.fill();
      ctx.font = '8px serif'; ctx.textAlign='center';
      ctx.fillText('🐪', cx, cy-5);
      ctx.textAlign='left';
    }
  }
}

// ——— NOTIFICATIONS ANIMÉES ———————————————————————————
export class NotificationSystem {
  constructor() {
    this.notifications = [];
    this._container    = null;
    this._init();
  }

  _init() {
    this._container = document.createElement('div');
    this._container.id = 'notif-container';
    this._container.style.cssText = `
      position:fixed; top:60px; right:260px;
      z-index:200; pointer-events:none;
      display:flex; flex-direction:column; gap:6px;
    `;
    document.body.appendChild(this._container);
  }

  push(icon, title, desc, color = '#4db8ff') {
    const el = document.createElement('div');
    el.style.cssText = `
      background:rgba(9,14,24,0.95);
      border:1px solid ${color};
      border-left:3px solid ${color};
      border-radius:6px;
      padding:8px 12px;
      font-family:'Share Tech Mono',monospace;
      font-size:11px;
      color:#c8d8f0;
      max-width:260px;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
      animation:notifIn 0.3s ease;
    `;
    el.innerHTML = `<div style="color:${color};font-weight:bold">${icon} ${title}</div>
                    <div style="color:#5a7a9a;font-size:10px;margin-top:2px">${desc}</div>`;
    this._container.appendChild(el);

    // Auto-remove après 4s
    setTimeout(() => {
      el.style.transition = 'opacity 0.5s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  }

  pushAchievement(ach) {
    this.push('🏆', ach.name, ach.desc, '#ffd060');
  }

  pushEvent(icon, text, color) {
    this.push(icon, text, '', color || '#4db8ff');
  }
}
