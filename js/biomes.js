// ============================================================
// biomes.js — Définition des biomes et leurs propriétés
// ============================================================

export const BIOME = {
  OCEAN:        'ocean',
  RIVER:        'river',
  LAKE:         'lake',
  BEACH:        'beach',
  PLAIN:        'plain',
  PRAIRIE:      'prairie',
  FOREST:       'forest',
  DENSE_FOREST: 'dense_forest',
  JUNGLE:       'jungle',
  SWAMP:        'swamp',
  DESERT:       'desert',
  SAVANNA:      'savanna',
  TUNDRA:       'tundra',
  TAIGA:        'taiga',
  HILL:         'hill',
  MOUNTAIN:     'mountain',
  VOLCANO:      'volcano',
};

/**
 * Propriétés de chaque biome :
 *  color       - couleur canvas
 *  fertility   - 0–1, pousse des plantes
 *  food        - 0–1, nourriture disponible
 *  wood        - 0–1, bois disponible
 *  stone       - 0–1, pierre disponible
 *  ore         - 0–1, minerais disponibles
 *  water       - 0–1, accès eau
 *  speed       - multiplicateur de déplacement
 *  temperature - -1 (froid) à 1 (chaud)
 *  passable    - les humains/animaux peuvent traverser
 *  buildable   - on peut y construire
 */
export const BIOME_PROPS = {
  [BIOME.OCEAN]:        { color:'#1a4a8a', fertility:0.0, food:0.3, wood:0.0, stone:0.0, ore:0.0, water:1.0, speed:0.0, temperature:0.0,  passable:false, buildable:false },
  [BIOME.RIVER]:        { color:'#2a6abf', fertility:0.6, food:0.5, wood:0.1, stone:0.1, ore:0.1, water:1.0, speed:0.5, temperature:0.0,  passable:true,  buildable:false },
  [BIOME.LAKE]:         { color:'#1e5899', fertility:0.0, food:0.4, wood:0.0, stone:0.0, ore:0.0, water:1.0, speed:0.0, temperature:0.0,  passable:false, buildable:false },
  [BIOME.BEACH]:        { color:'#d4b96a', fertility:0.1, food:0.2, wood:0.0, stone:0.2, ore:0.0, water:0.5, speed:0.8, temperature:0.3,  passable:true,  buildable:true  },
  [BIOME.PLAIN]:        { color:'#8db870', fertility:0.7, food:0.6, wood:0.1, stone:0.2, ore:0.1, water:0.3, speed:1.0, temperature:0.2,  passable:true,  buildable:true  },
  [BIOME.PRAIRIE]:      { color:'#a8c878', fertility:0.8, food:0.7, wood:0.2, stone:0.1, ore:0.1, water:0.4, speed:1.0, temperature:0.2,  passable:true,  buildable:true  },
  [BIOME.FOREST]:       { color:'#3d7a3d', fertility:0.8, food:0.7, wood:0.8, stone:0.1, ore:0.2, water:0.5, speed:0.7, temperature:0.1,  passable:true,  buildable:true  },
  [BIOME.DENSE_FOREST]: { color:'#245a24', fertility:0.9, food:0.8, wood:1.0, stone:0.1, ore:0.3, water:0.6, speed:0.5, temperature:0.0,  passable:true,  buildable:false },
  [BIOME.JUNGLE]:       { color:'#1a5c1a', fertility:1.0, food:0.9, wood:0.9, stone:0.0, ore:0.2, water:0.8, speed:0.4, temperature:0.7,  passable:true,  buildable:false },
  [BIOME.SWAMP]:        { color:'#4a6a3a', fertility:0.7, food:0.5, wood:0.5, stone:0.0, ore:0.1, water:0.9, speed:0.3, temperature:0.3,  passable:true,  buildable:false },
  [BIOME.DESERT]:       { color:'#c8a850', fertility:0.0, food:0.1, wood:0.0, stone:0.5, ore:0.4, water:0.0, speed:0.7, temperature:0.9,  passable:true,  buildable:true  },
  [BIOME.SAVANNA]:      { color:'#b8a040', fertility:0.4, food:0.5, wood:0.3, stone:0.3, ore:0.2, water:0.2, speed:0.9, temperature:0.7,  passable:true,  buildable:true  },
  [BIOME.TUNDRA]:       { color:'#9ab0b8', fertility:0.1, food:0.2, wood:0.1, stone:0.4, ore:0.3, water:0.3, speed:0.6, temperature:-0.9, passable:true,  buildable:false },
  [BIOME.TAIGA]:        { color:'#5a7a6a', fertility:0.4, food:0.4, wood:0.7, stone:0.3, ore:0.4, water:0.4, speed:0.7, temperature:-0.5, passable:true,  buildable:false },
  [BIOME.HILL]:         { color:'#7a8a6a', fertility:0.4, food:0.4, wood:0.4, stone:0.7, ore:0.6, water:0.3, speed:0.7, temperature:-0.1, passable:true,  buildable:true  },
  [BIOME.MOUNTAIN]:     { color:'#8a8888', fertility:0.1, food:0.1, wood:0.2, stone:1.0, ore:0.9, water:0.2, speed:0.3, temperature:-0.6, passable:true,  buildable:false },
  [BIOME.VOLCANO]:      { color:'#a03020', fertility:0.0, food:0.0, wood:0.0, stone:0.6, ore:1.0, water:0.0, speed:0.2, temperature:1.0,  passable:false, buildable:false },
};

/**
 * Retourne le biome à partir des paramètres de bruit
 * @param {number} elevation - 0–1
 * @param {number} moisture  - 0–1
 * @param {number} temperature - 0–1
 */
export function getBiomeFromParams(elevation, moisture, temperature) {
  if (elevation < 0.25) return BIOME.OCEAN;
  if (elevation < 0.28) return BIOME.BEACH;
  if (elevation > 0.85) return BIOME.MOUNTAIN;
  if (elevation > 0.92) return BIOME.VOLCANO;
  if (elevation > 0.72) return BIOME.HILL;

  if (moisture > 0.82) {
    if (temperature > 0.6) return BIOME.JUNGLE;
    if (temperature > 0.2) return BIOME.DENSE_FOREST;
    return BIOME.TAIGA;
  }
  if (moisture > 0.6) {
    if (temperature > 0.6) return BIOME.FOREST;
    if (temperature < -0.3) return BIOME.TAIGA;
    return BIOME.FOREST;
  }
  if (moisture > 0.38) {
    if (temperature < -0.4) return BIOME.TUNDRA;
    if (temperature > 0.5) return BIOME.SAVANNA;
    return BIOME.PRAIRIE;
  }
  if (moisture < 0.18) {
    if (temperature > 0.4) return BIOME.DESERT;
    return BIOME.TUNDRA;
  }
  if (moisture < 0.42 && elevation < 0.55) return BIOME.PLAIN;
  if (temperature < -0.4) return BIOME.TUNDRA;
  if (moisture > 0.55) return BIOME.SWAMP;
  return BIOME.PLAIN;
}
