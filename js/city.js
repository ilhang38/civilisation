// ============================================================
// city.js — Colonies, bâtiments HD, guerres
// ============================================================

import { Human, JOB }         from './human.js';
import { TechTree }            from './technology.js';
import { TILE_SIZE }           from './world.js';

export const CITY_LEVEL = {
  CAMP:       { name:'Camp',        icon:'⛺', minPop:1,   color:'#c8a040', radius:20  },
  VILLAGE:    { name:'Village',     icon:'🏘', minPop:8,   color:'#80c060', radius:35  },
  TOWN:       { name:'Ville',       icon:'🏙', minPop:25,  color:'#4090d0', radius:55  },
  CITY:       { name:'Grande Ville',icon:'🌆', minPop:60,  color:'#c060d0', radius:80  },
  METROPOLIS: { name:'Métropole',   icon:'🌇', minPop:150, color:'#f07030', radius:120 },
};
const LEVEL_ORDER = ['CAMP','VILLAGE','TOWN','CITY','METROPOLIS'];

export const BUILDING_TYPE = {
  HOUSE:    { name:'Maison',   icon:'🏠', cost:{wood:10,stone:3},  produces:{},          color:'#8a6040', roofColor:'#c04030' },
  FARM:     { name:'Ferme',    icon:'🌾', cost:{wood:8, stone:0},  produces:{food:12},   color:'#806030', roofColor:'#c08020' },
  MILL:     { name:'Moulin',   icon:'⚙', cost:{wood:15,stone:8},  produces:{food:6,wood:2}, color:'#907050', roofColor:'#b06820' },
  SAWMILL:  { name:'Scierie',  icon:'🪚', cost:{wood:5, stone:12}, produces:{wood:14},   color:'#705030', roofColor:'#904020' },
  QUARRY:   { name:'Carrière', icon:'🗿', cost:{wood:4, stone:4},  produces:{stone:10},  color:'#808080', roofColor:'#606060' },
  MINE:     { name:'Mine',     icon:'⛏', cost:{wood:15,stone:8},  produces:{ore:8,stone:4}, color:'#505060', roofColor:'#303040' },
  WORKSHOP: { name:'Atelier',  icon:'🔨', cost:{wood:12,stone:8},  produces:{gold:3},    color:'#806850', roofColor:'#a05030' },
  MARKET:   { name:'Marché',   icon:'🏪', cost:{wood:15,stone:15}, produces:{gold:6},    color:'#a07840', roofColor:'#c09020' },
  BARRACKS: { name:'Caserne',  icon:'⚔', cost:{wood:8, stone:20}, produces:{},          color:'#405060', roofColor:'#203040' },
  WALL:     { name:'Muraille', icon:'🧱', cost:{wood:4, stone:30}, produces:{},          color:'#707070', roofColor:'#505050' },
};

let _nextId = 0;
const NAMES = ['Avalon','Brest','Calais','Dorin','Embor','Favre','Greva','Helsin',
               'Irone','Jarven','Kelmar','Lavon','Morvin','Norden','Ostmar','Polhaven',
               'Querac','Runvik','Sunmar','Torveld','Ulborg','Vardal','Welmore',
               'Xandor','Yarvil','Zephyr','Aldmar','Birken','Crestol','Dunvale'];

// ——— Couleurs uniques par colonie ————————————————————————
const FACTION_COLORS = ['#e05050','#50a0e0','#50d080','#e0c050','#c050e0','#e08050','#50e0d0'];

export class Settlement {
  constructor(x, y, world, founder = null, playerMode = false) {
    this.id    = _nextId++;
    this.x = x; this.y = y; this.world = world;
    this.name  = NAMES[this.id % NAMES.length] + (this.id >= NAMES.length ? ` ${Math.floor(this.id/NAMES.length)+1}` : '');
    this.level = 'CAMP';
    this.age   = 0;
    this.isPlayerOwned = playerMode;

    // Couleur de faction unique
    this.factionColor = FACTION_COLORS[this.id % FACTION_COLORS.length];

    this.humans  = [];
    this.maxPop  = playerMode ? 2 : 6;
    this.popGrowthTimer = 0;

    this.stockpile = { food:120, wood:60, stone:40, ore:10, gold:0 };
    this.buildings = [];
    this._buildTimer = 0;

    this.tech      = new TechTree();
    this.knowledge = 0;
    this.expansionTimer = 300 + Math.random() * 300;

    // Guerre
    this.atWarWith   = new Set(); // ids des ennemis
    this.soldiers    = [];        // soldats en mission
    this.warTimer    = 0;
    this.reputation  = 50;        // 0=agressif, 100=pacifique

    if (founder) {
      founder.settlement = this; founder.homeX = x; founder.homeY = y;
      this.humans.push(founder);
    }

    if (!playerMode) {
      for (let i = 0; i < 4; i++) this._spawnHuman();
      this.buildings.push({ type:'FARM', name:'Ferme', icon:'🌾',
        x: x + 20, y: y + 10, bx: 0, by: 0 });
    }
  }

