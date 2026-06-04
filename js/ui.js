// ============================================================
// ui.js — Interface complète : stats, sélection, journal, classement
// ============================================================

import { CITY_LEVEL, BUILDING_TYPE } from './city.js';
import { TECH_CONFIG }               from './technology.js';

export class UI {
  constructor(sim) {
    this.sim = sim;
    this._updateTimer  = 0;
    this._minimapTimer = 0;
    this._selected     = null;
    this.tooltip       = document.getElementById('tooltip');
    this._minimapCtx   = document.getElementById('minimap-canvas')?.getContext('2d');
  }

  update(dt) {
    this._updateTimer += dt;
    if (this._updateTimer < 25) return;
    this._updateTimer = 0;

    this._drawWorldStats();
    this._drawEcologyStats();
    this._drawWarStats();
    this._drawDiploStats();
    this._drawRanking();
    this._drawCityList();
    this._drawTechList();
    this._drawEventLog();
    this._drawResourceBar();
    if (this._selected) this._drawSelection();

    // Minimap moins souvent
    this._minimapTimer += 25;
    if (this._minimapTimer > 200) { this._minimapTimer=0; this._drawMinimap(); }
  }

  // ——— Monde ——————————————————————————————————————————
  _drawWorldStats() {
    const el = document.getElementById('world-stats');
    if (!el) return;
    const sim = this.sim;
    const pop = sim.settlements.reduce((s,c)=>s+c.humans.length, 0);
    const season = sim.seasonSys?.getStatus() || {};

    el.innerHTML = `
      <div class="stat-row"><span class="stat-label">👥 Population</span><span class="stat-value blue">${pop}</span></div>
      <div class="stat-row"><span class="stat-label">🏙 Colonies</span><span class="stat-value orange">${sim.settlements.length}</span></div>
      <div class="stat-row"><span class="stat-label">${season.icon||'🌸'} Saison</span><span class="stat-value">${season.season||'—'}</span></div>
      <div class="stat-row"><span class="stat-label">📅 Année</span><span class="stat-value">${season.year||1}</span></div>
      <div class="stat-row"><span class="stat-label">${season.isNight?'🌙 Nuit':'☀ Jour'}</span><span class="stat-value ${season.isNight?'':'green'}">${season.isNight?'Nuit':'Jour'}</span></div>
      ${(season.disasters||[]).map(d=>`<div class="stat-row pulse"><span class="stat-label">${d.icon} ${d.name}</span><span class="stat-value red">ACTIF</span></div>`).join('')}
    `;

    // Badge saison topbar
    const badge = document.getElementById('season-badge');
    if (badge) badge.textContent = `${season.icon||'🌸'} ${season.season||''}`;
  }

  _drawEcologyStats() {
    const el = document.getElementById('ecology-stats');
    if (!el) return;
    const ps = this.sim.plantMgr.getStats();
    const as = this.sim.animalMgr.getStats();
    el.innerHTML = `
      <div class="stat-row"><span class="stat-label">🌳 Arbres</span><span class="stat-value green">${ps.tree}</span></div>
      <div class="stat-row"><span class="stat-label">🍓 Baies</span><span class="stat-value green">${ps.berry}</span></div>
      <div class="stat-row"><span class="stat-label">🐇 Herbivores</span><span class="stat-value">${as.herbivores}</span></div>
      <div class="stat-row"><span class="stat-label">🐺 Prédateurs</span><span class="stat-value red">${as.predators}</span></div>
    `;
  }

  _drawWarStats() {
    const el = document.getElementById('war-stats');
    if (!el) return;
    const wars = [];
    const seen = new Set();
    for (const s of this.sim.settlements) {
      for (const eid of (s.atWarWith||new Set())) {
        const key = [s.id,eid].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const e = this.sim.settlements.find(x=>x.id===eid);
        if (e) wars.push({ a:s, b:e });
      }
    }
    if (wars.length===0) {
      el.innerHTML = '<p class="muted" style="font-size:10px">☮ Aucun conflit</p>'; return;
    }
    el.innerHTML = wars.map(w=>`
      <div style="padding:2px 0;font-size:10px;border-bottom:1px solid #1e2d42">
        <span style="color:${w.a.factionColor}">${w.a.name}</span>
        <span style="color:#ff4444"> ⚔ </span>
        <span style="color:${w.b.factionColor}">${w.b.name}</span>
      </div>`).join('');
  }

