'use strict';

/* ============================================================
   数据层
   ============================================================ */

const FRAME = 11; // 机身每边厚度：2px 金属边框 + 9px 黑色面板

/* 机型参数说明
 * w/h：逻辑尺寸（pt 或 dp）。iOS 取自 Apple 官方分辨率 ÷ 3；Android 取系统默认显示大小下的 dp。
 * inch：官方标称对角线（iOS 为含圆角标称值，括号里是 Apple 给的矩形对角线）。
 * r   ：屏幕圆角半径。iOS 为 UIScreen._displayCornerRadius 实测值（ScreenCorners）。
 * pad ：机身外沿到屏幕边缘的厚度，由「(机身宽 − 屏幕物理宽) / 2 × 每毫米点数」反推。
 * mm  ：机身宽 × 高（官方数据）。
 * islandK：灵动岛整体缩放。iPhone 18 Pro 系列把红外相机移到屏下，药丸面积缩小约 35%
 *          （官方口径），线性缩放约 √0.65 ≈ 0.8。
 */
const DEVICES = [
  { id:'ip18pm', os:'ios', name:'iPhone 18 Pro Max', inch:6.9,  w:440, h:956,  r:62,    pad:15.5, cutout:'island', islandK:0.80, mm:[78.0,163.4] },
  { id:'ip18p',  os:'ios', name:'iPhone 18 Pro',     inch:6.3,  w:402, h:874,  r:62,    pad:16.1, cutout:'island', islandK:0.80, mm:[71.9,150.0] },
  { id:'ip17pm', os:'ios', name:'iPhone 17 Pro Max', inch:6.9,  w:440, h:956,  r:62,    pad:15.5, cutout:'island', mm:[78.0,163.4] },
  { id:'ip16p',  os:'ios', name:'iPhone 16 Pro',     inch:6.3,  w:402, h:874,  r:62,    pad:14.9, cutout:'island', mm:[71.5,149.6] },
  { id:'ip14',   os:'ios', name:'iPhone 14',         inch:6.1,  w:390, h:844,  r:47.33, pad:20.8, cutout:'notch',  mm:[71.5,146.7] },
  { id:'mi15u',  os:'android', name:'小米 15 Ultra',    inch:6.73, w:411, h:914,  r:56, pad:15.1, cutout:'punch', mm:[75.3,161.3] },
  { id:'s25u',   os:'android', name:'Galaxy S25 Ultra', inch:6.9,  w:360, h:780,  r:52, pad:10.3, cutout:'punch', mm:[77.6,162.8] },
  { id:'p9p',    os:'android', name:'Pixel 9 Pro',      inch:6.3,  w:427, h:952,  r:52, pad:21.2, cutout:'punch', mm:[72.0,152.8] },
  { id:'agen',   os:'android', name:'Android 通用 · 水滴示例', inch:6.5, w:360, h:780, r:44, pad:15.1, cutout:'waterdrop', mm:[74.9,166.0], generic:true }
];

const CUTOUTS = ['island','notch','waterdrop','punch'];
const CUTOUT_LABEL = { island:'灵动岛', notch:'刘海', waterdrop:'水滴', punch:'挖孔' };

/* ============================================================
   程序化织物/材质纹理（512² 无缝平铺）
   逐像素生成，不依赖外部图片；斜纹/经纬周期都能整除 512，保证接缝不可见
   ============================================================ */

const TEX_SIZE = 512;
const TEX_SPECS = [
  // 牛仔布：靛蓝粗斜纹（3/1 twill）+ 细密经纬 + 棉絮亮点
  // 注意：斜纹/经纬周期必须能整除 512，否则平铺会露接缝
  { id:'denim', name:'牛仔布', base:[44,62,88],
    twill:{ period:8, amp:.30 }, warp:{ period:4, amp:-.075 },
    noise:.16, speckle:{ at:.983, add:.44 } }
];

