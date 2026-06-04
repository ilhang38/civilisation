// ============================================================
// world.js — NIVEAU 3 : Textures pixel art procédurales
// ============================================================

import { BIOME, BIOME_PROPS, getBiomeFromParams } from './biomes.js';
import { atlas, SPR }                              from './textures.js';

function fade(t){return t*t*t*(t*(t*6-15)+10);}
function lerp(a,b,t){return a+t*(b-a);}
function buildPerm(seed){
  const p=[];for(let i=0;i<256;i++)p[i]=i;let s=seed|0;
  for(let i=255;i>0;i--){s=(s*1664525+1013904223)&0xffffffff;const j=Math.abs(s)%(i+1);[p[i],p[j]]=[p[j],p[i]];}
  return[...p,...p];
}
function grad(h,x,y){const u=h<4?x:y,v=h<4?y:x;return((h&1)?-u:u)+((h&2)?-v:v);}

export class NoiseGen {
  constructor(s=42){this.perm=buildPerm(s);}
  noise2(x,y){
    const p=this.perm,X=Math.floor(x)&255,Y=Math.floor(y)&255;
    x-=Math.floor(x);y-=Math.floor(y);
    const u=fade(x),v=fade(y),a=p[X]+Y,b=p[X+1]+Y;
    return lerp(lerp(grad(p[a],x,y),grad(p[b],x-1,y),u),lerp(lerp(grad(p[a+1],x,y-1),grad(p[b+1],x-1,y-1),u),v),0);
  }
  fractal(x,y,oct=6,per=0.5,lac=2){
    let val=0,amp=1,freq=1,max=0;
    for(let i=0;i<oct;i++){val+=this.noise2(x*freq,y*freq)*amp;max+=amp;amp*=per;freq*=lac;}
    return val/max;
  }
}

export const TILE_SIZE = 32; // ← 32px avec textures PNG

export class Tile {
  constructor(x,y,biome,noiseVal=0,elevation=0){
    this.x=x;this.y=y;this.biome=biome;
    this.props=BIOME_PROPS[biome];
    this.noiseVal=noiseVal;this.elevation=elevation;
    this.wood=Math.round(this.props.wood*80+Math.random()*20);
    this.stone=Math.round(this.props.stone*80+Math.random()*20);
    this.food=Math.round(this.props.food*60+Math.random()*20);
    this.ore=Math.round(this.props.ore*60+Math.random()*20);
    this.water=this.props.water>0.5?100:Math.round(this.props.water*100);
    this.regenTimer=0;
    this._variant=Math.floor(Math.random()*4); // variant de texture
  }
  regen(dt){
    this.regenTimer+=dt;
    if(this.regenTimer>60){
      this.regenTimer=0;const p=this.props;
      if(this.wood <p.wood *80)this.wood =Math.min(100,this.wood +1);
      if(this.food <p.food *60)this.food =Math.min(100,this.food +1);
      if(this.stone<p.stone*80)this.stone=Math.min(100,this.stone+1);
    }
  }
  harvest(type,amount){const cur=this[type]||0,taken=Math.min(cur,amount);this[type]=cur-taken;return taken;}
}

// ——— Mapping biome → clé texture ——————————————————
const BIOME_TEX = {
  [BIOME.OCEAN]       :'terrain_ocean',
  [BIOME.RIVER]       :'terrain_river',
  [BIOME.LAKE]        :'terrain_lake',
  [BIOME.BEACH]       :'terrain_beach',
  [BIOME.PLAIN]       :'terrain_plain',
  [BIOME.PRAIRIE]     :'terrain_prairie',
  [BIOME.FOREST]      :'terrain_forest',
  [BIOME.DENSE_FOREST]:'terrain_dense_forest',
  [BIOME.JUNGLE]      :'terrain_jungle',
  [BIOME.SWAMP]       :'terrain_swamp',
  [BIOME.DESERT]      :'terrain_desert',
  [BIOME.SAVANNA]     :'terrain_savanna',
  [BIOME.TUNDRA]      :'terrain_tundra',
  [BIOME.TAIGA]       :'terrain_taiga',
  [BIOME.HILL]        :'terrain_hill',
  [BIOME.MOUNTAIN]    :'terrain_mountain',
  [BIOME.VOLCANO]     :'terrain_volcano',
};

