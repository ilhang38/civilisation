// ============================================================
// history.js — Livre d'histoire, chronologie, succès, merveilles
// ============================================================

// ——— TYPES D'ÉVÉNEMENTS ————————————————————————————————
export const EVENT_TYPE = {
  FOUNDED:     'founded',    EVOLVED:  'evolved',
  WAR_START:   'war_start',  WAR_END:  'war_end',
  DISASTER:    'disaster',   TECH:     'tech',
  ALLIANCE:    'alliance',   HERO:     'hero',
  WONDER:      'wonder',     SEASON:   'season',
  POPULATION:  'population', TRADE:    'trade',
  RELIGION:    'religion',   REVOLT:   'revolt',
};

const EVENT_ICONS = {
  [EVENT_TYPE.FOUNDED]:    '🏕', [EVENT_TYPE.EVOLVED]:   '🏙',
  [EVENT_TYPE.WAR_START]:  '⚔', [EVENT_TYPE.WAR_END]:   '🕊',
  [EVENT_TYPE.DISASTER]:   '🌋', [EVENT_TYPE.TECH]:      '🔬',
  [EVENT_TYPE.ALLIANCE]:   '🤝', [EVENT_TYPE.HERO]:      '⭐',
  [EVENT_TYPE.WONDER]:     '🏛', [EVENT_TYPE.SEASON]:    '🍂',
  [EVENT_TYPE.POPULATION]: '👥', [EVENT_TYPE.TRADE]:     '💰',
  [EVENT_TYPE.RELIGION]:   '🙏', [EVENT_TYPE.REVOLT]:    '🗡',
};

// ——— MERVEILLES DU MONDE ——————————————————————————————
export const WONDERS = [
  { id:'pyramid',    name:'Grande Pyramide',    icon:'🔺', requires:{ pop:50,  stone:500, tech:'masonry'    }, bonus:{ gold:10,  pop:5  } },
  { id:'colosseum',  name:'Colisée',            icon:'🏟', requires:{ pop:80,  wood:400,  tech:'architecture'}, bonus:{ gold:15,  pop:8  } },
  { id:'library',    name:'Grande Bibliothèque',icon:'📚', requires:{ pop:60,  wood:300,  tech:'writing'     }, bonus:{ gold:5,   tech:2 } },
  { id:'harbor',     name:'Grand Port',         icon:'⚓', requires:{ pop:40,  wood:200,  tech:'trade'       }, bonus:{ gold:20,  trade:2} },
  { id:'forge',      name:'Forge Légendaire',   icon:'⚒', requires:{ pop:70,  ore:400,   tech:'metallurgy'  }, bonus:{ gold:8,   army:3 } },
  { id:'temple',     name:'Temple Sacré',       icon:'⛩', requires:{ pop:30,  stone:300, tech:'architecture'}, bonus:{ faith:30, pop:10 } },
  { id:'lighthouse', name:'Phare Géant',        icon:'🗼', requires:{ pop:45,  stone:250, tech:'engineering' }, bonus:{ gold:12,  trade:3} },
  { id:'garden',     name:'Jardins Suspendus',  icon:'🌿', requires:{ pop:100, wood:500,  tech:'agriculture' }, bonus:{ food:25,  pop:15 } },
];

// ——— SUCCÈS ——————————————————————————————————————————
export const ACHIEVEMENTS = [
  { id:'first_village',  name:'Premier Village',   icon:'🏘', desc:'Atteindre le stade Village',        check: s => s.settlements.some(x=>x.level!=='CAMP') },
  { id:'first_city',     name:'Première Ville',    icon:'🏙', desc:'Atteindre le stade Ville',          check: s => s.settlements.some(x=>['TOWN','CITY','METROPOLIS'].includes(x.level)) },
  { id:'pop_100',        name:'Centenaire',         icon:'💯', desc:'Atteindre 100 habitants',           check: s => s.settlements.reduce((t,x)=>t+x.humans.length,0) >= 100 },
  { id:'pop_500',        name:'Nation',             icon:'🌍', desc:'Atteindre 500 habitants',           check: s => s.settlements.reduce((t,x)=>t+x.humans.length,0) >= 500 },
  { id:'first_war',      name:'Baptême du feu',     icon:'⚔', desc:'Première guerre',                   check: s => s.settlements.some(x=>x.atWarWith?.size>0) },
  { id:'first_alliance', name:'Diplomate',          icon:'🤝', desc:'Première alliance',                 check: s => s.diplomacy?.relations.size > 0 },
  { id:'all_techs',      name:'Civilisation',       icon:'⚗', desc:'Rechercher toutes les technologies', check: s => s.settlements.some(x=>x.tech.researched.size>=9) },
  { id:'wonder_built',   name:'Merveille du monde', icon:'🏛', desc:'Construire une merveille',          check: s => s.settlements.some(x=>x.wonders?.length>0) },
  { id:'survived_10y',   name:'Ancienne civilisation',icon:'📜',desc:'Survivre 10 ans',                  check: s => (s.seasonSys?.year||0) >= 10 },
  { id:'hero_born',      name:'Héros légendaire',   icon:'⭐', desc:'Un héros est né',                   check: s => s.heroRegistry?.heroes.length > 0 },
  { id:'5_cities',       name:'Empire',             icon:'🗺', desc:'Avoir 5 colonies',                  check: s => s.settlements.length >= 5 },
  { id:'gold_1000',      name:'Trésor royal',       icon:'💰', desc:'Accumuler 1000 or',                 check: s => s.settlements.reduce((t,x)=>t+(x.stockpile.gold||0),0) >= 1000 },
];