function texNoise(x, y, seed){
  let h = (x * 374761393 + y * 668265263 + seed * 1442695040) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** 平滑值噪声：格点随机 + smoothstep 双线性插值，避免出现方块状斑块 */
function texSmooth(x, y, scale, seed){
  const gx = x / scale, gy = y / scale;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const W = 32; // 与 512/scale 的格数对齐，取模保证首尾无缝
  const n00 = texNoise(((x0 % W) + W) % W, ((y0 % W) + W) % W, seed);
  const n10 = texNoise((((x0 + 1) % W) + W) % W, ((y0 % W) + W) % W, seed);
  const n01 = texNoise(((x0 % W) + W) % W, (((y0 + 1) % W) + W) % W, seed);
  const n11 = texNoise((((x0 + 1) % W) + W) % W, (((y0 + 1) % W) + W) % W, seed);
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}

const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;

function makeTextureCanvas(t){
  const S = TEX_SIZE;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  const [br, bg, bb] = t.base;
  let i = 0;

  for (let y = 0; y < S; y++){
    const weftHit = t.weft && (y % t.weft.period) === 0 ? t.weft.amp : 0;
    for (let x = 0; x < S; x++){
      let v = 1;

      // 45° 斜纹：三角波，周期整除 S 才不会出现接缝
      if (t.twill){
        const ph = ((x + y) % t.twill.period) / t.twill.period;
        v += (ph < .5 ? 1 : -1) * t.twill.amp * .5;
      }
      // 经线（垂直）/ 纬线（水平）
      if (t.warp && (x % t.warp.period) === 0) v += t.warp.amp;
      v += weftHit;
      // 低频斑块（皮革/水泥）
      if (t.grain){
        v += (texSmooth(x, y, t.grain.scale, 7) - .5) * t.grain.amp;
      }
      if (t.grain2){
        v += (texSmooth(x, y, t.grain2.scale, 19) - .5) * t.grain2.amp;
      }
      // 细噪点
      v += (texNoise(x, y, 3) - .5) * t.noise;
      // 高光颗粒（棉絮 / 磨砂点）
      if (t.speckle && texNoise(x, y, 11) > t.speckle.at) v += t.speckle.add;

      d[i++] = clamp8(br * v);
      d[i++] = clamp8(bg * v);
      d[i++] = clamp8(bb * v);
      d[i++] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

const TEX_CANVAS = {};
const TEX_SRC = {};
let texReady = false;

function buildTextures(){
  if (texReady) return;
  TEX_SPECS.forEach(t => {
    try{
      const c = makeTextureCanvas(t);
      TEX_CANVAS[t.id] = c;
      TEX_SRC[t.id] = c.toDataURL('image/png');
    } catch(err){
      console.warn('[Wallpaper Studio] 纹理生成失败:', t.id, err);
    }
  });
  texReady = true;
}

const ENV_PRESETS = [
  { id:'mist',     name:'雾白', kind:'radial', at:[.50,.05], radius:[1.20,.95],
    stops:[[0,'#f6f4f0'],[.55,'#ded9d1'],[1,'#c5bfb5']] },
  { id:'graphite', name:'石墨', kind:'radial', at:[.50,.00], radius:[1.20,.90],
    stops:[[0,'#2c2d32'],[.58,'#111214'],[1,'#08090b']] },
  { id:'clay',     name:'陶土', kind:'radial', at:[.28,.18], radius:[1.00,.80],
    stops:[[0,'#c07a5f'],[.48,'#7d4334'],[1,'#3a1f18']] },
  { id:'ocean',    name:'深海', kind:'radial', at:[.22,.10], radius:[.90,.75],
    stops:[[0,'#1a5768'],[.55,'#0a2028'],[1,'#050f14']] },
  { id:'aurora',   name:'极光', kind:'radial', at:[.72,.18], radius:[.75,.65],
    stops:[[0,'#4a3280'],[.45,'#221a44'],[1,'#0a0913']] },
  { id:'sand',     name:'沙丘', kind:'linear', angle:165,
    stops:[[0,'#3c2a20'],[.60,'#1d130f'],[1,'#0b0807']] },
  // —— 织物纹理 ——
  { id:'denim',    name:'牛仔布', kind:'texture', tex:'denim',    fallback:'#2c3e58' }
];

function envCSS(p){
  if (p.kind === 'texture'){
    const url = TEX_SRC[p.tex];
    // 纹理贴图平铺；未生成完成时退回底色
    return url
      ? `url("${url}") repeat left top / ${TEX_SIZE}px ${TEX_SIZE}px, ${p.fallback}`
      : p.fallback;
  }
  const stops = p.stops.map(([o, c]) => `${c} ${Math.round(o * 1000) / 10}%`).join(',');
  if (p.kind === 'linear') return `linear-gradient(${p.angle}deg,${stops})`;
  return `radial-gradient(${p.radius[0] * 100}% ${p.radius[1] * 100}% at ${p.at[0] * 100}% ${p.at[1] * 100}%,${stops})`;
}

const WALLPAPERS = [
  {
    id:'dune', name:'沙丘', blend:'screen', grain:.12, vig:.42,
    stops:['#060404','#0c0705','#1c0d07'],
    blobs:[
      { x:.50, y:1.02, r:.78, c:[255,142,64],  a:.55 },
      { x:.24, y:.92,  r:.55, c:[255,196,130], a:.28 },
      { x:.78, y:.16,  r:.60, c:[90,50,34],    a:.18 }
    ]
  },
  {
    id:'aurora', name:'极光', blend:'screen', grain:.1, vig:.34,
    stops:['#04060f','#070b1a','#03040b'],
    blobs:[
      { x:.20, y:.20, r:.70, c:[60,230,200], a:.34 },
      { x:.62, y:.34, r:.62, c:[90,120,255], a:.22 },
      { x:.90, y:.14, r:.55, c:[150,90,240], a:.30 },
      { x:.40, y:.85, r:.80, c:[30,90,190],  a:.16 }
    ]
  },
  {
    id:'abyss', name:'深海', blend:'screen', grain:.1, vig:.40,
    stops:['#000a10','#01202f','#00060a'],
    blobs:[
      { x:.50, y:.95, r:.85, c:[40,180,210], a:.34 },
      { x:.82, y:.20, r:.70, c:[20,80,150],  a:.36 },
      { x:.45, y:.62, r:.40, c:[120,240,255], a:.12 }
    ]
  },
  {
    // 中等亮度：让锁屏时钟能透出壁纸（on-glass 档），默认壁纸
    id:'morning', name:'晨霭', blend:'source-over', grain:.04, vig:.16,
    stops:['#8f97a6','#767f8f','#5a6371'],
    blobs:[
      { x:.32, y:.16, r:.86, c:[206,215,228], a:.52 },
      { x:.84, y:.60, r:.74, c:[142,158,182], a:.26 },
      { x:.18, y:.92, r:.68, c:[96,108,128],  a:.24 }
    ]
  },
  {
    id:'dawn', name:'晨曦', blend:'source-over', grain:.05, vig:.14,
    stops:['#fdeedd','#f9c6a8','#e79aa0','#8a7099'],
    blobs:[
      { x:.30, y:.12, r:.80, c:[255,252,242], a:.70 },
      { x:.80, y:.60, r:.62, c:[255,150,150], a:.30 },
      { x:.15, y:.95, r:.70, c:[110,100,180], a:.22 }
    ]
  },
  {
    id:'graphite', name:'石墨', blend:'screen', grain:.11, vig:.30,
    stops:['#050507','#0d0f13','#050506'],
    blobs:[
      { x:.25, y:.05, r:.90, c:[210,225,245], a:.16 },
      { x:.70, y:.75, r:.75, c:[140,160,190], a:.10 },
      { x:.50, y:.40, r:.50, c:[255,255,255], a:.04 }
    ]
  },
  {
    id:'mist', name:'薄雾', blend:'source-over', grain:.04, vig:.12,
    stops:['#f3f6f4','#e2e9e5','#c0ccc7'],
    blobs:[
      { x:.30, y:.12, r:.85, c:[255,255,255], a:.70 },
      { x:.85, y:.80, r:.75, c:[100,155,148], a:.16 },
      { x:.55, y:.45, r:.50, c:[255,255,255], a:.25 }
    ]
  }
];

const DEFAULT_STATE = {
  os:'ios',
  deviceId:'ip18pm',
  cutout:'island',
  fitMode:true,
  zoom:.8,
  fit:'cover',
  media:{ kind:'preset', presetId:'morning', name:'晨霭' },
  env:{ mode:'preset', presetId:'mist', src:null, blur:0, dim:100 },
  lock:true,
  gloss:true,
  glass:60,        // 液态玻璃浓度 0(极清透)~100(全着色)
  loop:true
};

const STORE_KEY = 'wallpaper-studio.v1';

/* ============================================================
   状态
   ============================================================ */

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let WP_SRC = {};            // id -> dataURL
let mediaURL = null;        // 当前媒体 objectURL
let envURL = null;          // 环境图 objectURL
let currentVideo = null;
let lastByOs = {};
let toastTimer = null;
let dragDepth = 0;

/* ============================================================
   DOM
   ============================================================ */

const $ = (id) => document.getElementById(id);
const stage       = $('stage');
const viewportEl  = $('viewport');
const canvasArea  = $('canvasArea');
const scaler      = $('scaler');
const device      = $('device');
const screenEl    = $('screen');
const bezelEl     = $('bezel');
const mediaEl     = $('media');
const envEl       = $('env');
const cutoutEl    = $('cutout');
const chromeEl    = $('chrome');
const lockDate    = $('lockDate');
const lockTime    = $('lockTime');

const osSeg       = $('osSeg');
const cutoutSeg   = $('cutoutSeg');
const fitSeg      = $('fitSeg');
const deviceSelect= $('deviceSelect');
const deviceMeta  = $('deviceMeta');
const cutoutLabel = $('cutoutLabel');


const fitBtn      = $('fitBtn');
const oneBtn      = $('oneBtn');
const zoomRange   = $('zoomRange');
const zoomOut     = $('zoomOut');

const presetsEl   = $('presets');
const mediaName   = $('mediaName');
const fileInput   = $('fileInput');
const dropZone    = $('dropZone');
const urlInput    = $('urlInput');
const urlBtn      = $('urlBtn');
const videoTools  = $('videoTools');
const videoToggle = $('videoToggle');
const loopToggle  = $('loopToggle');

const swatchesEl  = $('swatches');
const envUploadBtn= $('envUploadBtn');
const envFile     = $('envFile');
const blurRange   = $('blurRange');
const blurVal     = $('blurVal');
const dimRange    = $('dimRange');
const dimVal      = $('dimVal');

const lockToggle  = $('lockToggle');
const glossToggle = $('glossToggle');
const glassRange  = $('glassRange');
const glassVal    = $('glassVal');
const dropVeil    = $('dropVeil');
const toastEl     = $('toast');

/* ============================================================
   壁纸绘制：程序化渐变 + 噪点
   ============================================================ */

function noiseTile(){
  const n = document.createElement('canvas');
  n.width = n.height = 160;
  const ctx = n.getContext('2d');
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4){
    const v = 128 + (Math.random() - .5) * 90;
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return n;
}
const NOISE = noiseTile();

function makeWallpaper(spec, W = 900, H = 1950){
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  // 底色
  const lg = g.createLinearGradient(0, 0, W * .3, H);
  spec.stops.forEach((s, i) => lg.addColorStop(i / (spec.stops.length - 1), s));
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);

  // 光斑
  g.globalCompositeOperation = spec.blend || 'screen';
  spec.blobs.forEach(b => {
    const x = b.x * W, y = b.y * H, r = Math.max(b.r * W, 1);
    const [cr, cg, cb] = b.c;
    const col = (a) => `rgba(${cr},${cg},${cb},${a})`;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    // 平滑衰减，避免出现同心"年轮"
    rg.addColorStop(0, col(b.a));
    rg.addColorStop(.42, col(b.a * .45));
    rg.addColorStop(.72, col(b.a * .15));
    rg.addColorStop(1, col(0));
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  });
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // 暗角
  const vg = g.createRadialGradient(W * .5, H * .44, W * .12, W * .5, H * .5, Math.max(W, H) * .8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${spec.vig})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);

  // 颗粒
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = spec.grain;
  g.fillStyle = g.createPattern(NOISE, 'repeat');
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  return c.toDataURL('image/jpeg', .92);
}

function buildWallpapers(){
  WALLPAPERS.forEach(w => {
    try{
      WP_SRC[w.id] = makeWallpaper(w);
    } catch(err){
      console.warn('[Wallpaper Studio] 预设生成失败:', w.id, err);
    }
  });
}

/* ============================================================
   工具
   ============================================================ */

const getDevice = () => DEVICES.find(d => d.id === state.deviceId) || DEVICES[0];

const toRad = (deg) => deg * Math.PI / 180;

/**
 * 连续曲率圆角（squircle）路径，算法与 figma-squircle 一致。
 * iOS 屏幕/机身用的就是这种曲线，普通 border-radius 的圆弧会显得生硬。
 */
function squirclePath(w, h, radius, smoothing = 0.6){
  const budget = Math.min(w, h) / 2;
  const r = Math.min(radius, budget);
  const s = Math.min(smoothing, budget / r - 1);
  const p = Math.min((1 + s) * r, budget);

  const arcMeasure = 90 * (1 - s);
  const arcLen = Math.sin(toRad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = r * Math.tan(toRad(alpha / 2));
  const beta = 45 * s;
  const c = p3p4 * Math.cos(toRad(beta));
  const d = c * Math.tan(toRad(beta));
  const b = (p - arcLen - c - d) / 3;
  const a = 2 * b;

  const n = (v) => (Math.round(v * 1000) / 1000);
  const AR = n(r), AL = n(arcLen), P = n(p);
  const A = n(a), B = n(a + b), Cc = n(a + b + c), D = n(d);

  return [
    `M ${n(w - p)} 0`,
    // 右上
    `c ${A} 0 ${B} 0 ${Cc} ${D}`,
    `a ${AR} ${AR} 0 0 1 ${AL} ${AL}`,
    `c ${D} ${n(c)} ${D} ${n(b + c)} ${D} ${Cc}`,
    `L ${n(w)} ${n(h - p)}`,
    // 右下
    `c 0 ${A} 0 ${B} ${n(-d)} ${Cc}`,
    `a ${AR} ${AR} 0 0 1 ${n(-arcLen)} ${AL}`,
    `c ${n(-c)} ${D} ${n(-(b + c))} ${D} ${n(-(a + b + c))} ${D}`,
    `L ${P} ${n(h)}`,
    // 左下
    `c ${n(-a)} 0 ${n(-(a + b))} 0 ${n(-(a + b + c))} ${n(-d)}`,
    `a ${AR} ${AR} 0 0 1 ${n(-arcLen)} ${n(-arcLen)}`,
    `c ${n(-d)} ${n(-c)} ${n(-d)} ${n(-(b + c))} ${n(-d)} ${n(-(a + b + c))}`,
    `L 0 ${P}`,
    // 左上
    `c 0 ${n(-a)} 0 ${n(-(a + b))} ${D} ${n(-(a + b + c))}`,
    `a ${AR} ${AR} 0 0 1 ${AL} ${n(-arcLen)}`,
    `c ${n(c)} ${n(-d)} ${n(b + c)} ${n(-d)} ${Cc} ${n(-d)}`,
    'Z'
  ].join(' ');
}

function setSeg(el, index, n){
  el.style.setProperty('--i', index);
  el.style.setProperty('--n', n);
  el.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === index));
}

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function isVideoUrl(url){
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url) || /^data:video\//i.test(url);
}

