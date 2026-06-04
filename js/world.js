// ============================================================
// world.js — OPTION B : Moteur PixiJS WebGL
// Même API que l'original — compatibilité totale garantie
// ============================================================

import { BIOME, BIOME_PROPS, getBiomeFromParams } from './biomes.js';

// ——— Noise (identique) ——————————————————————————————
function fade(t){return t*t*t*(t*(t*6-15)+10);}
function lerp(a,b,t){return a+t*(b-a);}
function buildPerm(seed){
  const p=[];for(let i=0;i<256;i++)p[i]=i;
  let s=seed|0;
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
    return lerp(lerp(grad(p[a],x,y),grad(p[b],x-1,y),u),lerp(grad(p[a+1],x,y-1),grad(p[b+1],x-1,y-1),u),v);
  }
  fractal(x,y,oct=6,per=0.5,lac=2){
    let val=0,amp=1,freq=1,max=0;
    for(let i=0;i<oct;i++){val+=this.noise2(x*freq,y*freq)*amp;max+=amp;amp*=per;freq*=lac;}
    return val/max;
  }
}

export const TILE_SIZE = 16;

// ——— Palettes biomes ————————————————————————————————
const BIOME_COLORS_HEX = {
  [BIOME.OCEAN]       :'0x1a4a8a',[BIOME.RIVER]       :'0x2a6abf',
  [BIOME.LAKE]        :'0x1e5899',[BIOME.BEACH]       :'0xd4b96a',
  [BIOME.PLAIN]       :'0x7ab05a',[BIOME.PRAIRIE]     :'0x8ec868',
  [BIOME.FOREST]      :'0x2d6e2d',[BIOME.DENSE_FOREST]:'0x1a4e1a',
  [BIOME.JUNGLE]      :'0x156015',[BIOME.SWAMP]       :'0x3a5a2a',
  [BIOME.DESERT]      :'0xc8a850',[BIOME.SAVANNA]     :'0xa89030',
  [BIOME.TUNDRA]      :'0x9ab0b8',[BIOME.TAIGA]       :'0x4a6e5a',
  [BIOME.HILL]        :'0x6a7a5a',[BIOME.MOUNTAIN]    :'0x8a8878',
  [BIOME.VOLCANO]     :'0xa03020',
};
// CSS pour minimap et fallback
export const BIOME_COLORS_CSS = {
  [BIOME.OCEAN]:'#1a4a8a',[BIOME.RIVER]:'#2a6abf',[BIOME.LAKE]:'#1e5899',
  [BIOME.BEACH]:'#d4b96a',[BIOME.PLAIN]:'#7ab05a',[BIOME.PRAIRIE]:'#8ec868',
  [BIOME.FOREST]:'#2d6e2d',[BIOME.DENSE_FOREST]:'#1a4e1a',[BIOME.JUNGLE]:'#156015',
  [BIOME.SWAMP]:'#3a5a2a',[BIOME.DESERT]:'#c8a850',[BIOME.SAVANNA]:'#a89030',
  [BIOME.TUNDRA]:'#9ab0b8',[BIOME.TAIGA]:'#4a6e5a',[BIOME.HILL]:'#6a7a5a',
  [BIOME.MOUNTAIN]:'#8a8878',[BIOME.VOLCANO]:'#a03020',
};

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
    this._texSeed=Math.random();
  }
  regen(dt){
    this.regenTimer+=dt;
    if(this.regenTimer>60){
      this.regenTimer=0;const p=this.props;
      if(this.wood<p.wood*80)this.wood=Math.min(100,this.wood+1);
      if(this.food<p.food*60)this.food=Math.min(100,this.food+1);
      if(this.stone<p.stone*80)this.stone=Math.min(100,this.stone+1);
    }
  }
  harvest(type,amount){const cur=this[type]||0,taken=Math.min(cur,amount);this[type]=cur-taken;return taken;}
}

