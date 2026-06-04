// ============================================================
// diplomacy.js — Diplomatie, Religion, Bandits, Migrations
// ============================================================

import { TILE_SIZE } from './world.js';

// ——— RELIGION ——————————————————————————————————————————
const RELIGIONS = [
  { name:'Solaires',  icon:'☀', color:'#f5c842', bonus:'food',     mult:1.25 },
  { name:'Forestiers',icon:'🌿', color:'#44d080', bonus:'wood',     mult:1.30 },
  { name:'Mineurs',   icon:'⚙', color:'#a0a0c0', bonus:'stone',    mult:1.30 },
  { name:'Guerriers', icon:'⚔', color:'#e05050', bonus:'soldiers', mult:1.40 },
  { name:'Marchands', icon:'💰', color:'#ffa030', bonus:'gold',     mult:1.50 },
];

// ——— DIPLOMATIE ——————————————————————————————————————
export const RELATION = { ALLY:'ally', NEUTRAL:'neutral', ENEMY:'enemy', TRADE:'trade' };

export class DiplomacySystem {
  constructor() {
    this.relations = new Map(); // "id1-id2" → { type, strength, tradeValue }
    this.bandits   = [];
    this.caravans  = [];
    this.migrants  = [];
    this._banditTimer  = 300 + Math.random()*300;
    this._caravanTimer = 200 + Math.random()*200;
    this._tick = 0;
  }

  // ——— Relations ——————————————————————————————————————
  _key(a, b) { return [a.id, b.id].sort().join('-'); }

  getRelation(a, b) {
    return this.relations.get(this._key(a, b)) || { type: RELATION.NEUTRAL, strength: 50 };
  }

  setRelation(a, b, type, strength = 50) {
    this.relations.set(this._key(a, b), { type, strength, tradeValue: 0 });
  }

  // ——— Update principal ——————————————————————————————
  update(dt, settlements, world, seasonSystem) {
    this._tick += dt;

    // Initialiser religions
    for (const s of settlements) {
      if (!s.religion) {
        s.religion = RELIGIONS[s.id % RELIGIONS.length];
        s.faithLevel = 30 + Math.random() * 40;
      }
    }

    // Diplomatie automatique entre colonies
    this._updateDiplomacy(dt, settlements, seasonSystem);

    // Caravanes commerciales
    this._caravanTimer -= dt;
    if (this._caravanTimer < 0) {
      this._caravanTimer = 150 + Math.random()*200;
      this._spawnCaravan(settlements);
    }

    // Bandits
    this._banditTimer -= dt;
    if (this._banditTimer < 0) {
      this._banditTimer = 250 + Math.random()*400;
      this._spawnBandits(settlements, world);
    }

    // Update bandits
    this._updateBandits(dt, settlements);

    // Update caravanes
    this._updateCaravans(dt, settlements, seasonSystem);

    // Migrations
    this._updateMigrations(dt, settlements);
  }

  // ——— Diplomatie IA ——————————————————————————————————
  _updateDiplomacy(dt, settlements, seasonSystem) {
    if (settlements.length < 2) return;

    for (let i = 0; i < settlements.length; i++) {
      for (let j = i+1; j < settlements.length; j++) {
        const a = settlements[i], b = settlements[j];
        const rel = this.getRelation(a, b);
        const dist = Math.hypot(a.x-b.x, a.y-b.y);

        // En guerre → pas de diplomatie
        if (a.atWarWith?.has(b.id)) continue;

        // Proposer alliance si proches et pas ennemis
        if (dist < 400 && rel.type === RELATION.NEUTRAL &&
            a.humans.length > 8 && b.humans.length > 8 &&
            Math.random() < 0.0002 * dt) {
          this.setRelation(a, b, RELATION.ALLY, 70);
          seasonSystem?.logExternal('🤝', `Alliance : ${a.name} ↔ ${b.name}`);
        }

        // Commerce entre alliés
        if (rel.type === RELATION.ALLY && Math.random() < 0.001 * dt) {
          const trade = Math.min(20, a.stockpile.food * 0.05, b.stockpile.food * 0.05);
          a.stockpile.gold = (a.stockpile.gold||0) + trade * 0.1;
          b.stockpile.gold = (b.stockpile.gold||0) + trade * 0.1;
        }

        // Religion : bonus si même religion
        if (a.religion && b.religion && a.religion.name === b.religion.name) {
          if (rel.type === RELATION.NEUTRAL) this.setRelation(a, b, RELATION.ALLY, 60);
        }
      }
    }

    // Appliquer bonus religion
    for (const s of settlements) {
      if (!s.religion) continue;
      s.faithLevel = Math.min(100, (s.faithLevel||0) + dt * 0.01);
      const bonus  = s.religion.bonus;
      const mult   = 1 + (s.faithLevel/100) * (s.religion.mult - 1);
      if (bonus === 'food')  s._religionFoodMult  = mult;
      if (bonus === 'wood')  s._religionWoodMult  = mult;
      if (bonus === 'stone') s._religionStoneMult = mult;
    }
  }

