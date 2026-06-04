// ============================================================
// world.js — OPTION A : Canvas 2D poussé à fond
// Tiles 16×16, textures procédurales, transitions biomes,
// eau avec distorsion, brume, météo visuelle
// ============================================================

import { BIOME, BIOME_PROPS, getBiomeFromParams } from './biomes.js';

// ——— Perlin noise ——————————————————————————————————————
function fade(t) { return t*t*t*(t*(t*6-15)+10); }
function lerp(a,b,t) { return a+t*(b-a); }
function buildPerm(seed) {
  const p=[]; for(let i=0;i<256;i++) p[i]=i;
  let s=seed|0;
  for(let i=255;i>0;i--){s=(s*1664525+1013904223)&0xffffffff;const j=Math.abs(s)%(i+1);[p[i],p[j]]=[p[j],p[i]];}
  return [...p,...p];
}
function grad(h,x,y){const u=h<4?x:y,v=h<4?y:x;return((h&1)?-u:u)+((h&2)?-v:v);}

export class NoiseGen {
  constructor(seed=42){this.perm=buildPerm(seed);}
  noise2(x,y){
    const p=this.perm,X=Math.floor(x)&255,Y=Math.floor(y)&255;
    x-=Math.floor(x);y-=Math.floor(y);
    const u=fade(x),v=fade(y),a=p[X]+Y,b=p[X+1]+Y;
    return lerp(lerp(grad(p[a],x,y),grad(p[b],x-1,y),u),lerp(grad(p[a+1],x,y-1),grad(p[b+1],x-1,y-1),u),v);
  }
  fractal(x,y,oct=6,per=0.5,lac=2){
    let val=0,amp=1,freq=1,max=0;
    for(let i=0;i<oct;i++){val+=this.noise2(x*freq,y*freq)*amp;max+=amp;amp*=per;freq*=lac;}
    return val/max;
  }
}

export const TILE_SIZE = 16; // ← 16 au lieu de 8 !

// ——— Palettes de couleurs enrichies ——————————————————
const BIOME_PALETTE = {
  [BIOME.OCEAN]:        { base:[18,58,130],   dark:[10,35,90],    light:[40,100,180],  tex:'wave'    },
  [BIOME.RIVER]:        { base:[30,95,185],   dark:[18,60,140],   light:[60,130,220],  tex:'wave'    },
  [BIOME.LAKE]:         { base:[22,72,148],   dark:[12,45,110],   light:[35,95,185],   tex:'wave'    },
  [BIOME.BEACH]:        { base:[210,185,100], dark:[180,155,70],  light:[235,215,140], tex:'sand'    },
  [BIOME.PLAIN]:        { base:[110,165,75],  dark:[85,135,50],   light:[140,195,100], tex:'grass'   },
  [BIOME.PRAIRIE]:      { base:[130,185,90],  dark:[100,155,65],  light:[160,215,115], tex:'grass'   },
  [BIOME.FOREST]:       { base:[35,100,35],   dark:[20,68,20],    light:[55,130,50],   tex:'forest'  },
  [BIOME.DENSE_FOREST]: { base:[22,72,22],    dark:[12,48,12],    light:[38,100,35],   tex:'forest'  },
  [BIOME.JUNGLE]:       { base:[15,80,15],    dark:[8,52,8],      light:[28,110,25],   tex:'forest'  },
  [BIOME.SWAMP]:        { base:[55,85,40],    dark:[35,58,25],    light:[78,112,58],   tex:'swamp'   },
  [BIOME.DESERT]:       { base:[200,165,70],  dark:[165,130,40],  light:[228,198,105], tex:'sand'    },
  [BIOME.SAVANNA]:      { base:[168,148,50],  dark:[135,118,28],  light:[195,175,78],  tex:'grass'   },
  [BIOME.TUNDRA]:       { base:[148,165,175], dark:[115,135,148], light:[178,195,208], tex:'tundra'  },
  [BIOME.TAIGA]:        { base:[65,105,80],   dark:[42,75,55],    light:[92,138,108],  tex:'forest'  },
  [BIOME.HILL]:         { base:[102,122,82],  dark:[75,92,58],    light:[132,155,108], tex:'rock'    },
  [BIOME.MOUNTAIN]:     { base:[135,130,125], dark:[100,95,90],   light:[170,168,162], tex:'rock'    },
  [BIOME.VOLCANO]:      { base:[150,38,22],   dark:[105,20,8],    light:[192,62,42],   tex:'rock'    },
};