// ——— PixiJS World Renderer ——————————————————————————
export class World {
  constructor(cols=180,rows=120,seed=Date.now()){
    this.cols=cols;this.rows=rows;this.seed=seed;
    this.tiles=[];this._elevMap=[];
    // PixiJS app & containers
    this.pixiApp    = null;
    this.mapContainer   = null;
    this.entityContainer= null;
    this.uiContainer    = null;
    this.waterContainer = null;
    this.weatherContainer=null;
    this._waterSprites  = [];
    this._weatherParts  = [];
    this._weatherMode   = 'none';
    this._filterDark    = null; // filtre nuit
    // Fallback canvas 2D
    this.offscreenCanvas= null;
    this.offscreenCtx   = null;
    this._mapDirty      = true;
    this._pixiReady     = false;
    this._generate();
    this._initPixi();
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
        const d=(new NoiseGen(this.seed+3333).noise2(x/20,y/20)+1)/2;
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

  // ——— INIT PIXI ———————————————————————————————————
  _initPixi(){
    // Vérifier que PIXI est disponible
    if(typeof window.PIXI === 'undefined'){
      console.warn('[World] PIXI non chargé, fallback canvas 2D');
      this._initFallback();
      return;
    }
    const PIXI = window.PIXI;
    const W    = this.cols*TILE_SIZE, H = this.rows*TILE_SIZE;

    // Créer l'application Pixi sur un canvas dédié (caché)
    this._pixiCanvas = document.createElement('canvas');
    this._pixiCanvas.width  = Math.min(W, 4096);
    this._pixiCanvas.height = Math.min(H, 4096);
    this._pixiCanvas.style.display = 'none';
    document.body.appendChild(this._pixiCanvas);

    try {
      this.pixiApp = new PIXI.Application({
        view:            this._pixiCanvas,
        width:           this._pixiCanvas.width,
        height:          this._pixiCanvas.height,
        backgroundColor: 0x060809,
        antialias:       false,
        powerPreference: 'high-performance',
      });

      this.mapContainer    = new PIXI.Container();
      this.waterContainer  = new PIXI.Container();
      this.weatherContainer= new PIXI.Container();
      this.entityContainer = new PIXI.Container();
      this.pixiApp.stage.addChild(this.mapContainer);
      this.pixiApp.stage.addChild(this.waterContainer);
      this.pixiApp.stage.addChild(this.weatherContainer);
      this.pixiApp.stage.addChild(this.entityContainer);

      this._buildPixiMap();
      this._buildWaterSprites();
      this._pixiReady = true;
      console.log('[World] PixiJS WebGL initialisé ✅');
    } catch(e) {
      console.warn('[World] PixiJS échoué, fallback:', e.message);
      this._initFallback();
    }
  }

  _initFallback(){
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    this.offscreenCanvas=document.createElement('canvas');
    this.offscreenCanvas.width=W;this.offscreenCanvas.height=H;
    this.offscreenCtx=this.offscreenCanvas.getContext('2d');
    this._redrawMapFallback();
  }

  // ——— CONSTRUCTION CARTE PIXI ————————————————————
  _buildPixiMap(){
    const PIXI = window.PIXI, TS = TILE_SIZE;
    const gfx   = new PIXI.Graphics();

    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const tile = this.tiles[y][x];
        const col  = parseInt(BIOME_COLORS_HEX[tile.biome]||'0x7ab05a');

        // Variation de couleur par bruit
        const n    = tile.noiseVal;
        let r      = (col>>16)&0xff,g=(col>>8)&0xff,b=col&0xff;
        const vary = (n-0.5)*40;
        r=Math.max(0,Math.min(255,r+vary));
        g=Math.max(0,Math.min(255,g+vary));
        b=Math.max(0,Math.min(255,b+vary));
        const finalCol = (r<<16)|(g<<8)|b;

        gfx.beginFill(finalCol);
        gfx.drawRect(x*TS,y*TS,TS,TS);
        gfx.endFill();

        // Textures selon biome
        this._pixiTileDetail(gfx, tile, x*TS, y*TS, TS);
      }
    }