  _drawDiploStats() {
    const el = document.getElementById('diplo-stats');
    if (!el || !this.sim.diplomacy) return;
    const stats = this.sim.diplomacy.getStats(this.sim.settlements);
    const bandits = this.sim.diplomacy.bandits.filter(b=>b.alive).length;
    el.innerHTML = `
      <div class="stat-row"><span class="stat-label">🤝 Alliances</span><span class="stat-value green">${stats.alliances}</span></div>
      <div class="stat-row"><span class="stat-label">🐪 Caravanes</span><span class="stat-value">${stats.caravans}</span></div>
      <div class="stat-row"><span class="stat-label">💀 Bandits</span><span class="stat-value red">${bandits}</span></div>
    `;

    // Religions
    const religions = {};
    for (const s of this.sim.settlements) {
      if (s.religion) religions[s.religion.name] = (religions[s.religion.name]||0)+1;
    }
    el.innerHTML += Object.entries(religions).map(([name,count])=>`
      <div class="stat-row" style="font-size:10px">
        <span class="stat-label">${name}</span>
        <span class="stat-value">${count} villes</span>
      </div>`).join('');
  }

  _drawRanking() {
    const el = document.getElementById('ranking-stats');
    if (!el) return;
    const ranked = [...this.sim.settlements]
      .map(s => ({
        s,
        score: s.humans.length * 10 + s.buildings.length * 5 + (s.stockpile.gold||0) * 2 + s.tech.researched.size * 15
      }))
      .sort((a,b)=>b.score-a.score)
      .slice(0,5);

    el.innerHTML = ranked.map((r,i)=>`
      <div class="stat-row" style="font-size:10px">
        <span style="color:${r.s.factionColor}">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${r.s.name}</span>
        <span class="stat-value">${r.score}</span>
      </div>`).join('');
  }

  // ——— Panneau droit ———————————————————————————————————
  _drawCityList() {
    const el = document.getElementById('city-list');
    if (!el) return;
    if (!this.sim.settlements.length) { el.innerHTML='<p class="muted">Aucune colonie</p>'; return; }
    el.innerHTML = this.sim.settlements.map((s,i)=>{
      const lvl = CITY_LEVEL[s.level];
      const atWar = s.atWarWith?.size>0;
      return `<div class="city-card" data-idx="${i}" style="border-left:3px solid ${s.factionColor}">
        <div class="city-name">${lvl.icon} ${s.name} ${atWar?'⚔':''}</div>
        <div class="city-level" style="color:${s.factionColor}">${lvl.name} · ${s.religion?.icon||''} ${s.religion?.name||''}</div>
        <div class="city-pop">👤 ${s.humans.length}/${s.maxPop} · 🍖${Math.floor(s.stockpile.food)}</div>
      </div>`;
    }).join('');

    el.querySelectorAll('.city-card').forEach(card=>{
      card.addEventListener('click',()=>{
        const s = this.sim.settlements[parseInt(card.dataset.idx)];
        this.selectObject({type:'city',obj:s});
        this.sim.camera.targetX = s.x - this.sim.canvas.width/2;
        this.sim.camera.targetY = s.y - this.sim.canvas.height/2;
      });
    });
  }

