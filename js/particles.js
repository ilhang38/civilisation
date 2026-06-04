// ============================================================
// particles.js — Particules : feux, fumée, combats, routes
// ============================================================

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.MAX = 400;
  }

  // ——— Spawn ——————————————————————————————————————————
  spawnFire(x, y, count = 3) {
    for (let i=0; i<count && this.particles.length<this.MAX; i++) {
      this.particles.push({
        type:'fire', x, y,
        vx: (Math.random()-0.5)*0.8,
        vy: -0.8-Math.random()*1.2,
        life: 30+Math.random()*20, maxLife:50,
        size: 1.5+Math.random()*2,
        color: ['#ff6020','#ff8030','#ffaa40','#ff4010'][Math.floor(Math.random()*4)],
      });
    }
  }

  spawnSmoke(x, y, count = 2) {
    for (let i=0; i<count && this.particles.length<this.MAX; i++) {
      this.particles.push({
        type:'smoke', x, y,
        vx: (Math.random()-0.5)*0.4,
        vy: -0.3-Math.random()*0.5,
        life: 60+Math.random()*40, maxLife:100,
        size: 2+Math.random()*3,
        color: '#888888',
      });
    }
  }

  spawnBattle(x, y, count = 6) {
    for (let i=0; i<count && this.particles.length<this.MAX; i++) {
      const angle = Math.random()*Math.PI*2;
      const speed = 1+Math.random()*2;
      this.particles.push({
        type:'battle', x, y,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        life: 20+Math.random()*15, maxLife:35,
        size: 1+Math.random()*2,
        color: Math.random()<0.5 ? '#ff3020' : '#ffcc20',
      });
    }
  }

  spawnLevelUp(x, y) {
    for (let i=0; i<12 && this.particles.length<this.MAX; i++) {
      const angle = (i/12)*Math.PI*2;
      this.particles.push({
        type:'levelup', x, y,
        vx: Math.cos(angle)*2,
        vy: Math.sin(angle)*2 - 1,
        life: 50, maxLife:50,
        size: 2,
        color: '#ffd060',
      });
    }
  }

  spawnRain(x, y, count = 2) {
    for (let i=0; i<count && this.particles.length<this.MAX; i++) {
      this.particles.push({
        type:'rain', x: x+(Math.random()-0.5)*800, y: y-50,
        vx: -0.3, vy: 4+Math.random()*2,
        life: 40+Math.random()*20, maxLife:60,
        size: 0.5,
        color: 'rgba(150,180,255,0.6)',
      });
    }
  }

  // ——— Update ——————————————————————————————————————————
  update(dt) {
    for (let i=this.particles.length-1; i>=0; i--) {
      const p = this.particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.life -= dt;
      // Gravité légère sur certains types
      if (p.type==='battle') p.vy += 0.05*dt;
      if (p.type==='levelup') p.vy += 0.03*dt;
      if (p.life <= 0) this.particles.splice(i,1);
    }
  }

  // ——— Draw ——————————————————————————————————————————
  draw(ctx, camX, camY, viewW, viewH) {
    for (const p of this.particles) {
      const sx=p.x-camX, sy=p.y-camY;
      if (sx<-20||sx>viewW+20||sy<-20||sy>viewH+20) continue;
      const alpha = Math.max(0, p.life/p.maxLife);
      ctx.globalAlpha = alpha;

      if (p.type==='smoke') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size*(1+(1-alpha)), 0, Math.PI*2);
        ctx.fill();
      } else if (p.type==='rain') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = 0.5;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+p.vx*4, sy+p.vy*4); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // Spawner continu pour les villes actives
  updateSettlements(settlements, dt) {
    for (const s of settlements) {
      if (s.buildings.length === 0) continue;
      // Fumée des villes
      if (Math.random() < 0.08*dt) {
        const b = s.buildings[Math.floor(Math.random()*s.buildings.length)];
        this.spawnSmoke(b.x, b.y, 1);
      }
      // Feux de camp (camp/village)
      if ((s.level==='CAMP'||s.level==='VILLAGE') && Math.random()<0.05*dt) {
        this.spawnFire(s.x+(Math.random()-0.5)*20, s.y+(Math.random()-0.5)*20, 1);
      }
      // Particules de bataille
      if (s.atWarWith?.size>0 && Math.random()<0.15*dt) {
        this.spawnBattle(s.x+(Math.random()-0.5)*30, s.y+(Math.random()-0.5)*30, 3);
      }
    }
  }
}
