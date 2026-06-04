// ============================================================
// graphs.js — Graphiques temps réel en canvas
// ============================================================

const MAX_HISTORY = 200;

export class GraphManager {
  constructor() {
    this.history = {
      population: [],
      food:       [],
      animals:    [],
      cities:     [],
      resources:  [],
    };
    this.canvases = {};
    this._init();
  }

  _init() {
    const ids = {
      population: 'graph-population',
      food:       'graph-food',
      animals:    'graph-animals',
      cities:     'graph-cities',
      resources:  'graph-resources',
    };
    for (const [key, id] of Object.entries(ids)) {
      const el = document.getElementById(id);
      if (el) this.canvases[key] = el;
    }
  }

  push(data) {
    for (const [key, val] of Object.entries(data)) {
      if (!this.history[key]) this.history[key] = [];
      this.history[key].push(val);
      if (this.history[key].length > MAX_HISTORY) this.history[key].shift();
    }
  }

  draw() {
    const configs = {
      population: { color:'#4a9eff', label:'Pop' },
      food:       { color:'#43d98f', label:'Food' },
      animals:    { color:'#f5c842', label:'Animaux' },
      cities:     { color:'#ff7b3a', label:'Villes' },
      resources:  { color:'#c060ff', label:'Res.' },
    };
    for (const [key, cfg] of Object.entries(configs)) {
      const canvas = this.canvases[key];
      if (!canvas) continue;
      this._drawGraph(canvas, this.history[key] || [], cfg.color, cfg.label);
    }
  }

  _drawGraph(canvas, data, color, label) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Fond
    ctx.fillStyle = '#060809';
    ctx.fillRect(0, 0, W, H);

    if (data.length < 2) return;

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    // Grille
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth   = 1;
    for (let g = 0; g <= 4; g++) {
      const gy = H - (g / 4) * H;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Remplissage
    const step = W / (data.length - 1);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < data.length; i++) {
      const px = i * step;
      const py = H - ((data[i] - min) / range) * (H - 4) - 2;
      if (i === 0) ctx.lineTo(px, py);
      else         ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color + '33';
    ctx.fill();

    // Ligne
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const px = i * step;
      const py = H - ((data[i] - min) / range) * (H - 4) - 2;
      if (i === 0) ctx.moveTo(px, py);
      else         ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Valeur courante
    ctx.font      = 'bold 10px Courier New';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(data[data.length-1])}`, 4, 12);

    // Max
    ctx.fillStyle = '#6b7c9a';
    ctx.font      = '8px Courier New';
    ctx.fillText(`max:${Math.round(max)}`, 4, H - 4);
  }
}
