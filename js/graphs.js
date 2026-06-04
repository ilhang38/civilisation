// ============================================================
// graphs.js — Graphiques avancés : multi-courbes, tendances,
//             événements sur courbes, zoom historique
// ============================================================

const MAX_HISTORY = 300;

const GRAPH_CONFIGS = {
  population: { color:'#4a9eff', label:'Population',  unit:'👥' },
  food:       { color:'#43d98f', label:'Nourriture',  unit:'🍖' },
  animals:    { color:'#f5c842', label:'Animaux',     unit:'🐾' },
  cities:     { color:'#ff7b3a', label:'Colonies',    unit:'🏙' },
  resources:  { color:'#c060ff', label:'Ressources',  unit:'📦' },
  gold:       { color:'#ffd060', label:'Or',          unit:'💰' },
  tech:       { color:'#60d0ff', label:'Technologie', unit:'⚗' },
  military:   { color:'#ff5050', label:'Militaire',   unit:'⚔' },
};

export class GraphManager {
  constructor() {
    this.history  = Object.fromEntries(Object.keys(GRAPH_CONFIGS).map(k=>[k,[]]));
    this.events   = []; // { tick, icon, key } pour afficher sur courbes
    this.canvases = {};
    this._tick    = 0;
    this._zoomStart = null; // null = pas de zoom
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
      if (el) {
        this.canvases[key] = el;
        // Tooltip sur hover
        el.addEventListener('mousemove', (e) => this._onHover(e, key, el));
        el.addEventListener('mouseleave', () => this._hideTooltip());
      }
    }

    // Injecter style tooltip
    if (!document.getElementById('graph-tooltip-style')) {
      const s = document.createElement('style');
      s.id = 'graph-tooltip-style';
      s.textContent = `
        #graph-tooltip {
          position:fixed; background:rgba(9,14,24,0.95);
          border:1px solid #2a4060; border-radius:4px;
          padding:4px 8px; font:10px "Share Tech Mono",monospace;
          color:#c8d8f0; pointer-events:none; z-index:300;
        }
        @keyframes notifIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:none} }
      `;
      document.head.appendChild(s);
    }
  }

  push(data) {
    this._tick++;
    for (const [key, val] of Object.entries(data)) {
      if (!this.history[key]) this.history[key] = [];
      this.history[key].push(val);
      if (this.history[key].length > MAX_HISTORY) this.history[key].shift();
    }
  }

  addEvent(icon, keys) {
    const idx = (this.history[keys[0]]?.length || 0) - 1;
    if (idx >= 0) this.events.push({ idx, icon, keys });
    if (this.events.length > 50) this.events.shift();
  }

  draw() {
    for (const key of Object.keys(GRAPH_CONFIGS)) {
      const canvas = this.canvases[key];
      if (!canvas) continue;
      this._drawGraph(canvas, key);
    }
  }

  _drawGraph(canvas, key) {
    const ctx = canvas.getContext('2d');
    const W   = canvas.width, H = canvas.height;
    const cfg = GRAPH_CONFIGS[key];
    const data = this.history[key] || [];

    ctx.clearRect(0, 0, W, H);

    // Fond dégradé
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0, '#0a0f18');
    bg.addColorStop(1, '#060809');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (data.length < 2) {
      ctx.fillStyle = '#2a3a50';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('En attente...', W/2, H/2);
      ctx.textAlign = 'left';
      return;
    }

    const max   = Math.max(...data, 1);
    const min   = Math.min(...data, 0);
    const range = max - min || 1;

    // Grille
    ctx.strokeStyle = '#0f1a28';
    ctx.lineWidth   = 1;
    for (let g = 0; g <= 3; g++) {
      const gy = H - 8 - (g / 3) * (H - 12);
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      if (g > 0) {
        ctx.fillStyle = '#1e3050';
        ctx.font = '7px monospace';
        ctx.fillText(Math.round(min + (range * g/3)), 2, gy - 1);
      }
    }

    const step = W / (data.length - 1);

    // Zone de remplissage dégradée
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, cfg.color + '40');
    grad.addColorStop(1, cfg.color + '05');
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < data.length; i++) {
      const px = i * step;
      const py = H - 8 - ((data[i] - min) / range) * (H - 16);
      i === 0 ? ctx.lineTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Ligne principale
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const px = i * step;
      const py = H - 8 - ((data[i] - min) / range) * (H - 16);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur  = 3;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Tendance (flèche)
    if (data.length >= 5) {
      const recent = data.slice(-5);
      const trend  = recent[recent.length-1] - recent[0];
      const arrow  = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
      const color  = trend > 0 ? '#43d98f' : trend < 0 ? '#ff4455' : '#888';
      ctx.fillStyle  = color;
      ctx.font       = 'bold 10px monospace';
      ctx.textAlign  = 'right';
      ctx.fillText(arrow, W - 2, 10);
      ctx.textAlign  = 'left';
    }

    // Marqueurs d'événements sur la courbe
    for (const ev of this.events) {
      if (!ev.keys.includes(key)) continue;
      const offset = data.length - 1 - (this.events.indexOf(ev));
      if (offset < 0 || offset >= data.length) continue;
      const px = offset * step;
      const py = H - 8 - ((data[offset] - min) / range) * (H - 16);
      ctx.fillStyle = '#ffd060';
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
      ctx.font = '8px serif'; ctx.textAlign = 'center';
      ctx.fillText(ev.icon, px, py - 5);
      ctx.textAlign = 'left';
    }

    // Valeur courante avec unité
    const last = data[data.length-1];
    ctx.font      = 'bold 10px "Share Tech Mono",monospace';
    ctx.fillStyle = cfg.color;
    ctx.textAlign = 'left';
    ctx.fillText(`${cfg.unit} ${Math.round(last)}`, 3, 10);

    // Max en bas
    ctx.fillStyle = '#2a4060';
    ctx.font      = '7px monospace';
    ctx.fillText(`max:${Math.round(max)}`, 3, H - 2);
  }

  _onHover(e, key, canvas) {
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const data = this.history[key] || [];
    if (data.length < 2) return;
    const idx  = Math.round((mx / canvas.width) * (data.length - 1));
    const val  = data[idx];
    if (val == null) return;

    let tt = document.getElementById('graph-tooltip');
    if (!tt) {
      tt = document.createElement('div');
      tt.id = 'graph-tooltip';
      document.body.appendChild(tt);
    }
    const cfg = GRAPH_CONFIGS[key];
    tt.textContent = `${cfg.label}: ${Math.round(val)}`;
    tt.style.left  = (e.clientX + 10) + 'px';
    tt.style.top   = (e.clientY - 20) + 'px';
    tt.style.display = 'block';
  }

  _hideTooltip() {
    const tt = document.getElementById('graph-tooltip');
    if (tt) tt.style.display = 'none';
  }
}