function rgb(r,g,b){return `rgb(${r|0},${g|0},${b|0})`;}
function mix(c1,c2,t){return[c1[0]+(c2[0]-c1[0])*t,c1[1]+(c2[1]-c1[1])*t,c1[2]+(c2[2]-c1[2])*t];}

// ——— Tile ————————————————————————————————————————————
export class Tile {
  constructor(x,y,biome,noiseVal=0,elevation=0){
    this.x=x;this.y=y;this.biome=biome;
    this.props=BIOME_PROPS[biome];
    this.noiseVal=noiseVal;
    this.elevation=elevation;
    this.wood  =Math.round(this.props.wood *80+Math.random()*20);
    this.stone =Math.round(this.props.stone*80+Math.random()*20);
    this.food  =Math.round(this.props.food *60+Math.random()*20);
    this.ore   =Math.round(this.props.ore  *60+Math.random()*20);
    this.water =this.props.water>0.5?100:Math.round(this.props.water*100);
    this.regenTimer=0;
    // Variation texture unique par tile
    this._texSeed = Math.random();
    this._texSeed2= Math.random();
  }
  regen(dt){
    this.regenTimer+=dt;
    if(this.regenTimer>60){
      this.regenTimer=0;
      const p=this.props;
      if(this.wood <p.wood *80)this.wood =Math.min(100,this.wood +1);
      if(this.food <p.food *60)this.food =Math.min(100,this.food +1);
      if(this.stone<p.stone*80)this.stone=Math.min(100,this.stone+1);
    }
  }
  harvest(type,amount){
    const cur=this[type]||0,taken=Math.min(cur,amount);
    this[type]=cur-taken;return taken;
  }
}

// ——— World ——————————————————————————————————————————
export class World {
  constructor(cols=180,rows=120,seed=Date.now()){
    this.cols=cols;this.rows=rows;this.seed=seed;
    this.tiles=[];
    this._elevMap=[];
    this._offscreen=null;this._offCtx=null;
    this._waterCanvas=null;this._waterCtx=null;
    this._weatherCanvas=null;this._weatherCtx=null;
    this._mapDirty=true;
    this._weatherParticles=[];
    this._weatherMode='none'; // 'rain'|'snow'|'leaves'|'none'
    this._tick=0;
    this._generate();
    this._buildOffscreen();
  }

  _generate(){
    const nE=new NoiseGen(this.seed),nM=new NoiseGen(this.seed+9999),
          nT=new NoiseGen(this.seed+7777),nD=new NoiseGen(this.seed+3333);
    for(let y=0;y<this.rows;y++){
      this.tiles[y]=[];this._elevMap[y]=[];
      for(let x=0;x<this.cols;x++){
        let e=(nE.fractal(x/60,y/60,7,.55,2)+1)/2;
        let m=(nM.fractal(x/50,y/50,5,.5,2)+1)/2;
        let t=(nT.fractal(x/80,y/80,4,.45,2)+1)/2;
        const d=(nD.fractal(x/20,y/20,3,.5,2)+1)/2;
        const nx=(x/this.cols)*2-1,ny=(y/this.rows)*2-1;
        const dist=Math.sqrt(nx*nx+ny*ny);
        e=Math.max(0,e-dist*dist*0.7);
        t=t*0.5+(1-y/this.rows)*0.5;
        this._elevMap[y][x]=e;
        this.tiles[y][x]=new Tile(x,y,getBiomeFromParams(e,m,t),d,e);
      }
    }
    this._carveRivers(6);
  }

  _carveRivers(count){
    for(let r=0;r<count;r++){
      let sx,sy,tries=0;
      do{sx=Math.floor(Math.random()*this.cols);sy=Math.floor(Math.random()*this.rows);tries++;}
      while(tries<200&&![BIOME.MOUNTAIN,BIOME.HILL].includes(this.tiles[sy]?.[sx]?.biome));
      if(tries>=200)continue;
      let cx=sx,cy=sy;
      for(let step=0;step<300;step++){
        const tile=this.tiles[cy]?.[cx];
        if(!tile||tile.biome===BIOME.OCEAN||tile.biome===BIOME.LAKE)break;
        if(tile.biome!==BIOME.RIVER)this.tiles[cy][cx]=new Tile(cx,cy,BIOME.RIVER,Math.random(),tile.elevation);
        const dx=cx<this.cols/2?-1:1,dy=cy<this.rows/2?-1:1;
        if(Math.random()<.5)cx=Math.max(0,Math.min(this.cols-1,cx+(Math.random()<.7?dx:(Math.random()<.5?1:-1))));
        else                cy=Math.max(0,Math.min(this.rows-1,cy+(Math.random()<.7?dy:(Math.random()<.5?1:-1))));
      }
    }
  }

