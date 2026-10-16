/* ==========================================================================
   Fondos animados en canvas (versión realista).
   Cada escena tiene versión clara y oscura. Lo estático (cielo, montañas,
   texturas de nubes con ruido fractal, Vía Láctea…) se pinta una sola vez en
   capas auxiliares; en cada cuadro solo se dibuja lo que se mueve.
   En modo "Ahorro" baja resolución, cantidad de partículas y FPS para TV.
   ES5 a propósito: los navegadores de TV suelen ser Chromium antiguos.
   ========================================================================== */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var canvas, ctx;
  var current = null, currentId = null;
  var mode = 'dark', quality = 'high';
  var W = 0, H = 0, scale = 1;
  var raf = 0, last = 0, t0 = 0, fadeTimer = 0, pending = null;
  var texCache = {};

  /* ======================================================================
     Utilidades
     ====================================================================== */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
  function eco() { return quality === 'eco'; }

  /* ctx.filter (desenfoque real) existe en Chromium 52+; en navegadores sin él se aproxima */
  var HAS_FILTER = (function () {
    try { return typeof document.createElement('canvas').getContext('2d').filter === 'string'; } catch (e) { return false; }
  })();
  /* Dibuja una capa desenfocada (profundidad de campo, ciudad tras el vidrio, follaje…) */
  function drawBlurred(dst, src, w, h, px) {
    if (px <= 0) { dst.drawImage(src, 0, 0, w, h); return; }
    if (HAS_FILTER) {
      dst.filter = 'blur(' + (px * scale).toFixed(1) + 'px)';
      dst.drawImage(src, 0, 0, w, h);
      dst.filter = 'none';
      return;
    }
    var f = Math.max(2, px * scale / 2), a = pixCanvas(src.width / f, src.height / f);
    a.getContext('2d').drawImage(src, 0, 0, a.width, a.height);
    var b = pixCanvas(a.width * 2, a.height * 2);
    b.getContext('2d').drawImage(a, 0, 0, b.width, b.height);
    dst.drawImage(b, 0, 0, w, h);
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mixArr(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function linear(c, x0, y0, x1, y1, stops) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  function radial(c, x, y, r, stops) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  /* Canvas auxiliar a la misma escala que el principal (coordenadas en px CSS) */
  function buffer(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    var x = c.getContext('2d');
    x.setTransform(scale, 0, 0, scale, 0, 0);
    return { canvas: c, ctx: x };
  }
  /* Canvas en píxeles reales (texturas que luego se estiran) */
  function pixCanvas(pw, ph) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(pw));
    c.height = Math.max(1, Math.round(ph));
    return c;
  }

  /* Sprite de brillo radial */
  function glow(color, size, core, coreAlpha) {
    var c = pixCanvas(size, size), x = c.getContext('2d'), r = size / 2;
    x.fillStyle = radial(x, r, r, r, [[0, rgba(color, 1)], [core, rgba(color, coreAlpha)], [1, rgba(color, 0)]]);
    x.fillRect(0, 0, size, size);
    return c;
  }
  /* Disco desenfocado (bokeh): plano con el borde un poco más brillante */
  function bokehDisc(color, size) {
    var c = pixCanvas(size, size), x = c.getContext('2d'), r = size / 2;
    x.fillStyle = radial(x, r, r, r, [[0, rgba(color, 0.5)], [0.78, rgba(color, 0.62)], [0.9, rgba(color, 0.55)], [1, rgba(color, 0)]]);
    x.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------- ruido fractal (value noise) con repetición horizontal opcional ---------- */
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    var r = mulberry(seed), p = [], perm = new Uint8Array(512), vals = new Float32Array(256), i, j, tmp;
    for (i = 0; i < 256; i++) { p[i] = i; vals[i] = r(); }
    for (i = 255; i > 0; i--) { j = (r() * (i + 1)) | 0; tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
    function noise(x, y, period) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, x1 = ix + 1;
      if (period) { ix = ((ix % period) + period) % period; x1 = ((x1 % period) + period) % period; }
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var a = vals[perm[(perm[ix & 255] + iy) & 255]], b = vals[perm[(perm[x1 & 255] + iy) & 255]];
      var c = vals[perm[(perm[ix & 255] + iy + 1) & 255]], d = vals[perm[(perm[x1 & 255] + iy + 1) & 255]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct, period) {
      var s = 0, amp = 0.5, f = 1, n = 0;
      for (var o = 0; o < oct; o++) {
        s += amp * noise(x * f, y * f, period ? period * f : 0);
        n += amp; amp *= 0.5; f *= 2;
      }
      return s / n;
    }
    return { noise: noise, fbm: fbm };
  }

  /* Capa de nubes con ruido fractal e iluminación hacia el sol.
     Se repite en horizontal sin cortes para poder desplazarla. */
  function cloudTexture(o) {
    var key = 'cl' + JSON.stringify(o);
    if (texCache[key]) return texCache[key];
    var k = eco() ? 0.65 : 1, pw = Math.round(o.pw * k), ph = Math.round(o.ph * k);
    var N = makeNoise(o.seed), cv = pixCanvas(pw, ph), cx = cv.getContext('2d');
    var img = cx.createImageData(pw, ph), d = img.data;
    var sx = o.period / pw, sy = sx * o.squash;
    for (var y = 0; y < ph; y++) {
      var v = y / ph, band = o.band(v);
      if (band <= 0.002) continue;
      for (var x = 0; x < pw; x++) {
        var nx = x * sx, ny = y * sy + o.seed;
        var n = N.fbm(nx, ny, o.oct, o.period) * band;
        var dens = (n - o.cover) / o.soft;
        if (dens <= 0) continue;
        if (dens > 1) dens = 1;
        dens = dens * dens * (3 - 2 * dens);
        var n2 = N.fbm(nx + o.ldx, ny + o.ldy, 3, o.period) * band;
        var lit = 0.68 + (n - n2) * o.contrast - (n - o.cover) * o.thick - v * o.bottomDark;
        lit = lit < 0 ? 0 : lit > 1 ? 1 : lit;
        var i = (y * pw + x) * 4;
        d[i] = o.shade[0] + (o.lit[0] - o.shade[0]) * lit;
        d[i + 1] = o.shade[1] + (o.lit[1] - o.shade[1]) * lit;
        d[i + 2] = o.shade[2] + (o.lit[2] - o.shade[2]) * lit;
        d[i + 3] = dens * o.alpha * 255;
      }
    }
    cx.putImageData(img, 0, 0);
    texCache[key] = cv;
    return cv;
  }
  function bandFn(a, b) { return function (v) { return smooth(0, a, v) * (1 - smooth(b, 1, v)); }; }

  /* ---------- paisaje ---------- */
  function ridge(baseY, amp, steps, rough) {
    var n = 1 << steps, pts = new Array(n + 1), size, i, a = amp;
    pts[0] = baseY + rand(-amp, amp) * 0.5;
    pts[n] = baseY + rand(-amp, amp) * 0.5;
    for (size = n; size > 1; size >>= 1, a *= (rough || 0.56)) {
      for (i = size >> 1; i < n; i += size) pts[i] = (pts[i - (size >> 1)] + pts[i + (size >> 1)]) / 2 + rand(-a, a);
    }
    return pts;
  }
  function ridgeAt(pts, w, x) {
    var f = clamp(x / w, 0, 1) * (pts.length - 1), i = Math.floor(f), j = Math.min(i + 1, pts.length - 1);
    return pts[i] + (pts[j] - pts[i]) * (f - i);
  }
  function fillRidge(c, w, pts, bottom, fill) {
    c.beginPath();
    c.moveTo(0, bottom);
    for (var i = 0; i < pts.length; i++) c.lineTo(i / (pts.length - 1) * w, pts[i]);
    c.lineTo(w, bottom);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }
  /* Nieve en las cumbres: más gruesa cuanto más alta la cima, borde irregular */
  function snowCaps(c, w, pts, baseY, amp, depth, color) {
    var n = pts.length, i, walk = 0, lows = [];
    c.beginPath();
    c.moveTo(0, pts[0]);
    for (i = 0; i < n; i++) c.lineTo(i / (n - 1) * w, pts[i]);
    for (i = n - 1; i >= 0; i--) {
      walk = clamp(walk + rand(-0.35, 0.35), -1, 1);
      var hgt = clamp((baseY - pts[i]) / amp + 0.3, 0, 1.4);
      lows.push(pts[i] + depth * hgt * (0.55 + 0.45 * walk) + 1);
      c.lineTo(i / (n - 1) * w, lows[lows.length - 1]);
    }
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }

  /* Pino con puntas de ramas irregulares y montones de nieve sobre las ramas */
  function pine(c, x, by, hgt, fill, snow, snowA) {
    var tiers = clamp(Math.round(hgt / 11), 4, 10), wb = hgt * 0.4, i, j, tips, q, tiersData = [];
    c.fillStyle = fill;
    c.fillRect(x - hgt * 0.018, by - hgt * 0.2, hgt * 0.036, hgt * 0.22);
    c.beginPath();
    for (i = 0; i < tiers; i++) {
      var p = (i + 1) / tiers;
      var top = by - hgt + (i * hgt * 0.8) / tiers;
      var dh = hgt * (0.18 + 0.1 * p), bot = top + dh;
      var hw = wb * (0.14 + 0.86 * p) / 2;
      tiersData.push([top, dh, hw]);
      tips = 2 + ((Math.random() * 3) | 0);
      c.moveTo(x, top);
      for (j = 1; j <= tips; j++) {
        q = j / tips;
        c.lineTo(x + hw * (q - 0.5 / tips) * 0.72, top + dh * (0.12 + 0.72 * q));
        c.lineTo(x + hw * q * rand(0.85, 1.1), top + dh * (0.3 + 0.7 * q) + dh * rand(0, 0.15));
      }
      c.lineTo(x + hw * 0.35, bot - dh * 0.06);
      c.lineTo(x, bot - dh * 0.14);
      c.lineTo(x - hw * 0.35, bot - dh * 0.06);
      for (j = tips; j >= 1; j--) {
        q = j / tips;
        c.lineTo(x - hw * q * rand(0.85, 1.1), top + dh * (0.3 + 0.7 * q) + dh * rand(0, 0.15));
        c.lineTo(x - hw * (q - 0.5 / tips) * 0.72, top + dh * (0.12 + 0.72 * q));
      }
      c.closePath();
    }
    c.fill();
    if (!snow) return;
    c.globalAlpha = snowA;
    c.fillStyle = snow;
    c.beginPath();
    for (i = 0; i < tiersData.length; i++) {
      var td = tiersData[i], slope = Math.atan2(td[1] * 0.7, td[2]) * 0.8, n = 3 + ((Math.random() * 4) | 0);
      // la punta del árbol siempre lleva nieve
      if (i === 0) { c.moveTo(x, td[0]); c.lineTo(x + td[2] * 0.5, td[0] + td[1] * 0.45); c.lineTo(x - td[2] * 0.5, td[0] + td[1] * 0.45); c.closePath(); }
      for (j = 0; j < n; j++) {
        var side = Math.random() < 0.5 ? -1 : 1, qq = rand(0.12, 0.85);
        var sx = x + side * td[2] * qq * 0.92, sy = td[0] + td[1] * (0.22 + 0.68 * qq) - td[1] * 0.06;
        var rw = td[2] * rand(0.16, 0.32), rh = rw * rand(0.26, 0.42), rot = side * slope;
        if (c.ellipse) {
          c.moveTo(sx + rw * Math.cos(rot), sy + rw * Math.sin(rot));
          c.ellipse(sx, sy, rw, rh, rot, 0, TAU);
        } else {
          c.moveTo(sx + rh, sy);
          c.arc(sx, sy, rh, 0, TAU);
        }
      }
    }
    c.fill();
    c.globalAlpha = 1;
  }
  function pineRow(c, w, baseY, minH, maxH, fill, snow, snowA, spacing) {
    var x = -30;
    while (x < w + 30) {
      var hh = Math.random() < 0.12 ? maxH * rand(1, 1.25) : rand(minH, maxH);
      pine(c, x, baseY + rand(0, hh * 0.05), hh, typeof fill === 'string' ? fill : pick(fill), snow, snowA * rand(0.8, 1.1));
      x += hh * rand(0.16, 0.36) * (spacing || 1);
    }
  }
  function pinesOnRidge(c, w, pts, minH, maxH, fill) {
    var x = -10;
    while (x < w + 10) {
      var hh = rand(minH, maxH);
      pine(c, x, ridgeAt(pts, w, x) + hh * 0.06, hh, fill, null, 0);
      x += hh * rand(0.2, 0.55);
    }
  }

  /* ---------- cielo ---------- */
  var STAR_COLORS = ['#ffffff', '#ffffff', '#f1f5ff', '#dbe5ff', '#c3d3ff', '#fff3df', '#ffdcb8'];
  function starField(c, w, count, maxY, alpha) {
    var halo = glow('#dfe8ff', 32, 0.1, 0.45);
    for (var i = 0; i < count; i++) {
      var x = Math.random() * w, y = Math.pow(Math.random(), 1.15) * maxY, m = Math.random();
      c.fillStyle = pick(STAR_COLORS);
      if (m < 0.8) {
        c.globalAlpha = rand(0.12, 0.65) * alpha;
        c.fillRect(x, y, 1, 1);
      } else if (m < 0.975) {
        c.globalAlpha = rand(0.4, 0.95) * alpha;
        c.beginPath(); c.arc(x, y, rand(0.6, 1.15), 0, TAU); c.fill();
      } else {
        c.globalAlpha = rand(0.45, 0.85) * alpha;
        c.drawImage(halo, x - 7, y - 7, 14, 14);
        c.beginPath(); c.arc(x, y, 1.3, 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
  function glowLayers(c, x, y, color, layers) {
    for (var i = 0; i < layers.length; i++) {
      var r = layers[i][0];
      c.fillStyle = radial(c, x, y, r, [[0, rgba(color, layers[i][1])], [0.4, rgba(color, layers[i][1] * 0.45)], [1, rgba(color, 0)]]);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function sunDisk(c, x, y, r, glowColor, a) {
    glowLayers(c, x, y, glowColor, [[r * 16, a * 0.35], [r * 6, a * 0.55], [r * 2.4, a * 0.9]]);
    c.fillStyle = radial(c, x, y, r, [[0, '#ffffff'], [0.75, '#fffaf0'], [1, 'rgba(255,248,230,0.9)']]);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function moonDisk(c, x, y, r, glowColor, a) {
    glowLayers(c, x, y, glowColor, [[r * 12, a * 0.28], [r * 3.5, a * 0.45]]);
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.fillStyle = radial(c, x - r * 0.2, y - r * 0.2, r * 1.3, [[0, '#fdfbf3'], [0.7, '#ebe6d6'], [1, '#d6d0bf']]);
    c.fillRect(x - r, y - r, r * 2, r * 2);
    // mares de la luna
    var maria = [[-0.32, -0.18, 0.36], [0.18, 0.08, 0.3], [-0.05, 0.36, 0.22], [0.36, -0.3, 0.17], [-0.42, 0.28, 0.14], [0.05, -0.42, 0.12]];
    for (var i = 0; i < maria.length; i++) {
      var m = maria[i], mx = x + m[0] * r, my = y + m[1] * r, mr = m[2] * r;
      c.fillStyle = radial(c, mx, my, mr, [[0, 'rgba(120,118,128,0.32)'], [0.7, 'rgba(120,118,128,0.18)'], [1, 'rgba(120,118,128,0)']]);
      c.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    c.restore();
  }

  /* Reflejo en agua: copia invertida de una capa, oscurecida y con ondas finas */
  function lakeReflection(c, w, h, top, sources, tint) {
    c.save();
    c.beginPath(); c.rect(0, top, w, h - top); c.clip();
    c.translate(0, top * 2); c.scale(1, -1);
    for (var i = 0; i < sources.length; i++) c.drawImage(sources[i], 0, 0, w, h);
    c.restore();
    c.fillStyle = linear(c, 0, top, 0, h, tint);
    c.fillRect(0, top, w, h - top);
    for (var y = top + 1; y < h; y += rand(1.2, 3) * (1 + (y - top) / (h - top) * 2.5)) {
      c.fillStyle = Math.random() < 0.45 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.13)';
      c.fillRect(rand(-w * 0.2, w), y, rand(w * 0.08, w * 0.6), rand(0.6, 1.4));
    }
  }

  var defs = {};

  /* ======================================================================
     Aurora boreal — cortinas de luz sobre montañas nevadas y un lago
     ====================================================================== */
  function auroraRay(kind) {
    var c = pixCanvas(2, 160), x = c.getContext('2d');
    x.fillStyle = linear(x, 0, 0, 0, 160, kind === 0
      ? [[0, 'rgba(140,60,240,0)'], [0.3, 'rgba(130,70,230,0.16)'], [0.6, 'rgba(40,215,120,0.42)'], [0.86, 'rgba(60,250,135,0.85)'], [0.95, 'rgba(175,255,200,0.95)'], [1, 'rgba(175,255,200,0)']]
      : [[0, 'rgba(255,60,120,0)'], [0.35, 'rgba(235,70,140,0.28)'], [0.75, 'rgba(150,90,240,0.38)'], [1, 'rgba(90,240,160,0)']]);
    x.fillRect(0, 0, 2, 160);
    return c;
  }

  defs.aurora = {
    name: 'Aurora', swatch: 'linear-gradient(180deg,#041026,#1f8f6a 60%,#0a2235)', res: 1,
    create: function () {
      var sky, land, lake, aur, ac, bloom, bc, ribbons, horizon, N, twinkles, light;
      return {
        setup: function (env) {
          var w = env.w, h = env.h;
          light = env.mode === 'light';
          N = makeNoise(7);
          horizon = Math.round(h * 0.74);

          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, horizon, light
            ? [[0, '#121d47'], [0.5, '#2a457f'], [0.85, '#6584b8'], [1, '#9fb6d8']]
            : [[0, '#01030a'], [0.45, '#03102a'], [0.8, '#072238'], [1, '#0e3344']]);
          c.fillRect(0, 0, w, horizon + 4);
          starField(c, w, Math.round(w * h / (light ? 5200 : 1300)), horizon, light ? 0.5 : 1);
          sky = b.canvas;

          var m = buffer(w, h), mc = m.ctx;
          var farBase = horizon - h * 0.08, farAmp = h * 0.15, far = ridge(farBase, farAmp, 8, 0.64);
          fillRidge(mc, w, far, horizon + 2, linear(mc, 0, farBase - farAmp, 0, horizon, light
            ? [[0, '#8397bb'], [1, '#2f4166']] : [[0, '#25344f'], [1, '#0a1220']]));
          snowCaps(mc, w, far, farBase, farAmp, h * 0.055, light ? 'rgba(232,240,255,0.78)' : 'rgba(165,200,225,0.38)');
          if (!light) {
            // luz verdosa de la aurora sobre la nieve
            mc.globalCompositeOperation = 'source-atop';
            mc.fillStyle = linear(mc, 0, farBase - farAmp, 0, horizon, [[0, 'rgba(90,255,170,0.22)'], [1, 'rgba(90,255,170,0)']]);
            mc.fillRect(0, 0, w, horizon);
            mc.globalCompositeOperation = 'source-over';
          }
          var near = ridge(horizon - h * 0.012, h * 0.025, 7);
          fillRidge(mc, w, near, horizon + 2, light ? '#1b2642' : '#02060d');
          pinesOnRidge(mc, w, near, h * 0.02, h * 0.055, light ? '#18223d' : '#02050b');
          land = m.canvas;

          var l = buffer(w, h);
          lakeReflection(l.ctx, w, h, horizon, [sky, land], light
            ? [[0, 'rgba(20,35,75,0.28)'], [1, 'rgba(8,16,40,0.62)']]
            : [[0, 'rgba(0,4,10,0.3)'], [1, 'rgba(0,3,8,0.78)']]);
          lake = l.canvas;

          var q = eco() ? 0.17 : 0.25;
          aur = pixCanvas(Math.max(64, w * q), Math.max(36, h * q)); ac = aur.getContext('2d');
          bloom = pixCanvas(Math.max(16, aur.width / 4), Math.max(9, aur.height / 4)); bc = bloom.getContext('2d');
          ribbons = [
            { y0: 0.58, amp: 0.05, k1: 5.2, k2: 11, s1: 0.06, s2: 0.045, ph: 0.4, hgt: 0.44, a0: -0.15, a1: 1.15, bright: 0.85, ray: auroraRay(0), seed: 1 },
            { y0: 0.47, amp: 0.035, k1: 7, k2: 15, s1: 0.05, s2: 0.07, ph: 2.1, hgt: 0.3, a0: 0.12, a1: 0.9, bright: 0.55, ray: auroraRay(0), seed: 9 },
            { y0: 0.32, amp: 0.04, k1: 4, k2: 9, s1: 0.04, s2: 0.03, ph: 4, hgt: 0.28, a0: 0.35, a1: 1.15, bright: 0.4, ray: auroraRay(1), seed: 17 }
          ];
          twinkles = [];
          for (var i = 0; i < 90; i++) twinkles.push({ x: rand(0, w), y: rand(0, horizon * 0.9), sp: rand(1, 3), ph: rand(0, TAU) });
        },
        draw: function (c, w, h, t) {
          c.drawImage(sky, 0, 0, w, h);
          c.fillStyle = '#ffffff';
          for (var i = 0; i < twinkles.length; i++) {
            var s = twinkles[i], a = Math.max(0, Math.sin(t * s.sp + s.ph));
            c.globalAlpha = a * a * (light ? 0.4 : 0.9);
            c.fillRect(s.x, s.y, 1.4, 1.4);
          }
          c.globalAlpha = 1;

          // cortinas: columnas de rayos con brillo, altura y forma que cambian lentamente
          var aw = aur.width, ah = aur.height;
          ac.clearRect(0, 0, aw, ah);
          for (var r = 0; r < ribbons.length; r++) {
            var rb = ribbons[r];
            for (var x = 0; x < aw; x++) {
              var u = x / aw;
              var env = smooth(rb.a0, rb.a0 + 0.22, u) * (1 - smooth(rb.a1 - 0.22, rb.a1, u));
              if (env <= 0.01) continue;
              var I = env * (0.2 + 0.8 * N.noise(u * 5 + t * 0.05, rb.seed)) * (0.45 + 0.55 * N.noise(u * 70 + t * 0.3, rb.seed + 5));
              if (I < 0.05) continue;
              var yb = (rb.y0 + rb.amp * Math.sin(u * rb.k1 + t * rb.s1 + rb.ph) + rb.amp * 0.6 * Math.sin(u * rb.k2 - t * rb.s2)) * ah;
              var hh = rb.hgt * ah * (0.55 + 0.7 * N.noise(u * 8 - t * 0.04, rb.seed + 3));
              ac.globalAlpha = Math.min(1, I * rb.bright * (light ? 0.55 : 1));
              ac.drawImage(rb.ray, x, yb - hh, 1.6, hh);
            }
          }
          ac.globalAlpha = 1;
          bc.clearRect(0, 0, bloom.width, bloom.height);
          bc.drawImage(aur, 0, 0, bloom.width, bloom.height);
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = 0.5;
          c.drawImage(bloom, 0, 0, w, h);
          c.globalAlpha = 0.9;
          c.drawImage(aur, 0, 0, w, h);
          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';

          c.drawImage(land, 0, 0, w, h);
          c.drawImage(lake, 0, 0, w, h);
          // la aurora reflejada en el lago
          c.save();
          c.beginPath(); c.rect(0, horizon, w, h - horizon); c.clip();
          c.translate(0, horizon * 2); c.scale(1, -1);
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = light ? 0.3 : 0.45;
          c.drawImage(bloom, 0, 0, w, h);
          c.globalAlpha = light ? 0.15 : 0.25;
          c.drawImage(aur, 0, 0, w, h);
          c.restore();
        }
      };
    }
  };

  /* ======================================================================
     Océano — mar abierto en perspectiva, nubes, reflejo y destellos del sol/luna
     ====================================================================== */
  defs.ocean = {
    name: 'Océano', swatch: 'linear-gradient(180deg,#5d97d6,#f3e2cc 48%,#4b86b0 52%,#174a74)', res: 1,
    create: function () {
      var sky, sea, clouds, waves, glints, horizon, sunX, light, P, cloudW, cloudOff = 0, pos = [];
      return {
        setup: function (env) {
          var w = env.w, h = env.h, i;
          light = env.mode === 'light';
          horizon = Math.round(h * 0.57);
          P = light ? {
            sky: [[0, '#2a62ab'], [0.45, '#5a94d4'], [0.82, '#c3d6e6'], [1, '#f2e1cb']],
            glow: '#ffe6b8', seaTop: '#a5c0d3', seaMid: '#4a85af', seaDeep: '#15466f',
            crest: '#ffffff', trough: '#0a2a46', glint: '#fff6dc',
            lit: [255, 251, 246], shade: [150, 160, 186]
          } : {
            sky: [[0, '#02050f'], [0.5, '#0a1430'], [0.85, '#1c2246'], [1, '#30335c']],
            glow: '#c9c8ff', seaTop: '#262b4c', seaMid: '#10172f', seaDeep: '#050914',
            crest: '#c8d3ff', trough: '#000000', glint: '#ebe8ff',
            lit: [152, 160, 198], shade: [24, 28, 56]
          };
          sunX = w * 0.7;
          var sunY = light ? horizon - h * 0.16 : horizon - h * 0.26, R = Math.min(w, h);

          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, horizon, P.sky);
          c.fillRect(0, 0, w, horizon + 2);
          if (light) sunDisk(c, sunX, sunY, R * 0.032, P.glow, 0.8);
          else { starField(c, w, Math.round(w * h / 2600), horizon * 0.8, 0.85); moonDisk(c, sunX, sunY, R * 0.034, P.glow, 0.7); }
          c.fillStyle = linear(c, 0, horizon - h * 0.07, 0, horizon, [[0, rgba(P.seaTop, 0)], [1, rgba(P.seaTop, 0.6)]]);
          c.fillRect(0, horizon - h * 0.07, w, h * 0.07);
          sky = b.canvas;

          clouds = cloudTexture({
            pw: 640, ph: 170, period: 5, seed: 3, cover: 0.52, soft: 0.16, oct: 5, squash: 2.4,
            lit: P.lit, shade: P.shade, alpha: light ? 0.95 : 0.75, band: bandFn(0.3, 0.75),
            ldx: 0.16, ldy: -0.12, contrast: 3.2, thick: 0.7, bottomDark: 0.3
          });
          cloudW = w * 1.6;

          var s = buffer(w, h), sc = s.ctx, sh = h - horizon;
          sc.fillStyle = linear(sc, 0, horizon, 0, h, [[0, P.seaTop], [0.22, P.seaMid], [1, P.seaDeep]]);
          sc.fillRect(0, horizon, w, sh);
          // camino de luz difuso bajo el sol o la luna
          sc.save();
          sc.translate(sunX, horizon);
          sc.scale(1, 5);
          sc.fillStyle = radial(sc, 0, 0, w * 0.09, [[0, rgba(P.glint, light ? 0.35 : 0.25)], [1, rgba(P.glint, 0)]]);
          sc.fillRect(-w * 0.09, 0, w * 0.18, w * 0.09);
          sc.restore();
          // textura fina del agua
          for (i = 0; i < 2600; i++) {
            var z = Math.pow(Math.random(), 0.8), y = horizon + sh * Math.pow(z, 1.9);
            sc.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
            sc.fillRect(rand(0, w), y, (2 + 30 * z) * w / 1920, 0.6 + z);
          }
          sea = s.canvas;

          var n = Math.round(clamp(w * h / 2300, 300, 1000) * (eco() ? 0.6 : 1));
          waves = [];
          for (i = 0; i < n; i++) waves.push({ z: Math.pow(Math.random(), 0.7), u: Math.random(), ph: rand(0, TAU), sp: rand(0.5, 1.4), dr: rand(0.003, 0.01) });
          glints = [];
          for (i = 0; i < (eco() ? 160 : 300); i++) glints.push({ z: Math.pow(Math.random(), 0.75), gx: gauss(), ph: rand(0, TAU), sp: rand(2.5, 6) });
        },
        draw: function (c, w, h, t, dt) {
          var i, sh = h - horizon, ws = w / 1920;
          c.drawImage(sky, 0, 0, w, h);
          cloudOff = (cloudOff + dt * 5 * ws) % cloudW;
          var cy = horizon - h * 0.4, ch = h * 0.38;
          c.drawImage(clouds, -cloudOff, cy, cloudW + 2, ch);
          c.drawImage(clouds, cloudW - cloudOff - 1, cy, cloudW + 2, ch);
          c.drawImage(sea, 0, 0, w, h);

          // oleaje: cada ola es una cresta clara con su valle oscuro, más grandes cuanto más cerca
          for (i = 0; i < waves.length; i++) {
            var wv = waves[i], z = wv.z, bob = Math.sin(t * wv.sp + wv.ph);
            var len = (3 + 75 * Math.pow(z, 1.5)) * ws, th = 0.5 + 2.6 * z;
            var x = ((wv.u + t * wv.dr * (0.3 + z)) % 1) * (w + len) - len;
            var y = horizon + sh * Math.pow(z, 1.9) + bob * z * 2.5;
            pos[i] = [x, y, len, th, bob < -0.3 ? 0 : bob < 0.4 ? 1 : 2];
          }
          // marejada: bandas suaves que avanzan hacia el espectador
          for (var j = 0; j < 7; j++) {
            var zz = (((j / 7) + t * 0.012) % 1 + 1) % 1, yy = horizon + sh * Math.pow(zz, 1.9), bh = 3 + 46 * zz;
            c.fillStyle = linear(c, 0, yy, 0, yy + bh, [[0, rgba(P.crest, 0.06 * zz)], [0.35, rgba(P.trough, 0.1 * zz)], [1, rgba(P.trough, 0)]]);
            c.fillRect(0, yy, w, bh);
          }
          var ca = light ? [0.1, 0.22, 0.38] : [0.06, 0.14, 0.26], ta = light ? [0.07, 0.14, 0.22] : [0.14, 0.22, 0.32];
          for (var bkt = 0; bkt < 3; bkt++) {
            c.fillStyle = rgba(P.trough, ta[bkt]);
            c.beginPath();
            for (i = 0; i < waves.length; i++) {
              var q = pos[i];
              if (q[4] !== bkt) continue;
              c.moveTo(q[0] + q[2] * 0.1, q[1] + q[3] * 0.6);
              c.quadraticCurveTo(q[0] + q[2] * 0.55, q[1] + q[3] * 2.8, q[0] + q[2] * 0.95, q[1] + q[3] * 0.6);
              c.quadraticCurveTo(q[0] + q[2] * 0.55, q[1] + q[3] * 1.2, q[0] + q[2] * 0.1, q[1] + q[3] * 0.6);
            }
            c.fill();
            c.fillStyle = rgba(P.crest, ca[bkt]);
            c.beginPath();
            for (i = 0; i < waves.length; i++) {
              var r2 = pos[i];
              if (r2[4] !== bkt) continue;
              c.moveTo(r2[0], r2[1]);
              c.quadraticCurveTo(r2[0] + r2[2] * 0.5, r2[1] - r2[3] * 1.6, r2[0] + r2[2], r2[1]);
              c.quadraticCurveTo(r2[0] + r2[2] * 0.5, r2[1] + r2[3] * 0.5, r2[0], r2[1]);
            }
            c.fill();
          }

          // destellos del sol/luna sobre el agua
          c.globalCompositeOperation = 'lighter';
          for (i = 0; i < glints.length; i++) {
            var g = glints[i], f = Math.sin(t * g.sp + g.ph);
            if (f < 0.55) continue;
            var a = (f - 0.55) / 0.45, gz = g.z;
            var gy = horizon + sh * Math.pow(gz, 1.9), gx = sunX + g.gx * (0.012 + 0.13 * gz) * w;
            var gl = (2 + 34 * gz) * ws;
            c.fillStyle = rgba(P.glint, a * a * (light ? 0.95 : 0.85));
            c.fillRect(gx - gl / 2, gy, gl, 0.7 + 1.8 * gz);
          }
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = rgba(P.glint, light ? 0.35 : 0.18);
          c.fillRect(0, horizon, w, 1);
        }
      };
    }
  };

  /* ======================================================================
     Cielo — tres capas de nubes volumétricas, sol o luna y aves de paso
     ====================================================================== */
  defs.clouds = {
    name: 'Cielo', swatch: 'linear-gradient(180deg,#3f8fdc,#a9d3f5 60%,#ffffff)', res: 0.75,
    create: function () {
      var sky, layers, birds = null, nextBirds = 6, light;
      return {
        setup: function (env) {
          var w = env.w, h = env.h, R = Math.min(w, h);
          light = env.mode === 'light';
          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, h, light
            ? [[0, '#2465c2'], [0.5, '#5a98df'], [0.85, '#a7cbee'], [1, '#d6e8f7']]
            : [[0, '#02040c'], [0.55, '#0b1430'], [1, '#222f55']]);
          c.fillRect(0, 0, w, h);
          if (light) {
            sunDisk(c, w * 0.82, h * 0.14, R * 0.035, '#fff3cf', 0.85);
          } else {
            starField(c, w, Math.round(w * h / 2400), h * 0.85, 0.85);
            moonDisk(c, w * 0.8, h * 0.16, R * 0.036, '#c6cdf5', 0.75);
          }
          sky = b.canvas;

          var lit = light ? [255, 255, 255] : [192, 200, 232], shade = light ? [140, 156, 186] : [30, 36, 66];
          var haze = light ? [208, 228, 246] : [40, 52, 92], al = light ? 1 : 0.85;
          // la base de los cúmulos es plana pero suave
          function flatBase(top, base) { return function (v) { return smooth(0, top, v) * (1 - smooth(base - 0.2, base, v)); }; }
          // alto de la textura proporcional a cómo se dibuja (16:9) para que no se estire
          function texH(pw, wm, hgt) { return Math.round(pw * (hgt * 9) / (wm * 16)); }
          layers = [
            { tex: cloudTexture({ pw: 900, ph: texH(900, 1.4, 0.26), period: 8, seed: 11, cover: 0.48, soft: 0.16, oct: 5, squash: 2.6, lit: mixArr(lit, haze, 0.4), shade: mixArr(shade, haze, 0.5), alpha: 0.88 * al, band: flatBase(0.3, 0.92), ldx: 0.14, ldy: -0.1, contrast: 2.8, thick: 0.6, bottomDark: 0.25 }),
              y: 0.5, hgt: 0.26, wm: 1.4, speed: 3 },
            { tex: cloudTexture({ pw: 1100, ph: texH(1100, 1.6, 0.46), period: 7, seed: 23, cover: 0.485, soft: 0.13, oct: 6, squash: 2, lit: lit, shade: shade, alpha: 0.98 * al, band: flatBase(0.3, 0.88), ldx: 0.13, ldy: -0.2, contrast: 3.8, thick: 1, bottomDark: 0.42 }),
              y: 0.2, hgt: 0.46, wm: 1.6, speed: 7 },
            { tex: cloudTexture({ pw: 1050, ph: texH(1050, 1.9, 0.5), period: 6, seed: 41, cover: 0.505, soft: 0.12, oct: 6, squash: 2.4, lit: lit, shade: shade, alpha: 0.97 * al, band: flatBase(0.28, 0.9), ldx: 0.13, ldy: -0.2, contrast: 4, thick: 1.1, bottomDark: 0.45 }),
              y: -0.06, hgt: 0.5, wm: 1.9, speed: 13 }
          ];
          for (var j = 0; j < layers.length; j++) layers[j].off = rand(0, layers[j].wm * w);
        },
        draw: function (c, w, h, t, dt) {
          c.drawImage(sky, 0, 0, w, h);
          var ws = w / 1920;
          for (var i = 0; i < layers.length; i++) {
            var L = layers[i], lw = L.wm * w;
            L.off = (L.off + dt * L.speed * ws) % lw;
            c.drawImage(L.tex, -L.off, L.y * h, lw + 2, L.hgt * h);
            c.drawImage(L.tex, lw - L.off - 1, L.y * h, lw + 2, L.hgt * h);
            if (i === 0 && light) drawBirds(c, w, h, t, dt);
          }
        }
      };
      /* Una bandada en V cruza el cielo de vez en cuando */
      function drawBirds(c, w, h, t, dt) {
        if (!birds) {
          if (t < nextBirds) return;
          var n = 5 + ((Math.random() * 5) | 0), y0 = rand(0.12, 0.4) * h, k = rand(0.7, 1.2) * h / 1080;
          birds = { x: -80, y: y0, vx: rand(28, 42) * w / 1920, k: k, list: [] };
          for (var i = 0; i < n; i++) birds.list.push({ dx: -Math.abs(i - n / 2) * 16 * k - i * 3 * k, dy: (i - n / 2) * 9 * k, ph: rand(0, TAU), sp: rand(7, 9) });
        }
        birds.x += birds.vx * dt;
        birds.y += Math.sin(t * 0.3) * 4 * dt;
        c.strokeStyle = 'rgba(28,36,52,0.75)';
        c.lineWidth = 1.4 * birds.k;
        c.lineCap = 'round';
        c.beginPath();
        for (var j = 0; j < birds.list.length; j++) {
          var b = birds.list[j], x = birds.x + b.dx, y = birds.y + b.dy, f = Math.sin(t * b.sp + b.ph) * 4 * birds.k, s = 7 * birds.k;
          c.moveTo(x - s, y + f);
          c.quadraticCurveTo(x - s * 0.4, y - Math.abs(f) * 0.3 - 1, x, y);
          c.quadraticCurveTo(x + s * 0.4, y - Math.abs(f) * 0.3 - 1, x + s, y + f);
        }
        c.stroke();
        if (birds.x > w + 200) { birds = null; nextBirds = t + rand(25, 60); }
      }
    }
  };

  /* ======================================================================
     Lluvia — gotas sobre una ventana con la ciudad desenfocada detrás.
     Las gotas grandes refractan (invierten) la escena y resbalan dejando rastro.
     ====================================================================== */
  function microDrop(m, x, y, r, light) {
    m.fillStyle = light ? 'rgba(40,52,64,0.22)' : 'rgba(0,0,0,0.38)';
    m.beginPath(); m.arc(x, y + r * 0.3, r, 0, TAU); m.fill();
    m.fillStyle = light ? 'rgba(255,255,255,0.32)' : 'rgba(205,220,255,0.16)';
    m.beginPath(); m.arc(x, y, r * 0.88, 0, TAU); m.fill();
    m.fillStyle = 'rgba(255,255,255,0.6)';
    m.beginPath(); m.arc(x - r * 0.3, y - r * 0.32, Math.max(0.35, r * 0.26), 0, TAU); m.fill();
  }
  function dropShade(light) {
    var c = pixCanvas(64, 64), x = c.getContext('2d');
    var g = x.createRadialGradient(32, 26, 6, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.04)');
    g.addColorStop(0.9, light ? 'rgba(25,35,45,0.4)' : 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = radial(x, 23, 19, 11, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(12, 8, 22, 22);
    x.fillStyle = radial(x, 32, 50, 12, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(20, 38, 24, 24);
    return c;
  }

  defs.rain = {
    name: 'Lluvia', swatch: 'linear-gradient(180deg,#1e2a3a,#4a5d78)', res: 1,
    create: function () {
      var bgPx, micro, mc, drops, streaks, shade, light, k, spawn = 0, evap = 0;
      function resetDrop(d, w, h, top) {
        d.x = rand(0, w);
        d.y = top ? rand(-h * 0.1, h * 0.5) : rand(0, h);
        d.r = (Math.random() < 0.7 ? rand(4, 9) : rand(9, 17)) * k;
        d.vy = 0;
        d.stuck = rand(0.3, 5);
        d.ph = rand(0, TAU);
      }
      return {
        setup: function (env) {
          var w = env.w, h = env.h, i;
          light = env.mode === 'light';
          k = Math.max(0.6, h / 1080);

          // escena de fondo: se pinta nítida y luego se desenfoca, como vista a través del vidrio mojado
          var sharp = buffer(w, h), s = sharp.ctx;
          if (!light) {
            for (i = 0; i < 22; i++) {
              var bw = rand(0.04, 0.12) * w, bh = rand(0.25, 0.7) * h, bx = rand(-bw, w), by = h * 0.8 - bh;
              s.fillStyle = pick(['#0b111d', '#0e1524', '#090e18', '#121a2a']);
              s.fillRect(bx, by, bw, h);
              var cw = rand(9, 14) * k, rh = rand(12, 18) * k;
              for (var wy = by + rh * 0.6; wy < h * 0.78; wy += rh) {
                for (var wx = bx + cw * 0.4; wx < bx + bw - cw * 0.6; wx += cw) {
                  if (Math.random() < 0.32) {
                    s.globalAlpha = rand(0.4, 1);
                    s.fillStyle = pick(['#ffcf7a', '#ffd99a', '#ffe6b8', '#9fd3ff', '#fff1c8', '#ffb35c']);
                    s.fillRect(wx, wy, cw * 0.55, rh * 0.5);
                  }
                }
              }
              s.globalAlpha = 1;
            }
            s.fillStyle = '#121219';
            s.fillRect(0, h * 0.8, w, h * 0.2);
            for (i = 0; i < 40; i++) {
              s.fillStyle = pick(['#ff3b30', '#ffefc2', '#ff9f43', '#ff3b30']);
              s.fillRect(rand(0, w), h * rand(0.82, 0.95), rand(6, 16) * k, rand(3, 6) * k);
            }
          } else {
            for (i = 0; i < 520; i++) {
              s.globalAlpha = rand(0.55, 0.95);
              s.fillStyle = pick(['#5f7d5a', '#738f69', '#4f6b4d', '#8aa27d', '#6d8a73', '#9db58c', '#46613f']);
              var lx = rand(-20, w + 20), ly = h * (0.32 + 0.5 * Math.pow(Math.random(), 0.7));
              s.beginPath(); s.arc(lx, ly, rand(6, 34) * k, 0, TAU); s.fill();
            }
            s.globalAlpha = 1;
            s.fillStyle = '#7f9672';
            s.fillRect(0, h * 0.86, w, h * 0.14);
          }
          var bg = buffer(w, h), bc = bg.ctx;
          bc.fillStyle = linear(bc, 0, 0, 0, h, light
            ? [[0, '#c6d0da'], [0.55, '#d4dce3'], [1, '#aab8ad']]
            : [[0, '#0a111f'], [0.55, '#141c2d'], [1, '#1b2030']]);
          bc.fillRect(0, 0, w, h);
          drawBlurred(bc, sharp.canvas, w, h, light ? 22 : 14);
          // luces desenfocadas (bokeh)
          var cols = light ? ['#ffffff', '#f6f8f2', '#eef4e6'] : ['#ffb35c', '#ffd98a', '#ff7a52', '#8fd0ff', '#fff1d0', '#ff4f4f', '#b3ffcf'];
          var discs = {};
          bc.globalCompositeOperation = light ? 'source-over' : 'lighter';
          for (i = 0; i < Math.round(w * h / 22000); i++) {
            var col = pick(cols), r = rand(12, 55) * k;
            if (!discs[col]) discs[col] = bokehDisc(col, 64);
            bc.globalAlpha = light ? rand(0.12, 0.28) : rand(0.15, 0.45);
            bc.drawImage(discs[col], rand(-r, w), rand(light ? 0 : h * 0.15, h) - r, r * 2, r * 2);
          }
          bc.globalAlpha = 1;
          bc.globalCompositeOperation = 'source-over';
          // vaho del vidrio
          bc.fillStyle = light ? 'rgba(255,255,255,0.12)' : 'rgba(150,170,200,0.05)';
          bc.fillRect(0, 0, w, h);
          bgPx = bg.canvas;

          var m = buffer(w, h);
          micro = m.canvas; mc = m.ctx;
          for (i = 0; i < Math.round(w * h / (eco() ? 1800 : 1000)); i++) microDrop(mc, rand(0, w), rand(0, h), (Math.random() < 0.8 ? rand(0.6, 2.2) : rand(2.2, 4)) * k, light);

          shade = dropShade(light);
          drops = [];
          var n = Math.round(w * h / (eco() ? 55000 : 30000));
          for (i = 0; i < n; i++) { var d = {}; resetDrop(d, w, h, false); drops.push(d); }
          streaks = [];
          for (i = 0; i < 150; i++) streaks.push({ x: rand(0, w), y: rand(0, h), len: rand(10, 26) * k, v: rand(600, 900) * k });
        },
        draw: function (c, w, h, t, dt) {
          var i;
          c.drawImage(bgPx, 0, 0, w, h);

          // lluvia que cae afuera, al otro lado del vidrio
          c.strokeStyle = light ? 'rgba(255,255,255,0.28)' : 'rgba(170,190,225,0.13)';
          c.lineWidth = 1;
          c.beginPath();
          for (i = 0; i < streaks.length; i++) {
            var s = streaks[i];
            s.y += s.v * dt; s.x += s.v * 0.08 * dt;
            if (s.y > h) { s.y = -s.len; s.x = rand(-w * 0.1, w); }
            c.moveTo(s.x, s.y); c.lineTo(s.x - s.len * 0.08, s.y - s.len);
          }
          c.stroke();

          // nuevas microgotas y evaporación lenta
          spawn += dt * (w * h / 2073600) * (eco() ? 14 : 24);
          while (spawn >= 1) { microDrop(mc, rand(0, w), rand(0, h), rand(0.6, 2.6) * k, light); spawn -= 1; }
          evap += dt;
          if (evap > 1.5) {
            evap = 0;
            mc.globalCompositeOperation = 'destination-out';
            mc.fillStyle = 'rgba(0,0,0,0.035)';
            mc.fillRect(0, 0, w, h);
            mc.globalCompositeOperation = 'source-over';
          }

          c.drawImage(micro, 0, 0, w, h);

          // gotas grandes: se quedan pegadas, luego resbalan a tirones limpiando el vidrio
          for (i = 0; i < drops.length; i++) {
            var d = drops[i];
            if (d.stuck > 0) {
              d.stuck -= dt;
              if (d.r < 6 * k && Math.random() < dt * 0.05) d.r += 0.5 * k;
            } else if (d.r >= 6 * k) {
              d.vy = Math.min(d.vy + 260 * dt * k, (40 + d.r * 24) * k);
              var dy = d.vy * dt;
              d.y += dy;
              d.x += Math.sin(d.y * 0.04 + d.ph) * 0.3;
              mc.globalCompositeOperation = 'destination-out';
              mc.beginPath(); mc.arc(d.x, d.y, d.r * 0.95, 0, TAU); mc.fill();
              mc.globalCompositeOperation = 'source-over';
              if (Math.random() < dt * 12) microDrop(mc, d.x + rand(-d.r * 0.25, d.r * 0.25), d.y - d.r * rand(1.8, 3.5), rand(0.4, d.r * 0.32), light);
              d.r = Math.max(4 * k, d.r - dy * 0.0018);
              if (Math.random() < dt * 0.9) { d.stuck = rand(0.05, 0.9); d.vy = 0; }
            } else {
              d.stuck = rand(1, 5);
            }
            if (d.y - d.r > h) resetDrop(d, w, h, true);
            drawDrop(c, d);
          }
        }
      };
      function drawDrop(c, d) {
        var rx = d.r, ry = d.r * 1.12;
        c.save();
        c.beginPath();
        if (c.ellipse) c.ellipse(d.x, d.y, rx, ry, 0, 0, TAU); else c.arc(d.x, d.y, rx, 0, TAU);
        c.clip();
        // refracción: la escena de atrás se ve invertida y comprimida dentro de la gota
        var R = d.r * 4, ss = Math.min(2 * R * scale, bgPx.width, bgPx.height);
        var sx = clamp((d.x - R) * scale, 0, bgPx.width - ss), sy = clamp((d.y - R) * scale, 0, bgPx.height - ss);
        c.translate(d.x, d.y);
        c.scale(1, -1);
        c.drawImage(bgPx, sx, sy, ss, ss, -rx, -ry, rx * 2, ry * 2);
        c.restore();
        c.drawImage(shade, d.x - rx * 1.08, d.y - ry * 1.08, rx * 2.16, ry * 2.16);
      }
    }
  };

  /* ======================================================================
     Nieve — bosque de pinos nevados en capas con niebla, profundidad de campo
     ====================================================================== */
  defs.snow = {
    name: 'Nieve', swatch: 'linear-gradient(180deg,#1b2b45,#9fb3cf)', res: 1,
    create: function () {
      var bg, fg, far, mid, near, sprite, bokeh, sparkles, light, k;
      function makeFlake(w, h, layer, anywhere) {
        var f = { layer: layer };
        f.x = rand(-20, w + 20);
        f.y = anywhere ? rand(-20, h) : rand(-60, -10);
        if (layer === 0) { f.r = rand(0.5, 1.3); f.vy = rand(18, 34); f.depth = 0.35; }
        else if (layer === 1) { f.r = rand(1.4, 2.8); f.vy = rand(36, 60); f.depth = 0.7; }
        else { f.r = rand(9, 22); f.vy = rand(70, 110); f.depth = 1.3; }
        f.r *= k; f.vy *= k;
        f.amp = rand(10, 30); f.sw = rand(0.3, 0.9); f.ph = rand(0, TAU);
        f.a = layer === 2 ? rand(0.15, 0.32) : Math.min(1, 0.4 + f.r * 0.22 / k);
        return f;
      }
      function mist(c, w, h, y0, y1, color, a) {
        c.fillStyle = linear(c, 0, y0, 0, y1, [[0, rgba(color, 0)], [0.55, rgba(color, a)], [1, rgba(color, 0)]]);
        c.fillRect(0, y0, w, y1 - y0);
      }
      return {
        setup: function (env) {
          var w = env.w, h = env.h, i, R = Math.min(w, h);
          light = env.mode === 'light';
          k = Math.max(0.6, h / 1080);
          var mistC = light ? '#eef2f7' : '#7f97bd';

          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, h, light
            ? [[0, '#8799b2'], [0.5, '#b2bfcf'], [1, '#dde4ec']]
            : [[0, '#050c1a'], [0.5, '#102039'], [1, '#253a5c']]);
          c.fillRect(0, 0, w, h);
          if (light) glowLayers(c, w * 0.68, h * 0.2, '#ffffff', [[R * 0.6, 0.35], [R * 0.18, 0.4]]);
          else { starField(c, w, Math.round(w * h / 4200), h * 0.5, 0.75); moonDisk(c, w * 0.2, h * 0.17, R * 0.035, '#b8c8ef', 0.7); }
          // cada capa se pinta aparte y se desenfoca más cuanto más lejos está
          var L1 = buffer(w, h), l1 = L1.ctx;
          var fb = h * 0.6, fa = h * 0.14, fr = ridge(fb, fa, 8, 0.62);
          fillRidge(l1, w, fr, h, linear(l1, 0, fb - fa, 0, fb + h * 0.1, light ? [[0, '#c5cfdc'], [1, '#9eadc0']] : [[0, '#3b4f72'], [1, '#1d2b45']]));
          snowCaps(l1, w, fr, fb, fa, h * 0.07, light ? 'rgba(250,252,255,0.88)' : 'rgba(190,210,240,0.45)');
          drawBlurred(c, L1.canvas, w, h, 1.6);
          mist(c, w, h, h * 0.55, h * 0.74, mistC, light ? 0.7 : 0.25);

          var L2 = buffer(w, h), l2 = L2.ctx;
          pineRow(l2, w, h * 0.72, h * 0.04, h * 0.1, light ? ['#8a99ad', '#8294a9', '#93a1b4'] : ['#2a3a56', '#26354f', '#2f405d'], light ? '#f2f5f9' : '#9db1d1', light ? 0.55 : 0.45, 0.9);
          l2.fillStyle = light ? '#d5dde7' : '#2c3d5c';
          l2.fillRect(0, h * 0.72, w, h);
          drawBlurred(c, L2.canvas, w, h, 1.2);
          mist(c, w, h, h * 0.66, h * 0.82, mistC, light ? 0.6 : 0.22);

          var L3 = buffer(w, h), l3 = L3.ctx;
          pineRow(l3, w, h * 0.81, h * 0.08, h * 0.17, light ? ['#5f7088', '#566880', '#687a92'] : ['#18263d', '#152238', '#1c2b45'], light ? '#f4f7fb' : '#a5b8d6', light ? 0.72 : 0.58, 1.1);
          l3.fillStyle = linear(l3, 0, h * 0.81, 0, h, light ? [[0, '#e3e9f0'], [1, '#eef2f7']] : [[0, '#344868'], [1, '#3d5276']]);
          l3.fillRect(0, h * 0.81, w, h);
          drawBlurred(c, L3.canvas, w, h, 0.5);
          mist(c, w, h, h * 0.76, h * 0.9, mistC, light ? 0.4 : 0.15);
          bg = b.canvas;

          var f0 = buffer(w, h), fc0 = f0.ctx;
          var x = -40;
          while (x < w + 40) {
            // pinos cercanos solo en los costados: enmarcan la escena
            var edge = Math.min(x, w - x) / w;
            if (edge < 0.2) pine(fc0, x, h * 0.98, rand(0.22, 0.4) * h, light ? pick(['#3a495e', '#34435a']) : pick(['#0b1424', '#0e182a']), light ? '#ffffff' : '#c3d2ea', light ? 0.85 : 0.7);
            x += rand(0.035, 0.08) * w;
          }
          var f = buffer(w, h), fc = f.ctx;
          drawBlurred(fc, f0.canvas, w, h, 1.5);
          fc.fillStyle = linear(fc, 0, h * 0.9, 0, h, light ? [[0, '#eef2f7'], [1, '#fbfcfe']] : [[0, '#425679'], [1, '#5c7098']]);
          fc.beginPath();
          fc.moveTo(0, h);
          fc.lineTo(0, h * 0.95);
          fc.quadraticCurveTo(w * 0.25, h * 0.9, w * 0.5, h * 0.935);
          fc.quadraticCurveTo(w * 0.78, h * 0.97, w, h * 0.925);
          fc.lineTo(w, h);
          fc.fill();
          fg = f.canvas;
          sparkles = [];
          for (i = 0; i < 70; i++) sparkles.push({ x: rand(0, w), y: rand(h * 0.94, h), ph: rand(0, TAU), sp: rand(0.6, 1.6) });

          sprite = glow('#ffffff', 32, 0.35, 0.85);
          bokeh = bokehDisc('#ffffff', 64);
          var e = eco() ? 0.55 : 1;
          far = []; mid = []; near = [];
          for (i = 0; i < Math.round(w * h / 5200 * e); i++) far.push(makeFlake(w, h, 0, true));
          for (i = 0; i < Math.round(w * h / 15000 * e); i++) mid.push(makeFlake(w, h, 1, true));
          for (i = 0; i < Math.round(14 * e); i++) near.push(makeFlake(w, h, 2, true));
        },
        draw: function (c, w, h, t, dt) {
          var wind = (16 + 26 * Math.sin(t * 0.06) + 10 * Math.sin(t * 0.21 + 1)) * k;
          c.drawImage(bg, 0, 0, w, h);
          flakes(c, far, sprite, w, h, t, dt, wind);
          c.drawImage(fg, 0, 0, w, h);
          // destellos en la nieve
          c.fillStyle = '#ffffff';
          for (var i = 0; i < sparkles.length; i++) {
            var s = sparkles[i], a = Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 14);
            if (a < 0.05) continue;
            c.globalAlpha = a;
            c.fillRect(s.x - 1, s.y, 2.2, 0.8);
            c.fillRect(s.x, s.y - 0.7, 0.8, 2.2);
          }
          c.globalAlpha = 1;
          flakes(c, mid, sprite, w, h, t, dt, wind);
          flakes(c, near, bokeh, w, h, t, dt, wind);
          c.globalAlpha = 1;
        }
      };
      function flakes(c, list, img, w, h, t, dt, wind) {
        for (var i = 0; i < list.length; i++) {
          var f = list[i];
          f.y += f.vy * dt;
          f.x += (wind * f.depth + Math.sin(t * f.sw + f.ph) * f.amp) * dt;
          if (f.y > h + f.r * 2) { var n = makeFlake(w, h, f.layer, false); for (var key in n) f[key] = n[key]; }
          if (f.x > w + 40) f.x = -40; else if (f.x < -40) f.x = w + 40;
          var s = f.r * (f.layer === 2 ? 2 : 4);
          c.globalAlpha = f.a;
          c.drawImage(img, f.x - s / 2, f.y - s / 2, s, s);
        }
      }
    }
  };

  /* ======================================================================
     Noche estrellada — Vía Láctea con polvo cósmico, montañas y lago
     (en modo claro: amanecer)
     ====================================================================== */
  function milkyWay(c, w, h, alpha) {
    var e = eco() ? 0.6 : 1, pw = Math.round(640 * e), ph = Math.round(190 * e);
    var key = 'mw' + pw;
    var tex = texCache[key];
    if (!tex) {
      var N = makeNoise(29), glowC = pixCanvas(pw, ph), dustC = pixCanvas(pw, ph);
      var g = glowC.getContext('2d'), gd = g.createImageData(pw, ph), dd = dustC.getContext('2d'), du = dd.createImageData(pw, ph);
      for (var y = 0; y < ph; y++) {
        var v = (y / ph - 0.5) * 2, across = Math.exp(-v * v * 3.4);
        for (var x = 0; x < pw; x++) {
          var u = x / pw, i = (y * pw + x) * 4;
          var core = Math.exp(-((u - 0.62) * (u - 0.62)) / 0.025);
          var n = N.fbm(u * 7, y / ph * 2.2, 5);
          var bright = across * (0.25 + 1.1 * n * n) * (0.75 + 0.8 * core);
          gd.data[i] = 175 + 80 * core; gd.data[i + 1] = 185 + 35 * core; gd.data[i + 2] = 255 - 70 * core;
          gd.data[i + 3] = clamp(bright * 0.85, 0, 1) * 255;
          var dn = N.fbm(u * 11 + 17, y / ph * 3.4 + 5, 4);
          var dust = smooth(0.47, 0.68, dn) * Math.exp(-v * v * 7) * (0.6 + 0.5 * core);
          du.data[i] = 4; du.data[i + 1] = 6; du.data[i + 2] = 16;
          du.data[i + 3] = clamp(dust * 0.9, 0, 1) * 255;
        }
      }
      g.putImageData(gd, 0, 0);
      dd.putImageData(du, 0, 0);
      tex = texCache[key] = { glow: glowC, dust: dustC };
    }
    var L = Math.max(w, h) * 1.7, B = h * 0.46;
    c.save();
    c.translate(w * 0.5, h * 0.42);
    c.rotate(-0.52);
    c.globalAlpha = alpha;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(tex.glow, -L / 2, -B / 2, L, B);
    // nubes de estrellas concentradas en la banda
    c.fillStyle = '#ffffff';
    for (var s = 0; s < Math.round(w * h / 450); s++) {
      c.globalAlpha = rand(0.08, 0.6) * alpha;
      c.fillRect(rand(-L / 2, L / 2), gauss() * B * 0.32, 1, 1);
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = alpha;
    c.drawImage(tex.dust, -L / 2, -B / 2, L, B);
    c.restore();
    c.globalAlpha = 1;
  }

  defs.stars = {
    name: 'Noche estrellada', swatch: 'radial-gradient(circle at 30% 30%,#ffffff 0 2%,transparent 3%),linear-gradient(180deg,#02030c,#2a2350)', res: 1,
    create: function () {
      var sky, land, twk, shooting = null, nextShot = 3, sat = null, nextSat = 12, light, horizon;
      return {
        setup: function (env) {
          var w = env.w, h = env.h, i;
          light = env.mode === 'light';
          horizon = Math.round(h * 0.8);
          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, horizon, light
            ? [[0, '#1b285a'], [0.4, '#474d8c'], [0.7, '#b07898'], [0.88, '#efa688'], [1, '#ffd2a0']]
            : [[0, '#010209'], [0.45, '#030a1d'], [0.78, '#0a1330'], [0.93, '#141e38'], [1, '#22303f']]);
          c.fillRect(0, 0, w, horizon + 4);
          if (!light) {
            // resplandor atmosférico verde y luz lejana en el horizonte
            c.fillStyle = linear(c, 0, horizon * 0.72, 0, horizon, [[0, 'rgba(70,150,110,0)'], [0.7, 'rgba(70,150,110,0.12)'], [1, 'rgba(255,170,120,0.14)']]);
            c.fillRect(0, horizon * 0.72, w, horizon * 0.28 + 4);
          }
          milkyWay(c, w, h, light ? 0.16 : 1);
          starField(c, w, Math.round(w * h / (light ? 6500 : 800)), light ? horizon * 0.55 : horizon, light ? 0.5 : 1);
          if (!light) {
            // estrellas brillantes con destello en cruz
            for (i = 0; i < 9; i++) {
              var sx = rand(0, w), sy = rand(0, horizon * 0.85), sl = rand(4, 9);
              c.globalCompositeOperation = 'lighter';
              glowLayers(c, sx, sy, pick(['#cfe0ff', '#fff2dd', '#ffffff']), [[sl, 0.5]]);
              c.fillStyle = 'rgba(255,255,255,0.35)';
              c.fillRect(sx - sl, sy - 0.3, sl * 2, 0.6);
              c.fillRect(sx - 0.3, sy - sl, 0.6, sl * 2);
              c.globalCompositeOperation = 'source-over';
            }
          }
          sky = b.canvas;

          var m = buffer(w, h), mc = m.ctx;
          var fb = horizon - h * 0.08, fa = h * 0.1, far = ridge(fb, fa, 8);
          fillRidge(mc, w, far, horizon + 2, linear(mc, 0, fb - fa, 0, horizon, light ? [[0, '#7f72a2'], [1, '#5c5488']] : [[0, '#121a33'], [1, '#090e1e']]));
          if (light) snowCaps(mc, w, far, fb, fa, h * 0.035, 'rgba(255,214,200,0.5)');
          var near = ridge(horizon - h * 0.03, h * 0.05, 7);
          fillRidge(mc, w, near, horizon + 2, light ? '#3d3966' : '#05080f');
          pinesOnRidge(mc, w, near, h * 0.018, h * 0.045, light ? '#37335d' : '#03050b');
          var l = buffer(w, h), lc = l.ctx;
          lc.drawImage(m.canvas, 0, 0, w, h);
          lakeReflection(lc, w, h, horizon, [sky, m.canvas], light
            ? [[0, 'rgba(60,40,90,0.25)'], [1, 'rgba(30,25,60,0.6)']]
            : [[0, 'rgba(0,2,8,0.35)'], [1, 'rgba(0,2,8,0.8)']]);
          land = l.canvas;

          twk = [];
          for (i = 0; i < 320; i++) {
            twk.push({ x: rand(0, w), y: Math.pow(Math.random(), 1.2) * horizon * (light ? 0.5 : 0.95), r: Math.random() < 0.85 ? 1 : 1.6,
              sp: rand(0.5, 2.6), ph: rand(0, TAU), a: rand(0.4, 1), col: pick(STAR_COLORS) });
          }
        },
        draw: function (c, w, h, t, dt) {
          c.drawImage(sky, 0, 0, w, h);
          var fade = light ? 0.4 : 1, i;
          for (i = 0; i < twk.length; i++) {
            var s = twk[i], a = s.a * (0.45 + 0.55 * Math.sin(t * s.sp + s.ph)) * fade;
            if (a <= 0.02) continue;
            c.globalAlpha = a;
            c.fillStyle = s.col;
            c.fillRect(s.x, s.y, s.r, s.r);
          }
          c.globalAlpha = 1;
          // satélite cruzando despacio
          if (!sat && t > nextSat && !light) sat = { x: -10, y: rand(0.08, 0.4) * h, vx: rand(18, 30) * w / 1920, vy: rand(-3, 3) };
          if (sat) {
            sat.x += sat.vx * dt; sat.y += sat.vy * dt;
            c.fillStyle = 'rgba(255,255,255,0.8)';
            c.fillRect(sat.x, sat.y, 1.6, 1.6);
            if (sat.x > w + 10) { sat = null; nextSat = t + rand(30, 70); }
          }
          // estrella fugaz
          if (!shooting && t > nextShot) {
            var sp = rand(650, 950) * (h / 1080 * 0.6 + 0.4);
            shooting = { x: rand(w * 0.3, w * 1.05), y: rand(0, h * 0.35), vx: -sp, vy: sp * rand(0.35, 0.55), life: 0, dur: rand(0.7, 1.2) };
          }
          if (shooting) {
            var sh = shooting;
            sh.life += dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
            var p = sh.life / sh.dur;
            if (p >= 1) { shooting = null; nextShot = t + rand(5, 14); }
            else {
              var al = Math.sin(p * Math.PI) * (light ? 0.6 : 0.95);
              var tx = sh.x - sh.vx * 0.14, ty = sh.y - sh.vy * 0.14;
              c.strokeStyle = linear(c, sh.x, sh.y, tx, ty, [[0, 'rgba(255,255,255,' + al + ')'], [1, 'rgba(255,255,255,0)']]);
              c.lineWidth = 1.6; c.lineCap = 'round';
              c.beginPath(); c.moveTo(sh.x, sh.y); c.lineTo(tx, ty); c.stroke();
            }
          }
          c.drawImage(land, 0, 0, w, h);
        }
      };
    }
  };

  /* ======================================================================
     Luciérnagas — de noche: bosque con luz de luna y luciérnagas que parpadean;
     de día: pradera con flores, pasto que se mece, semillas y mariposas
     ====================================================================== */
  function trunk(c, x, top, bottom, wd, color) {
    var bend = rand(-wd * 0.8, wd * 0.8);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x - wd * 0.42, top);
    c.quadraticCurveTo(x - wd * 0.5 + bend, (top + bottom) / 2, x - wd * 0.62, bottom);
    c.lineTo(x + wd * 0.62, bottom);
    c.quadraticCurveTo(x + wd * 0.5 + bend, (top + bottom) / 2, x + wd * 0.42, top);
    c.closePath();
    c.fill();
  }
  function grassBlades(c, w, baseY, height, color, density) {
    c.strokeStyle = color;
    c.lineCap = 'round';
    for (var x = -10; x < w + 10; x += rand(1.5, 4.5) / density) {
      var bh = rand(0.3, 1) * height, lean = rand(-0.35, 0.35) * bh;
      c.lineWidth = rand(0.8, 2.4);
      c.beginPath();
      c.moveTo(x, baseY + 4);
      c.quadraticCurveTo(x + lean * 0.2, baseY - bh * 0.6, x + lean, baseY - bh);
      c.stroke();
    }
  }
  function fern(c, x, y, size, color, dir) {
    c.strokeStyle = color; c.lineWidth = Math.max(1, size * 0.012); c.lineCap = 'round';
    var ex = x + dir * size * 0.8, ey = y - size * 0.55;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + dir * size * 0.3, y - size * 0.6, ex, ey); c.stroke();
    for (var i = 1; i < 14; i++) {
      var p = i / 14, px = x + (ex - x) * p + dir * size * 0.1 * Math.sin(p * 3), py = y + (ey - y) * p - size * 0.12 * Math.sin(p * Math.PI);
      var l = size * 0.16 * (1 - p * 0.7);
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + dir * l * 0.4, py - l); c.moveTo(px, py); c.lineTo(px + dir * l * 0.6, py + l * 0.5); c.stroke();
    }
  }

  defs.fireflies = {
    name: 'Luciérnagas', swatch: 'radial-gradient(circle at 35% 40%,#eaff9a 0 8%,transparent 22%),linear-gradient(180deg,#05140f,#103a2c)', res: 1,
    create: function () {
      var bg, fg, flies, glowS, haloS, light, blades, seeds, butterflies, k;
      return {
        setup: function (env) {
          var w = env.w, h = env.h, i;
          light = env.mode === 'light';
          k = Math.max(0.6, h / 1080);
          if (light) setupDay(w, h); else setupNight(w, h);
        },
        draw: function (c, w, h, t, dt) {
          if (light) drawDay(c, w, h, t, dt); else drawNight(c, w, h, t, dt);
        }
      };

      /* ---------- noche ---------- */
      function setupNight(w, h) {
        var i, R = Math.min(w, h), mx = w * 0.66, my = h * 0.2;
        var b = buffer(w, h), c = b.ctx;
        c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#02060a'], [0.45, '#071519'], [0.8, '#0a1d1b'], [1, '#0b1f19']]);
        c.fillRect(0, 0, w, h);
        glowLayers(c, mx, my, '#a6cfe0', [[R * 0.7, 0.28], [R * 0.2, 0.4]]);
        c.fillStyle = 'rgba(235,245,250,0.85)';
        c.beginPath(); c.arc(mx, my, R * 0.03, 0, TAU); c.fill();
        // rayos de luna entre los árboles
        c.globalCompositeOperation = 'lighter';
        for (i = 0; i < 6; i++) {
          var x0 = mx + rand(-R * 0.15, R * 0.15), spread = rand(0.04, 0.1) * w, x1 = x0 - rand(0.1, 0.45) * w;
          c.fillStyle = linear(c, 0, my, 0, h, [[0, 'rgba(170,210,220,0.07)'], [1, 'rgba(170,210,220,0)']]);
          c.beginPath(); c.moveTo(x0 - 6, my); c.lineTo(x0 + 6, my); c.lineTo(x1 + spread, h); c.lineTo(x1 - spread, h); c.closePath(); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
        // troncos lejanos con niebla, luego medianos
        for (i = 0; i < 28; i++) trunk(c, rand(0, w), -10, h * 0.86, rand(0.004, 0.011) * w, 'rgba(26,56,52,0.75)');
        c.fillStyle = linear(c, 0, h * 0.45, 0, h * 0.9, [[0, 'rgba(110,160,150,0)'], [0.6, 'rgba(110,160,150,0.12)'], [1, 'rgba(110,160,150,0.05)']]);
        c.fillRect(0, h * 0.45, w, h * 0.45);
        for (i = 0; i < 12; i++) trunk(c, rand(0, w), -10, h * 0.9, rand(0.013, 0.026) * w, '#0b1c19');
        fillRidge(c, w, ridge(h * 0.86, h * 0.025, 7), h, '#06100d');
        grassBlades(c, w, h * 0.9, h * 0.05, '#081511', 0.8);
        bg = b.canvas;

        var f0 = buffer(w, h), fc = f0.ctx;
        trunk(fc, w * 0.04, -10, h, w * 0.055, '#020504');
        trunk(fc, w * 0.13, -10, h, w * 0.03, '#030806');
        trunk(fc, w * 0.9, -10, h, w * 0.045, '#020504');
        trunk(fc, w * 0.985, -10, h, w * 0.035, '#030806');
        // hojas que cuelgan en las esquinas superiores
        fc.fillStyle = '#020605';
        for (i = 0; i < 1100; i++) {
          var left = Math.random() < 0.5, lx = left ? rand(-0.05, 0.38) * w : rand(0.62, 1.05) * w;
          var far = left ? lx / (0.38 * w) : (w - lx) / (0.38 * w);
          var ly = rand(-0.03, 0.24) * h * (1 - clamp(far, 0, 1) * 0.75);
          fc.save(); fc.translate(lx, ly); fc.rotate(rand(0, TAU));
          fc.beginPath();
          if (fc.ellipse) fc.ellipse(0, 0, rand(5, 13) * k, rand(2, 5) * k, 0, 0, TAU); else fc.arc(0, 0, 5 * k, 0, TAU);
          fc.fill(); fc.restore();
        }
        grassBlades(fc, w, h, h * 0.1, '#020605', 1.1);
        fern(fc, w * 0.08, h, h * 0.3, '#0a1a12', 1);
        fern(fc, w * 0.18, h, h * 0.22, '#0a1a12', 1);
        fern(fc, w * 0.86, h, h * 0.28, '#0a1a12', -1);
        fern(fc, w * 0.95, h, h * 0.24, '#0a1a12', -1);
        var f = buffer(w, h);
        drawBlurred(f.ctx, f0.canvas, w, h, 2.2);
        fg = f.canvas;

        glowS = glow('#e4ff84', 64, 0.1, 0.75);
        haloS = bokehDisc('#d8ff86', 64);
        flies = [];
        var n = Math.round((eco() ? 60 : 110) * Math.max(0.5, w * h / 2073600));
        for (i = 0; i < n; i++) {
          var z = Math.random();
          flies.push({ x: rand(0, w), y: rand(h * 0.3, h * 0.95), z: z, ang: rand(0, TAU), v: rand(6, 20), ph: rand(0, 6),
            on: rand(0.8, 1.6), off: rand(1, 3.5), r: (0.8 + 2.6 * z) * k });
        }
      }
      function drawNight(c, w, h, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        c.globalCompositeOperation = 'lighter';
        drawFlies(c, w, h, t, dt, false);
        c.globalCompositeOperation = 'source-over';
        c.drawImage(fg, 0, 0, w, h);
        c.globalCompositeOperation = 'lighter';
        drawFlies(c, w, h, t, dt, true);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
      }
      /* cada luciérnaga parpadea con su propio ritmo: se enciende suave y se apaga */
      function drawFlies(c, w, h, t, dt, front) {
        for (var i = 0; i < flies.length; i++) {
          var f = flies[i];
          if ((f.z > 0.72) !== front) continue;
          f.ang += rand(-1, 1) * dt * 1.4;
          f.x += Math.cos(f.ang) * f.v * dt * k;
          f.y += (Math.sin(f.ang) * f.v * 0.6 + Math.sin(t * 1.3 + f.ph) * 4) * dt * k;
          if (f.x < -30) f.x = w + 30; else if (f.x > w + 30) f.x = -30;
          if (f.y < h * 0.25) f.ang = Math.abs(f.ang);
          if (f.y > h * 0.97) f.ang = -Math.abs(f.ang);
          var cyc = f.on + f.off, p = (t + f.ph * cyc) % cyc;
          var I = p < f.on ? Math.pow(Math.sin(p / f.on * Math.PI), 2) : 0;
          if (I < 0.02) continue;
          if (f.z > 0.92) {
            // muy cerca de la cámara: un disco desenfocado
            var s1 = f.r * 22;
            c.globalAlpha = I * 0.35;
            c.drawImage(haloS, f.x - s1 / 2, f.y - s1 / 2, s1, s1);
          } else {
            var s2 = f.r * 18;
            c.globalAlpha = I * (0.4 + 0.6 * f.z);
            c.drawImage(glowS, f.x - s2 / 2, f.y - s2 / 2, s2, s2);
          }
        }
      }

      /* ---------- día ---------- */
      function setupDay(w, h) {
        var i, R = Math.min(w, h), sx = w * 0.18, sy = h * 0.12, hz = h * 0.58;
        var b = buffer(w, h), c = b.ctx;
        c.fillStyle = linear(c, 0, 0, 0, hz, [[0, '#4a8fd6'], [0.55, '#9cc8ee'], [0.85, '#dfecf2'], [1, '#f1ead6']]);
        c.fillRect(0, 0, w, hz + 2);
        sunDisk(c, sx, sy, R * 0.04, '#fff1c4', 0.9);
        // línea de árboles lejana, desenfocada
        var tl = buffer(w, h), tc = tl.ctx;
        for (i = 0; i < 800; i++) {
          tc.fillStyle = pick(['#6d9668', '#5f8a5c', '#7aa171', '#557f55', '#82a878', '#4d7a4f']);
          tc.beginPath();
          tc.arc(rand(-20, w + 20), h * (0.49 + 0.09 * Math.pow(Math.random(), 0.6)), rand(6, 24) * k, 0, TAU);
          tc.fill();
        }
        tc.fillStyle = '#5f8a5c';
        tc.fillRect(0, h * 0.56, w, h * 0.04);
        drawBlurred(c, tl.canvas, w, h, 4);
        fillRidge(c, w, ridge(hz, h * 0.035, 7), h, '#9ac58a');
        fillRidge(c, w, ridge(h * 0.66, h * 0.03, 7), h, linear(c, 0, h * 0.64, 0, h, [[0, '#84b96c'], [1, '#5a9644']]));
        // pasto y flores en perspectiva
        for (i = 0; i < 3200; i++) {
          var z = Math.pow(Math.random(), 0.7), y = h * 0.66 + z * h * 0.34, hl = (2 + 16 * z) * k;
          c.strokeStyle = pick(['#5e9a45', '#6fae52', '#4c853a', '#86c063', '#3f7330']);
          c.globalAlpha = 0.7;
          c.lineWidth = 0.6 + z;
          var gx = rand(0, w);
          c.beginPath(); c.moveTo(gx, y); c.lineTo(gx + rand(-2, 2) * z, y - hl); c.stroke();
        }
        c.globalAlpha = 1;
        for (i = 0; i < 380; i++) {
          var fz = Math.pow(Math.random(), 0.8), fy2 = h * 0.67 + fz * h * 0.3;
          c.fillStyle = pick(['#ffffff', '#ffe066', '#c8a2ff', '#ff9ec7', '#ffffff', '#fff3a0']);
          c.beginPath(); c.arc(rand(0, w), fy2, (0.6 + 2.4 * fz) * k, 0, TAU); c.fill();
        }
        bg = b.canvas;
        blades = [];
        var nb = Math.round((eco() ? 90 : 170) * w / 1920);
        for (i = 0; i < nb; i++) blades.push({ x: rand(-10, w + 10), hh: rand(0.06, 0.2) * h, lw: rand(1.5, 4) * k, col: pick(['#3f7a30', '#4b8a38', '#356b28', '#5a9a42']), ph: rand(0, TAU) });
        seeds = [];
        for (i = 0; i < (eco() ? 22 : 40); i++) seeds.push({ x: rand(0, w), y: rand(h * 0.15, h * 0.9), z: rand(0.3, 1), ph: rand(0, TAU), vx: rand(8, 22), vy: rand(-4, 2) });
        butterflies = [];
        for (i = 0; i < 2; i++) butterflies.push({ x: rand(0.2, 0.8) * w, y: rand(0.55, 0.8) * h, ang: rand(0, TAU), ph: rand(0, TAU), col: i ? '#ffffff' : '#ff9a3c' });
        glowS = glow('#ffffff', 32, 0.25, 0.7);
      }
      function drawDay(c, w, h, t, dt) {
        var i, gust = Math.sin(t * 0.35) * 0.6 + 0.4;
        c.drawImage(bg, 0, 0, w, h);
        // semillas y polen flotando a contraluz
        for (i = 0; i < seeds.length; i++) {
          var s = seeds[i];
          s.x += (s.vx * (0.5 + gust)) * dt * k;
          s.y += (s.vy + Math.sin(t * 0.8 + s.ph) * 6) * dt * k;
          if (s.x > w + 20) { s.x = -20; s.y = rand(h * 0.15, h * 0.9); }
          if (s.y < -20) s.y = h;
          var sz = (3 + 9 * s.z) * k;
          c.globalAlpha = 0.5 + 0.4 * s.z;
          c.drawImage(glowS, s.x - sz / 2, s.y - sz / 2, sz, sz);
        }
        c.globalAlpha = 1;
        // mariposas
        for (i = 0; i < butterflies.length; i++) {
          var b = butterflies[i];
          b.ang += rand(-1, 1) * dt * 2;
          b.x += Math.cos(b.ang) * 40 * dt * k;
          b.y += (Math.sin(b.ang) * 25 + Math.sin(t * 3 + b.ph) * 20) * dt * k;
          if (b.x < w * 0.05 || b.x > w * 0.95) b.ang = Math.PI - b.ang;
          if (b.y < h * 0.45 || b.y > h * 0.9) b.ang = -b.ang;
          var flap = Math.abs(Math.sin(t * 14 + b.ph)), ws = 9 * k;
          c.fillStyle = b.col;
          c.globalAlpha = 0.95;
          c.save(); c.translate(b.x, b.y); c.rotate(Math.cos(b.ang) * 0.3);
          c.beginPath(); c.ellipse ? c.ellipse(-ws * 0.5 * flap, -ws * 0.2, ws * 0.55 * flap + 0.5, ws * 0.45, -0.4, 0, TAU) : c.arc(-ws * 0.5 * flap, 0, ws * 0.4, 0, TAU); c.fill();
          c.beginPath(); c.ellipse ? c.ellipse(ws * 0.5 * flap, -ws * 0.2, ws * 0.55 * flap + 0.5, ws * 0.45, 0.4, 0, TAU) : c.arc(ws * 0.5 * flap, 0, ws * 0.4, 0, TAU); c.fill();
          c.fillStyle = '#2b2b2b';
          c.fillRect(-0.8 * k, -ws * 0.45, 1.6 * k, ws * 0.9);
          c.restore();
        }
        c.globalAlpha = 1;
        // pasto cercano meciéndose con el viento
        c.lineCap = 'round';
        for (i = 0; i < blades.length; i++) {
          var bl = blades[i], sway = (Math.sin(t * 1.4 + bl.x * 0.006 + bl.ph * 0.3) * 0.5 + gust * 0.6) * bl.hh * 0.25;
          c.strokeStyle = bl.col;
          c.lineWidth = bl.lw;
          c.beginPath();
          c.moveTo(bl.x, h + 4);
          c.quadraticCurveTo(bl.x + sway * 0.3, h - bl.hh * 0.55, bl.x + sway, h - bl.hh);
          c.stroke();
        }
      }
    }
  };

  /* ======================================================================
     Motor
     ====================================================================== */
  var ORDER = ['aurora', 'ocean', 'clouds', 'rain', 'snow', 'stars', 'fireflies'];

  function env() {
    return { ctx: ctx, w: W, h: H, mode: mode };
  }

  function resize() {
    if (!canvas || !current) return;
    W = window.innerWidth || document.documentElement.clientWidth;
    H = window.innerHeight || document.documentElement.clientHeight;
    var dpr = eco() ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    scale = dpr * defs[currentId].res * (eco() ? 0.75 : 1);
    canvas.width = Math.max(1, Math.round(W * scale));
    canvas.height = Math.max(1, Math.round(H * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    current.setup(env());
    current.draw(ctx, W, H, (now() - t0) / 1000, 0);
  }

  function now() {
    return (global.performance && performance.now) ? performance.now() : Date.now();
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (!current) return;
    ts = ts || now();
    var minGap = eco() ? 1000 / 30 : 1000 / 61;
    if (last && ts - last < minGap) return;
    var dt = last ? Math.min((ts - last) / 1000, 0.1) : 0;
    last = ts;
    current.draw(ctx, W, H, Math.max(0, (ts - t0) / 1000), dt);
  }

  function run() {
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }

  /* Funde a transparente, ejecuta fn (que vuelve a mostrar el canvas) */
  function fadeTo(fn) {
    clearTimeout(fadeTimer);
    pending = fn;
    canvas.style.opacity = '0';
    fadeTimer = setTimeout(function () {
      var f = pending;
      pending = null;
      if (f) f();
    }, 550);
  }
  function cancelFade() {
    clearTimeout(fadeTimer);
    pending = null;
  }

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  }

  global.Scenes = {
    list: ORDER.map(function (id) { return { id: id, name: defs[id].name, swatch: defs[id].swatch }; }),

    init: function (el) {
      canvas = el;
      ctx = canvas.getContext('2d');
      t0 = now();
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
    },

    /* Cambia de escena con un fundido suave */
    start: function (id) {
      if (!defs[id]) id = 'aurora';
      if (id === currentId && current && !pending) { run(); return; }
      var swap = function () {
        currentId = id;
        current = defs[id].create();
        resize();
        canvas.style.opacity = '1';
        run();
      };
      if (current && raf) fadeTo(swap);
      else { cancelFade(); swap(); }
    },

    stop: function () {
      cancelFade();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      current = null;
      currentId = null;
    },

    setMode: function (m) {
      if (m === mode) return;
      mode = m;
      // si hay un cambio de escena en curso, tomará el nuevo modo al terminar
      if (!current || pending) return;
      fadeTo(function () {
        if (current) resize();
        canvas.style.opacity = '1';
      });
    },

    setQuality: function (q) {
      quality = q;
      texCache = {};
      resize();
    },

    current: function () { return currentId; }
  };
})(window);