  // ——— Caravanes ——————————————————————————————————————
  _spawnCaravan(settlements) {
    if (settlements.length < 2) return;
    const from = settlements[Math.floor(Math.random()*settlements.length)];
    if (from.stockpile.food < 30) return;
    const allies = settlements.filter(s => {
      const r = this.getRelation(from, s);
      return s.id !== from.id && (r.type === RELATION.ALLY || r.type === RELATION.NEUTRAL);
    });
    if (allies.length === 0) return;
    const to = allies[Math.floor(Math.random()*allies.length)];
    this.caravans.push({
      x: from.x, y: from.y,
      fromId: from.id, toId: to.id,
      destX: to.x, destY: to.y,
      goods: Math.min(30, from.stockpile.food * 0.1),
      speed: 1.2, alive: true,
      color: from.factionColor || '#ffa030',
    });
  }

  _updateCaravans(dt, settlements, seasonSystem) {
    for (let i = this.caravans.length-1; i >= 0; i--) {
      const c = this.caravans[i];
      if (!c.alive) { this.caravans.splice(i,1); continue; }

      const dx = c.destX-c.x, dy = c.destY-c.y;
      const dist = Math.sqrt(dx*dx+dy*dy);

      if (dist < 15) {
        // Livraison !
        const dest = settlements.find(s => s.id === c.toId);
        if (dest) {
          dest.stockpile.food  += c.goods;
          dest.stockpile.gold  = (dest.stockpile.gold||0) + 2;
          const from = settlements.find(s => s.id === c.fromId);
          if (from) from.stockpile.gold = (from.stockpile.gold||0) + 3;
        }
        c.alive = false;
        continue;
      }

      c.x += (dx/dist) * c.speed * dt;
      c.y += (dy/dist) * c.speed * dt;
    }
  }

  // ——— Bandits ——————————————————————————————————————
  _spawnBandits(settlements, world) {
    if (settlements.length === 0) return;
    const s = settlements[Math.floor(Math.random()*settlements.length)];
    const angle = Math.random()*Math.PI*2;
    const dist  = 150+Math.random()*200;
    const bx = s.x + Math.cos(angle)*dist;
    const by = s.y + Math.sin(angle)*dist;
    const tile = world.tileAt(bx, by);
    if (!tile || !tile.props.passable) return;

    this.bandits.push({
      x: bx, y: by,
      hp: 30+Math.floor(Math.random()*20),
      maxHp: 50,
      targetId: null,
      speed: 1.3,
      lootTimer: 0,
      alive: true,
      size: 5,
      wander: { timer:0, tx: bx, ty: by },
    });
  }

  _updateBandits(dt, settlements) {
    for (let i = this.bandits.length-1; i >= 0; i--) {
      const b = this.bandits[i];
      if (!b.alive || b.hp <= 0) { this.bandits.splice(i,1); continue; }

      // Trouver cible : colonie la plus proche
      let bestDist = 300, best = null;
      for (const s of settlements) {
        const d = Math.hypot(s.x-b.x, s.y-b.y);
        if (d < bestDist) { bestDist=d; best=s; }
      }

      if (best && bestDist < 250) {
        // Approcher la colonie
        const dx=best.x-b.x, dy=best.y-b.y, dist=Math.sqrt(dx*dx+dy*dy);
        b.x += (dx/dist)*b.speed*dt;
        b.y += (dy/dist)*b.speed*dt;

        // Piller si assez proche
        if (bestDist < 20) {
          b.lootTimer += dt;
          if (b.lootTimer > 30) {
            b.lootTimer = 0;
            best.stockpile.food  = Math.max(0, best.stockpile.food  - 5);
            best.stockpile.gold  = Math.max(0, (best.stockpile.gold||0) - 2);
            // Les soldats ripostent
            const soldiers = best.humans.filter(h=>h.job==='soldier').length;
            b.hp -= soldiers * 3;
          }
        }
      } else {
        // Errer
        b.wander.timer -= dt;
        if (b.wander.timer <= 0) {
          b.wander.timer = 40+Math.random()*60;
          b.wander.tx = b.x+(Math.random()-0.5)*120;
          b.wander.ty = b.y+(Math.random()-0.5)*120;
        }
        const dx=b.wander.tx-b.x, dy=b.wander.ty-b.y, dist=Math.sqrt(dx*dx+dy*dy)+0.01;
        b.x += (dx/dist)*b.speed*0.6*dt;
        b.y += (dy/dist)*b.speed*0.6*dt;
      }
    }
  }