  _drawTechList() {
    const el = document.getElementById('tech-list');
    if (!el || !this.sim.settlements.length) return;
    const s = [...this.sim.settlements].sort((a,b)=>b.tech.researched.size-a.tech.researched.size)[0];
    if (!s) return;
    const prog = s.tech.getProgress();
    el.innerHTML = (prog?`<div class="tech-item tech-progress pulse"><span>⏳ ${prog.name}</span><span>${Math.round(prog.pct*100)}%</span></div>`:'') +
      Object.entries(TECH_CONFIG).map(([key,cfg])=>{
        let cls='tech-locked',st='🔒';
        if (s.tech.researched.has(key)) { cls='tech-done'; st='✅'; }
        else if (cfg.requires.every(r=>s.tech.researched.has(r))) { cls='tech-progress'; st='🔬'; }
        return `<div class="tech-item ${cls}"><span>${cfg.icon} ${cfg.name}</span><span>${st}</span></div>`;
      }).join('');
  }

  _drawEventLog() {
    const el = document.getElementById('event-log');
    if (!el || !this.sim.seasonSys) return;
    const events = this.sim.seasonSys.eventLog.slice(0,15);
    if (!events.length) { el.innerHTML='<p class="muted" style="font-size:10px">Aucun événement</p>'; return; }
    el.innerHTML = events.map(e=>`
      <div style="padding:2px 0;border-bottom:1px solid #111820;font-size:10px">
        <span style="opacity:0.5;font-size:9px">${e.time} </span>
        <span>${e.icon} ${e.text}</span>
      </div>`).join('');
  }

  _drawResourceBar() {
    const totals = {food:0,wood:0,stone:0,ore:0,gold:0};
    for (const s of this.sim.settlements)
      for (const k of Object.keys(totals)) totals[k]+=(s.stockpile[k]||0);
    const f = (v)=>v>=1000?`${(v/1000).toFixed(1)}k`:Math.floor(v);
    const el = id => document.getElementById(id);
    el('res-food') && (el('res-food').textContent  = `🍖 ${f(totals.food)}`);
    el('res-wood') && (el('res-wood').textContent  = `🪵 ${f(totals.wood)}`);
    el('res-stone')&& (el('res-stone').textContent = `🪨 ${f(totals.stone)}`);
    el('res-ore')  && (el('res-ore').textContent   = `⛏ ${f(totals.ore)}`);
    el('res-gold') && (el('res-gold').textContent  = `💰 ${f(totals.gold)}`);
  }

  // ——— Sélection ——————————————————————————————————————
  selectObject(sel) { this._selected=sel; this._drawSelection(); }