    // Relief ombres
    for(let y=1;y<this.rows-1;y++){
      for(let x=1;x<this.cols-1;x++){
        const e=this._elevMap[y][x],eN=this._elevMap[y-1]?.[x]??e,eW=this._elevMap[y]?.[x-1]??e;
        const slope=(e-eN)+(e-eW);
        if(Math.abs(slope)>0.03){
          const alpha=Math.min(slope>0?0.5:0.25,Math.abs(slope)*3);
          const col=slope>0?0x000000:0xffffdd;
          gfx.beginFill(col,alpha);
          gfx.drawRect(x*TS,y*TS,TS,TS);
          gfx.endFill();
        }
      }
    }

    // Neige sommets
    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const e=this._elevMap[y]?.[x]||0;
        if(e>0.85){
          const alpha=Math.min(0.85,(e-0.85)/0.1*0.85);
          gfx.beginFill(0xeef5ff,alpha);
          gfx.drawRect(x*TS,y*TS,TS,TS);
          gfx.endFill();
        }
      }
    }

    this.mapContainer.addChild(gfx);

    // Convertir en texture (une seule drawcall GPU)
    const rt = PIXI.RenderTexture.create({width:this.cols*TS,height:this.rows*TS});
    this.pixiApp.renderer.render(gfx,{renderTexture:rt});
    this.mapContainer.removeChildren();
    const sprite = new PIXI.Sprite(rt);
    this.mapContainer.addChild(sprite);
    this._mapTexture = rt;
  }

  _pixiTileDetail(gfx, tile, px, py, TS){
    const s1=tile._texSeed;
    const b=tile.biome;
    if(b===BIOME.BEACH||b===BIOME.DESERT){
      gfx.beginFill(0xfff0c0,0.12);
      for(let i=0;i<5;i++) gfx.drawRect(px+(s1*TS+(i*37))%TS,py+(s1*TS+(i*53))%TS,1,1);
      gfx.endFill();
    } else if(b===BIOME.FOREST||b===BIOME.DENSE_FOREST||b===BIOME.TAIGA){
      gfx.beginFill(0x002800,0.20);
      for(let i=0;i<3;i++) gfx.drawCircle(px+(s1*TS+(i*59))%TS,py+(s1*TS+(i*43))%TS,2);
      gfx.endFill();
    } else if(b===BIOME.MOUNTAIN||b===BIOME.HILL){
      gfx.lineStyle(0.5,0x3c3228,0.18);
      gfx.moveTo(px+2,py+TS*0.4);gfx.lineTo(px+TS-2,py+TS*0.4);
      gfx.moveTo(px+1,py+TS*0.7);gfx.lineTo(px+TS-1,py+TS*0.7);
      gfx.lineStyle(0);
    }
  }

  _buildWaterSprites(){
    const PIXI = window.PIXI, TS = TILE_SIZE;
    // Créer sprites animés pour l'eau
    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const b=this.tiles[y][x].biome;
        if(b!==BIOME.OCEAN&&b!==BIOME.LAKE&&b!==BIOME.RIVER)continue;
        const gfx = new PIXI.Graphics();
        gfx.x=x*TS;gfx.y=y*TS;
        gfx._wx=x;gfx._wy=y;gfx._biome=b;
        this.waterContainer.addChild(gfx);
        this._waterSprites.push(gfx);
      }
    }
  }

  // ——— ANIMATION EAU PIXI —————————————————————————
  _updateWaterPixi(time){
    const PIXI = window.PIXI, TS = TILE_SIZE;
    for(const gfx of this._waterSprites){
      gfx.clear();
      const x=gfx._wx,y=gfx._wy,b=gfx._biome;
      const t1=Math.sin(time*0.002+x*0.3+y*0.2);
      const wave=(t1+Math.cos(time*0.0015+x*0.25-y*0.3))*0.25+0.5;

      if(b===BIOME.OCEAN||b===BIOME.LAKE){
        gfx.beginFill(0x5096ff,0.07+wave*0.07);
        gfx.drawRect(0,0,TS,TS);
        gfx.endFill();
        if(wave>0.78){
          gfx.beginFill(0xffffff,(wave-0.78)*0.7);
          gfx.drawRect(1,TS*0.3+t1*TS*0.15,TS-2,1.5);
          gfx.endFill();
        }
        // Éclat lumineux
        const sparkle=Math.sin(time*0.008+x*1.7+y*2.3);
        if(sparkle>0.92){
          gfx.beginFill(0xffffff,(sparkle-0.92)*4);
          gfx.drawRect(Math.floor(wave*TS*0.5),2,2,2);
          gfx.endFill();
        }
      } else {
        gfx.beginFill(0x64b4ff,0.12+wave*0.10);
        gfx.drawRect(0,0,TS,TS);
        gfx.endFill();
        gfx.lineStyle(1,0xb4dcff,0.15+wave*0.12);
        const off=(time*0.05)%TS;
        gfx.moveTo(-off,0);gfx.lineTo(TS-off,TS);
        gfx.lineStyle(0);
      }
    }
  }

  // ——— MÉTÉO PIXI ——————————————————————————————————
  setWeather(mode){
    if(!this._pixiReady){return;}
    const PIXI=window.PIXI;
    this._weatherMode=mode;
    this.weatherContainer.removeChildren();
    this._weatherParts=[];
    if(mode==='none')return;
    const count=mode==='rain'?300:150;
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    for(let i=0;i<count;i++){
      const gfx=new PIXI.Graphics();
      const px=Math.random()*W,py=Math.random()*H;
      gfx.x=px;gfx.y=py;
      const part={
        gfx,x:px,y:py,
        vx:mode==='rain'?-1.5:mode==='snow'?(Math.random()-0.5)*0.5:(Math.random()-0.5)*0.8,
        vy:mode==='rain'?6+Math.random()*3:mode==='snow'?0.5+Math.random()*0.8:0.3+Math.random()*0.5,
        size:mode==='rain'?0.5:mode==='snow'?2:3+Math.random()*3,
        alpha:mode==='rain'?0.4+Math.random()*0.3:0.6+Math.random()*0.4,
        rot:Math.random()*Math.PI*2,
        color:mode==='leaves'?Math.floor(Math.random()*0xffffff)|0xff3000:0xffffff,
      };
      this._weatherParts.push(part);
      this.weatherContainer.addChild(gfx);
    }
  }

  _updateWeatherPixi(dt){
    if(this._weatherMode==='none')return;
    const W=this.cols*TILE_SIZE,H=this.rows*TILE_SIZE;
    for(const p of this._weatherParts){
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=0.02*dt;
      if(p.y>H)p.y=-10;if(p.x<-20)p.x=W+10;if(p.x>W+20)p.x=-10;
      p.gfx.x=p.x;p.gfx.y=p.y;
      p.gfx.clear();
      if(this._weatherMode==='rain'){
        p.gfx.lineStyle(p.size,0xb4d4ff,p.alpha);
        p.gfx.moveTo(0,0);p.gfx.lineTo(p.vx*3,p.vy*3);
        p.gfx.lineStyle(0);
      } else if(this._weatherMode==='snow'){
        p.gfx.beginFill(0xf0f8ff,p.alpha);
        p.gfx.drawCircle(0,0,p.size);
        p.gfx.endFill();
        // Cristal
        p.gfx.lineStyle(0.5,0xdcebff,0.5);
        for(let i=0;i<3;i++){
          const a=p.rot+i*Math.PI/3;
          p.gfx.moveTo(0,0);p.gfx.lineTo(Math.cos(a)*p.size*2,Math.sin(a)*p.size*2);
        }
        p.gfx.lineStyle(0);
      } else {
        p.gfx.beginFill(p.color,p.alpha);
        p.gfx.drawEllipse(0,0,p.size,p.size*0.5);
        p.gfx.endFill();
      }
    }
  }

  // ——— FILTRE NUIT PIXI ————————————————————————————
  _updateNightFilter(nightAlpha){
    if(!this._pixiReady||!window.PIXI)return;
    const PIXI=window.PIXI;
    if(!this._filterDark&&nightAlpha>0.01){
      // ColorMatrixFilter pour assombrir
      this._filterDark=new PIXI.ColorMatrixFilter();
      this.pixiApp.stage.filters=[this._filterDark];
    }
    if(this._filterDark){
      const brightness=Math.max(0.25,1-nightAlpha*0.75);
      this._filterDark.brightness(brightness,false);
      // Teinte bleue la nuit
      const blue=nightAlpha*0.15;
      this._filterDark.tint(0x8898ff,false);
    }
  }

  // ——— RENDU PIXI VERS CANVAS PRINCIPAL ————————————
  _renderPixiToCanvas(ctx,camX,camY,viewW,viewH,timestamp,nightAlpha){
    const PIXI=window.PIXI;
    // Positionner les containers selon la caméra
    this.mapContainer.x      = -camX;
    this.mapContainer.y      = -camY;
    this.waterContainer.x    = -camX;
    this.waterContainer.y    = -camY;
    this.weatherContainer.x  = -camX;
    this.weatherContainer.y  = -camY;

    // Mise à jour eau et météo
    this._updateWaterPixi(timestamp);
    this._updateWeatherPixi(0.016*60);
    this._updateNightFilter(nightAlpha);

    // Rendre dans le canvas Pixi (GPU)
    this.pixiApp.render();

    // Copier le rendu Pixi dans le canvas principal
    ctx.drawImage(this._pixiCanvas, 0, 0, viewW, viewH, 0, 0, viewW, viewH);
  }

  // ——— FALLBACK 2D ————————————————————————————————
  _redrawMapFallback(){
    const ctx=this.offscreenCtx,TS=TILE_SIZE;
    for(let y=0;y<this.rows;y++){
      for(let x=0;x<this.cols;x++){
        const tile=this.tiles[y][x];
        const col=BIOME_COLORS_CSS[tile.biome]||'#7ab05a';
        ctx.fillStyle=col;ctx.fillRect(x*TS,y*TS,TS,TS);
      }
    }
    this._mapDirty=false;
  }

  // ——— API PUBLIQUE (identique original) ————————————
  update(dt){
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)this.tiles[y][x].regen(dt);
  }

  draw(ctx,camX,camY,viewW,viewH,timestamp=0,nightAlpha=0){
    if(this._pixiReady){
      this._renderPixiToCanvas(ctx,camX,camY,viewW,viewH,timestamp,nightAlpha);
    } else {
      if(this._mapDirty)this._redrawMapFallback();
      if(this.offscreenCanvas)ctx.drawImage(this.offscreenCanvas,camX,camY,viewW,viewH,0,0,viewW,viewH);
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
    let totalWood=0,totalFood=0,totalStone=0,totalOre=0,w=0,l=0;
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
      const t=this.tiles[y][x];totalWood+=t.wood;totalFood+=t.food;totalStone+=t.stone;totalOre+=t.ore;
      if([BIOME.OCEAN,BIOME.LAKE,BIOME.RIVER].includes(t.biome))w++;else l++;
    }
    return{totalWood,totalFood,totalStone,totalOre,waterTiles:w,landTiles:l};
  }
  toJSON(){return{cols:this.cols,rows:this.rows,seed:this.seed};}
}