/* ============================================================
   应用：设备 / 开孔 / 缩放
   ============================================================ */

function buildDeviceOptions(){
  const list = DEVICES.filter(d => d.os === state.os);
  deviceSelect.innerHTML = list.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  deviceSelect.value = state.deviceId;
}

function squircleGeom(d){
  const pad = d.pad ?? 11;
  const S = 0.6;
  const rOut = d.r + pad;
  const pOut = (1 + S) * rOut;
  const sFor = (r, inset) => Math.max(0, (pOut - inset) / r - 1);
  const ins = pad * 0.45;            // 金属边厚度（与 CSS 的 padding 一致）
  return {
    pad,
    dev:    { w: d.w + pad * 2,             h: d.h + pad * 2,             r: rOut,             s: S },
    bezel:  { w: d.w + pad * 2 - ins * 2,   h: d.h + pad * 2 - ins * 2,   r: rOut - ins,       s: sFor(rOut - ins, ins) },
    screen: { w: d.w,                  h: d.h,                  r: d.r,         s: sFor(d.r, pad) }
  };
}

function applySquircle(){
  const d = getDevice();
  const geo = squircleGeom(d);
  const q = (k) => `path("${squirclePath(geo[k].w, geo[k].h, geo[k].r, geo[k].s)}")`;
  device.style.clipPath = q('dev');
  bezelEl.style.clipPath = q('bezel');
  screenEl.style.clipPath = q('screen');
}

function applyDevice(){
  const d = getDevice();
  const pad = d.pad ?? 11;
  device.style.setProperty('--dw', d.w + 'px');
  device.style.setProperty('--dh', d.h + 'px');
  device.style.setProperty('--r', d.r + 'px');
  device.style.setProperty('--pad', pad + 'px');
  device.style.setProperty('--island-k', d.islandK || 1);
  device.classList.toggle('is-android', d.os === 'android');
  scaler.classList.toggle('is-android', d.os === 'android');
  applySquircle();

  buildDeviceOptions();

  const rr = Number.isInteger(d.r) ? d.r : d.r.toFixed(2).replace(/\.?0+$/, '');
  const unit = d.os === 'ios' ? 'pt' : 'dp';
  if (d.generic){
    deviceMeta.textContent = `${d.inch}″ · ${d.w} × ${d.h} ${unit} · R${rr} · 通用基准`;
  } else {
    deviceMeta.textContent = `${d.inch}″ · ${d.w} × ${d.h} ${unit} · R${rr} · ${d.mm[0].toFixed(1)} × ${d.mm[1].toFixed(1)} mm`;
  }
}

function applyCutout(){
  cutoutEl.dataset.cutout = state.cutout;
  cutoutLabel.textContent = CUTOUT_LABEL[state.cutout] || '—';
  setSeg(cutoutSeg, Math.max(0, CUTOUTS.indexOf(state.cutout)), 4);

  // 状态栏垂直位置按开孔类型对齐（灵动岛 54pt / 刘海 47pt 状态栏）
  const d = getDevice();
  const sbTop = { island: 22, notch: 17, punch: 13, waterdrop: 11 }[state.cutout] ?? 18;
  device.style.setProperty('--sb-top', sbTop + 'px');
  device.style.setProperty('--sb-right', d.os === 'android' ? '16px' : '26px');
}

