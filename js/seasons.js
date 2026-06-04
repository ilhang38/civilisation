// ============================================================
// seasons.js — Saisons, Nuit/Jour, Catastrophes, Météo
// ============================================================

export const SEASON = { SPRING:'spring', SUMMER:'summer', AUTUMN:'autumn', WINTER:'winter' };

const SEASON_CONFIG = {
  [SEASON.SPRING]: { name:'Printemps', icon:'🌸', color:'rgba(120,220,100,0.06)', fertilityMult:1.3, foodMult:1.2, tempOffset:0.1,  duration:1200 },
  [SEASON.SUMMER]: { name:'Été',       icon:'☀',  color:'rgba(255,200,50,0.07)',  fertilityMult:1.1, foodMult:1.4, tempOffset:0.25, duration:1400 },
  [SEASON.AUTUMN]: { name:'Automne',   icon:'🍂', color:'rgba(200,100,30,0.07)',  fertilityMult:0.8, foodMult:0.9, tempOffset:0.0,  duration:1200 },
  [SEASON.WINTER]: { name:'Hiver',     icon:'❄',  color:'rgba(180,220,255,0.10)', fertilityMult:0.2, foodMult:0.3, tempOffset:-0.3, duration:1000 },
};

const SEASONS_ORDER = [SEASON.SPRING, SEASON.SUMMER, SEASON.AUTUMN, SEASON.WINTER];

export const DISASTER_TYPE = {
  EARTHQUAKE: 'earthquake', DROUGHT: 'drought',
  EPIDEMIC:   'epidemic',   VOLCANO:  'volcano',
  STORM:      'storm',
};

export class SeasonSystem {
  constructor() {
    this.seasonIdx    = 0;
    this.seasonTimer  = 0;
    this.year         = 1;
    // Jour/Nuit
    this.dayTimer     = 0;
    this.dayDuration  = 400;
    this.isNight      = false;
    this.nightAlpha   = 0;   // 0=jour, 1=nuit totale
    // Catastrophes
    this.disasters    = [];  // actives
    this.disasterTimer= 800 + Math.random()*800;
    // Journal
    this.eventLog     = [];  // { tick, icon, text }
    this.tick         = 0;
  }

  get season()     { return SEASONS_ORDER[this.seasonIdx]; }
  get seasonCfg()  { return SEASON_CONFIG[this.season]; }

  update(dt, settlements, world) {
    this.tick += dt;

    // Saisons
    this.seasonTimer += dt;
    const dur = this.seasonCfg.duration;
    if (this.seasonTimer >= dur) {
      this.seasonTimer = 0;
      this.seasonIdx   = (this.seasonIdx + 1) % 4;
      if (this.seasonIdx === 0) this.year++;
      this._logEvent(this.seasonCfg.icon, `${this.seasonCfg.name} — Année ${this.year}`);
    }

    // Nuit / Jour
    this.dayTimer += dt;
    if (this.dayTimer >= this.dayDuration) this.dayTimer = 0;
    const dayPhase  = this.dayTimer / this.dayDuration;
    // 0-0.3 = aube, 0.3-0.6 = jour, 0.6-0.75 = crépuscule, 0.75-1 = nuit
    if (dayPhase < 0.3)       this.nightAlpha = 0.6 * (1 - dayPhase / 0.3);
    else if (dayPhase < 0.65) this.nightAlpha = 0;
    else if (dayPhase < 0.78) this.nightAlpha = 0.7 * ((dayPhase - 0.65) / 0.13);
    else                      this.nightAlpha = 0.7;
    this.isNight = this.nightAlpha > 0.4;

    // Météo / catastrophes
    this.disasterTimer -= dt;
    if (this.disasterTimer < 0) {
      this.disasterTimer = 600 + Math.random() * 1200;
      this._spawnDisaster(settlements, world);
    }

    // Mettre à jour catastrophes actives
    for (let i = this.disasters.length-1; i >= 0; i--) {
      const d = this.disasters[i];
      d.timer -= dt;
      if (d.timer <= 0) {
        this.disasters.splice(i, 1);
        continue;
      }
      this._applyDisaster(d, dt, settlements);
    }
  }

  _spawnDisaster(settlements, world) {
    if (settlements.length === 0) return;
    const types   = Object.values(DISASTER_TYPE);
    const type    = types[Math.floor(Math.random() * types.length)];
    const target  = settlements[Math.floor(Math.random() * settlements.length)];

    // Pas de volcan si pas de biome volcanique proche
    if (type === DISASTER_TYPE.VOLCANO && Math.random() > 0.3) return;

    const configs = {
      [DISASTER_TYPE.EARTHQUAKE]: { icon:'🌋', name:'Séisme',    color:'#b06020', duration:300,  radius:80 },
      [DISASTER_TYPE.DROUGHT]:    { icon:'🌵', name:'Sécheresse',color:'#c0a030', duration:1500, radius:200 },
      [DISASTER_TYPE.EPIDEMIC]:   { icon:'💀', name:'Épidémie',  color:'#60c040', duration:800,  radius:120 },
      [DISASTER_TYPE.VOLCANO]:    { icon:'🌋', name:'Éruption',  color:'#ff4020', duration:400,  radius:60  },
      [DISASTER_TYPE.STORM]:      { icon:'⛈', name:'Tempête',   color:'#4060a0', duration:500,  radius:160 },
    };

    const cfg = configs[type];
    const d = {
      type, x: target.x + (Math.random()-0.5)*200, y: target.y + (Math.random()-0.5)*200,
      timer: cfg.duration, maxTimer: cfg.duration,
      icon: cfg.icon, name: cfg.name, color: cfg.color, radius: cfg.radius,
      intensity: 0.3 + Math.random() * 0.7,
    };
    this.disasters.push(d);
    this._logEvent(cfg.icon, `${cfg.name} frappe près de ${target.name}!`);
  }

