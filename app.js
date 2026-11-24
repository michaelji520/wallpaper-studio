'use strict';

/* ============================================================
   数据层
   ============================================================ */

const FRAME = 11; // 机身每边厚度：2px 金属边框 + 9px 黑色面板

const DEVICES = [
  { id:'ip18pm', os:'ios', name:'iPhone 18 Pro Max', inch:6.9,  w:440, h:956,  r:62,    pad:15.3, cutout:'island', mm:[78.0,163.4] },
  { id:'ip18p',  os:'ios', name:'iPhone 18 Pro',     inch:6.3,  w:402, h:874,  r:62,    pad:15.9, cutout:'island', mm:[71.9,150.0] },
  { id:'ip17pm', os:'ios', name:'iPhone 17 Pro Max', inch:6.9,  w:440, h:956,  r:62,    pad:15.3, cutout:'island', mm:[78.0,163.4] },
  { id:'ip16p',  os:'ios', name:'iPhone 16 Pro',     inch:6.3,  w:402, h:874,  r:62,    pad:14.7, cutout:'island', mm:[71.5,149.6] },
  { id:'ip14',   os:'ios', name:'iPhone 14',         inch:6.1,  w:390, h:844,  r:47.33, pad:20.8, cutout:'notch',  mm:[71.5,146.7] },
  { id:'mi15u',  os:'android', name:'小米 15 Ultra',    inch:6.73, w:440, h:980,  r:56, pad:17,   cutout:'punch', mm:[75.3,161.3] },
  { id:'s25u',   os:'android', name:'Galaxy S25 Ultra', inch:6.9,  w:480, h:1040, r:52, pad:13,   cutout:'punch', mm:[77.6,162.8] },
  { id:'p9p',    os:'android', name:'Pixel 9 Pro',      inch:6.3,  w:412, h:924,  r:52, pad:14.5, cutout:'punch', mm:[72.8,152.8] },
  { id:'agen',   os:'android', name:'Android 通用 · 水滴示例', inch:6.5, w:360, h:780, r:44, pad:13.5, cutout:'waterdrop', mm:[74.9,166.0], generic:true }
];

const CUTOUTS = ['island','notch','waterdrop','punch'];
const CUTOUT_LABEL = { island:'灵动岛', notch:'刘海', waterdrop:'水滴', punch:'挖孔' };

const ENV_PRESETS = [
  { id:'graphite', name:'石墨', css:'radial-gradient(120% 90% at 50% 0%,#2c2d32 0%,#111214 58%,#08090b 100%)' },
  { id:'mist',     name:'雾白', css:'radial-gradient(120% 95% at 50% 5%,#f6f4f0 0%,#ded9d1 55%,#c5bfb5 100%)' },
  { id:'clay',     name:'陶土', css:'radial-gradient(100% 80% at 28% 18%,#c07a5f 0%,#7d4334 48%,#3a1f18 100%)' },
  { id:'ocean',    name:'深海', css:'radial-gradient(90% 75% at 22% 10%,#1a5768 0%,#0a2028 55%,#050f14 100%)' },
  { id:'aurora',   name:'极光', css:'radial-gradient(75% 65% at 72% 18%,#4a3280 0%,#221a44 45%,#0a0913 100%)' },
  { id:'sand',     name:'沙丘', css:'linear-gradient(165deg,#3c2a20 0%,#1d130f 60%,#0b0807 100%)' }
];

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
  media:{ kind:'preset', presetId:'dune', name:'沙丘' },
  env:{ mode:'preset', presetId:'graphite', src:null, blur:0, dim:100 },
  lock:true,
  gloss:true,
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

const readoutDevice = $('readoutDevice');
const readoutSize   = $('readoutSize');
const readoutScale  = $('readoutScale');

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

function applySquircle(){
  const d = getDevice();
  const pad = d.pad ?? 11;
  const S = 0.6;                       // 连续曲率平滑度（Figma/iOS 默认 60%）
  const W = d.w + pad * 2;
  const H = d.h + pad * 2;

  const rOut = d.r + pad;
  const pOut = (1 + S) * rOut;         // 机身圆角的过渡段长度

  // 内层按"等距偏移"反推：过渡段长度随内缩量递减，保证边框厚度均匀
  const sFor = (radius, inset) => Math.max(0, (pOut - inset) / radius - 1);

  device.style.clipPath = `path("${squirclePath(W, H, rOut, S)}")`;
  bezelEl.style.clipPath = `path("${squirclePath(W - 10, H - 10, d.r + pad - 5, sFor(d.r + pad - 5, 5))}")`;
  screenEl.style.clipPath = `path("${squirclePath(d.w, d.h, d.r, sFor(d.r, pad))}")`;
}

function applyDevice(){
  const d = getDevice();
  const pad = d.pad ?? 11;
  device.style.setProperty('--dw', d.w + 'px');
  device.style.setProperty('--dh', d.h + 'px');
  device.style.setProperty('--r', d.r + 'px');
  device.style.setProperty('--pad', pad + 'px');
  device.classList.toggle('is-android', d.os === 'android');
  scaler.classList.toggle('is-android', d.os === 'android');
  applySquircle();

  buildDeviceOptions();
  readoutDevice.textContent = d.name;
  readoutSize.textContent = d.w + ' × ' + d.h;

  const rr = Number.isInteger(d.r) ? d.r : d.r.toFixed(2).replace(/\.?0+$/, '');
  if (d.generic){
    deviceMeta.textContent = `${d.inch}″ · ${d.w} × ${d.h} dp · R${rr} · 通用基准`;
  } else {
    deviceMeta.textContent = `${d.inch}″ · ${d.w} × ${d.h} pt · R${rr} · ${d.mm[0].toFixed(1)} × ${d.mm[1].toFixed(1)} mm`;
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
  device.style.setProperty('--sb-right', d.os === 'android' ? '16px' : '24px');
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
  readoutScale.textContent = pct;
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
  try{
    const c = document.createElement('canvas');
    c.width = 16; c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(source, 0, 0, 16, 32);
    const d = g.getImageData(0, 0, 16, 12).data; // 只看上三分之一（锁屏文字区域）
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4){
      sum += .2126 * d[i] + .7152 * d[i+1] + .0722 * d[i+2];
      n++;
    }
    return sum / n;
  } catch(e){
    return 0; // 跨域图片画布被污染时按深色处理
  }
}

function syncTone(source){
  if (!source){ screenEl.classList.remove('on-light'); return; }
  screenEl.classList.toggle('on-light', sampleLuma(source) > 166);
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
    v.addEventListener('loadeddata', () => { if (currentVideo === v) syncTone(v); });
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
    envEl.style.background = p.css;
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

function applyFit(){
  setSeg(fitSeg, state.fit === 'contain' ? 1 : 0, 2);
  const el = mediaEl.querySelector('.wp');
  if (el) el.style.objectFit = state.fit;
  const v = mediaEl.querySelector('video');
  if (v) v.style.objectFit = state.fit;
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
    b.style.background = p.css;
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
  applyFit();
  setSeg(osSeg, state.os === 'ios' ? 0 : 1, 2);
  setSeg(fitSeg, state.fit === 'contain' ? 1 : 0, 2);
  loopToggle.checked = state.loop;
}

function init(){
  bind();
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
