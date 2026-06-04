# CivilSim — Simulateur de Civilisation Vivant

Simulation complète Civilization × SimCity × RimWorld en JavaScript pur (HTML/CSS/JS ES6 modules). Aucune dépendance externe.

## Structuregezez

```
index.html           — Point d'entrée HTML
style.css            — Thème dark industriel
js/
 ├── main.js         — Orchestrateur, boucle principale, caméra, événements
 ├── world.js        — Génération procédurale (Perlin noise), tuiles, offscreen canvas
 ├── biomes.js       — 17 biomes avec propriétés (fertilité, ressources, vitesse...)
 ├── plants.js       — 6 types de plantes (pousse, meurt, se reproduit)
 ├── animals.js      — 9 animaux (5 herbivores + 4 prédateurs) avec IA comportementale
 ├── human.js        — Humains avec besoins (faim/soif/énergie), 8 métiers, IA
 ├── city.js         — Colonies Camp→Métropole, 10 bâtiments, économie, expansion
 ├── technology.js   — Arbre techno (9 techs) avec effets sur la simulation
 ├── ui.js           — Interface : stats, sélection, liste villes, technologies
 ├── graphs.js       — Graphiques temps réel : population, nourriture, animaux...
 └── save.js         — Sauvegarde localStorage + export/import JSON
```

## Utilisation

Ouvrir `index.html` dans un navigateur **via un serveur web local** (ES6 modules nécessitent HTTP) :

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code : Live Server extension
```

Puis : http://localhost:8080

## Contrôles

- **Clic + drag** : naviguer sur la carte
- **Clic simple** : sélectionner humain / animal / ville
- **Molette** : navigation horizontale
- **Boutons top** : Pause / x1 / x2 / x4 / x8 / Reset
- **Sauver** : localStorage
- **Export/Import** : fichier JSON

## Entités simulées

| Type | Quantité max | Comportements |
|------|-------------|---------------|
| Plantes | 800 | Pousse, meurt, propage |
| Herbivores | ~240 | Fuite, eau, nourriture, reproduction |
| Prédateurs | ~60 | Chasse, territoire |
| Humains | Variable | 8 métiers, 4 besoins, IA |
| Colonies | Illimité | Évolution, expansion automatique |

## Bugs évités

- ✅ Tous les imports ES6 vérifiés avant exécution
- ✅ Canvas offscreen pour performances
- ✅ Culling des entités hors vue
- ✅ Overlay FPS + compteur d'entités
- ✅ Gestion d'erreur fatale avec affichage stack
- ✅ requestAnimationFrame correct avec `bind`