  // ——— Update ——————————————————————————————————————
  // dt    = dt accéléré pour économie/construction
  // dtBio = dt plafonné pour humains (faim/soif)
  update(dt, dtBio, plantMgr, animalMgr, allSettlements) {
    this.age += dt;

    // Humains : dtBio pour que la faim reste réaliste
    for (let i = this.humans.length-1; i >= 0; i--) {
      this.humans[i].update(dtBio, plantMgr, animalMgr);
      if (!this.humans[i].alive) this.humans.splice(i,1);
    }

    // Consommation nourriture : dt accéléré (économie réaliste)
    this.stockpile.food -= this.humans.length * 0.012 * dt;
    if (this.stockpile.food < 0) {
      this.stockpile.food = 0;
      if (Math.random() < 0.0002*dtBio && this.humans.length > 2)
        this.humans.splice(Math.floor(Math.random()*this.humans.length),1);
    }

    this._biomeProduce(dt);
    this._runBuildings(dt);
    this._growPopulation(dtBio);
    this._assignJobs();
    this._autoBuild(dt);

    this.knowledge += dt * 0.15 * (1 + this.humans.length * 0.02);
    this.tech.autoResearch();
    this.tech.update(dt, 0.06 * (1 + this.humans.length * 0.01));

    this._evolveLevel();
    this._updateWar(dt, allSettlements);

    this.expansionTimer -= dt;
    if (this.expansionTimer < 0 && this.humans.length >= 12 && this.stockpile.food > 80 && !this.isPlayerOwned) {
      this.expansionTimer = 500 + Math.random() * 400;
      return this._tryExpand(allSettlements);
    }
    return null;
  }

  // ——— Guerres ——————————————————————————————————————
  _updateWar(dt, allSettlements) {
    if (allSettlements.length < 2) return;
    this.warTimer += dt;

    // Déclarer guerre si assez fort et voisin proche
    if (this.warTimer > 800 && this.humans.length >= 15 &&
        this.buildings.some(b => b.type === 'BARRACKS') &&
        this.atWarWith.size === 0 && Math.random() < 0.003) {

      // Trouver un voisin rival
      const rivals = allSettlements.filter(s =>
        s.id !== this.id && !this.atWarWith.has(s.id) &&
        Math.hypot(s.x - this.x, s.y - this.y) < 600
      );
      if (rivals.length > 0) {
        const target = rivals[Math.floor(Math.random() * rivals.length)];
        this.atWarWith.add(target.id);
        target.atWarWith.add(this.id);
        this.warTimer = 0;
        console.log(`⚔ ${this.name} déclare la guerre à ${target.name}!`);
      }
    }

    // Envoi soldats en combat
    if (this.atWarWith.size > 0) {
      for (const enemyId of this.atWarWith) {
        const enemy = allSettlements.find(s => s.id === enemyId);
        if (!enemy) { this.atWarWith.delete(enemyId); continue; }

        const dist = Math.hypot(this.x - enemy.x, this.y - enemy.y);

        // Combat : dégâts proportionnels aux soldats
        const mySoldiers = this.humans.filter(h => h.job === JOB.SOLDIER).length;
        const enSoldiers = enemy.humans.filter(h => h.job === JOB.SOLDIER).length;

        if (dist < 400 && mySoldiers > 0 && Math.random() < 0.01 * dt) {
          // Pertes des deux côtés
          const myLoss = Math.random() < 0.4 ? 1 : 0;
          const enLoss = Math.random() < 0.5 ? 1 : 0;

          if (myLoss && this.humans.length > 3) {
            const soldiers = this.humans.filter(h => h.job === JOB.SOLDIER);
            if (soldiers.length > 0) soldiers[0].alive = false;
          }
          if (enLoss && enemy.humans.length > 3) {
            const soldiers = enemy.humans.filter(h => h.job === JOB.SOLDIER);
            if (soldiers.length > 0) soldiers[0].alive = false;
          }

          // Vol de ressources si ennemi faible
          if (enemy.humans.length < 4) {
            this.stockpile.food  += enemy.stockpile.food  * 0.3;
            this.stockpile.gold  += enemy.stockpile.gold  * 0.5;
            enemy.stockpile.food *= 0.7;
            // Fin de guerre
            this.atWarWith.delete(enemyId);
            enemy.atWarWith.delete(this.id);
            console.log(`🏳 ${enemy.name} capitule devant ${this.name}`);
          }
        }

        // Paix après longue guerre
        if (this.warTimer > 2000) {
          this.atWarWith.delete(enemyId);
          enemy.atWarWith.delete(this.id);
          this.warTimer = 0;
        }
      }
    }
  }