  _applyDisaster(d, dt, settlements) {
    const pct = d.timer / d.maxTimer;

    for (const s of settlements) {
      const dist = Math.hypot(s.x - d.x, s.y - d.y);
      if (dist > d.radius) continue;
      const strength = (1 - dist/d.radius) * d.intensity;

      switch(d.type) {
        case DISASTER_TYPE.DROUGHT:
          // Réduit nourriture
          s.stockpile.food = Math.max(0, s.stockpile.food - strength * 0.5 * dt);
          break;
        case DISASTER_TYPE.EPIDEMIC:
          // Tue des humains aléatoirement
          if (Math.random() < strength * 0.0005 * dt && s.humans.length > 2) {
            s.humans[Math.floor(Math.random()*s.humans.length)].alive = false;
          }
          break;
        case DISASTER_TYPE.EARTHQUAKE:
          // Détruit des bâtiments
          if (Math.random() < strength * 0.001 * dt && s.buildings.length > 0) {
            s.buildings.splice(Math.floor(Math.random()*s.buildings.length), 1);
          }
          break;
        case DISASTER_TYPE.STORM:
          // Réduit bois et nourriture
          s.stockpile.food = Math.max(0, s.stockpile.food - strength * 0.3 * dt);
          s.stockpile.wood = Math.max(0, s.stockpile.wood - strength * 0.2 * dt);
          break;
        case DISASTER_TYPE.VOLCANO:
          // Très destructeur
          if (Math.random() < strength * 0.002 * dt && s.humans.length > 1) {
            s.humans[Math.floor(Math.random()*s.humans.length)].alive = false;
          }
          break;
      }
    }
  }

  _logEvent(icon, text) {
    this.eventLog.unshift({ tick: this.tick, icon, text, time: new Date().toLocaleTimeString() });
    if (this.eventLog.length > 50) this.eventLog.pop();
  }

  logExternal(icon, text) { this._logEvent(icon, text); }

  // Rendu : overlay nuit, effets saison, particules catastrophe
  draw(ctx, W, H, camX, camY) {
    // Overlay nuit
    if (this.nightAlpha > 0.01) {
      const gradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.8);
      gradient.addColorStop(0, `rgba(0,5,20,${this.nightAlpha * 0.5})`);
      gradient.addColorStop(1, `rgba(0,5,30,${this.nightAlpha * 0.85})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Étoiles la nuit
      if (this.nightAlpha > 0.5) {
        ctx.fillStyle = `rgba(255,255,255,${(this.nightAlpha-0.5)*0.6})`;
        // Étoiles fixes basées sur position (pseudo-aléatoire)
        for (let i = 0; i < 60; i++) {
          const sx = ((i * 137.5) % W);
          const sy = ((i * 97.3)  % (H * 0.6));
          const r  = i % 3 === 0 ? 1.2 : 0.7;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    // Overlay saison
    const sc = this.seasonCfg;
    if (sc.color) {
      ctx.fillStyle = sc.color;
      ctx.fillRect(0, 0, W, H);
    }

    // Particules catastrophes
    for (const d of this.disasters) {
      this._drawDisaster(ctx, d, camX, camY, W, H);
    }
  }

  _drawDisaster(ctx, d, camX, camY, W, H) {
    const sx = d.x - camX, sy = d.y - camY;
    if (sx < -d.radius*2 || sx > W+d.radius*2) return;
    if (sy < -d.radius*2 || sy > H+d.radius*2) return;

    const pct   = d.timer / d.maxTimer;
    const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;

    // Cercle d'effet
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, d.radius);
    grad.addColorStop(0,   d.color + Math.floor(pulse * 60).toString(16).padStart(2,'0'));
    grad.addColorStop(0.6, d.color + '15');
    grad.addColorStop(1,   d.color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, d.radius, 0, Math.PI*2); ctx.fill();

    // Icône + nom
    ctx.font      = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.icon, sx, sy - 8);
    ctx.font      = 'bold 8px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(d.name, sx, sy + 6);
    ctx.textAlign = 'left';

    // Particules spécifiques
    if (d.type === DISASTER_TYPE.VOLCANO || d.type === DISASTER_TYPE.EARTHQUAKE) {
      for (let i = 0; i < 5; i++) {
        const angle = (Date.now() * 0.002 + i * 1.26) % (Math.PI*2);
        const dist  = 15 + Math.sin(Date.now()*0.005+i)*10;
        ctx.fillStyle = '#ff6020';
        ctx.beginPath();
        ctx.arc(sx + Math.cos(angle)*dist, sy + Math.sin(angle)*dist, 2, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  getSeasonMultipliers() {
    return {
      fertility: this.seasonCfg.fertilityMult,
      food:      this.seasonCfg.foodMult,
    };
  }

  getStatus() {
    return {
      season: this.seasonCfg.name,
      icon:   this.seasonCfg.icon,
      year:   this.year,
      isNight: this.isNight,
      disasters: this.disasters.map(d => ({ icon:d.icon, name:d.name })),
    };
  }
}