function computeFit(){
  const cs = getComputedStyle(canvasArea);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = Math.max(canvasArea.clientWidth - padX, 80);
  const availH = Math.max(canvasArea.clientHeight - padY, 80);
  const d = getDevice();
  const pad = d.pad ?? FRAME;
  const devW = d.w + pad * 2;
  const devH = d.h + pad * 2;
  return Math.min(availW / devW, availH / devH, 1);
}

function setZoom(z, fitMode){
  state.zoom = z;
  state.fitMode = !!fitMode;
  scaler.style.transform = `translate(-50%, -50%) scale(${z})`;
  const pct = Math.round(z * 100) + '%';
  zoomOut.textContent = pct;
  zoomRange.value = String(Math.round(z * 100));
  fitBtn.classList.toggle('on', state.fitMode);
  oneBtn.classList.toggle('on', !state.fitMode && Math.abs(z - 1) < .004);
}

function fitNow(){
  setZoom(computeFit(), true);
}

/* ============================================================
   应用：壁纸
   ============================================================ */

function sampleLuma(source){
  const t = sampleTone(source);
  return t.luma;
}

/** 采样壁纸上部（锁屏时钟所在区域）的平均色与亮度 */
function sampleTone(source){
  const fallback = { luma: 0, r: 255, g: 255, b: 255 };
  try{
    const c = document.createElement('canvas');
    c.width = 16; c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(source, 0, 0, 16, 32);
    const d = g.getImageData(0, 0, 16, 12).data; // 上三分之一（时钟区域）
    let lr = 0, lg = 0, lb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4){
      lr += d[i]; lg += d[i+1]; lb += d[i+2];
      n++;
    }
    if (!n) return fallback;
    const r = lr / n, gg = lg / n, b = lb / n;
    return { luma: .2126 * r + .7152 * gg + .0722 * b, r, g: gg, b };
  } catch(e){
    return fallback; // 跨域图片画布被污染时按深色处理
  }
}

function syncTone(source){
  if (!source){
    screenEl.classList.remove('on-light', 'on-glass');
    screenEl.style.removeProperty('--clock-rgb');
    return;
  }
  const t = sampleTone(source);
  // 时钟取「壁纸该区域平均色的提亮版」，而不是纯白 —— 真机玻璃字会带背景色相
  const boost = v => Math.round(Math.min(255, 255 - (255 - v) * 0.24));
  screenEl.style.setProperty('--clock-rgb', `${boost(t.r)},${boost(t.g)},${boost(t.b)}`);
  screenEl.classList.toggle('on-light', t.luma > 166);
  // 中等亮度壁纸才让时钟透出背景；太暗透出来会发灰，太亮要转深色
  screenEl.classList.toggle('on-glass', t.luma > 95 && t.luma <= 166);
}

function watchTone(el, source){
  if (el.tagName === 'IMG' && !el.complete){
    el.addEventListener('load', () => syncTone(el));
  } else {
    syncTone(el);
  }
}

function releaseMediaURL(){
  if (mediaURL){ URL.revokeObjectURL(mediaURL); mediaURL = null; }
}

function applyMedia(){
  const m = state.media;
  mediaEl.innerHTML = '';
  mediaEl.classList.toggle('is-empty', m.kind === 'none');

  if (m.kind === 'none'){
    mediaEl.innerHTML = '<div class="ph">拖入图片或视频</div>';
    syncTone(null);
    currentVideo = null;
    videoTools.hidden = true;
    mediaName.textContent = '未设置';
    markPreset(null);
    return;
  }

  const src = m.kind === 'preset' ? WP_SRC[m.presetId] : m.src;
  const hasSources = m.kind === 'video' && Array.isArray(m.sources) && m.sources.length > 0;
  if (!src && !hasSources){
    mediaEl.innerHTML = '<div class="ph">壁纸不可用</div>';
    syncTone(null);
    currentVideo = null;
    videoTools.hidden = true;
    mediaName.textContent = '—';
    markPreset(null);
    return;
  }

  if (m.kind === 'video'){
    const v = document.createElement('video');
    v.className = 'wp';
    if (hasSources){
      m.sources.forEach(u => {
        const so = document.createElement('source');
        so.src = u;
        so.type = /\.webm$/i.test(u) ? 'video/webm' : 'video/mp4';
        v.appendChild(so);
      });
    } else {
      v.src = src;
    }
    v.muted = true;
    v.loop = state.loop;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.style.objectFit = state.fit;
    mediaEl.appendChild(v);
    currentVideo = v;
    v.addEventListener('play', () => { if (currentVideo === v) videoToggle.textContent = '暂停视频'; });
    v.addEventListener('pause', () => { if (currentVideo === v) videoToggle.textContent = '播放视频'; });
    const sampleVideoTone = () => { if (currentVideo === v) syncTone(v); };
    if ('requestVideoFrameCallback' in v){
      v.requestVideoFrameCallback(sampleVideoTone);
    } else {
      v.addEventListener('loadeddata', () => setTimeout(sampleVideoTone, 120), { once: true });
    }
    v.play().catch(() => {});
    videoTools.hidden = false;
    videoToggle.textContent = '暂停视频';
  } else {
    const img = document.createElement('img');
    img.className = 'wp';
    img.src = src;
    img.alt = m.name || 'wallpaper';
    img.style.objectFit = state.fit;
    mediaEl.appendChild(img);
    watchTone(img, img.src);
    currentVideo = null;
    videoTools.hidden = true;
  }

  mediaName.textContent = m.name || '自定义';
  markPreset(m.kind === 'preset' ? m.presetId : (m.name === '动态壁纸示例' ? '__video' : null));
}

function markPreset(id){
  presetsEl.querySelectorAll('.preset').forEach(el => {
    el.classList.toggle('on', el.dataset.id === id);
  });
}

function setMedia(next, opts = {}){
  if (!opts.keepURL) releaseMediaURL();
  state.media = next;
  applyMedia();
  save();
}

function applyFile(file){
  if (!file) return;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo){
    toast('仅支持图片或视频文件');
    return;
  }
  releaseMediaURL();
  mediaURL = URL.createObjectURL(file);
  state.media = { kind: isVideo ? 'video' : 'image', src: mediaURL, name: file.name };
  applyMedia();
  save();
  toast(isVideo ? '视频已应用' : '图片已应用');
}

function applyUrl(){
  const url = urlInput.value.trim();
  if (!url){ urlInput.focus(); return; }
  if (!/^(https?:|data:|blob:)/i.test(url)){
    toast('请输入 http(s) 或 data 链接');
    return;
  }
  releaseMediaURL();
  state.media = { kind: isVideoUrl(url) ? 'video' : 'image', src: url, name: '来自链接' };
  applyMedia();
  save();
  toast('壁纸已应用');
}

/* ============================================================
   应用：环境
   ============================================================ */

function applyEnv(){
  const e = state.env;
  envEl.style.background = '';
  envEl.style.backgroundImage = '';

  if (e.mode === 'image' && e.src){
    envEl.style.backgroundImage = `url("${e.src}")`;
    envEl.style.backgroundColor = '#0a0a0c';
  } else {
    const p = ENV_PRESETS.find(x => x.id === e.presetId) || ENV_PRESETS[0];
    envEl.style.background = envCSS(p);
  }

  envEl.style.filter = `blur(${e.blur}px) brightness(${e.dim / 100})`;
  envEl.style.transform = `scale(${1 + e.blur / 85})`;

  swatchesEl.querySelectorAll('.swatch.color').forEach(el => {
    el.classList.toggle('on', e.mode === 'preset' && el.dataset.id === e.presetId);
  });
  blurRange.value = String(e.blur);
  blurVal.textContent = String(e.blur);
  dimRange.value = String(e.dim);
  dimVal.textContent = e.dim + '%';
}