  _biomeProduce(dt) {
    const tile = this.world.tileAt(this.x, this.y);
    if (!tile) return;
    const p = tile.props;
    this.stockpile.food  += p.fertility * 1.2 * dt * 0.04;
    this.stockpile.wood  += p.wood      * 0.8 * dt * 0.03;
    this.stockpile.stone += p.stone     * 0.6 * dt * 0.02;
  }

  _runBuildings(dt) {
    const s = this.tech.stats;
    for (const b of this.buildings) {
      const prod = BUILDING_TYPE[b.type]?.produces || {};
      for (const [res, amt] of Object.entries(prod)) {
        let mult = res==='food' ? (s.foodMult||1) : res==='wood' ? (s.gatherMult||1) : res==='stone' ? (s.stoneMult||1) : 1;
        this.stockpile[res] = (this.stockpile[res]||0) + amt * dt * 0.015 * mult;
      }
    }
    for (const k of Object.keys(this.stockpile))
      this.stockpile[k] = Math.max(0, Math.min(9999, this.stockpile[k]));
  }

  _growPopulation(dt) {
    this.popGrowthTimer += dt;
    if (this.popGrowthTimer < 120) return;
    this.popGrowthTimer = 0;
    const grow = this.tech.stats.popGrowth || 1;
    const houses = this.buildings.filter(b => b.type==='HOUSE').length;
    this.maxPop = (this.isPlayerOwned ? 2 : 6) + houses * 4;
    if (this.humans.length < this.maxPop && this.stockpile.food > 30*grow)
      if (Math.random() < 0.6*grow) this._spawnHuman();
  }

  _spawnHuman() {
    const a = Math.random()*Math.PI*2, d = 5+Math.random()*25;
    this.humans.push(new Human(this.x+Math.cos(a)*d, this.y+Math.sin(a)*d, this, this.world));
  }

  _assignJobs() {
    const pop = this.humans.length; if (!pop) return;
    const hasBarracks = this.buildings.some(b => b.type==='BARRACKS');
    const soldiers = hasBarracks ? Math.max(1, Math.floor(pop*0.12)) : 0;
    const farmers  = Math.max(2, Math.floor(pop*0.38));
    const hunters  = Math.max(1, Math.floor(pop*0.15));
    const lumber   = Math.max(1, Math.floor(pop*0.13));
    const miners   = Math.max(1, Math.floor(pop*0.10));
    const builders = Math.max(1, Math.floor(pop*0.08));
    const rest     = Math.max(0, pop-soldiers-farmers-hunters-lumber-miners-builders);
    const jobs = [];
    for (let i=0;i<farmers; i++) jobs.push(JOB.FARMER);
    for (let i=0;i<hunters; i++) jobs.push(JOB.HUNTER);
    for (let i=0;i<lumber;  i++) jobs.push(JOB.LUMBERER);
    for (let i=0;i<miners;  i++) jobs.push(JOB.MINER);
    for (let i=0;i<builders;i++) jobs.push(JOB.BUILDER);
    for (let i=0;i<soldiers;i++) jobs.push(JOB.SOLDIER);
    for (let i=0;i<rest;    i++) jobs.push(JOB.ARTISAN);
    this.humans.forEach((h,i) => h.job = jobs[i] || JOB.IDLE);
  }

