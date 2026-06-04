// ============================================================
// textures.js — Générateur de textures pixel art procédurales
// Crée toutes les textures en Canvas 2D puis les convertit
// en PIXI.Texture pour usage WebGL — ZÉRO dépendance externe
// ============================================================

// Taille de base des sprites
export const SPR = 32; // 32×32 pixels par sprite

// ——— Utilitaires ————————————————————————————————————
function makeCanvas(w = SPR, h = SPR) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function circle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

// ——— TILESET TERRAIN ————————————————————————————————
function makeTerrainTile(biomeKey) {
  const c = makeCanvas(SPR, SPR);
  const ctx = c.getContext('2d');
  const S = SPR;

  switch(biomeKey) {
    case 'ocean': case 'lake': {
      // Eau profonde : dégradé bleu + vagues
      const g = ctx.createLinearGradient(0,0,S,S);
      g.addColorStop(0,'#1a4a8a'); g.addColorStop(1,'#0e2f5a');
      ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
      // Reflets vagues
      ctx.strokeStyle='rgba(80,160,255,0.3)'; ctx.lineWidth=1;
      for(let y=4;y<S;y+=6){
        ctx.beginPath();
        for(let x=0;x<S;x+=4) ctx.lineTo(x, y+Math.sin(x*0.4)*1.5);
        ctx.stroke();
      }
      // Éclat
      rect(ctx,10,8,4,1,'rgba(180,230,255,0.4)');
      rect(ctx,20,14,3,1,'rgba(180,230,255,0.3)');
      break;
    }
    case 'river': {
      const g=ctx.createLinearGradient(0,0,0,S);
      g.addColorStop(0,'#2a6abf'); g.addColorStop(1,'#1a4a9f');
      ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
      ctx.strokeStyle='rgba(120,190,255,0.4)'; ctx.lineWidth=1.5;
      ctx.beginPath();
      for(let x=0;x<S;x++) ctx.lineTo(x, S/2+Math.sin(x*0.3)*3);
      ctx.stroke();
      break;
    }
    case 'beach': {
      // Sable avec grains et coquillages
      rect(ctx,0,0,S,S,'#d4b96a');
      // Variation de couleur
      for(let y=0;y<S;y++) for(let x=0;x<S;x++){
        if(Math.random()<0.15){
          const v=(Math.random()-0.5)*30;
          const base=Math.floor(212+v);
          px(ctx,x,y,`rgb(${base},${Math.floor(185+v*0.8)},${Math.floor(106+v*0.5)})`);
        }
      }
      // Coquillage
      circle(ctx,8,20,2,'rgba(255,255,220,0.8)');
      circle(ctx,24,10,1.5,'rgba(255,230,200,0.7)');
      // Ombre humide en bas
      rect(ctx,0,S-4,S,4,'rgba(180,140,60,0.3)');
      break;
    }
    case 'plain': {
      rect(ctx,0,0,S,S,'#7ab05a');
      // Brins d'herbe variés
      const grassColors=['#60a040','#80c055','#509830','#6ab048'];
      for(let i=0;i<20;i++){
        const gx=Math.floor(Math.random()*S), gy=Math.floor(Math.random()*S);
        const col=grassColors[Math.floor(Math.random()*4)];
        ctx.strokeStyle=col; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(gx,gy+3);
        ctx.quadraticCurveTo(gx+(Math.random()-0.5)*4,gy-2,gx+(Math.random()-0.5)*2,gy-4);
        ctx.stroke();
      }
      break;
    }
    case 'prairie': {
      rect(ctx,0,0,S,S,'#8ec868');
      for(let i=0;i<25;i++){
        const gx=Math.floor(Math.random()*S), gy=Math.floor(Math.random()*S);
        ctx.strokeStyle=`hsl(${100+Math.random()*20},${50+Math.random()*30}%,${35+Math.random()*15}%)`;
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(gx,gy+3);
        ctx.quadraticCurveTo(gx+(Math.random()-0.5)*4,gy,gx+(Math.random()-0.5)*2,gy-5);
        ctx.stroke();
      }
      // Petite fleur
      if(Math.random()<0.5) { circle(ctx,16,16,2,'#ffd060'); circle(ctx,16,16,1,'#ffaa00'); }
      break;
    }
    case 'forest': {
      rect(ctx,0,0,S,S,'#2d6e2d');
      // Sol forestier avec mousse
      for(let y=0;y<S;y+=2) for(let x=0;x<S;x+=2){
        if(Math.random()<0.3) rect(ctx,x,y,2,2,`hsl(${120+Math.random()*20},${40+Math.random()*20}%,${20+Math.random()*10}%)`);
      }
      // Racine
      ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(14,S); ctx.lineTo(16,S-8); ctx.lineTo(18,S); ctx.stroke();
      break;
    }
    case 'dense_forest': {
      rect(ctx,0,0,S,S,'#1a4e1a');
      for(let y=0;y<S;y+=2) for(let x=0;x<S;x+=2){
        if(Math.random()<0.4) rect(ctx,x,y,2,2,`hsl(${115+Math.random()*15},${35+Math.random()*20}%,${15+Math.random()*8}%)`);
      }
      break;
    }
    case 'jungle': {
      rect(ctx,0,0,S,S,'#156015');
      // Feuilles larges
      ctx.fillStyle='rgba(0,100,0,0.3)';
      for(let i=0;i<5;i++){
        const lx=Math.random()*S, ly=Math.random()*S;
        ctx.save(); ctx.translate(lx,ly); ctx.rotate(Math.random()*Math.PI);
        ctx.beginPath(); ctx.ellipse(0,0,6,3,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'swamp': {
      rect(ctx,0,0,S,S,'#3a5a2a');
      // Flaques sombres
      ctx.fillStyle='rgba(20,40,15,0.5)';
      ctx.beginPath(); ctx.ellipse(10,18,7,4,0.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(22,10,5,3,0.8,0,Math.PI*2); ctx.fill();
      // Reflet
      ctx.strokeStyle='rgba(80,150,80,0.3)'; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(6,18); ctx.lineTo(14,18); ctx.stroke();
      break;
    }
    case 'desert': {
      rect(ctx,0,0,S,S,'#c8a850');
      // Dunes : lignes courbes
      ctx.strokeStyle='rgba(200,160,60,0.5)'; ctx.lineWidth=1;
      for(let d=0;d<3;d++){
        const dy=8+d*8;
        ctx.beginPath();
        for(let x=0;x<S;x++) ctx.lineTo(x, dy+Math.sin(x*0.25+d*2)*2);
        ctx.stroke();
      }
      // Grain de sable (points)
      ctx.fillStyle='rgba(240,200,120,0.4)';
      for(let i=0;i<30;i++) ctx.fillRect(Math.random()*S,Math.random()*S,1,1);
      break;
    }
    case 'savanna': {
      rect(ctx,0,0,S,S,'#a89030');
      // Herbe sèche
      ctx.strokeStyle='#c8a840'; ctx.lineWidth=1;
      for(let i=0;i<12;i++){
        const sx=Math.random()*S, sy=Math.random()*S;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+(Math.random()-0.5)*4,sy-6); ctx.stroke();
      }
      break;
    }
    case 'tundra': {
      rect(ctx,0,0,S,S,'#9ab0b8');
      // Plaques de glace
      ctx.fillStyle='rgba(200,230,255,0.35)';
      ctx.fillRect(3,3,12,10); ctx.fillRect(18,14,10,8); ctx.fillRect(5,20,8,8);
      // Craquelures
      ctx.strokeStyle='rgba(160,200,220,0.5)'; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(3,8); ctx.lineTo(10,8); ctx.lineTo(8,3); ctx.stroke();
      break;
    }
    case 'taiga': {
      rect(ctx,0,0,S,S,'#4a6e5a');
      // Neige sur sol
      ctx.fillStyle='rgba(220,240,255,0.25)';
      for(let i=0;i<8;i++) ctx.fillRect(Math.random()*S,Math.random()*S,Math.random()*6+2,2);
      break;
    }
    case 'hill': {
      rect(ctx,0,0,S,S,'#6a7a5a');
      // Strates rocheuses
      ctx.fillStyle='rgba(80,70,50,0.2)';
      rect(ctx,2,S*0.35,S-4,2,'rgba(80,60,40,0.3)');
      rect(ctx,4,S*0.6,S-6,2,'rgba(80,60,40,0.25)');
      // Pierres
      circle(ctx,8,22,3,'rgba(100,90,75,0.5)');
      circle(ctx,22,12,2,'rgba(110,100,80,0.4)');
      break;
    }
    case 'mountain': {
      const g=ctx.createLinearGradient(0,0,0,S);
      g.addColorStop(0,'#e0ddd8'); g.addColorStop(0.4,'#a09890'); g.addColorStop(1,'#706860');
      ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
      // Fissures
      ctx.strokeStyle='rgba(60,50,40,0.4)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(12,S*0.4); ctx.lineTo(10,S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(24,S*0.6); ctx.stroke();
      // Neige sommet
      ctx.fillStyle='rgba(240,248,255,0.8)';
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(S-8,0); ctx.lineTo(S-10,S*0.2); ctx.lineTo(8,S*0.18); ctx.fill();
      break;
    }
    case 'volcano': {
      const g=ctx.createRadialGradient(S/2,S/2,2,S/2,S/2,S/2);
      g.addColorStop(0,'#ff4020'); g.addColorStop(0.5,'#802010'); g.addColorStop(1,'#401008');
      ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
      // Lave
      ctx.fillStyle='rgba(255,100,20,0.5)';
      for(let i=0;i<4;i++){
        const lx=S*0.3+Math.random()*S*0.4, ly=S*0.3+Math.random()*S*0.4;
        circle(ctx,lx,ly,2+Math.random()*3,'rgba(255,120,30,0.6)');
      }
      break;
    }
    default: {
      rect(ctx,0,0,S,S,'#7ab05a');
    }
  }

  return c;
}

// ——— SPRITES ENTITÉS ————————————————————————————————

export function makeAnimalSprite(type) {
  const c = makeCanvas(SPR, SPR);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const S = SPR;

  // Transparence de fond
  ctx.clearRect(0,0,S,S);

  switch(type) {
    case 'rabbit': {
      // Corps blanc/gris
      circle(ctx,16,20,7,'#e8dcc8');
      // Tête
      circle(ctx,16,11,5,'#ddd0ba');
      // Oreilles
      rect(ctx,11,2,3,9,'#e0d0b8');
      rect(ctx,18,2,3,9,'#e0d0b8');
      // Intérieur oreilles rose
      rect(ctx,12,3,1,6,'rgba(255,180,180,0.7)');
      rect(ctx,19,3,1,6,'rgba(255,180,180,0.7)');
      // Yeux
      px(ctx,14,10,'#222'); px(ctx,18,10,'#222');
      // Reflet yeux
      px(ctx,14,9,'rgba(255,255,255,0.7)'); px(ctx,18,9,'rgba(255,255,255,0.7)');
      // Nez rose
      px(ctx,16,13,'#ff9999');
      // Queue
      circle(ctx,21,22,2,'#f0e8e0');
      break;
    }
    case 'deer': {
      // Corps brun
      ctx.fillStyle='#b07840';
      ctx.beginPath(); ctx.ellipse(16,20,8,6,0,0,Math.PI*2); ctx.fill();
      // Cou + tête
      rect(ctx,13,10,5,8,'#b07840');
      circle(ctx,16,9,5,'#c08850');
      // Bois
      ctx.strokeStyle='#7a5020'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(13,6); ctx.lineTo(10,1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10,3); ctx.lineTo(7,2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19,6); ctx.lineTo(22,1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22,3); ctx.lineTo(25,2); ctx.stroke();
      // Ventre clair
      ctx.fillStyle='rgba(220,180,100,0.6)';
      ctx.beginPath(); ctx.ellipse(16,22,5,3,0,0,Math.PI*2); ctx.fill();
      // Pattes
      rect(ctx,10,25,2,6,'#906030'); rect(ctx,14,25,2,6,'#906030');
      rect(ctx,18,25,2,6,'#906030'); rect(ctx,22,25,2,6,'#906030');
      // Yeux
      px(ctx,14,8,'#1a0a00'); px(ctx,18,8,'#1a0a00');
      px(ctx,14,7,'rgba(255,255,255,0.6)');
      break;
    }
    case 'wolf': {
      ctx.fillStyle='#708090';
      ctx.beginPath(); ctx.ellipse(16,20,8,6,0,0,Math.PI*2); ctx.fill();
      // Tête triangulaire
      ctx.beginPath(); ctx.moveTo(10,12); ctx.lineTo(22,12); ctx.lineTo(16,5); ctx.fill();
      // Museau
      ctx.fillStyle='#90a0a8';
      ctx.beginPath(); ctx.ellipse(16,13,3,2,0,0,Math.PI*2); ctx.fill();
      // Oreilles pointues
      ctx.fillStyle='#607080';
      ctx.beginPath(); ctx.moveTo(10,12); ctx.lineTo(8,5); ctx.lineTo(14,10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(22,12); ctx.lineTo(24,5); ctx.lineTo(18,10); ctx.fill();
      // Yeux jaunes
      ctx.fillStyle='#e8b020';
      circle(ctx,13,10,2,'#e8b020'); circle(ctx,19,10,2,'#e8b020');
      ctx.fillStyle='#000';
      circle(ctx,13,10,1,'#000'); circle(ctx,19,10,1,'#000');
      // Queue
      ctx.strokeStyle='#708090'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(8,20); ctx.quadraticCurveTo(3,14,5,8); ctx.stroke();
      // Ventre
      ctx.fillStyle='rgba(180,195,200,0.5)';
      ctx.beginPath(); ctx.ellipse(16,22,5,3,0,0,Math.PI*2); ctx.fill();
      // Nez noir
      circle(ctx,16,14,1.5,'#222');
      break;
    }
    case 'bear': {
      ctx.fillStyle='#604030';
      ctx.beginPath(); ctx.ellipse(16,20,10,8,0,0,Math.PI*2); ctx.fill();
      // Tête ronde et grosse
      circle(ctx,16,10,8,'#604030');
      // Oreilles rondes
      circle(ctx,10,4,3,'#604030'); circle(ctx,22,4,3,'#604030');
      // Museau clair
      ctx.fillStyle='#785048';
      ctx.beginPath(); ctx.ellipse(16,13,4,3,0,0,Math.PI*2); ctx.fill();
      // Nez
      circle(ctx,16,12,2,'#1a0a00');
      px(ctx,15,11,'rgba(255,255,255,0.5)');
      // Yeux
      circle(ctx,12,8,1.5,'#1a0a00'); circle(ctx,20,8,1.5,'#1a0a00');
      px(ctx,12,7,'rgba(255,255,255,0.5)'); px(ctx,20,7,'rgba(255,255,255,0.5)');
      // Ventre
      ctx.fillStyle='rgba(120,90,70,0.4)';
      ctx.beginPath(); ctx.ellipse(16,22,6,5,0,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'fox': {
      ctx.fillStyle='#c06018';
      ctx.beginPath(); ctx.ellipse(16,20,7,5,0,0,Math.PI*2); ctx.fill();
      // Tête avec museau allongé
      circle(ctx,16,11,5,'#c06018');
      ctx.fillStyle='#e08038';
      ctx.beginPath(); ctx.ellipse(19,14,3,2,0.5,0,Math.PI*2); ctx.fill();
      // Oreilles pointues
      ctx.fillStyle='#c06018';
      ctx.beginPath(); ctx.moveTo(11,9); ctx.lineTo(9,3); ctx.lineTo(15,8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(21,9); ctx.lineTo(23,3); ctx.lineTo(17,8); ctx.fill();
      // Intérieur oreilles
      ctx.fillStyle='#ff9060';
      ctx.beginPath(); ctx.moveTo(12,8); ctx.lineTo(10,4); ctx.lineTo(14,8); ctx.fill();
      // Nez noir
      circle(ctx,21,14,1.5,'#222');
      // Yeux
      ctx.fillStyle='#e8b020'; circle(ctx,13,10,2,'#e8b020'); circle(ctx,19,10,2,'#e8b020');
      ctx.fillStyle='#111'; circle(ctx,13,10,1,'#111'); circle(ctx,19,10,1,'#111');
      // Queue blanche au bout
      ctx.strokeStyle='#c06018'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(9,20); ctx.quadraticCurveTo(4,15,6,8); ctx.stroke();
      ctx.strokeStyle='#f0f0f0'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(5,10); ctx.lineTo(6,8); ctx.stroke();
      break;
    }
    case 'sheep': {
      // Toison en nuages
      ctx.fillStyle='#e8e4d8';
      for(const [cx,cy,r] of [[16,18,8],[10,16,5],[22,16,5],[16,12,5],[10,20,4],[22,20,4]])
        circle(ctx,cx,cy,r,'#e8e4d8');
      // Tête noire
      ctx.fillStyle='#3a3030';
      circle(ctx,16,9,4,'#3a3030');
      // Oreilles
      ctx.fillStyle='#4a3838';
      ctx.beginPath(); ctx.ellipse(11,10,2,3,0.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(21,10,2,3,-0.5,0,Math.PI*2); ctx.fill();
      // Pattes
      rect(ctx,11,25,2,5,'#5a5050'); rect(ctx,15,25,2,5,'#5a5050');
      rect(ctx,17,25,2,5,'#5a5050'); rect(ctx,21,25,2,5,'#5a5050');
      // Yeux
      px(ctx,14,9,'#fff'); px(ctx,18,9,'#fff');
      break;
    }
    case 'boar': {
      ctx.fillStyle='#503828';
      ctx.beginPath(); ctx.ellipse(16,20,9,7,0,0,Math.PI*2); ctx.fill();
      // Tête
      circle(ctx,22,16,6,'#503828');
      // Groin
      ctx.fillStyle='#704038';
      ctx.beginPath(); ctx.ellipse(26,16,3,2,0,0,Math.PI*2); ctx.fill();
      // Défenses
      ctx.strokeStyle='#e8d080'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(25,18); ctx.lineTo(28,21); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(25,15); ctx.lineTo(28,12); ctx.stroke();
      // Yeux rouges
      circle(ctx,20,14,1.5,'#cc2020');
      // Poils de dos
      ctx.strokeStyle='#3a2818'; ctx.lineWidth=1;
      for(let i=8;i<24;i+=3){ ctx.beginPath(); ctx.moveTo(i,14); ctx.lineTo(i+1,10); ctx.stroke(); }
      break;
    }
    case 'goat': {
      ctx.fillStyle='#c8c0b0';
      ctx.beginPath(); ctx.ellipse(16,20,8,6,0,0,Math.PI*2); ctx.fill();
      circle(ctx,16,11,5,'#c8c0b0');
      // Cornes recourbées
      ctx.strokeStyle='#a08040'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(12,8); ctx.quadraticCurveTo(8,4,10,1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20,8); ctx.quadraticCurveTo(24,4,22,1); ctx.stroke();
      // Barbe
      ctx.strokeStyle='#d0c8b8'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(16,15); ctx.lineTo(16,19); ctx.stroke();
      // Yeux
      circle(ctx,13,10,1.5,'#4a3a20'); circle(ctx,19,10,1.5,'#4a3a20');
      // Pattes
      rect(ctx,10,25,2,6,'#a0988a'); rect(ctx,14,25,2,6,'#a0988a');
      rect(ctx,18,25,2,6,'#a0988a'); rect(ctx,22,25,2,6,'#a0988a');
      break;
    }
    case 'lynx': {
      ctx.fillStyle='#a07838';
      ctx.beginPath(); ctx.ellipse(16,20,8,6,0,0,Math.PI*2); ctx.fill();
      circle(ctx,16,10,6,'#a07838');
      // Oreilles avec touffe
      ctx.fillStyle='#a07838';
      ctx.beginPath(); ctx.moveTo(10,8); ctx.lineTo(8,2); ctx.lineTo(14,7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(22,8); ctx.lineTo(24,2); ctx.lineTo(18,7); ctx.fill();
      // Touffe noire
      ctx.fillStyle='#222';
      ctx.beginPath(); ctx.moveTo(10,6); ctx.lineTo(9,3); ctx.lineTo(12,6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(22,6); ctx.lineTo(23,3); ctx.lineTo(20,6); ctx.fill();
      // Taches
      ctx.fillStyle='rgba(80,55,20,0.35)';
      for(const [tx,ty] of [[12,18],[20,17],[16,22],[13,22],[19,23]])
        circle(ctx,tx,ty,2,'rgba(80,55,20,0.35)');
      // Yeux verts
      circle(ctx,13,9,2,'#30b050'); circle(ctx,19,9,2,'#30b050');
      ctx.fillStyle='#111'; circle(ctx,13,9,1,'#111'); circle(ctx,19,9,1,'#111');
      break;
    }
    default: {
      circle(ctx,16,16,10,'#888');
      circle(ctx,16,10,6,'#aaa');
    }
  }

  return c;
}

export function makePlantSprite(type) {
  const c = makeCanvas(SPR, SPR);
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,SPR,SPR);
  const S = SPR;

  switch(type) {
    case 'tree': {
      // Ombre au sol
      ctx.fillStyle='rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(16,29,9,3,0,0,Math.PI*2); ctx.fill();
      // Tronc
      rect(ctx,13,18,6,12,'#8B5E3C');
      rect(ctx,14,19,4,10,'#6a4a2a');
      // Racines
      ctx.strokeStyle='#6a4020'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(13,27); ctx.lineTo(9,30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19,27); ctx.lineTo(23,30); ctx.stroke();
      // Couronne 3 couches (profondeur)
      circle(ctx,16,14,'#1e5020',9); // ombre
      circle(ctx,16,12,9,'#1e5020');
      circle(ctx,14,10,8,'#2a6a2a');
      circle(ctx,18,11,7,'#2a6a2a');
      circle(ctx,13,9,6,'#357535'); // milieu
      circle(ctx,19,8,6,'#357535');
      circle(ctx,16,7,7,'#3a8040');
      circle(ctx,14,6,5,'#44a048'); // lumière
      circle(ctx,18,6,4,'#44a048');
      // Highlight
      ctx.fillStyle='rgba(180,255,140,0.12)';
      circle(ctx,13,7,3,'rgba(180,255,140,0.12)');
      break;
    }
    case 'berry': {
      // Buisson
      ctx.fillStyle='rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(16,28,10,3,0,0,Math.PI*2); ctx.fill();
      circle(ctx,16,20,10,'#1e5218');
      circle(ctx,10,18,7,'#245a20');
      circle(ctx,22,18,7,'#245a20');
      circle(ctx,16,15,7,'#2a6a24');
      circle(ctx,11,16,5,'#306028');
      circle(ctx,21,16,5,'#306028');
      // Baies rouges
      for(const[bx,by] of [[11,16],[16,13],[21,17],[13,20],[19,20],[15,18]])
        circle(ctx,bx,by,2.5,'#cc2244');
      // Reflets baies
      for(const[bx,by] of [[11,16],[16,13],[21,17]])
        px(ctx,bx-1,by-1,'rgba(255,200,200,0.7)');
      // Tiges
      ctx.strokeStyle='#3a6028'; ctx.lineWidth=1;
      for(const[bx,by] of [[11,16],[16,13],[21,17]]){
        ctx.beginPath(); ctx.moveTo(bx,by+2); ctx.lineTo(bx,by+5); ctx.stroke();
      }
      break;
    }
    case 'mushroom': {
      // Ombre
      ctx.fillStyle='rgba(0,0,0,0.1)';
      ctx.beginPath(); ctx.ellipse(16,30,8,2,0,0,Math.PI*2); ctx.fill();
      // Pied
      ctx.fillStyle='#e8e0d0';
      ctx.beginPath(); ctx.roundRect(12,18,8,12,2); ctx.fill();
      ctx.fillStyle='rgba(200,190,170,0.4)';
      rect(ctx,13,20,2,9,'rgba(200,190,170,0.4)');
      // Anneau
      ctx.strokeStyle='rgba(180,170,150,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.ellipse(16,22,5,1.5,0,0,Math.PI*2); ctx.stroke();
      // Chapeau
      const mGrad=ctx.createRadialGradient(14,14,1,16,16,12);
      mGrad.addColorStop(0,'#d88038'); mGrad.addColorStop(1,'#a85818');
      ctx.fillStyle=mGrad;
      ctx.beginPath(); ctx.ellipse(16,17,12,9,0,Math.PI,0); ctx.fill();
      // Dessous du chapeau
      ctx.fillStyle='rgba(240,220,180,0.7)';
      ctx.beginPath(); ctx.ellipse(16,18,11,3,0,0,Math.PI*2); ctx.fill();
      // Points blancs
      for(const[px2,py2,r] of [[12,14,2.5],[20,13,2],[16,11,2],[10,16,1.5],[22,15,1.5]]) {
        circle(ctx,px2,py2,r,'rgba(255,255,255,0.85)');
        px(ctx,px2-1,py2-1,'rgba(255,255,255,0.4)');
      }
      break;
    }
    case 'cactus': {
      ctx.fillStyle='rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(16,30,6,2,0,0,Math.PI*2); ctx.fill();
      // Corps principal
      ctx.fillStyle='#4a8a40';
      ctx.beginPath(); ctx.roundRect(13,8,6,22,3); ctx.fill();
      // Texture verticale
      ctx.strokeStyle='rgba(40,100,30,0.4)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(16,8); ctx.lineTo(16,30); ctx.stroke();
      // Bras gauche
      ctx.fillStyle='#4a8a40';
      ctx.beginPath(); ctx.roundRect(6,14,7,4,2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(6,10,4,9,2); ctx.fill();
      // Bras droit
      ctx.beginPath(); ctx.roundRect(19,16,7,4,2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(22,12,4,9,2); ctx.fill();
      // Épines
      ctx.strokeStyle='rgba(200,220,180,0.8)'; ctx.lineWidth=0.5;
      for(const[sx,sy,ex,ey] of [[12,12,9,11],[12,16,9,15],[12,20,9,19],[20,13,23,12],[20,17,23,16],[20,21,23,20]])
        { ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke(); }
      // Fleur
      circle(ctx,16,8,3,'#ff6080');
      circle(ctx,16,8,2,'#ffaa00');
      break;
    }
    case 'reed': {
      ctx.clearRect(0,0,S,S);
      // 3 roseaux
      for(const[ox,lean] of [[-5,-2],[0,1],[5,-1]]) {
        const bx=16+ox;
        ctx.strokeStyle='#6a8a30'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(bx,S-2);
        ctx.quadraticCurveTo(bx+lean*0.5,S/2,bx+lean,4); ctx.stroke();
        // Épi
        ctx.fillStyle='#8a6030';
        ctx.beginPath(); ctx.ellipse(bx+lean,5,2,5,lean*0.1,0,Math.PI*2); ctx.fill();
      }
      // Feuilles
      ctx.strokeStyle='#7a9a38'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(16,22); ctx.quadraticCurveTo(8,18,6,14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16,20); ctx.quadraticCurveTo(24,16,26,12); ctx.stroke();
      break;
    }
    case 'grass': {
      ctx.clearRect(0,0,S,S);
      const colors=['#5a9a3a','#6aaa45','#4a8a2a','#72b040'];
      for(let i=0;i<12;i++){
        const gx=4+Math.random()*(S-8), gy=S-4;
        const lean=(Math.random()-0.5)*6;
        ctx.strokeStyle=colors[Math.floor(Math.random()*4)];
        ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(gx,gy);
        ctx.quadraticCurveTo(gx+lean*0.5,gy-S*0.4,gx+lean,gy-S*0.6+Math.random()*8);
        ctx.stroke();
      }
      break;
    }
    default: {
      circle(ctx,16,16,8,'#4a8a30');
    }
  }
  return c;
}

export function makeBuildingSprite(type) {
  const c = makeCanvas(SPR*2, SPR*2); // Bâtiments plus grands
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,SPR*2,SPR*2);
  const S=SPR*2;

  // Ombre commune
  ctx.fillStyle='rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(S/2,S-4,S*0.35,S*0.08,0,0,Math.PI*2); ctx.fill();

  switch(type) {
    case 'HOUSE': {
      // Murs
      rect(ctx,12,24,40,28,'#c8a870');
      rect(ctx,14,26,36,24,'#d4b882'); // face claire
      // Porte
      rect(ctx,24,36,16,16,'#6a4a28');
      rect(ctx,25,37,7,14,'#5a3a20'); // ombre porte
      // Fenêtres
      rect(ctx,16,28,10,10,'#4a6a8a'); rect(ctx,38,28,10,10,'#4a6a8a');
      // Cadres fenêtres
      ctx.strokeStyle='#d0b878'; ctx.lineWidth=1.5;
      ctx.strokeRect(16,28,10,10); ctx.strokeRect(38,28,10,10);
      // Croisillons fenêtres
      ctx.beginPath(); ctx.moveTo(21,28); ctx.lineTo(21,38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16,33); ctx.lineTo(26,33); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(43,28); ctx.lineTo(43,38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(38,33); ctx.lineTo(48,33); ctx.stroke();
      // Lumière fenêtre (nuit simulée via alpha)
      ctx.fillStyle='rgba(255,220,120,0.0)'; // activé via JS
      rect(ctx,17,29,8,8,'rgba(255,220,120,0.0)');
      // Toit
      ctx.fillStyle='#c04030';
      ctx.beginPath(); ctx.moveTo(8,26); ctx.lineTo(S-8,26); ctx.lineTo(S-8-6,8); ctx.lineTo(14,8); ctx.fill();
      ctx.fillStyle='#a03020'; // ombre toit
      ctx.beginPath(); ctx.moveTo(8,26); ctx.lineTo(14,8); ctx.lineTo(14,26); ctx.fill();
      // Tuiles de toit
      ctx.strokeStyle='rgba(150,30,20,0.4)'; ctx.lineWidth=0.5;
      for(let ty2=10;ty2<26;ty2+=4) { ctx.beginPath(); ctx.moveTo(10,ty2); ctx.lineTo(S-10,ty2); ctx.stroke(); }
      // Cheminée
      rect(ctx,44,5,7,15,'#9a8070');
      rect(ctx,45,6,5,13,'#a89080');
      rect(ctx,43,4,9,3,'#b09888');
      break;
    }
    case 'FARM': {
      // Sol cultivé
      ctx.fillStyle='#7a5030';
      ctx.fillRect(4,36,S-8,24);
      // Rangs de culture
      ctx.strokeStyle='#604020'; ctx.lineWidth=1;
      for(let row=0;row<5;row++){
        ctx.beginPath(); ctx.moveTo(4,38+row*4); ctx.lineTo(S-4,38+row*4); ctx.stroke();
      }
      // Petites plantes
      ctx.fillStyle='#60a030';
      for(let ci=0;ci<8;ci++){
        const fx=8+ci*7,fy=36;
        ctx.beginPath(); ctx.moveTo(fx,fy+4); ctx.lineTo(fx-3,fy); ctx.lineTo(fx+3,fy); ctx.fill();
      }
      // Grange
      rect(ctx,16,12,32,24,'#c86820');
      rect(ctx,18,14,28,20,'#d87830');
      // Portes de grange
      ctx.fillStyle='#8a4410';
      ctx.beginPath(); ctx.moveTo(24,36); ctx.lineTo(24,20); ctx.arc(32,20,8,Math.PI,0); ctx.lineTo(40,36); ctx.fill();
      // Toit grange triangulaire
      ctx.fillStyle='#a04010';
      ctx.beginPath(); ctx.moveTo(10,14); ctx.lineTo(S-10,14); ctx.lineTo(S-14,4); ctx.lineTo(14,4); ctx.fill();
      ctx.fillStyle='#803010';
      ctx.beginPath(); ctx.moveTo(10,14); ctx.lineTo(14,4); ctx.lineTo(14,14); ctx.fill();
      // Croix de grange
      ctx.strokeStyle='rgba(200,140,80,0.5)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(24,22); ctx.lineTo(40,34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40,22); ctx.lineTo(24,34); ctx.stroke();
      break;
    }
    case 'BARRACKS': {
      // Base militaire
      rect(ctx,8,20,48,32,'#3a4850');
      rect(ctx,10,22,44,28,'#445260');
      // Merlons (créneaux)
      ctx.fillStyle='#3a4850';
      for(let m=0;m<6;m++) rect(ctx,10+m*8,14,5,8,'#3a4850');
      // Porte renforcée
      rect(ctx,22,30,20,22,'#2a1a0a');
      ctx.strokeStyle='#604020'; ctx.lineWidth=2;
      ctx.strokeRect(22,30,20,22);
      // Épées décoratives
      ctx.strokeStyle='#c0c0c0'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(28,32); ctx.lineTo(28,48); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(26,34); ctx.lineTo(30,34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(36,32); ctx.lineTo(36,48); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(34,34); ctx.lineTo(38,34); ctx.stroke();
      // Fenêtres meurtrières
      ctx.fillStyle='#1a1a2a';
      for(const[wx,wy] of [[14,24],[44,24],[14,34],[44,34]]) rect(ctx,wx,wy,4,6,'#1a1a2a');
      break;
    }
    case 'MINE': {
      // Entrée de mine
      rect(ctx,12,16,40,36,'#605040');
      rect(ctx,14,18,36,32,'#706050');
      // Tunnel sombre
      ctx.fillStyle='#0a0806';
      ctx.beginPath(); ctx.moveTo(20,52); ctx.lineTo(20,28); ctx.arc(32,28,12,Math.PI,0); ctx.lineTo(44,52); ctx.fill();
      // Rails
      ctx.strokeStyle='#888'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(26,52); ctx.lineTo(26,32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(38,52); ctx.lineTo(38,32); ctx.stroke();
      // Traverses
      ctx.lineWidth=1;
      for(let t=0;t<5;t++){ ctx.beginPath(); ctx.moveTo(25,36+t*4); ctx.lineTo(39,36+t*4); ctx.stroke(); }
      // Poutres de soutien
      ctx.strokeStyle='#8a6030'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(20,28); ctx.lineTo(44,28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20,28); ctx.lineTo(18,52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(44,28); ctx.lineTo(46,52); ctx.stroke();
      // Minerai scintillant
      ctx.fillStyle='rgba(200,160,60,0.7)';
      for(const[mx,my] of [[14,22],[46,24],[12,36],[48,38]]) circle(ctx,mx,my,2,'rgba(200,160,60,0.7)');
      break;
    }
    default: {
      rect(ctx,12,16,40,36,'#808080');
      rect(ctx,10,12,44,6,'#606060');
      ctx.fillStyle='#707070';
      ctx.beginPath(); ctx.moveTo(8,14); ctx.lineTo(S-8,14); ctx.lineTo(S-10,4); ctx.lineTo(10,4); ctx.fill();
    }
  }
  return c;
}

// ——— SPRITE HUMAIN PIXEL ART 16px ——————————————————
export function makeHumanSprite(job, sex) {
  const c = makeCanvas(16, 24);
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,16,24);

  const skinTones = ['#f5d5a0','#e8c080','#c89060','#a06840'];
  const skin = skinTones[Math.floor(Math.random()*2)];

  // Corps avec couleur selon métier
  const jobColors = {
    hunter:'#f5a030', farmer:'#60c840', lumberer:'#a07040',
    miner:'#9090a0', builder:'#4080d0', soldier:'#d04040',
    artisan:'#c060c0', idle:'#808080',
  };
  const bodyColor = jobColors[job] || '#808080';

  // Jambes
  rect(ctx,5,16,3,7,bodyColor); rect(ctx,8,16,3,7,bodyColor);
  // Corps
  rect(ctx,4,8,8,8,bodyColor);
  // Bras
  rect(ctx,1,8,3,6,bodyColor); rect(ctx,12,8,3,6,bodyColor);
  // Mains
  rect(ctx,1,14,3,2,skin); rect(ctx,12,14,3,2,skin);
  // Cou
  rect(ctx,6,5,4,3,skin);
  // Tête
  rect(ctx,4,1,8,6,skin);
  // Cheveux
  const hairColor = sex==='F' ? '#6a3a8a' : '#3a2a18';
  rect(ctx,4,1,8,2,hairColor);
  rect(ctx,4,2,1,4,hairColor); rect(ctx,11,2,1,4,hairColor);
  // Yeux
  rect(ctx,6,3,1,1,'#222'); rect(ctx,9,3,1,1,'#222');
  // Soldier : casque
  if(job==='soldier'){ rect(ctx,3,0,10,3,'#606070'); rect(ctx,3,2,1,2,'#606070'); rect(ctx,12,2,1,2,'#606070'); }
  // Farmer : chapeau de paille
  if(job==='farmer'){ rect(ctx,3,0,10,2,'#d4a830'); rect(ctx,2,1,12,1,'#c49820'); }
  // Miner : casque mineur
  if(job==='miner'){ rect(ctx,4,0,8,3,'#404040'); px(ctx,8,0,'#ffee80'); }
  // Lumberer : hache
  if(job==='lumberer'){ rect(ctx,12,8,2,5,'#8a6030'); rect(ctx,12,8,4,3,'#9a9090'); }

  return c;
}

// ——— TEXTURE ATLAS (toutes les textures d'un coup) ——
export class TextureAtlas {
  constructor() {
    this.canvases = {};  // clé → canvas
    this.textures = {};  // clé → PIXI.Texture (si PIXI dispo)
    this._ready   = false;
  }

  build() {
    // Terrains
    const biomeKeys = ['ocean','river','lake','beach','plain','prairie','forest',
      'dense_forest','jungle','swamp','desert','savanna','tundra','taiga','hill','mountain','volcano'];
    for(const k of biomeKeys) this.canvases[`terrain_${k}`] = makeTerrainTile(k);

    // Animaux
    const animalTypes=['rabbit','deer','wolf','bear','fox','sheep','boar','goat','lynx'];
    for(const t of animalTypes) this.canvases[`animal_${t}`] = makeAnimalSprite(t);

    // Plantes
    const plantTypes=['tree','berry','mushroom','cactus','reed','grass'];
    for(const t of plantTypes) this.canvases[`plant_${t}`] = makePlantSprite(t);

    // Bâtiments
    const buildTypes=['HOUSE','FARM','BARRACKS','MINE','SAWMILL','QUARRY','WORKSHOP','MARKET','MILL','WALL'];
    for(const t of buildTypes) this.canvases[`building_${t}`] = makeBuildingSprite(t);

    // Humains par métier
    for(const job of ['hunter','farmer','lumberer','miner','builder','soldier','artisan','idle']) {
      this.canvases[`human_${job}_M`] = makeHumanSprite(job,'M');
      this.canvases[`human_${job}_F`] = makeHumanSprite(job,'F');
    }

    // Convertir en PIXI.Texture si disponible
    if(typeof window.PIXI !== 'undefined') this._buildPixiTextures();
    this._ready = true;
    console.log(`[TextureAtlas] ${Object.keys(this.canvases).length} textures générées`);
  }

  _buildPixiTextures() {
    const PIXI = window.PIXI;
    for(const [key, canvas] of Object.entries(this.canvases)) {
      try {
        this.textures[key] = PIXI.Texture.from(canvas);
      } catch(e) { /* skip */ }
    }
  }

  get(key) {
    if(typeof window.PIXI !== 'undefined' && this.textures[key]) return this.textures[key];
    return this.canvases[key] || null; // retourne canvas en fallback
  }

  // Dessiner sur un ctx 2D standard (fallback sans PixiJS)
  drawOn(ctx, key, x, y, w, h) {
    const src = this.canvases[key];
    if(src) ctx.drawImage(src, x, y, w || src.width, h || src.height);
  }
}

// Instance globale
export const atlas = new TextureAtlas();
