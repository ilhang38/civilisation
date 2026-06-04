// ============================================================
// genetics.js — Génétique, familles, dynasties, héros
// ============================================================

export class Genome {
  constructor(parent1 = null, parent2 = null) {
    if (parent1 && parent2) {
      // Hérédité : mix des deux parents + mutation
      this.strength     = this._inherit(parent1.genome.strength,     parent2.genome.strength);
      this.intelligence = this._inherit(parent1.genome.intelligence, parent2.genome.intelligence);
      this.speed        = this._inherit(parent1.genome.speed,        parent2.genome.speed);
      this.fertility    = this._inherit(parent1.genome.fertility,    parent2.genome.fertility);
      this.longevity    = this._inherit(parent1.genome.longevity,    parent2.genome.longevity);
      this.charisma     = this._inherit(parent1.genome.charisma,     parent2.genome.charisma);
    } else {
      // Génome de base aléatoire
      this.strength     = 3 + Math.random() * 7;
      this.intelligence = 3 + Math.random() * 7;
      this.speed        = 0.6 + Math.random() * 0.8;
      this.fertility    = 0.4 + Math.random() * 0.6;
      this.longevity    = 60  + Math.random() * 40;
      this.charisma     = 2   + Math.random() * 8;
    }
  }

  _inherit(a, b) {
    const base = (a + b) / 2 + (Math.random() - 0.5) * 2;
    // Mutation rare (2%)
    const mutation = Math.random() < 0.02 ? (Math.random() - 0.5) * 4 : 0;
    return Math.max(0.1, Math.min(10, base + mutation));
  }

  // Détecter si héros (stats exceptionnelles)
  isHero() {
    return (this.strength > 8.5 || this.intelligence > 8.5 || this.charisma > 8.5);
  }
}

export class FamilyTree {
  constructor() {
    this.families = new Map(); // familyId → { name, members, founded }
    this._nextFamilyId = 0;
  }

  createFamily(founderName) {
    const id = this._nextFamilyId++;
    this.families.set(id, {
      id, name: founderName,
      members: [], founded: Date.now(),
      prestige: 0,
    });
    return id;
  }

  addMember(familyId, humanId, parentId = null) {
    const fam = this.families.get(familyId);
    if (fam) fam.members.push({ humanId, parentId, born: Date.now() });
  }

  getTopFamilies(settlements) {
    // Calculer prestige par famille
    for (const [id, fam] of this.families) {
      fam.prestige = fam.members.length * 2;
      // Bonus si membre est leader de colonie
      for (const s of settlements) {
        if (s.leaderFamilyId === id) fam.prestige += 20;
      }
    }
    return [...this.families.values()]
      .sort((a, b) => b.prestige - a.prestige)
      .slice(0, 5);
  }
}

export class HeroRegistry {
  constructor() {
    this.heroes = []; // { name, trait, settlement, born, deeds }
  }

  checkAndRegister(human, settlement) {
    if (!human.genome?.isHero()) return null;
    if (this.heroes.some(h => h.humanId === human.id)) return null;

    const traits = [];
    if (human.genome.strength > 8.5)     traits.push('Guerrier légendaire');
    if (human.genome.intelligence > 8.5) traits.push('Sage visionnaire');
    if (human.genome.charisma > 8.5)     traits.push('Leader charismatique');

    const hero = {
      humanId:    human.id,
      name:       human.name,
      trait:      traits[0] || 'Héros',
      settlement: settlement?.name || '?',
      born:       human.age,
      deeds:      0,
    };
    this.heroes.push(hero);
    return hero;
  }

  addDeed(humanId) {
    const h = this.heroes.find(h => h.humanId === humanId);
    if (h) h.deeds++;
  }

  getLeaderboard() {
    return [...this.heroes].sort((a, b) => b.deeds - a.deeds).slice(0, 10);
  }
}