  _drawSelection() {
    const el=document.getElementById('selection-info');
    if (!el||!this._selected) return;
    const {type,obj}=this._selected;

    if (type==='human') {
      const i=obj.getInfo();
      el.innerHTML=`
        <div class="sel-name">${i.sex==='M'?'👨':'👩'} ${i.name}</div>
        <div class="sel-type">Humain — ${i.job}</div>
        <div class="sel-stat"><span>Âge</span><span>${i.age}</span></div>
        <div class="sel-stat"><span>État</span><span>${i.state}</span></div>
        <div class="sel-stat"><span>Faim</span><span style="color:${i.hunger>70?'#f55':'#5d5'}">${i.hunger}%</span></div>
        <div class="sel-stat"><span>Soif</span><span style="color:${i.thirst>70?'#f55':'#5d5'}">${i.thirst}%</span></div>
        <div class="sel-stat"><span>Énergie</span><span>${i.energy}%</span></div>
        <div class="sel-stat"><span>Intelligence</span><span>${i.intelligence}</span></div>
        <div class="sel-stat"><span>Force</span><span>${i.strength}</span></div>
      `;
    } else if (type==='animal') {
      const i=obj.getInfo();
      el.innerHTML=`
        <div class="sel-name">${i.herbivore?'🐇':'🐺'} ${i.type}</div>
        <div class="sel-type">${i.herbivore?'Herbivore':'Prédateur'}</div>
        <div class="sel-stat"><span>Âge</span><span>${i.age}</span></div>
        <div class="sel-stat"><span>HP</span><span>${i.hp}</span></div>
        <div class="sel-stat"><span>Faim</span><span style="color:${i.hunger>70?'#f55':'#5d5'}">${i.hunger}%</span></div>
        <div class="sel-stat"><span>État</span><span>${i.state}</span></div>
      `;
    } else if (type==='city') {
      const i=obj.getInfo();
      const rel = this.sim.diplomacy ? [...(obj.atWarWith||[])].map(id=>{
        const e=this.sim.settlements.find(s=>s.id===id);
        return e?`⚔ ${e.name}`:'';
      }).filter(Boolean) : [];
      el.innerHTML=`
        <div class="sel-name" style="color:${obj.factionColor}">🏙 ${i.name}</div>
        <div class="sel-type">${i.level}</div>
        <div class="sel-stat"><span>👥 Population</span><span>${i.population}/${i.maxPop}</span></div>
        <div class="sel-stat"><span>${obj.religion?.icon||'🙏'} Religion</span><span>${obj.religion?.name||'—'}</span></div>
        <div class="sel-stat"><span>🏗 Bâtiments</span><span>${i.buildings}</span></div>
        <div class="sel-stat"><span>🍖 Nourriture</span><span>${Math.floor(i.stockpile.food)}</span></div>
        <div class="sel-stat"><span>🪵 Bois</span><span>${Math.floor(i.stockpile.wood)}</span></div>
        <div class="sel-stat"><span>🪨 Pierre</span><span>${Math.floor(i.stockpile.stone)}</span></div>
        <div class="sel-stat"><span>💰 Or</span><span>${Math.floor(i.stockpile.gold||0)}</span></div>
        ${rel.length?`<div class="sel-stat" style="color:#f55"><span>⚔ En guerre</span><span>${rel.join(', ')}</span></div>`:''}
        ${i.techProgress?`<div class="sel-stat pulse"><span>⏳ ${i.techProgress.name}</span><span>${Math.round(i.techProgress.pct*100)}%</span></div>`:''}
      `;
    }
  }

  clearSelection() {
    this._selected=null;
    const el=document.getElementById('selection-info');
    if (el) el.innerHTML='<p class="muted">Cliquez sur une entité</p>';
  }

  // ——— Minimap ——————————————————————————————————————
  _drawMinimap() {
    const ctx = this._minimapCtx;
    if (!ctx || !this.sim.world) return;
    const W=180, H=120;
    const world=this.sim.world;
    const scaleX=W/world.cols, scaleY=H/world.rows;

    ctx.drawImage(world.offscreenCanvas, 0, 0, world.cols*8, world.rows*8, 0, 0, W, H);

    // Colonies
    for (const s of this.sim.settlements) {
      const mx=(s.x/(world.cols*8))*W, my=(s.y/(world.rows*8))*H;
      ctx.fillStyle = s.factionColor||'#fff';
      ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI*2); ctx.fill();
    }

    // Viewport
    const vx=(this.sim.camera.x/(world.cols*8))*W;
    const vy=(this.sim.camera.y/(world.rows*8))*H;
    const vw=(this.sim.canvas.width/this.sim.zoom/(world.cols*8))*W;
    const vh=(this.sim.canvas.height/this.sim.zoom/(world.rows*8))*H;
    ctx.strokeStyle='rgba(255,255,255,0.6)';
    ctx.lineWidth=1;
    ctx.strokeRect(vx, vy, vw, vh);
  }

  showTooltip(x,y,text) {
    if(!this.tooltip) return;
    this.tooltip.classList.remove('hidden');
    this.tooltip.textContent=text;
    this.tooltip.style.left=(x+12)+'px';
    this.tooltip.style.top=(y+12)+'px';
  }
  hideTooltip() { this.tooltip?.classList.add('hidden'); }
  updateFPS(fps,entities) {
    const el=document.getElementById('fps-overlay');
    if(el) el.textContent=`FPS: ${fps} | Entités: ${entities}`;
  }
  updateDate(year,day) {
    const el=document.getElementById('world-date');
    if(el) el.textContent=`Année ${year} · Jour ${day}`;
  }
}