export class World {
  constructor(cols=180,rows=120,seed=Date.now()){
    this.cols=cols;this.rows=rows;this.seed=seed;
    this.tiles=[];this._elevMap=[];
    this._offscreen=null;this._offCtx=null;
    this._waterCanvas=null;this._waterCtx=null;
    this._weatherCanvas=null;this._weatherCtx=null;
    this._mapDirty=true;
    this._weatherParticles=[];
    this._weatherMode='none';
    this._texturesReady=false;
    this._tick=0;
    this._generate();
    // Construire l'atlas puis la carte
    this._initTextures();
  }

  _generate(){
    const nE=new NoiseGen(this.seed),nM=new NoiseGen(this.seed+9999),
          nT=new NoiseGen(this.seed+7777);
    for(let y=0;y<this.rows;y++){
      this.tiles[y]=[];this._elevMap[y]=[];
      for(let x=0;x<this.cols;x++){
        let e=(nE.fractal(x/60,y/60,7,.55,2)+1)/2;
        const m=(nM.fractal(x/50,y/50,5,.5,2)+1)/2;
        let t=(nT.fractal(x/80,y/80,4,.45,2)+1)/2;
        const nx=(x/this.cols)*2-1,ny=(y/this.rows)*2-1;
        e=Math.max(0,e-Math.sqrt(nx*nx+ny*ny)**2*0.7);
        t=t*0.5+(1-y/this.rows)*0.5;
        this._elevMap[y][x]=e;
        const nD=new NoiseGen(this.seed+3333).noise2(x/20,y/20);
        this.tiles[y][x]=new Tile(x,y,getBiomeFromParams(e,m,t),(nD+1)/2,e);
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

  _initTextures(){
    // Construire l'atlas de textures
    atlas.build();
    this._texturesReady=true;

    // Canvas de la carte
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

  // ——— CARTE AVEC TEXTURES PIXEL ART ——————————————
  _redrawMap(){
    if(!this._texturesReady)return;
    const ctx=this._offCtx,TS=TILE_SIZE;

    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const tile=this.tiles[y][x];
        const px=x*TS,py=y*TS;
        const texKey=BIOME_TEX[tile.biome]||'terrain_plain';
        const texCanvas=atlas.canvases[texKey];
        if(texCanvas){
          // Dessiner la texture (tiled)
          ctx.drawImage(texCanvas,px,py,TS,TS);
        } else {
          ctx.fillStyle=tile.props.color||'#7ab05a';
          ctx.fillRect(px,py,TS,TS);
        }
      }
    }

    // Passe relief (ombres directionnelles)
    for(let y=1;y<this.rows-1;y++){
      for(let x=1;x<this.cols-1;x++){
        const e=this._elevMap[y][x];
        const eN=this._elevMap[y-1]?.[x]??e,eW=this._elevMap[y]?.[x-1]??e;
        const slope=(e-eN)+(e-eW);
        if(Math.abs(slope)>0.025){
          const a=slope>0?Math.min(0.5,slope*3.5):0;
          const la=slope<0?Math.min(0.25,-slope*2.5):0;
          if(a>0){ctx.fillStyle=`rgba(0,0,0,${a})`;ctx.fillRect(x*TS,y*TS,TS,TS);}
          if(la>0){ctx.fillStyle=`rgba(255,255,230,${la})`;ctx.fillRect(x*TS,y*TS,TS,TS);}
        }
      }
    }

    // Transitions entre biomes (dégradé sur 8px)
    ctx.save();ctx.globalAlpha=0.45;
    for(let y=0;y<this.rows-1;y++){
      for(let x=0;x<this.cols-1;x++){
        const t=this.tiles[y][x],tr=this.tiles[y][x+1],tb=this.tiles[y+1][x];
        const px=x*TS,py=y*TS;
        if(t.biome!==tr.biome){
          const trTex=atlas.canvases[BIOME_TEX[tr.biome]||'terrain_plain'];
          if(trTex){
            const g=ctx.createLinearGradient(px+TS-8,py,px+TS+8,py);
            g.addColorStop(0,'transparent');
            ctx.drawImage(trTex,px+TS-4,py,8,TS);
          }
        }
        if(t.biome!==tb.biome){
          const tbTex=atlas.canvases[BIOME_TEX[tb.biome]||'terrain_plain'];
          if(tbTex) ctx.drawImage(tbTex,px,py+TS-4,TS,8);
        }
      }
    }
    ctx.restore();

    this._mapDirty=false;
  }

  // ——— EAU ANIMÉE ——————————————————————————————————
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
        const wave=(t1+t2)*0.25+0.5;

        if(b===BIOME.OCEAN||b===BIOME.LAKE){
          ctx.fillStyle=`rgba(50,140,255,${0.08+wave*0.08})`;
          ctx.fillRect(px,py,TS,TS);
          if(wave>0.75){
            ctx.fillStyle=`rgba(255,255,255,${(wave-0.75)*0.8})`;
            ctx.fillRect(px+2,py+TS*0.3+t1*TS*0.15,TS-4,2);
          }
          const sparkle=Math.sin(time*0.008+x*1.7+y*2.3);
          if(sparkle>0.9){
            ctx.fillStyle=`rgba(255,255,255,${(sparkle-0.9)*5})`;
            ctx.fillRect(px+Math.floor(wave*TS*0.4),py+4,3,3);
          }
        } else {
          ctx.fillStyle=`rgba(80,170,255,${0.10+wave*0.10})`;
          ctx.fillRect(px,py,TS,TS);
          ctx.strokeStyle=`rgba(150,210,255,${0.15+wave*0.12})`;
          ctx.lineWidth=1.5;
          const off=(time*0.05)%TS;
          ctx.beginPath();ctx.moveTo(px-off,py);ctx.lineTo(px+TS-off,py+TS);ctx.stroke();
        }
      }
    }
  }

  // ——— MÉTÉO ——————————————————————————————————————
  setWeather(mode){
    this._weatherMode=mode;
    this._weatherParticles=[];
    if(mode==='none')return;
    const count=mode==='rain'?200:mode==='snow'?120:80;
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    for(let i=0;i<count;i++){
      this._weatherParticles.push({
        x:Math.random()*W,y:Math.random()*H,
        vx:mode==='rain'?-1.5:mode==='snow'?(Math.random()-0.5)*0.5:(Math.random()-0.5)*0.8,
        vy:mode==='rain'?8+Math.random()*4:mode==='snow'?0.6+Math.random()*0.8:0.4+Math.random()*0.6,
        size:mode==='rain'?0.8:mode==='snow'?2.5:4+Math.random()*3,
        alpha:mode==='rain'?0.5+Math.random()*0.3:0.7+Math.random()*0.3,
        rot:Math.random()*Math.PI*2,
        color:mode==='leaves'?`hsl(${18+Math.random()*35},70%,42%)`:null,
      });
    }
  }

  _updateWeather(dt){
    if(this._weatherMode==='none')return;
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    for(const p of this._weatherParticles){
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(this._weatherMode!=='rain')p.rot+=0.02*dt;
      if(p.y>H)p.y=-10;if(p.x<-20)p.x=W+10;if(p.x>W+20)p.x=-10;
    }
  }

  _drawWeather(ctx,camX,camY,viewW,viewH){
    if(this._weatherMode==='none')return;
    for(const p of this._weatherParticles){
      const sx=p.x-camX,sy=p.y-camY;
      if(sx<-10||sx>viewW+10||sy<-10||sy>viewH+10)continue;
      ctx.globalAlpha=p.alpha;
      if(this._weatherMode==='rain'){
        ctx.strokeStyle='rgba(180,215,255,1)';ctx.lineWidth=p.size;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+p.vx*4,sy+p.vy*4);ctx.stroke();
      } else if(this._weatherMode==='snow'){
        ctx.fillStyle='rgba(240,248,255,1)';
        ctx.beginPath();ctx.arc(sx,sy,p.size,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(220,238,255,0.6)';ctx.lineWidth=0.5;
        for(let i=0;i<3;i++){
          const a=p.rot+i*Math.PI/3;
          ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(a)*p.size*2,sy+Math.sin(a)*p.size*2);ctx.stroke();
        }
      } else {
        ctx.save();ctx.translate(sx,sy);ctx.rotate(p.rot);
        ctx.fillStyle=p.color;
        ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*0.5,0,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha=1.0;
  }

  _drawMorningMist(ctx,W,H,nightAlpha){
    if(nightAlpha<0.05||nightAlpha>0.45)return;
    const mistA=(0.25-Math.abs(nightAlpha-0.25))/0.25*0.15;
    if(mistA<=0)return;
    const g=ctx.createRadialGradient(W/2,H*0.6,0,W/2,H*0.6,Math.max(W,H)*0.7);
    g.addColorStop(0,`rgba(210,225,255,${mistA})`);g.addColorStop(1,'rgba(210,225,255,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }

  update(dt){
    this._tick+=dt;
    this._updateWeather(dt);
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)this.tiles[y][x].regen(dt);
  }

  draw(ctx,camX,camY,viewW,viewH,timestamp=0,nightAlpha=0){
    if(this._mapDirty)this._redrawMap();
    if(!this._offscreen)return;
    ctx.drawImage(this._offscreen,camX,camY,viewW,viewH,0,0,viewW,viewH);
    this._animateWater(timestamp);
    ctx.drawImage(this._waterCanvas,camX,camY,viewW,viewH,0,0,viewW,viewH);
    this._drawWeather(ctx,camX,camY,viewW,viewH);
    this._drawMorningMist(ctx,viewW,viewH,nightAlpha);
    // Overlay nuit
    if(nightAlpha>0.01){
      const g=ctx.createRadialGradient(viewW/2,viewH/2,0,viewW/2,viewH/2,Math.max(viewW,viewH)*0.8);
      g.addColorStop(0,`rgba(0,5,20,${nightAlpha*0.45})`);g.addColorStop(1,`rgba(0,5,30,${nightAlpha*0.8})`);
      ctx.fillStyle=g;ctx.fillRect(0,0,viewW,viewH);
      if(nightAlpha>0.5){
        ctx.fillStyle=`rgba(255,255,255,${(nightAlpha-0.5)*0.5})`;
        for(let i=0;i<60;i++){
          const sx=((i*137.5)%viewW),sy=((i*97.3)%(viewH*0.55));
          ctx.beginPath();ctx.arc(sx,sy,i%3===0?1.2:0.7,0,Math.PI*2);ctx.fill();
        }
      }
    }
  }

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
    let tW=0,tF=0,tS=0,tO=0,wt=0,lt=0;
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
      const t=this.tiles[y][x];tW+=t.wood;tF+=t.food;tS+=t.stone;tO+=t.ore;
      if([BIOME.OCEAN,BIOME.LAKE,BIOME.RIVER].includes(t.biome))wt++;else lt++;
    }
    return{totalWood:tW,totalFood:tF,totalStone:tS,totalOre:tO,waterTiles:wt,landTiles:lt};
  }
  toJSON(){return{cols:this.cols,rows:this.rows,seed:this.seed};}
}