  _buildOffscreen(){
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    this._offscreen=document.createElement('canvas');
    this._offscreen.width=W;this._offscreen.height=H;
    this._offCtx=this._offscreen.getContext('2d');
    this._waterCanvas=document.createElement('canvas');
    this._waterCanvas.width=W;this._waterCanvas.height=H;
    this._waterCtx=this._waterCanvas.getContext('2d');
    this._weatherCanvas=document.createElement('canvas');
    this._weatherCanvas.width=W;this._weatherCanvas.height=H;
    this._weatherCtx=this._weatherCanvas.getContext('2d');
    this._redrawMap();
  }

  // ——— CARTE HAUTE QUALITÉ 16px ————————————————————
  _redrawMap(){
    const ctx=this._offCtx,TS=TILE_SIZE;

    // PASSE 1 : couleur de base avec variation de bruit
    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const tile=this.tiles[y][x];
        const pal=BIOME_PALETTE[tile.biome]||BIOME_PALETTE[BIOME.PLAIN];
        const n=tile.noiseVal;
        let col;
        if(n<0.35)      col=mix(pal.dark,pal.base,n/0.35);
        else if(n<0.65) col=pal.base;
        else            col=mix(pal.base,pal.light,(n-0.65)/0.35);
        ctx.fillStyle=rgb(col[0],col[1],col[2]);
        ctx.fillRect(x*TS,y*TS,TS,TS);
      }
    }

    // PASSE 2 : textures procédurales par biome
    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const tile=this.tiles[y][x];
        const px=x*TS,py=y*TS;
        this._drawTileTexture(ctx,tile,px,py,TS);
      }
    }

    // PASSE 3 : transitions douces entre biomes voisins
    this._drawBiomeTransitions(ctx,TS);

    // PASSE 4 : relief (ombres/lumières directionnelles)
    this._drawRelief(ctx,TS);

    // PASSE 5 : neige sur sommets
    this._drawSnowCaps(ctx,TS);

    this._mapDirty=false;
  }

  _drawTileTexture(ctx,tile,px,py,TS){
    const s1=tile._texSeed,s2=tile._texSeed2;
    const b=tile.biome;

    if(b===BIOME.BEACH||b===BIOME.DESERT){
      // Grain de sable : petits points
      ctx.fillStyle='rgba(255,240,180,0.18)';
      for(let i=0;i<6;i++){
        const sx=px+(s1*TS+(i*37)%TS)%TS,sy=py+(s2*TS+(i*53)%TS)%TS;
        ctx.fillRect(sx,sy,1,1);
      }
    }
    else if(b===BIOME.PLAIN||b===BIOME.PRAIRIE||b===BIOME.SAVANNA){
      // Herbe : petits tirets verts
      ctx.fillStyle='rgba(80,160,40,0.20)';
      for(let i=0;i<4;i++){
        const sx=px+(s1*TS+(i*41)%TS)%TS,sy=py+(s2*TS+(i*67)%TS)%TS;
        ctx.fillRect(sx,sy,1,2);
      }
    }
    else if(b===BIOME.FOREST||b===BIOME.DENSE_FOREST||b===BIOME.TAIGA){
      // Forêt : motif de feuilles sombres
      ctx.fillStyle='rgba(0,40,0,0.22)';
      for(let i=0;i<3;i++){
        const sx=px+(s1*TS+(i*59)%TS)%TS,sy=py+(s2*TS+(i*43)%TS)%TS;
        ctx.beginPath();ctx.arc(sx,sy,2,0,Math.PI*2);ctx.fill();
      }
    }
    else if(b===BIOME.MOUNTAIN||b===BIOME.HILL||b===BIOME.VOLCANO){
      // Roche : lignes de strates
      ctx.fillStyle='rgba(60,50,40,0.18)';
      if(s1>0.6) ctx.fillRect(px+2,py+TS*0.4,TS-4,1);
      if(s2>0.5) ctx.fillRect(px+1,py+TS*0.7,TS-3,1);
    }
    else if(b===BIOME.TUNDRA){
      // Toundra : plaques de glace
      if(s1>0.7){
        ctx.fillStyle='rgba(200,230,255,0.30)';
        ctx.fillRect(px+2,py+2,TS-4,TS-4);
      }
    }
    else if(b===BIOME.SWAMP){
      // Marais : flaques sombres
      if(s1>0.65){
        ctx.fillStyle='rgba(20,50,15,0.35)';
        ctx.beginPath();ctx.ellipse(px+TS/2,py+TS/2,TS*0.35,TS*0.22,s2*Math.PI,0,Math.PI*2);ctx.fill();
      }
    }
    else if(b===BIOME.JUNGLE){
      // Jungle : motif dense de végétation
      ctx.fillStyle='rgba(0,60,0,0.25)';
      for(let i=0;i<5;i++){
        const sx=px+(s1*TS+(i*31)%TS)%TS,sy=py+(s2*TS+(i*71)%TS)%TS;
        ctx.beginPath();ctx.arc(sx,sy,1.5,0,Math.PI*2);ctx.fill();
      }
    }
  }

  _drawBiomeTransitions(ctx,TS){
    // Dégradé entre biomes différents : bord droit et bas
    ctx.globalAlpha=0.5;
    for(let y=0;y<this.rows-1;y++){
      for(let x=0;x<this.cols-1;x++){
        const t=this.tiles[y][x];
        const tr=this.tiles[y][x+1];
        const tb=this.tiles[y+1][x];
        const px=x*TS,py=y*TS;
        if(t.biome!==tr.biome){
          const palR=BIOME_PALETTE[tr.biome]||BIOME_PALETTE[BIOME.PLAIN];
          const grad=ctx.createLinearGradient(px+TS-4,py,px+TS+4,py);
          grad.addColorStop(0,'transparent');
          grad.addColorStop(1,rgb(palR.base[0],palR.base[1],palR.base[2]));
          ctx.fillStyle=grad;
          ctx.fillRect(px+TS-4,py,8,TS);
        }
        if(t.biome!==tb.biome){
          const palB=BIOME_PALETTE[tb.biome]||BIOME_PALETTE[BIOME.PLAIN];
          const grad=ctx.createLinearGradient(px,py+TS-4,px,py+TS+4);
          grad.addColorStop(0,'transparent');
          grad.addColorStop(1,rgb(palB.base[0],palB.base[1],palB.base[2]));
          ctx.fillStyle=grad;
          ctx.fillRect(px,py+TS-4,TS,8);
        }
      }
    }
    ctx.globalAlpha=1.0;
  }

  _drawRelief(ctx,TS){
    for(let y=1;y<this.rows-1;y++){
      for(let x=1;x<this.cols-1;x++){
        const e =this._elevMap[y][x];
        const eN=this._elevMap[y-1]?.[x]??e;
        const eW=this._elevMap[y]?.[x-1]??e;
        const slope=(e-eN)+(e-eW);
        if(slope>0.03){
          ctx.fillStyle=`rgba(0,0,0,${Math.min(0.55,slope*3.0)})`;
          ctx.fillRect(x*TS,y*TS,TS,TS);
        } else if(slope<-0.03){
          ctx.fillStyle=`rgba(255,255,230,${Math.min(0.28,-slope*2.0)})`;
          ctx.fillRect(x*TS,y*TS,TS,TS);
        }
      }
    }
  }

  _drawSnowCaps(ctx,TS){
    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const e=this._elevMap[y]?.[x]||0;
        if(e>0.85){
          const alpha=Math.min(0.85,(e-0.85)/0.1*0.85);
          ctx.fillStyle=`rgba(235,242,255,${alpha})`;
          ctx.fillRect(x*TS,y*TS,TS,TS);
          // Détail de neige : cristaux
          if(e>0.90){
            ctx.fillStyle='rgba(255,255,255,0.5)';
            ctx.fillRect(x*TS+2,y*TS+2,2,2);
            ctx.fillRect(x*TS+TS-4,y*TS+TS-4,2,2);
          }
        }
      }
    }
  }

  // ——— EAU ANIMÉE HAUTE QUALITÉ ————————————————————
  _animateWater(time){
    const ctx=this._waterCtx,TS=TILE_SIZE;
    const W=this._waterCanvas.width,H=this._waterCanvas.height;
    ctx.clearRect(0,0,W,H);

    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const b=this.tiles[y][x].biome;
        if(b!==BIOME.OCEAN&&b!==BIOME.LAKE&&b!==BIOME.RIVER)continue;
        const px=x*TS,py=y*TS;
        const t1=Math.sin(time*0.002+x*0.3+y*0.2);
        const t2=Math.cos(time*0.0015+x*0.25-y*0.3);
        const wave=(t1+t2)*0.25+0.5; // 0-1

        if(b===BIOME.OCEAN||b===BIOME.LAKE){
          // Couche 1 : reflet de surface
          const grad=ctx.createLinearGradient(px,py,px+TS,py+TS);
          grad.addColorStop(0,`rgba(80,150,255,${0.06+wave*0.08})`);
          grad.addColorStop(1,`rgba(20,80,200,${0.04+wave*0.05})`);
          ctx.fillStyle=grad;
          ctx.fillRect(px,py,TS,TS);

          // Couche 2 : vague blanche si assez forte
          if(wave>0.78){
            const waveAlpha=(wave-0.78)*0.7;
            ctx.fillStyle=`rgba(255,255,255,${waveAlpha})`;
            const wy=py+TS*0.3+t1*TS*0.15;
            ctx.fillRect(px+1,wy,TS-2,1.5);
          }

          // Couche 3 : éclat lumineux (soleil sur eau)
          const sparkle=Math.sin(time*0.008+x*1.7+y*2.3);
          if(sparkle>0.92){
            ctx.fillStyle=`rgba(255,255,255,${(sparkle-0.92)*4})`;
            ctx.fillRect(px+Math.floor(wave*TS*0.5),py+2,2,2);
          }
        }
        else if(b===BIOME.RIVER){
          // Courant : lignes diagonales animées
          ctx.fillStyle=`rgba(100,180,255,${0.12+wave*0.10})`;
          ctx.fillRect(px,py,TS,TS);
          ctx.strokeStyle=`rgba(180,220,255,${0.15+wave*0.12})`;
          ctx.lineWidth=1;
          const offset=(time*0.05)%TS;
          ctx.beginPath();
          ctx.moveTo(px-offset,py);ctx.lineTo(px+TS-offset,py+TS);
          ctx.stroke();
        }
      }
    }
  }

  // ——— MÉTÉO VISUELLE ——————————————————————————————
  setWeather(mode){
    this._weatherMode=mode;
    this._weatherParticles=[];
    if(mode==='none')return;
    const count=mode==='rain'?200:mode==='snow'?120:80;
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    for(let i=0;i<count;i++){
      this._weatherParticles.push({
        x:Math.random()*W, y:Math.random()*H,
        vx:mode==='rain'?-1.5:mode==='snow'?(Math.random()-0.5)*0.5:(Math.random()-0.5)*0.8,
        vy:mode==='rain'?6+Math.random()*3:mode==='snow'?0.5+Math.random()*0.8:0.3+Math.random()*0.5,
        size:mode==='rain'?0.5:mode==='snow'?2:3+Math.random()*3,
        alpha:mode==='rain'?0.4+Math.random()*0.3:mode==='snow'?0.6+Math.random()*0.4:0.5+Math.random()*0.5,
        rot:Math.random()*Math.PI*2,
        color:mode==='leaves'?`hsl(${20+Math.random()*40},70%,45%)`:null,
      });
    }
  }

  _updateWeather(dt){
    if(this._weatherMode==='none'||!this._weatherParticles.length)return;
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    for(const p of this._weatherParticles){
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(this._weatherMode==='snow'||this._weatherMode==='leaves') p.rot+=0.02*dt;
      if(p.y>H)p.y=-10;
      if(p.x<-20)p.x=W+10;
      if(p.x>W+20)p.x=-10;
    }
  }

  _drawWeatherOverCanvas(ctx,camX,camY,viewW,viewH,timestamp){
    if(this._weatherMode==='none')return;
    for(const p of this._weatherParticles){
      const sx=p.x-camX,sy=p.y-camY;
      if(sx<-10||sx>viewW+10||sy<-10||sy>viewH+10)continue;
      ctx.globalAlpha=p.alpha;
      if(this._weatherMode==='rain'){
        ctx.strokeStyle='rgba(180,210,255,1)';
        ctx.lineWidth=p.size;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+p.vx*3,sy+p.vy*3);ctx.stroke();
      } else if(this._weatherMode==='snow'){
        ctx.fillStyle='rgba(240,248,255,1)';
        ctx.beginPath();ctx.arc(sx,sy,p.size,0,Math.PI*2);ctx.fill();
        // Cristal
        ctx.strokeStyle='rgba(220,235,255,0.6)';ctx.lineWidth=0.5;
        for(let i=0;i<3;i++){
          const a=p.rot+i*Math.PI/3;
          ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(a)*p.size*2,sy+Math.sin(a)*p.size*2);ctx.stroke();
        }
      } else if(this._weatherMode==='leaves'){
        ctx.save();ctx.translate(sx,sy);ctx.rotate(p.rot);
        ctx.fillStyle=p.color;
        ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*0.5,0,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha=1.0;
  }

  // ——— Brume matinale ——————————————————————————————
  _drawMorningMist(ctx,W,H,nightAlpha){
    // Brume seulement à l'aube (nightAlpha en train de descendre)
    if(nightAlpha<0.05||nightAlpha>0.45)return;
    const mistAlpha=(0.25-Math.abs(nightAlpha-0.25))/0.25*0.18;
    if(mistAlpha<=0)return;
    const grad=ctx.createRadialGradient(W/2,H*0.6,0,W/2,H*0.6,Math.max(W,H)*0.7);
    grad.addColorStop(0,`rgba(200,220,255,${mistAlpha})`);
    grad.addColorStop(1,`rgba(200,220,255,0)`);
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,W,H);
  }

  // ——— UPDATE & DRAW PRINCIPAL ——————————————————————
  update(dt){
    this._tick+=dt;
    this._updateWeather(dt);
    for(let y=0;y<this.rows;y++)
      for(let x=0;x<this.cols;x++)
        this.tiles[y][x].regen(dt);
  }

  draw(ctx,camX,camY,viewW,viewH,timestamp=0,nightAlpha=0){
    if(this._mapDirty)this._redrawMap();
    // 1. Carte statique
    ctx.drawImage(this._offscreen,camX,camY,viewW,viewH,0,0,viewW,viewH);
    // 2. Eau animée
    this._animateWater(timestamp);
    ctx.drawImage(this._waterCanvas,camX,camY,viewW,viewH,0,0,viewW,viewH);
    // 3. Météo sur canvas
    this._drawWeatherOverCanvas(ctx,camX,camY,viewW,viewH,timestamp);
    // 4. Brume matinale
    this._drawMorningMist(ctx,viewW,viewH,nightAlpha);
  }

  // ——— UTILITAIRES ——————————————————————————————————
  getTile(x,y){if(x<0||y<0||x>=this.cols||y>=this.rows)return null;return this.tiles[y][x];}
  tileAt(wx,wy){return this.getTile(Math.floor(wx/TILE_SIZE),Math.floor(wy/TILE_SIZE));}
  findNearestBiomes(wx,wy,biomeList,maxDist=30){
    const tx=Math.floor(wx/TILE_SIZE),ty=Math.floor(wy/TILE_SIZE),results=[],r=Math.ceil(maxDist/TILE_SIZE);
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const t=this.getTile(tx+dx,ty+dy);if(t&&biomeList.includes(t.biome))results.push({tile:t,dist:Math.sqrt(dx*dx+dy*dy)});}
    return results.sort((a,b)=>a.dist-b.dist).slice(0,5);
  }
  findBuildSpot(wx,wy,radius=20){
    const tx=Math.floor(wx/TILE_SIZE),ty=Math.floor(wy/TILE_SIZE);
    for(let r=0;r<=radius;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
      const t=this.getTile(tx+dx,ty+dy);if(t&&t.props.buildable)return t;
    }
    return null;
  }
  getStats(){
    let totalWood=0,totalFood=0,totalStone=0,totalOre=0,waterTiles=0,landTiles=0;
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
      const t=this.tiles[y][x];totalWood+=t.wood;totalFood+=t.food;totalStone+=t.stone;totalOre+=t.ore;
      if([BIOME.OCEAN,BIOME.LAKE,BIOME.RIVER].includes(t.biome))waterTiles++;else landTiles++;
    }
    return{totalWood,totalFood,totalStone,totalOre,waterTiles,landTiles};
  }
  toJSON(){return{cols:this.cols,rows:this.rows,seed:this.seed};}
}