/* ============================================================
   其它渲染
   ============================================================ */

function applyChrome(){
  chromeEl.style.display = state.lock ? '' : 'none';
  lockToggle.checked = state.lock;
}

function applyGloss(){
  screenEl.classList.toggle('no-gloss', !state.gloss);
  glossToggle.checked = state.gloss;
}

/* 液态玻璃浓度：0 = 极清透（几乎全透），100 = 全着色（接近实心） */
function applyGlass(){
  const k = Math.min(100, Math.max(0, state.glass)) / 100;
  screenEl.style.setProperty('--glass-k', k.toFixed(2));
  if (glassRange) glassRange.value = state.glass;
  if (glassVal) glassVal.textContent = state.glass;
}

function applyFit(){
  setSeg(fitSeg, state.fit === 'contain' ? 1 : 0, 2);
  const el = mediaEl.querySelector('.wp');
  if (el) el.style.objectFit = state.fit;
  const v = mediaEl.querySelector('video');
  if (v) v.style.objectFit = state.fit;
}

/* ============================================================
   导出：内容区（环境背景 + 整机）→ 2K 图片 / 视频
   ============================================================ */

const EXPORT_W = 2560;
const svgCache = new Map();
let envImage = null, envImageSrc = null;

function linearGradient(g, angle, w, h, stops){
  const a = (angle % 360) * Math.PI / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const gr = g.createLinearGradient(
    w / 2 - dx * len / 2, h / 2 - dy * len / 2,
    w / 2 + dx * len / 2, h / 2 + dy * len / 2
  );
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}

/** 椭圆径向渐变：借坐标系缩放把圆拉成椭圆 */
function radialEllipse(g, cx, cy, rx, ry, stops, w, h){
  g.save();
  g.translate(cx, cy);
  g.scale(Math.max(rx, 1), Math.max(ry, 1));
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  stops.forEach(([o, c]) => rg.addColorStop(o, c));
  g.fillStyle = rg;
  g.fillRect(-24, -24, 48, 48);
  g.restore();
}