// ——— SYSTÈME D'HISTOIRE ——————————————————————————————
export class HistorySystem {
  constructor() {
    this.events       = [];   // chronologie complète
    this.achievements = new Set(); // ids débloqués
    this.wonders      = [];   // merveilles construites
    this._achievementQueue = []; // notifications
    this.tick         = 0;
    this.yearStart    = 0;

    // Stats historiques (pour graphiques)
    this.snapshots = []; // une snapshot par an
    this._snapshotTimer = 0;
  }

  // ——— Événements ————————————————————————————————————
  logEvent(type, text, settlement = null, extra = {}) {
    const ev = {
      id:   this.events.length,
      type, text, icon: EVENT_ICONS[type] || '📌',
      tick: this.tick, year: extra.year || 1,
      settlementName: settlement?.name || null,
      settlementColor: settlement?.factionColor || '#fff',
      extra,
    };
    this.events.unshift(ev);
    if (this.events.length > 500) this.events.pop();
    return ev;
  }

  // ——— Update ——————————————————————————————————————
  update(dt, sim) {
    this.tick += dt;

    // Snapshots annuelles
    this._snapshotTimer += dt;
    if (this._snapshotTimer > 4800) {
      this._snapshotTimer = 0;
      this._takeSnapshot(sim);
    }

    // Vérifier succès
    for (const ach of ACHIEVEMENTS) {
      if (this.achievements.has(ach.id)) continue;
      try {
        if (ach.check(sim)) {
          this.achievements.add(ach.id);
          this._achievementQueue.push(ach);
          this.logEvent(EVENT_TYPE.TECH, `Succès débloqué : ${ach.name}`, null, { year: sim.seasonSys?.year });
        }
      } catch(e) { /* skip */ }
    }

    // Vérifier merveilles constructibles
    for (const s of sim.settlements) {
      this._checkWonders(s, sim);
    }
  }

  _takeSnapshot(sim) {
    const pop  = sim.settlements.reduce((t,s)=>t+s.humans.length, 0);
    const food = sim.settlements.reduce((t,s)=>t+(s.stockpile.food||0), 0);
    const gold = sim.settlements.reduce((t,s)=>t+(s.stockpile.gold||0), 0);
    const tech = sim.settlements.reduce((t,s)=>t+s.tech.researched.size, 0);
    const mil  = sim.settlements.reduce((t,s)=>t+s.humans.filter(h=>h.job==='soldier').length, 0);
    this.snapshots.push({
      year: sim.seasonSys?.year || 1,
      pop, food, gold, tech, mil,
      cities: sim.settlements.length,
      animals: sim.animalMgr?.animals.length || 0,
    });
    if (this.snapshots.length > 200) this.snapshots.shift();
  }

  _checkWonders(settlement, sim) {
    if (!settlement.wonders) settlement.wonders = [];
    for (const w of WONDERS) {
      if (settlement.wonders.includes(w.id)) continue;
      if (sim.settlements.some(s => s.wonders?.includes(w.id))) continue; // unique
      const r = w.requires;
      if (settlement.humans.length < (r.pop||0)) continue;
      if ((settlement.stockpile.stone||0) < (r.stone||0)) continue;
      if ((settlement.stockpile.wood||0)  < (r.wood||0))  continue;
      if ((settlement.stockpile.ore||0)   < (r.ore||0))   continue;
      if (r.tech && !settlement.tech.researched.has(r.tech)) continue;

      // Construire la merveille !
      settlement.wonders.push(w.id);
      settlement.stockpile.stone = Math.max(0, (settlement.stockpile.stone||0) - (r.stone||0));
      settlement.stockpile.wood  = Math.max(0, (settlement.stockpile.wood||0)  - (r.wood||0));
      settlement.stockpile.ore   = Math.max(0, (settlement.stockpile.ore||0)   - (r.ore||0));

      // Appliquer bonus
      if (w.bonus.gold)  settlement.stockpile.gold = (settlement.stockpile.gold||0) + w.bonus.gold * 10;
      if (w.bonus.food)  settlement.stockpile.food += w.bonus.food * 10;

      this.logEvent(EVENT_TYPE.WONDER,
        `${settlement.name} a construit : ${w.icon} ${w.name}!`,
        settlement, { year: sim.seasonSys?.year }
      );
      this.wonders.push({ wonder: w, settlement: settlement.name });
    }
  }

  popAchievementNotification() {
    return this._achievementQueue.shift() || null;
  }

  getBookPages() {
    // Grouper les événements par année pour le livre d'histoire
    const pages = {};
    for (const ev of this.events) {
      const y = ev.year || 1;
      if (!pages[y]) pages[y] = [];
      pages[y].push(ev);
    }
    return Object.entries(pages)
      .sort(([a],[b]) => Number(b)-Number(a))
      .map(([year, events]) => ({ year: Number(year), events }));
  }

  getStats() {
    const byType = {};
    for (const ev of this.events) byType[ev.type] = (byType[ev.type]||0) + 1;
    return {
      totalEvents:  this.events.length,
      achievements: this.achievements.size,
      wonders:      this.wonders.length,
      byType,
    };
  }
}