  // ——— Migrations ——————————————————————————————————————
  _updateMigrations(dt, settlements) {
    // Créer des migrants si une colonie est en guerre ou en famine
    for (const s of settlements) {
      const atWar   = s.atWarWith?.size > 0;
      const famine  = s.stockpile.food < 10 && s.humans.length > 3;
      if ((atWar || famine) && Math.random() < 0.0008 * dt && s.humans.length > 4) {
        // Un humain migre vers une colonie en paix
        const refuges = settlements.filter(r =>
          r.id !== s.id && !r.atWarWith?.has(s.id) && r.stockpile.food > 50
        );
        if (refuges.length > 0) {
          const dest = refuges[Math.floor(Math.random()*refuges.length)];
          const h    = s.humans.splice(Math.floor(Math.random()*s.humans.length), 1)[0];
          if (h) {
            h.settlement = dest;
            h.homeX = dest.x; h.homeY = dest.y;
            dest.humans.push(h);
          }
        }
      }
    }
  }

  // ——— Rendu ——————————————————————————————————————————
  draw(ctx, camX, camY, viewW, viewH) {
    // Routes entre alliés
    ctx.globalAlpha = 0.25;
    for (const [key, rel] of this.relations) {
      if (rel.type !== RELATION.ALLY && rel.type !== RELATION.TRADE) continue;
      const [id1, id2] = key.split('-').map(Number);
      // (les settlements ne sont pas stockés ici, on dessine dans main)
    }
    ctx.globalAlpha = 1.0;

    // Caravanes
    for (const c of this.caravans) {
      if (c.x < camX-20 || c.x > camX+viewW+20) continue;
      const sx=c.x-camX, sy=c.y-camY;
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.font='8px serif'; ctx.textAlign='center';
      ctx.fillText('🐪', sx, sy-4);
      ctx.textAlign='left';
    }

    // Bandits
    for (const b of this.bandits) {
      if (!b.alive) continue;
      if (b.x < camX-20 || b.x > camX+viewW+20) continue;
      const sx=b.x-camX, sy=b.y-camY;
      // Ombre
      ctx.fillStyle='rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(sx, sy+b.size, b.size*0.8, b.size*0.3, 0, 0, Math.PI*2); ctx.fill();
      // Corps
      ctx.fillStyle='#3a2a1a';
      ctx.beginPath(); ctx.arc(sx, sy, b.size, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ff4444'; ctx.lineWidth=1.5;
      ctx.stroke();
      // Crâne
      ctx.font='8px serif'; ctx.textAlign='center';
      ctx.fillText('💀', sx, sy+3);
      ctx.textAlign='left';
      // HP
      if (b.hp < b.maxHp) {
        ctx.fillStyle='#333'; ctx.fillRect(sx-b.size, sy-b.size-4, b.size*2, 2);
        ctx.fillStyle='#f44'; ctx.fillRect(sx-b.size, sy-b.size-4, b.size*2*(b.hp/b.maxHp), 2);
      }
    }
  }

  // Rendu des routes entre villes
  drawRoutes(ctx, settlements, camX, camY) {
    ctx.save();
    for (const [key, rel] of this.relations) {
      if (rel.type !== RELATION.ALLY) continue;
      const [id1, id2] = key.split('-').map(Number);
      const a = settlements.find(s=>s.id===id1);
      const b = settlements.find(s=>s.id===id2);
      if (!a||!b) continue;
      const ax=a.x-camX, ay=a.y-camY;
      const bx=b.x-camX, by=b.y-camY;
      ctx.strokeStyle='rgba(255,200,80,0.3)';
      ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  getStats(settlements) {
    let alliances=0, tradePairs=0;
    for (const [,rel] of this.relations) {
      if (rel.type===RELATION.ALLY)  alliances++;
      if (rel.type===RELATION.TRADE) tradePairs++;
    }
    return {
      alliances, tradePairs,
      bandits:   this.bandits.filter(b=>b.alive).length,
      caravans:  this.caravans.length,
    };
  }
}