function rrect(g, x, y, w, h, r){
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function envImageEl(){
  if (state.env.mode !== 'image' || !state.env.src) return null;
  if (envImageSrc !== state.env.src){
    envImageSrc = state.env.src;
    envImage = new Image();
    envImage.src = state.env.src;
  }
  return envImage;
}

async function ensureEnvImage(){
  const img = envImageEl();
  if (img && !img.complete) await img.decode().catch(() => {});
}

function applyDim(g, w, h, dim){
  if (dim === 100) return;
  g.save();
  g.fillStyle = dim < 100
    ? `rgba(0,0,0,${(100 - dim) / 100 * .85})`
    : `rgba(255,255,255,${Math.min((dim - 100) / 200, .35)})`;
  g.fillRect(0, 0, w, h);
  g.restore();
}

function paintEnv(g, w, h){
  const e = state.env;
  const img = envImageEl();
  if (e.mode === 'image' && img && img.complete && img.naturalWidth){
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (1 + e.blur / 85);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    g.save();
    if ('filter' in g) g.filter = `blur(${e.blur}px) brightness(${e.dim}%)`;
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    g.restore();
    if (!('filter' in g)) applyDim(g, w, h, e.dim);
    return;
  }
  const p = ENV_PRESETS.find(x => x.id === e.presetId) || ENV_PRESETS[0];
  if (p.kind === 'texture'){
    const cv = TEX_CANVAS[p.tex];
    if (cv){
      // 用 pattern 平铺；此时 g 已带导出缩放，图案会跟着缩放，密度与页面一致
      const pat = g.createPattern(cv, 'repeat');
      g.fillStyle = pat || p.fallback;
      g.fillRect(0, 0, w, h);
    } else {
      g.fillStyle = p.fallback;
      g.fillRect(0, 0, w, h);
    }
    applyDim(g, w, h, e.dim);
    return;
  }
  if (p.kind === 'linear'){
    g.fillStyle = linearGradient(g, p.angle, w, h, p.stops);
    g.fillRect(0, 0, w, h);
  } else {
    radialEllipse(g, p.at[0] * w, p.at[1] * h, p.radius[0] * w, p.radius[1] * h, p.stops, w, h);
  }
  applyDim(g, w, h, e.dim);
}

function paintVignette(g, w, h){
  radialEllipse(g, w * .5, h * .4, w * 1.2, h * 1.0,
    [[0, 'rgba(0,0,0,0)'], [.4, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.35)']], w, h);
}

function drawWallpaper(g, W, H){
  const el = mediaEl.querySelector('.wp');
  const sw = el ? (el.naturalWidth || el.videoWidth || 0) : 0;
  const sh = el ? (el.naturalHeight || el.videoHeight || 0) : 0;
  g.fillStyle = '#0a0a0c';
  g.fillRect(0, 0, W, H);
  if (!sw || !sh) return false;
  const s = state.fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
  const dw = sw * s, dh = sh * s;
  try { g.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh); return true; }
  catch(e){ return false; }
}

function drawCutout(g, d, W, k){
  const sw = d.w * k;
  const cx = W / 2;
  g.fillStyle = '#000';
  if (state.cutout === 'island'){
    const ik = d.islandK || 1;
    const w = 0.262 * sw * ik, h = 0.076 * sw * ik;
    rrect(g, cx - w / 2, 0.028 * sw, w, h, h / 2); g.fill();
  } else if (state.cutout === 'notch'){
    const w = 0.415 * sw, h = 0.082 * sw, r = 0.038 * sw;
    g.beginPath();
    g.moveTo(cx - w / 2, 0);
    g.lineTo(cx - w / 2, h - r);
    g.quadraticCurveTo(cx - w / 2, h, cx - w / 2 + r, h);
    g.lineTo(cx + w / 2 - r, h);
    g.quadraticCurveTo(cx + w / 2, h, cx + w / 2, h - r);
    g.lineTo(cx + w / 2, 0);
    g.closePath(); g.fill();
  } else if (state.cutout === 'waterdrop'){
    const w = 0.087 * sw, h = 0.06 * sw;
    g.beginPath();
    g.moveTo(cx - w / 2, 0);
    g.lineTo(cx - w / 2, h * 0.42);
    g.quadraticCurveTo(cx - w / 2, h, cx, h);
    g.quadraticCurveTo(cx + w / 2, h, cx + w / 2, h * 0.42);
    g.lineTo(cx + w / 2, 0);
    g.closePath(); g.fill();
  } else {
    const r = 0.021 * sw;
    g.beginPath();
    g.arc(cx, 0.06 * sw, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** 页面里的 SVG 图标 → Image（按 viewBox 放大 8 倍栅格化，2K 下不糊） */
function svgImage(el, color){
  const key = (el.getAttribute('class') || '') + '|' + color;
  if (svgCache.has(key)) return svgCache.get(key);
  const clone = el.cloneNode(true);
  const cs = getComputedStyle(el);
  const vb = (clone.getAttribute('viewBox') || '0 0 24 24').split(/\s+/).map(Number);
  // 固定输出高度，避免大 viewBox（如 SF Symbols 的 1390×1000）按倍数放大后占用巨量内存
  const OUT_H = 512;
  const rk = OUT_H / (vb[3] || 24);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', Math.round(vb[2] * rk));
  clone.setAttribute('height', OUT_H);
  clone.setAttribute('fill', cs.fill === 'none' ? 'none' : 'currentColor');
  if (cs.stroke && cs.stroke !== 'none') clone.setAttribute('stroke', 'currentColor');
  const markup = clone.outerHTML.replace(/currentColor/g, color);

  const p = new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  });
  svgCache.set(key, p);
  return p;
}

/** 预计算锁屏元素在屏幕局部坐标里的绘制指令（k 为目标单位/显示像素） */
async function buildChromeLayer(d, k){
  const sr = screenEl.getBoundingClientRect();
  const z = (sr.width / d.w) || 1;
  const toC = r => ({
    x: (r.left - sr.left) / z * k,
    y: (r.top - sr.top) / z * k,
    w: r.width / z * k,
    h: r.height / z * k
  });
  const ops = [];
  // iOS 26/27 液态玻璃：时钟用渐变玻璃漆，圆钮用「背景折射 + 高光 + 玻璃边」
  const glass = d.os !== 'android';
  const onLight = screenEl.classList.contains('on-light');
  const SW = d.w * k, SH = d.h * k;
  // 页面里由采样算出的时钟基色（与 CSS 共用同一个变量，保证导出观感一致）
  const clockRGB = (getComputedStyle(screenEl).getPropertyValue('--clock-rgb') || '').trim() || '255,255,255';
  const gk = (typeof state.glass === 'number' ? state.glass : 60) / 100;

  const sbColor = getComputedStyle(document.querySelector('.statusbar')).color;
  for (const el of document.querySelectorAll('.sb-icons svg')){
    const r = toC(el.getBoundingClientRect());
    const img = await svgImage(el, sbColor);
    if (img) ops.push(g => g.drawImage(img, r.x, r.y, r.w, r.h));
  }

  for (const el of [lockDate, lockTime]){
    const r = toC(el.getBoundingClientRect());
    const cs = getComputedStyle(el);
    const text = el.textContent;
    const solid = cs.color;                       // Android / 日期用实色
    const isTime = el === lockTime;
    const size = parseFloat(cs.fontSize) * k;
    const ls = (parseFloat(cs.letterSpacing) || 0) * k;
    const font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    ops.push(g => {
      if (glass && isTime){
        const gr = g.createLinearGradient(0, r.y, 0, r.y + r.h);
        if (onLight){
          gr.addColorStop(0,   'rgba(20,18,15,.86)');
          gr.addColorStop(.52, 'rgba(20,18,15,.72)');
          gr.addColorStop(1,   'rgba(20,18,15,.82)');
        } else if (screenEl.classList.contains('on-glass')){
          gr.addColorStop(0,   `rgba(${clockRGB},${(0.56 + gk * 0.40).toFixed(3)})`);
          gr.addColorStop(.52, `rgba(${clockRGB},${(0.46 + gk * 0.33).toFixed(3)})`);
          gr.addColorStop(1,   `rgba(${clockRGB},${(0.54 + gk * 0.39).toFixed(3)})`);
        } else {
          gr.addColorStop(0,   'rgba(255,255,255,.99)');
          gr.addColorStop(.52, 'rgba(255,255,255,.92)');
          gr.addColorStop(1,   'rgba(255,255,255,.98)');
        }
        g.fillStyle = gr;
      } else {
        g.fillStyle = solid;
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = font;
      if ('letterSpacing' in g) g.letterSpacing = ls + 'px';
      g.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
    });
  }

  for (const orb of document.querySelectorAll('.orb')){
    const r = toC(orb.getBoundingClientRect());
    const cs = getComputedStyle(orb);
    const iconEl = orb.querySelector('svg');
    const ir = iconEl ? toC(iconEl.getBoundingClientRect()) : null;
    const icon = iconEl ? await svgImage(iconEl, cs.color) : null;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = r.w / 2;

    if (glass){
      const rim = Math.max(1, rad * 0.045);
      const rimColor = onLight ? 'rgba(255,255,255,.58)' : 'rgba(255,255,255,.32)';
      const tintA    = onLight ? (0.03 + gk * 0.22) : (0.008 + gk * 0.16);
      const tint     = `rgba(255,255,255,${tintA.toFixed(3)})`;
      const blurPx   = Math.max(2, rad * (0.28 + gk * 0.42));
      ops.push(g => {
        g.save();
        g.beginPath();
        g.arc(cx, cy, rad - rim / 2, 0, Math.PI * 2);
        g.clip();
        // 背景折射：把壁纸重新模糊画一遍
        if ('filter' in g) g.filter = `blur(${blurPx}px)`;
        drawWallpaper(g, SW, SH);
        if ('filter' in g) g.filter = 'none';
        g.fillStyle = tint;
        g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        g.restore();
        // 玻璃边缘
        g.beginPath();
        g.arc(cx, cy, rad - rim / 2, 0, Math.PI * 2);
        g.strokeStyle = rimColor;
        g.lineWidth = rim;
        g.stroke();
        if (icon && ir) g.drawImage(icon, ir.x, ir.y, ir.w, ir.h);
      });
    } else {
      const orbBg = cs.backgroundColor;
      ops.push(g => {
        g.fillStyle = orbBg;
        g.beginPath();
        g.arc(cx, cy, rad, 0, Math.PI * 2);
        g.fill();
        if (icon && ir) g.drawImage(icon, ir.x, ir.y, ir.w, ir.h);
      });
    }
  }

  const hb = document.querySelector('.home-bar');
  if (hb){
    const r = toC(hb.getBoundingClientRect());
    const hbBg = getComputedStyle(hb).backgroundColor;
    ops.push(g => { g.fillStyle = hbBg; rrect(g, r.x, r.y, r.w, r.h, r.h / 2); g.fill(); });
  }

  return { draw(g){ for (const fn of ops) fn(g); } };
}

/** 整机：机身 + 黑边 + 屏幕内容 + 侧键 + 落地阴影 */
function drawPhone(g, vp, layer){
  const d = getDevice();
  const geo = squircleGeom(d);
  const devRect = device.getBoundingClientRect();
  const x = devRect.left - vp.left, y = devRect.top - vp.top;
  const z = devRect.width / geo.dev.w;

  const bodyPath = new Path2D(squirclePath(geo.dev.w * z, geo.dev.h * z, geo.dev.r * z, geo.dev.s));
  const bezelPath = new Path2D(squirclePath(geo.bezel.w * z, geo.bezel.h * z, geo.bezel.r * z, geo.bezel.s));
  const screenPath = new Path2D(squirclePath(geo.screen.w * z, geo.screen.h * z, geo.screen.r * z, geo.screen.s));

  g.save();
  g.translate(x, y);

  // 落地阴影
  g.save();
  g.shadowColor = 'rgba(0,0,0,.40)';
  g.shadowBlur = 36 * z;
  g.shadowOffsetY = 16 * z;
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fill(bodyPath);
  g.restore();

  // 机身金属
  g.save();
  g.clip(bodyPath);
  const metal = d.os === 'android'
    ? [[0,'#4b4f56'],[.38,'#22252a'],[.62,'#3c4046'],[1,'#14161a']]
    : [[0,'#c6bfb1'],[.04,'#8b857a'],[.12,'#45413b'],[.34,'#232120'],[.58,'#2b2926'],[.8,'#55504a'],[.94,'#9a9387'],[1,'#cbc4b6']];
  g.fillStyle = linearGradient(g, 152, geo.dev.w * z, geo.dev.h * z, metal);
  g.fillRect(0, 0, geo.dev.w * z, geo.dev.h * z);
  g.restore();

  // 黑边
  g.save();
  g.translate(5 * z, 5 * z);
  g.fillStyle = '#050506';
  g.fill(bezelPath);
  g.restore();

  // 屏幕
  g.save();
  g.translate(geo.pad * z, geo.pad * z);
  g.clip(screenPath);
  drawWallpaper(g, geo.screen.w * z, geo.screen.h * z);
  drawCutout(g, d, geo.screen.w * z, z);
  if (layer) layer.draw(g);
  g.restore();

  g.restore();

  // 侧键
  document.querySelectorAll('.btn-side').forEach(el => {
    if (getComputedStyle(el).display === 'none') return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const bx = r.left - vp.left, by = r.top - vp.top;
    g.save();
    g.fillStyle = linearGradient(g, 90, r.width, r.height, [[0,'#7d776d'],[1,'#3a3733']]);
    rrect(g, bx, by, r.width, r.height, Math.min(2, r.width / 2));
    g.fill();
    g.restore();
  });
}

function stageCanvas(){
  const vp = viewportEl.getBoundingClientRect();
  const S = EXPORT_W / vp.width;
  const c = document.createElement('canvas');
  c.width = EXPORT_W;
  c.height = Math.round(vp.height * S);
  const g = c.getContext('2d');
  g.setTransform(S, 0, 0, S, 0, 0);   // 之后一律用内容区的 CSS 坐标
  return { c, g, vp, S };
}

function drawScene(g, vp, layer){
  paintEnv(g, vp.width, vp.height);
  drawPhone(g, vp, layer);
  paintVignette(g, vp.width, vp.height);
}

function downloadBlob(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportImage(){
  const btn = $('exportImg');
  if (btn.classList.contains('busy')) return;
  btn.classList.add('busy');
  try{
    const d = getDevice();
    const { c, g, vp } = stageCanvas();
    await ensureEnvImage();
    const z = screenEl.getBoundingClientRect().width / d.w;
    const layer = state.lock ? await buildChromeLayer(d, z) : null;
    drawScene(g, vp, layer);
    const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('画布导出失败')), 'image/png'));
    downloadBlob(blob, `wallpaper-scene-${d.id}-${c.width}x${c.height}.png`);
    toast(`已导出 ${c.width} × ${c.height} PNG`);
  } catch(err){
    console.error(err);
    toast(err && err.name === 'SecurityError'
      ? '跨域素材无法导出，请改用本地上传'
      : '导出失败：' + (err.message || '未知错误'));
  } finally {
    btn.classList.remove('busy');
  }
}

async function exportVideo(){
  const v = mediaEl.querySelector('video');
  if (!v){ toast('视频导出需要先选择视频壁纸'); return; }
  if (typeof MediaRecorder === 'undefined'){ toast('当前浏览器不支持视频录制'); return; }
  const btn = $('exportVid');
  if (btn.classList.contains('busy')) return;
  btn.classList.add('busy');

  const d = getDevice();
  const { c, g, vp } = stageCanvas();
  await ensureEnvImage();
  const z = screenEl.getBoundingClientRect().width / d.w;
  const layer = state.lock ? await buildChromeLayer(d, z) : null;

  c.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
  document.body.appendChild(c);

  const stream = c.captureStream(30);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    .find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 9000000 } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

  try{
    const started = new Promise(r => { rec.onstart = r; });
    rec.start(200);
    await Promise.race([started, new Promise(r => setTimeout(r, 1500))]);

    const durMs = Math.min(Math.max(v.duration || 6, 3), 10) * 1000;
    try { v.currentTime = 0; } catch(e){}
    await v.play().catch(() => {});
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => {
        drawScene(g, vp, layer);
        if (performance.now() - t0 < durMs) requestAnimationFrame(tick);
        else res();
      };
      tick();
    });
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.stop();
    await Promise.race([stopped, new Promise(r => setTimeout(r, 3000))]);

    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    const ext = /mp4/.test(mime) ? 'mp4' : 'webm';
    downloadBlob(blob, `wallpaper-scene-${d.id}-${c.width}x${c.height}-${Math.round(durMs / 1000)}s.${ext}`);
    toast(`已导出 ${Math.round(durMs / 1000)} 秒视频`);
  } catch(err){
    console.error(err);
    toast('视频导出失败：' + (err.message || '未知错误'));
  } finally {
    btn.classList.remove('busy');
    stream.getTracks().forEach(t => t.stop());
    c.remove();
  }
}