  _autoBuild(dt) {
    this._buildTimer -= dt;
    if (this._buildTimer > 0) return;
    this._buildTimer = 60 + Math.random()*60;
    const s = this.stockpile, lvl = this.level;
    if (s.food < 150 && s.wood >= 8) {
      if (this.buildings.filter(b=>b.type==='FARM').length < Math.ceil(this.humans.length/3)) { this._build('FARM'); return; }
    }
    if (this.humans.length >= this.maxPop-1 && s.wood >= 10 && s.stone >= 3) { this._build('HOUSE'); return; }
    if (s.food < 80 && s.wood >= 8) { this._build('FARM'); return; }
    if (s.stone < 40 && s.wood >= 4) { this._build('QUARRY'); return; }
    if (lvl !== 'CAMP' && !this.buildings.some(b=>b.type==='SAWMILL') && s.wood>=15&&s.stone>=12) { this._build('SAWMILL'); return; }
    if (lvl !== 'CAMP' && !this.buildings.some(b=>b.type==='BARRACKS') && s.wood>=8&&s.stone>=20) { this._build('BARRACKS'); return; }
    if (['TOWN','CITY','METROPOLIS'].includes(lvl) && !this.buildings.some(b=>b.type==='MINE') && s.wood>=15&&s.stone>=8) { this._build('MINE'); return; }
    if (['CITY','METROPOLIS'].includes(lvl) && !this.buildings.some(b=>b.type==='MARKET') && s.wood>=15&&s.stone>=15) { this._build('MARKET'); return; }
  }

  _build(type) {
    const cfg = BUILDING_TYPE[type]; if (!cfg) return;
    if ((this.stockpile.wood||0)  < (cfg.cost.wood||0))  return;
    if ((this.stockpile.stone||0) < (cfg.cost.stone||0)) return;
    this.stockpile.wood  -= cfg.cost.wood||0;
    this.stockpile.stone -= cfg.cost.stone||0;
    const a = Math.random()*Math.PI*2, d = 12+Math.random()*35;
    this.buildings.push({ type, name:cfg.name, icon:cfg.icon,
      x: this.x+Math.cos(a)*d, y: this.y+Math.sin(a)*d });
  }

  _evolveLevel() {
    const pop = this.humans.length;
    for (let i=LEVEL_ORDER.length-1; i>=0; i--) {
      if (pop >= CITY_LEVEL[LEVEL_ORDER[i]].minPop) {
        if (this.level !== LEVEL_ORDER[i]) {
          this.level = LEVEL_ORDER[i];
          this.stockpile.food+=100; this.stockpile.wood+=60; this.stockpile.stone+=40;
        }
        break;
      }
    }
  }

  _tryExpand(allSettlements) {
    for (let t=0; t<25; t++) {
      const a = Math.random()*Math.PI*2, d = 150+Math.random()*250;
      const nx = this.x+Math.cos(a)*d, ny = this.y+Math.sin(a)*d;
      if (nx<20||nx>=this.world.cols*TILE_SIZE-20||ny<20||ny>=this.world.rows*TILE_SIZE-20) continue;
      const tile = this.world.tileAt(nx,ny);
      if (!tile||!tile.props.buildable) continue;
      if (allSettlements.some(s=>Math.hypot(s.x-nx,s.y-ny)<120)) continue;
      this.stockpile.food-=40; this.stockpile.wood-=15;
      return new Settlement(nx, ny, this.world);
    }
    return null;
  }