function tickClock(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  lockTime.textContent = hh + ':' + mm;
  const wd = ['日','一','二','三','四','五','六'][now.getDay()];
  lockDate.textContent = `${now.getMonth() + 1}月${now.getDate()}日 星期${wd}`;
}

/* ============================================================
   面板构建
   ============================================================ */

function buildPresets(){
  presetsEl.innerHTML = '';
  WALLPAPERS.forEach(w => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.id = w.id;
    b.title = w.name;
    b.style.backgroundImage = `url("${WP_SRC[w.id]}")`;
    b.innerHTML = `<span class="pl">${w.name}</span>`;
    b.addEventListener('click', () => {
      setMedia({ kind:'preset', presetId:w.id, name:w.name });
      toast('壁纸：' + w.name);
    });
    presetsEl.appendChild(b);
  });

  const v = document.createElement('button');
  v.type = 'button';
  v.className = 'preset preset-video';
  v.dataset.id = '__video';
  v.title = '动态壁纸示例（6s 循环）';
  v.innerHTML = '<span class="pv-play"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8 10 6l-7 4.2V1.8Z" fill="currentColor"/></svg></span><span class="pl">视频</span>';
  v.addEventListener('click', () => {
    releaseMediaURL();
    state.media = { kind:'video', sources:['assets/demo-loop.webm','assets/demo-loop.mp4'], name:'动态壁纸示例' };
    applyMedia();
    save();
    toast('动态壁纸已应用 · 静音循环');
  });
  presetsEl.appendChild(v);
}

function buildSwatches(){
  swatchesEl.querySelectorAll('.swatch.color').forEach(el => el.remove());
  const anchor = swatchesEl.querySelector('.swatch-add');
  ENV_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch color';
    b.dataset.id = p.id;
    b.title = p.name;
    b.style.background = envCSS(p);
    b.addEventListener('click', () => {
      if (envURL){ URL.revokeObjectURL(envURL); envURL = null; }
      state.env.mode = 'preset';
      state.env.presetId = p.id;
      state.env.src = null;
      applyEnv();
      save();
    });
    swatchesEl.insertBefore(b, anchor);
  });
}

/* ============================================================
   持久化
   ============================================================ */

function save(){
  try{
    const snap = {
      os: state.os,
      deviceId: state.deviceId,
      cutout: state.cutout,
      fitMode: state.fitMode,
      zoom: state.zoom,
      fit: state.fit,
      presetId: state.media.kind === 'preset' ? state.media.presetId : null,
      env: { mode:'preset', presetId: state.env.presetId, blur: state.env.blur, dim: state.env.dim },
      lock: state.lock,
      gloss: state.gloss,
      glass: state.glass,
      loop: state.loop
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(snap));
  } catch(e){ /* 忽略隐私模式下的写入失败 */ }
}

function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.deviceId && DEVICES.some(d => d.id === s.deviceId)){
      state.deviceId = s.deviceId;
      state.os = DEVICES.find(d => d.id === s.deviceId).os;
    }
    if (CUTOUTS.includes(s.cutout)) state.cutout = s.cutout;
    if (typeof s.zoom === 'number') state.zoom = s.zoom;
    if (typeof s.fitMode === 'boolean') state.fitMode = s.fitMode;
    if (s.fit === 'contain' || s.fit === 'cover') state.fit = s.fit;
    if (s.presetId && WP_SRC[s.presetId]) state.media = { kind:'preset', presetId: s.presetId, name: (WALLPAPERS.find(w => w.id === s.presetId) || {}).name || '预设' };
    if (s.env){
      if (ENV_PRESETS.some(p => p.id === s.env.presetId)) state.env.presetId = s.env.presetId;
      if (typeof s.env.blur === 'number') state.env.blur = s.env.blur;
      if (typeof s.env.dim === 'number') state.env.dim = s.env.dim;
    }
    if (typeof s.lock === 'boolean') state.lock = s.lock;
    if (typeof s.gloss === 'boolean') state.gloss = s.gloss;
    if (typeof s.glass === 'number') state.glass = Math.min(100, Math.max(0, s.glass));
    if (typeof s.loop === 'boolean') state.loop = s.loop;
  } catch(e){ /* 忽略损坏的存储 */ }
}

/* ============================================================
   事件
   ============================================================ */

function bind(){
  /* --- 机型 --- */
  osSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-os]');
    if (!btn || btn.dataset.os === state.os) return;
    const os = btn.dataset.os;
    const list = DEVICES.filter(d => d.os === os);
    const prev = lastByOs[os];
    const target = (prev && list.find(d => d.id === prev)) || list[0];
    state.os = os;
    setSeg(osSeg, os === 'ios' ? 0 : 1, 2);
    changeDevice(target.id);
  });

  deviceSelect.addEventListener('change', () => changeDevice(deviceSelect.value));

  cutoutSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cutout]');
    if (!btn) return;
    state.cutout = btn.dataset.cutout;
    applyCutout();
    save();
  });

  /* --- 缩放 --- */
  fitBtn.addEventListener('click', fitNow);
  oneBtn.addEventListener('click', () => setZoom(1, false));
  zoomRange.addEventListener('input', () => setZoom(Number(zoomRange.value) / 100, false));

  /* --- 壁纸 --- */
  fileInput.addEventListener('change', (e) => {
    applyFile(e.target.files && e.target.files[0]);
    fileInput.value = '';
  });

  urlBtn.addEventListener('click', applyUrl);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyUrl(); });

  videoToggle.addEventListener('click', () => {
    if (!currentVideo) return;
    if (currentVideo.paused){
      currentVideo.play().catch(() => {});
      videoToggle.textContent = '暂停视频';
    } else {
      currentVideo.pause();
      videoToggle.textContent = '播放视频';
    }
  });

  loopToggle.addEventListener('change', () => {
    state.loop = loopToggle.checked;
    if (currentVideo) currentVideo.loop = state.loop;
    save();
  });

  fitSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-fit]');
    if (!btn) return;
    state.fit = btn.dataset.fit;
    applyFit();
    save();
  });

  const clearBtn = $('clearMedia');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    releaseMediaURL();
    setMedia({ kind:'none', src:null, name:null });
    toast('已清除壁纸');
  });

  /* --- 环境 --- */
  envUploadBtn.addEventListener('click', () => envFile.click());
  envFile.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f || !f.type.startsWith('image/')){ envFile.value = ''; return; }
    if (envURL) URL.revokeObjectURL(envURL);
    envURL = URL.createObjectURL(f);
    state.env.mode = 'image';
    state.env.src = envURL;
    applyEnv();
    save();
    toast('背景图已应用');
    envFile.value = '';
  });

  blurRange.addEventListener('input', () => {
    state.env.blur = Number(blurRange.value);
    applyEnv();
    save();
  });
  dimRange.addEventListener('input', () => {
    state.env.dim = Number(dimRange.value);
    applyEnv();
    save();
  });

  /* --- 显示 --- */
  lockToggle.addEventListener('change', () => {
    state.lock = lockToggle.checked;
    applyChrome();
    save();
  });
  glossToggle.addEventListener('change', () => {
    state.gloss = glossToggle.checked;
    applyGloss();
    save();
  });

  /* --- 玻璃浓度 --- */
  glassRange.addEventListener('input', () => {
    state.glass = +glassRange.value;
    applyGlass();
  });
  glassRange.addEventListener('change', save);

  /* --- 导出 --- */
  $('exportImg').addEventListener('click', exportImage);
  $('exportVid').addEventListener('click', exportVideo);

  /* --- 重置 --- */
  $('resetBtn').addEventListener('click', () => {
    releaseMediaURL();
    if (envURL){ URL.revokeObjectURL(envURL); envURL = null; }
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    lastByOs = {};
    try{ localStorage.removeItem(STORE_KEY); } catch(e){}
    applyAll();
    setSeg(osSeg, 0, 2);
    fitNow();
    toast('已恢复默认');
  });

  /* --- 拖放 --- */
  const isFileDrag = (e) => {
    const t = e.dataTransfer;
    if (!t) return false;
    return Array.from(t.types || []).includes('Files');
  };

  stage.addEventListener('dragenter', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth++;
    dropVeil.classList.add('show');
  });
  stage.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  stage.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropVeil.classList.remove('show');
  });
  stage.addEventListener('drop', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropVeil.classList.remove('show');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) applyFile(f);
  });

  dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  /* --- 粘贴 --- */
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items){
      if (it.type.startsWith('image/')){
        const f = it.getAsFile();
        if (f){ e.preventDefault(); applyFile(f); toast('已粘贴剪贴板图片'); }
        return;
      }
    }
  });

  /* --- 快捷键 --- */
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'f'){ e.preventDefault(); fitNow(); }
    else if (k === '1'){ e.preventDefault(); setZoom(1, false); }
    else if (k === 'l'){
      state.lock = !state.lock;
      applyChrome();
      save();
    }
  });

  /* --- 自适应 --- */
  if (window.ResizeObserver){
    const ro = new ResizeObserver(() => { if (state.fitMode) fitNow(); });
    ro.observe(canvasArea);
  } else {
    window.addEventListener('resize', () => { if (state.fitMode) fitNow(); });
  }
}

function changeDevice(id){
  const d = DEVICES.find(x => x.id === id);
  if (!d) return;
  state.deviceId = id;
  state.os = d.os;
  state.cutout = d.cutout;
  lastByOs[d.os] = id;

  applyDevice();
  applyCutout();
  setSeg(osSeg, d.os === 'ios' ? 0 : 1, 2);
  if (state.fitMode) fitNow();
  save();
}

/* ============================================================
   启动
   ============================================================ */

function applyAll(){
  applyDevice();
  applyCutout();
  applyMedia();
  applyEnv();
  applyChrome();
  applyGloss();
  applyGlass();
  applyFit();
  setSeg(osSeg, state.os === 'ios' ? 0 : 1, 2);
  setSeg(fitSeg, state.fit === 'contain' ? 1 : 0, 2);
  loopToggle.checked = state.loop;
}

function init(){
  bind();
  buildTextures();
  buildWallpapers();
  load();
  buildPresets();
  buildSwatches();
  applyAll();

  scaler.classList.add('no-anim');
  tickClock();
  setInterval(tickClock, 20000);

  // 首帧后再计算适应缩放，避免字体/布局未稳定
  requestAnimationFrame(() => {
    if (state.fitMode) fitNow();
    else setZoom(state.zoom, false);
    requestAnimationFrame(() => scaler.classList.remove('no-anim'));
  });

  if (location.protocol === 'file:'){
    console.warn('[Wallpaper Studio] 建议通过 http/https 打开，视频与本地资源更稳定。');
  }
}

init();