  // ——— Rendu HD ——————————————————————————————————————
  draw(ctx, camX, camY) {
    const sx = this.x-camX, sy = this.y-camY;
    const lvl = CITY_LEVEL[this.level];
    const fc  = this.factionColor;
    const atWar = this.atWarWith.size > 0;

    // Territoire
    ctx.strokeStyle = fc + '44';
    ctx.lineWidth   = atWar ? 2 : 1.5;
    if (atWar) {
      ctx.setLineDash([6,4]);
      ctx.strokeStyle = '#ff4444' + '66';
    }
    ctx.beginPath(); ctx.arc(sx, sy, lvl.radius, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // Bâtiments HD
    for (const b of this.buildings) this._drawBuilding(ctx, b, camX, camY);

    // Humains
    for (const h of this.humans) h.draw(ctx, camX, camY);

    // Icône centrale
    this._drawCenterIcon(ctx, sx, sy, fc, lvl, atWar);

    // Étiquette
    ctx.font = 'bold 9px "Share Tech Mono",monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = atWar ? '#ff8888' : '#fff';
    ctx.fillText(this.name, sx, sy+lvl.radius*0.55);
    ctx.fillStyle = fc;
    ctx.font = '8px monospace';
    ctx.fillText(`${lvl.icon} ${this.humans.length}👤 ${atWar?'⚔':''}`, sx, sy+lvl.radius*0.55+10);
    ctx.textAlign = 'left';
  }

  _drawCenterIcon(ctx, sx, sy, fc, lvl, atWar) {
    const r = 7;
    // Fond
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(sx, sy, r+1, 0, Math.PI*2); ctx.fill();
    // Couleur faction
    ctx.fillStyle = fc;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
    // Croix de guerre
    if (atWar) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx-1, sy-5, 2, 10);
      ctx.fillRect(sx-5, sy-1, 10, 2);
    } else {
      // Point blanc
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI*2); ctx.fill();
    }
  }

  _drawBuilding(ctx, b, camX, camY) {
    const bx = b.x - camX, by = b.y - camY;
    const cfg = BUILDING_TYPE[b.type] || {};
    const w = 8, h = 7;

    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(bx-w/2+2, by-h/2+3, w, h);

    // Murs
    ctx.fillStyle = cfg.color || '#606060';
    ctx.fillRect(bx-w/2, by-h/2, w, h);

    // Toit (triangle)
    ctx.fillStyle = cfg.roofColor || '#404040';
    ctx.beginPath();
    ctx.moveTo(bx-w/2-1, by-h/2);
    ctx.lineTo(bx, by-h/2-4);
    ctx.lineTo(bx+w/2+1, by-h/2);
    ctx.fill();

    // Fenêtre
    ctx.fillStyle = 'rgba(255,230,150,0.6)';
    ctx.fillRect(bx-1.5, by-1.5, 3, 3);

    // Spécialités visuelles
    if (b.type === 'FARM') {
      // Champs verts
      ctx.strokeStyle = '#4a8a30'; ctx.lineWidth = 0.5;
      for (let i=-3;i<=3;i+=2) { ctx.beginPath(); ctx.moveTo(bx-4,by+h/2+i*0.7); ctx.lineTo(bx+4,by+h/2+i*0.7); ctx.stroke(); }
    } else if (b.type === 'MILL') {
      // Ailes du moulin
      ctx.strokeStyle = cfg.color||'#607'; ctx.lineWidth=1.5;
      for (let a=0;a<4;a++) {
        const aa=a*Math.PI/2+performance.now()*0.001;
        ctx.beginPath(); ctx.moveTo(bx,by-h/2-2); ctx.lineTo(bx+Math.cos(aa)*6,by-h/2-2+Math.sin(aa)*6); ctx.stroke();
      }
    } else if (b.type === 'MINE') {
      // Rail de mine
      ctx.strokeStyle='#888'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx-5,by+h/2+1); ctx.lineTo(bx+5,by+h/2+1); ctx.stroke();
    } else if (b.type === 'BARRACKS') {
      // Couleur bleu militaire + épée
      ctx.fillStyle='#fff'; ctx.font='6px serif';
      ctx.textAlign='center'; ctx.fillText('⚔',bx,by+2); ctx.textAlign='left';
    } else if (b.type === 'WALL') {
      // Créneaux
      ctx.fillStyle = cfg.color||'#707';
      for (let i=-3;i<=3;i+=2) ctx.fillRect(bx+i-0.5, by-h/2-3, 1.5, 3);
    } else if (b.type === 'MARKET') {
      // Auvent coloré
      ctx.fillStyle='#e09020';
      ctx.fillRect(bx-w/2-1, by-h/2+1, w+2, 2);
    }
  }

  getInfo() {
    return {
      name: this.name, level: CITY_LEVEL[this.level].name,
      population: this.humans.length, maxPop: this.maxPop,
      stockpile: {...this.stockpile}, buildings: this.buildings.length,
      techs: [...this.tech.researched], techProgress: this.tech.getProgress(),
      atWar: this.atWarWith.size > 0, wars: this.atWarWith.size,
    };
  }

  toJSON() {
    return { id:this.id, x:this.x, y:this.y, name:this.name, level:this.level, age:this.age,
      stockpile:this.stockpile, buildings:this.buildings, humans:this.humans.map(h=>h.toJSON()), tech:this.tech.toJSON() };
  }
}
