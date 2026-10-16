/* ==========================================================================
   Fondos animados en canvas.
   Cada escena tiene versión clara y oscura, se dibuja con primitivas baratas
   (degradados, sprites pre-renderizados) y puede bajar resolución y FPS en
   modo "Ahorro" para que vaya fluida en Smart TV.
   ES5 a propósito: los navegadores de TV suelen ser Chromium antiguos.
   ========================================================================== */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var canvas, ctx;
  var current = null, currentId = null;
  var mode = 'dark', quality = 'high';
  var W = 0, H = 0, scale = 1;
  var raf = 0, last = 0, t0 = 0, fadeTimer = 0;

  /* ---------- utilidades ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mix(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function linear(c, x0, y0, x1, y1, stops) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
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
    return { canvas: c, ctx: x, w: w, h: h };
  }

  /* Sprite de brillo radial (luciérnagas, copos, bokeh) */
  function glow(color, size, core, coreAlpha) {
    var b = buffer(size, size), c = b.ctx, r = size / 2;
    var g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(core, rgba(color, coreAlpha));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return b.canvas;
  }

  /* Silueta de montañas por desplazamiento de punto medio */
  function ridge(baseY, amp, steps) {
    var n = 1 << steps, pts = new Array(n + 1), size, i, a = amp;
    pts[0] = baseY + rand(-amp, amp) * 0.5;
    pts[n] = baseY + rand(-amp, amp) * 0.5;
    for (size = n; size > 1; size >>= 1, a *= 0.56) {
      for (i = size >> 1; i < n; i += size) {
        pts[i] = (pts[i - (size >> 1)] + pts[i + (size >> 1)]) / 2 + rand(-a, a);
      }
    }
    return pts;
  }
  function fillRidge(c, w, h, pts, color) {
    c.beginPath();
    c.moveTo(0, h);
    for (var i = 0; i < pts.length; i++) c.lineTo(i / (pts.length - 1) * w, pts[i]);
    c.lineTo(w, h);
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }

  function sprinkleStars(c, w, h, count, maxY, alpha) {
    for (var i = 0; i < count; i++) {
      var r = Math.random() < 0.9 ? rand(0.4, 0.9) : rand(0.9, 1.5);
      c.globalAlpha = rand(0.25, 1) * alpha;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(rand(0, w), rand(0, maxY), r, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function disk(c, x, y, r, color, glowColor, glowAlpha, glowSize) {
    var g = c.createRadialGradient(x, y, r * 0.5, x, y, r * glowSize);
    g.addColorStop(0, rgba(glowColor, glowAlpha));
    g.addColorStop(1, rgba(glowColor, 0));
    c.fillStyle = g;
    c.fillRect(x - r * glowSize, y - r * glowSize, r * glowSize * 2, r * glowSize * 2);
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }

  var defs = {};

  /* ======================================================================
     Aurora — manchas de color que flotan lentamente (mesh gradient)
     ====================================================================== */
  defs.aurora = {
    name: 'Aurora', swatch: 'linear-gradient(135deg,#7c3aed,#2563eb 50%,#0d9488)', res: 0.3,
    create: function () {
      var blobs = null, base, comp, alpha;
      return {
        setup: function (env) {
          var light = env.mode === 'light';
          var cols = light
            ? ['#f9a8d4', '#93c5fd', '#86efac', '#fcd34d', '#c4b5fd', '#a5f3fc']
            : ['#7c3aed', '#2563eb', '#0d9488', '#be185d', '#4338ca', '#0891b2'];
          base = linear(env.ctx, 0, 0, env.w, env.h, light
            ? [[0, '#fdf3ea'], [1, '#ecf0fb']]
            : [[0, '#050817'], [1, '#0a0e24']]);
          comp = light ? 'source-over' : 'screen';
          alpha = light ? 0.72 : 0.78;
          if (!blobs) {
            blobs = [];
            for (var i = 0; i < cols.length; i++) {
              blobs.push({
                px: rand(0, TAU), py: rand(0, TAU),
                sx: rand(0.05, 0.11), sy: rand(0.04, 0.1),
                r: rand(0.36, 0.6)
              });
            }
          }
          for (var j = 0; j < blobs.length; j++) blobs[j].col = cols[j];
        },
        draw: function (c, w, h, t) {
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = base;
          c.fillRect(0, 0, w, h);
          c.globalCompositeOperation = comp;
          var m = Math.max(w, h);
          for (var i = 0; i < blobs.length; i++) {
            var b = blobs[i];
            var x = w * (0.5 + 0.42 * Math.sin(t * b.sx + b.px));
            var y = h * (0.5 + 0.42 * Math.cos(t * b.sy + b.py));
            var r = m * b.r * (0.9 + 0.1 * Math.sin(t * 0.13 + b.px));
            var g = c.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, rgba(b.col, alpha));
            g.addColorStop(0.5, rgba(b.col, alpha * 0.42));
            g.addColorStop(1, rgba(b.col, 0));
            c.fillStyle = g;
            c.fillRect(0, 0, w, h);
          }
          c.globalCompositeOperation = 'source-over';
        }
      };
    }
  };

  /* ======================================================================
     Océano — cielo, sol/luna y capas de olas con reflejo
     ====================================================================== */
  defs.ocean = {
    name: 'Océano', swatch: 'linear-gradient(180deg,#8ec5ef,#fde3c8 48%,#4f98d0 52%,#2368a7)', res: 1,
    create: function () {
      var sky, waves, horizon, sunX, glint, waterTop;
      return {
        setup: function (env) {
          var w = env.w, h = env.h, light = env.mode === 'light';
          var P = light ? {
            sky: [[0, '#3b86d4'], [0.55, '#8fc6ef'], [1, '#fde1c4']],
            sun: '#fffaf0', glow: '#ffe2ad',
            water: ['#bcdcf0', '#94c6e8', '#70ade0', '#5095d1', '#367dbd', '#2367a6'],
            glint: '#fff1cf'
          } : {
            sky: [[0, '#050822'], [0.55, '#1b1a4c'], [1, '#673b6a']],
            sun: '#f7f2e2', glow: '#cbbcff',
            water: ['#4b3e73', '#383064', '#2b2757', '#20204b', '#18193f', '#101233'],
            glint: '#e7e0ff'
          };
          horizon = Math.round(h * 0.54);
          sunX = w * 0.84;
          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, horizon, P.sky);
          c.fillRect(0, 0, w, horizon + 2);
          if (!light) sprinkleStars(c, w, h, Math.round(w * h / 9000), horizon * 0.75, 0.8);
          var R = Math.min(w, h) * 0.05;
          disk(c, sunX, horizon - h * 0.09, R, P.sun, P.glow, light ? 0.55 : 0.35, 7);
          // bruma en el horizonte
          c.fillStyle = linear(c, 0, horizon - h * 0.08, 0, horizon, [[0, rgba(P.water[0], 0)], [1, rgba(P.water[0], 0.55)]]);
          c.fillRect(0, horizon - h * 0.08, w, h * 0.08);
          sky = b.canvas;
          waterTop = P.water[0];
          glint = P.glint;
          waves = [];
          var n = P.water.length;
          for (var i = 1; i < n; i++) {
            var p = i / (n - 1);
            var y = horizon + Math.pow(p, 1.7) * (h - horizon) * 0.86 + 3;
            var amp = 1.5 + p * p * h * 0.022;
            var col = P.water[i];
            waves.push({
              y: y, amp: amp,
              k: TAU / ((90 + p * 520) * Math.max(0.6, w / 1600)),
              s: 0.3 + p * 0.55, ph: rand(0, TAU),
              fill: linear(env.ctx, 0, y - amp, 0, y + amp + h * 0.12, [[0, mix(col, '#ffffff', light ? 0.18 : 0.1)], [1, col]])
            });
          }
        },
        draw: function (c, w, h, t) {
          c.drawImage(sky, 0, 0, w, h);
          c.fillStyle = waterTop;
          c.fillRect(0, horizon, w, h - horizon);
          var step = Math.max(6, w / 220);
          for (var i = 0; i < waves.length; i++) {
            var v = waves[i];
            c.beginPath();
            c.moveTo(0, h);
            for (var x = 0; x <= w + step; x += step) {
              c.lineTo(x, v.y + Math.sin(x * v.k + t * v.s + v.ph) * v.amp +
                Math.sin(x * v.k * 2.3 - t * v.s * 1.4 + v.ph * 2) * v.amp * 0.35);
            }
            c.lineTo(w, h);
            c.closePath();
            c.fillStyle = v.fill;
            c.fill();
          }
          // destellos del sol/luna sobre el agua
          c.globalCompositeOperation = 'lighter';
          for (var j = 0; j < 36; j++) {
            var q = j / 36;
            var yy = horizon + Math.pow(q, 1.45) * (h - horizon);
            var hw = (6 + q * w * 0.07) * (0.5 + 0.5 * Math.sin(t * 1.2 + j * 1.7));
            c.fillStyle = rgba(glint, 0.2 * (1 - q * 0.8));
            c.fillRect(sunX - hw + Math.sin(t * 0.7 + j) * 8, yy, hw * 2, 1 + q * 3);
          }
          c.globalCompositeOperation = 'source-over';
        }
      };
    }
  };

  /* ======================================================================
     Cielo — nubes que pasan despacio en tres planos
     ====================================================================== */
  function makeCloud(light) {
    var CW = 440, CH = 200;
    var b = buffer(CW, CH), c = b.ctx;
    // desenfoque al crear el sprite (una sola vez) para que no se noten las bocanadas
    if ('filter' in c) c.filter = 'blur(5px)';
    var puffs = 16 + ((Math.random() * 8) | 0);
    for (var i = 0; i < puffs; i++) {
      var u = Math.random();
      var px = (0.16 + 0.68 * u) * CW;
      var mid = 1 - Math.abs(u - 0.5) * 1.8;
      var r = rand(24, 46) * (0.6 + 0.6 * mid);
      var py = CH * 0.66 - rand(0, 48) * mid;
      var g = c.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.65)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(px, py, r, 0, TAU);
      c.fill();
    }
    if ('filter' in c) c.filter = 'none';
    // base más plana
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = linear(c, 0, CH * 0.64, 0, CH * 0.86, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    c.fillRect(0, CH * 0.64, CW, CH * 0.36);
    c.globalCompositeOperation = 'source-atop';
    if (!light) {
      c.fillStyle = 'rgba(70,82,124,0.55)';
      c.fillRect(0, 0, CW, CH);
    }
    c.fillStyle = linear(c, 0, CH * 0.3, 0, CH, light
      ? [[0, 'rgba(255,255,255,0)'], [1, 'rgba(118,146,186,0.45)']]
      : [[0, 'rgba(200,210,245,0)'], [1, 'rgba(18,24,52,0.6)']]);
    c.fillRect(0, 0, CW, CH);
    c.globalCompositeOperation = 'source-over';
    return { canvas: b.canvas, w: CW, h: CH };
  }

  defs.clouds = {
    name: 'Cielo', swatch: 'linear-gradient(180deg,#3f8fdc,#a9d3f5 60%,#ffffff)', res: 0.5,
    create: function () {
      var sky, sprites, clouds = null;
      var layers = [
        { n: 5, s: [0.42, 0.6], y: [0.04, 0.4], v: 5, a: 0.55 },
        { n: 4, s: [0.7, 0.95], y: [0.18, 0.58], v: 9, a: 0.78 },
        { n: 3, s: [1.05, 1.4], y: [0.42, 0.82], v: 15, a: 0.95 }
      ];
      return {
        setup: function (env) {
          var w = env.w, h = env.h, light = env.mode === 'light';
          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, h, light
            ? [[0, '#3d8bdb'], [0.55, '#86bff0'], [1, '#d9edfb']]
            : [[0, '#060b1d'], [0.55, '#141f42'], [1, '#2d3a66']]);
          c.fillRect(0, 0, w, h);
          if (!light) sprinkleStars(c, w, h, Math.round(w * h / 7000), h * 0.7, 0.75);
          var R = Math.min(w, h) * 0.055;
          disk(c, w * 0.82, h * 0.16, R, light ? '#fffdf5' : '#f4f0e2', light ? '#fff4c9' : '#b9b4ff', light ? 0.7 : 0.3, 8);
          sky = b.canvas;
          sprites = [];
          for (var i = 0; i < 6; i++) sprites.push(makeCloud(light));
          if (!clouds) {
            clouds = [];
            for (var l = 0; l < layers.length; l++) {
              var L = layers[l];
              for (var k = 0; k < L.n; k++) {
                clouds.push({ layer: L, sprite: (Math.random() * 6) | 0, x: rand(-0.2, 1) * w, y: rand(L.y[0], L.y[1]), s: rand(L.s[0], L.s[1]) });
              }
            }
          }
        },
        draw: function (c, w, h, t, dt) {
          c.drawImage(sky, 0, 0, w, h);
          var k = Math.max(0.6, w / 1600);
          for (var i = 0; i < clouds.length; i++) {
            var cl = clouds[i], sp = sprites[cl.sprite];
            var sw = sp.w * cl.s * k, sh = sp.h * cl.s * k;
            cl.x += cl.layer.v * k * dt;
            if (cl.x > w) { cl.x = -sw; cl.y = rand(cl.layer.y[0], cl.layer.y[1]); cl.sprite = (Math.random() * 6) | 0; }
            c.globalAlpha = cl.layer.a;
            c.drawImage(sp.canvas, cl.x, cl.y * h - sh * 0.5, sw, sh);
          }
          c.globalAlpha = 1;
        }
      };
    }
  };

  /* ======================================================================
     Lluvia — gotas en tres planos, salpicaduras y luces desenfocadas
     ====================================================================== */
  defs.rain = {
    name: 'Lluvia', swatch: 'linear-gradient(180deg,#1e2a3a,#4a5d78)', res: 1,
    create: function () {
      var bg, drops = null, ripples = [], color, wind = 0.13;
      var LAYERS = [
        { len: 9, speed: 520, a: 0.16, lw: 0.9 },
        { len: 15, speed: 780, a: 0.26, lw: 1.1 },
        { len: 24, speed: 1080, a: 0.42, lw: 1.5 }
      ];
      function reset(d, w, h, top) {
        d.x = rand(-0.1 * w, w * 1.05);
        d.y = top ? rand(-h, 0) : rand(-h, h);
        d.len = LAYERS[d.l].len * rand(0.8, 1.3) * (h / 1080 + 0.3);
        d.v = LAYERS[d.l].speed * rand(0.9, 1.1) * (h / 1080 * 0.7 + 0.3);
        d.ground = h * rand(0.86, 1.02);
      }
      return {
        setup: function (env) {
          var w = env.w, h = env.h, light = env.mode === 'light';
          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, h, light
            ? [[0, '#8fa2b8'], [0.6, '#b9c6d5'], [1, '#d8e0e9']]
            : [[0, '#0b121e'], [0.6, '#172234'], [1, '#26354a']]);
          c.fillRect(0, 0, w, h);
          // luces de ciudad desenfocadas detrás de la lluvia
          var bokeh = light ? ['#ffffff', '#fdf2e0', '#e6f0ff'] : ['#ffb46b', '#ff8a5c', '#7ac8ff', '#ffd27a', '#b892ff'];
          var count = Math.round(w * h / 52000);
          c.globalCompositeOperation = light ? 'source-over' : 'lighter';
          for (var i = 0; i < count; i++) {
            var x = rand(0, w), y = rand(h * 0.35, h * 1.05), r = rand(18, 90) * (h / 1080 + 0.3);
            var g = c.createRadialGradient(x, y, 0, x, y, r);
            var col = pick(bokeh), a = light ? rand(0.18, 0.4) : rand(0.08, 0.22);
            g.addColorStop(0, rgba(col, a));
            g.addColorStop(0.7, rgba(col, a * 0.7));
            g.addColorStop(1, rgba(col, 0));
            c.fillStyle = g;
            c.fillRect(x - r, y - r, r * 2, r * 2);
          }
          c.globalCompositeOperation = 'source-over';
          // neblina baja
          c.fillStyle = linear(c, 0, h * 0.6, 0, h, light
            ? [[0, 'rgba(235,240,246,0)'], [1, 'rgba(235,240,246,0.55)']]
            : [[0, 'rgba(40,55,80,0)'], [1, 'rgba(40,55,80,0.5)']]);
          c.fillRect(0, h * 0.6, w, h * 0.4);
          bg = b.canvas;
          color = light ? '#2c3e57' : '#c4d6f0';
          var n = Math.min(520, Math.round(w * h / 4600));
          if (!drops || drops.length !== n) {
            drops = [];
            for (var j = 0; j < n; j++) {
              var d = { l: j % 3 === 0 ? 2 : (j % 3 === 1 ? 1 : 0) };
              reset(d, w, h, false);
              drops.push(d);
            }
          }
          ripples = [];
        },
        draw: function (c, w, h, t, dt) {
          c.drawImage(bg, 0, 0, w, h);
          c.lineCap = 'round';
          for (var l = 0; l < 3; l++) {
            var L = LAYERS[l];
            c.strokeStyle = rgba(color, L.a);
            c.lineWidth = L.lw;
            c.beginPath();
            for (var i = 0; i < drops.length; i++) {
              var d = drops[i];
              if (d.l !== l) continue;
              d.y += d.v * dt;
              d.x += d.v * wind * dt;
              if (d.y > d.ground) {
                if (l === 2 && ripples.length < 60) ripples.push({ x: d.x, y: d.ground, r: 0, max: rand(5, 13), life: 1 });
                reset(d, w, h, true);
                continue;
              }
              c.moveTo(d.x, d.y);
              c.lineTo(d.x - d.len * wind, d.y - d.len);
            }
            c.stroke();
          }
          if (ripples.length) {
            c.lineWidth = 1;
            for (var k = ripples.length - 1; k >= 0; k--) {
              var r = ripples[k];
              r.life -= dt * 2.2;
              if (r.life <= 0) { ripples.splice(k, 1); continue; }
              r.r = r.max * (1 - r.life);
              c.strokeStyle = rgba(color, 0.35 * r.life);
              c.beginPath();
              if (c.ellipse) c.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, TAU);
              else c.arc(r.x, r.y, r.r, 0, TAU);
              c.stroke();
            }
          }
        }
      };
    }
  };

  /* ======================================================================
     Nieve — copos con vaivén sobre un bosque de pinos
     ====================================================================== */
  function pines(c, w, h, baseY, minH, maxH, color) {
    c.fillStyle = color;
    c.beginPath();
    var x = -20;
    while (x < w + 20) {
      var th = rand(minH, maxH) * h, tw = th * rand(0.32, 0.42), by = baseY + rand(-0.01, 0.015) * h;
      for (var s = 0; s < 3; s++) {
        var top = by - th + s * th * 0.22, half = tw * (0.55 + s * 0.22) / 2, bottom = top + th * 0.5;
        c.moveTo(x, top);
        c.lineTo(x + half, bottom);
        c.lineTo(x - half, bottom);
        c.closePath();
      }
      c.rect(x - tw * 0.06, by - th * 0.15, tw * 0.12, th * 0.2);
      x += tw * rand(0.45, 0.9);
    }
    c.fill();
    c.fillRect(0, baseY, w, h - baseY);
  }

  defs.snow = {
    name: 'Nieve', swatch: 'linear-gradient(180deg,#1b2b45,#9fb3cf)', res: 1,
    create: function () {
      var bg, fg, flakes = null, sprite;
      function reset(f, w, h, top) {
        f.x = rand(0, w);
        f.y = top ? rand(-40, -5) : rand(0, h);
        f.r = Math.random() < 0.7 ? rand(0.8, 2) : rand(2, 3.8);
        f.vy = (14 + f.r * 15) * (h / 1080 * 0.6 + 0.4);
        f.amp = rand(8, 34);
        f.sw = rand(0.25, 0.8);
        f.ph = rand(0, TAU);
        f.a = Math.min(1, 0.35 + f.r * 0.2);
      }
      return {
        setup: function (env) {
          var w = env.w, h = env.h, light = env.mode === 'light';
          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, h, light
            ? [[0, '#6f86a3'], [0.6, '#9fb2c8'], [1, '#c9d5e2']]
            : [[0, '#08111f'], [0.6, '#16253d'], [1, '#2b3f5e']]);
          c.fillRect(0, 0, w, h);
          if (!light) sprinkleStars(c, w, h, Math.round(w * h / 14000), h * 0.45, 0.5);
          disk(c, w * 0.2, h * 0.18, Math.min(w, h) * 0.04, light ? '#fbfdff' : '#eef1f8', light ? '#ffffff' : '#a8b8e0', light ? 0.5 : 0.3, 6);
          pines(c, w, h, h * 0.84, 0.1, 0.2, light ? '#8197b1' : '#1b2b44');
          bg = b.canvas;
          var f2 = buffer(w, h), c2 = f2.ctx;
          pines(c2, w, h, h * 0.92, 0.16, 0.3, light ? '#4f6580' : '#0a1322');
          c2.fillStyle = linear(c2, 0, h * 0.9, 0, h, light
            ? [[0, '#dfe7f0'], [1, '#f4f7fb']]
            : [[0, '#41557a'], [1, '#56698e']]);
          c2.beginPath();
          c2.moveTo(0, h);
          c2.lineTo(0, h * 0.95);
          c2.quadraticCurveTo(w * 0.3, h * 0.91, w * 0.6, h * 0.94);
          c2.quadraticCurveTo(w * 0.85, h * 0.965, w, h * 0.93);
          c2.lineTo(w, h);
          c2.fill();
          fg = f2.canvas;
          sprite = glow('#ffffff', 32, 0.35, 0.8);
          var n = Math.min(420, Math.round(w * h / 5200));
          if (!flakes || flakes.length !== n) {
            flakes = [];
            for (var i = 0; i < n; i++) { var f = {}; reset(f, w, h, false); flakes.push(f); }
          }
        },
        draw: function (c, w, h, t, dt) {
          c.drawImage(bg, 0, 0, w, h);
          // copos pequeños detrás de los pinos cercanos, grandes delante
          drawFlakes(c, w, h, t, dt, false);
          c.globalAlpha = 1;
          c.drawImage(fg, 0, 0, w, h);
          drawFlakes(c, w, h, t, dt, true);
          c.globalAlpha = 1;
        }
      };
      function drawFlakes(c, w, h, t, dt, big) {
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i];
          if ((f.r >= 2) !== big) continue;
          f.y += f.vy * dt;
          if (f.y > h + 10) reset(f, w, h, true);
          var x = f.x + Math.sin(t * f.sw + f.ph) * f.amp;
          var s = f.r * 4;
          c.globalAlpha = f.a;
          c.drawImage(sprite, x - s / 2, f.y - s / 2, s, s);
        }
      }
    }
  };

  /* ======================================================================
     Noche estrellada — estrellas titilantes, vía láctea, estrellas fugaces
     (en modo claro: amanecer)
     ====================================================================== */
  defs.stars = {
    name: 'Noche estrellada', swatch: 'radial-gradient(circle at 30% 30%,#ffffff 0 2%,transparent 3%),linear-gradient(180deg,#02030c,#2a2350)', res: 1,
    create: function () {
      var bg, fg, stars = null, shooting = null, nextShot = 3, light = false;
      return {
        setup: function (env) {
          var w = env.w, h = env.h;
          light = env.mode === 'light';
          var b = buffer(w, h), c = b.ctx;
          c.fillStyle = linear(c, 0, 0, 0, h, light
            ? [[0, '#28386f'], [0.42, '#6f63a3'], [0.72, '#e2a2a8'], [1, '#ffd2a2']]
            : [[0, '#01020a'], [0.5, '#070b24'], [0.82, '#151a42'], [1, '#2b2452']]);
          c.fillRect(0, 0, w, h);
          if (!light) {
            // vía láctea: banda diagonal de polvo luminoso
            c.save();
            c.translate(w * 0.5, h * 0.42);
            c.rotate(-0.42);
            var bw = Math.max(w, h) * 1.4, bh = h * 0.22;
            for (var i = 0; i < 14; i++) {
              var x = rand(-bw / 2, bw / 2), r = rand(bh * 0.6, bh * 1.3);
              var g = c.createRadialGradient(x, 0, 0, x, 0, r);
              var col = pick(['#6f79c9', '#9a7cc9', '#5a86c4', '#c7a7d6']);
              g.addColorStop(0, rgba(col, 0.12));
              g.addColorStop(1, rgba(col, 0));
              c.fillStyle = g;
              c.fillRect(x - r, -r, r * 2, r * 2);
            }
            c.fillStyle = '#ffffff';
            for (var k = 0; k < Math.round(w * h / 900); k++) {
              var gx = rand(-bw / 2, bw / 2), gy = (Math.random() + Math.random() + Math.random() - 1.5) * bh * 0.7;
              c.globalAlpha = rand(0.05, 0.35);
              c.fillRect(gx, gy, 1, 1);
            }
            c.globalAlpha = 1;
            c.restore();
          }
          bg = b.canvas;
          var f = buffer(w, h), fc = f.ctx;
          fillRidge(fc, w, h, ridge(h * 0.74, h * 0.09, 7), light ? '#6c5f93' : '#0c1028');
          fillRidge(fc, w, h, ridge(h * 0.85, h * 0.07, 7), light ? '#3a3666' : '#04050f');
          fg = f.canvas;
          var n = Math.min(650, Math.round(w * h / 3600));
          if (!stars || stars.length !== n) {
            stars = [];
            for (var s = 0; s < n; s++) {
              stars.push({
                x: rand(0, w), y: Math.pow(Math.random(), 1.3) * h * 0.85,
                r: Math.random() < 0.88 ? rand(0.5, 1) : rand(1, 1.9),
                a: rand(0.35, 1), sp: rand(0.4, 2.2), ph: rand(0, TAU),
                col: Math.random() < 0.85 ? '#ffffff' : pick(['#cfe0ff', '#ffe9c9'])
              });
            }
          }
        },
        draw: function (c, w, h, t, dt) {
          c.drawImage(bg, 0, 0, w, h);
          var drift = t * 1.2, fade = light ? 0.45 : 1;
          for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            if (light && s.y > h * 0.45) continue;
            var a = s.a * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph)) * fade;
            var x = (s.x + drift) % w;
            c.globalAlpha = a;
            c.fillStyle = s.col;
            if (s.r < 1) c.fillRect(x, s.y, 1.3, 1.3);
            else { c.beginPath(); c.arc(x, s.y, s.r, 0, TAU); c.fill(); }
          }
          c.globalAlpha = 1;
          // estrella fugaz
          if (!shooting && t > nextShot) {
            var sp = rand(650, 950) * (h / 1080 * 0.6 + 0.4);
            shooting = { x: rand(w * 0.3, w * 1.05), y: rand(0, h * 0.35), vx: -sp, vy: sp * rand(0.35, 0.55), life: 0, dur: rand(0.7, 1.2) };
          }
          if (shooting) {
            var sh = shooting;
            sh.life += dt;
            sh.x += sh.vx * dt;
            sh.y += sh.vy * dt;
            var p = sh.life / sh.dur;
            if (p >= 1) { shooting = null; nextShot = t + rand(5, 14); }
            else {
              var alpha = Math.sin(p * Math.PI) * (light ? 0.6 : 0.95);
              var tx = sh.x - sh.vx * 0.14, ty = sh.y - sh.vy * 0.14;
              var g = c.createLinearGradient(sh.x, sh.y, tx, ty);
              g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
              g.addColorStop(1, 'rgba(255,255,255,0)');
              c.strokeStyle = g;
              c.lineWidth = 1.6;
              c.lineCap = 'round';
              c.beginPath();
              c.moveTo(sh.x, sh.y);
              c.lineTo(tx, ty);
              c.stroke();
            }
          }
          c.drawImage(fg, 0, 0, w, h);
        }
      };
    }
  };

  /* ======================================================================
     Luciérnagas — de noche luciérnagas en el bosque; de día polen al sol
     ====================================================================== */
  function grass(c, w, h, baseY, height, color, density) {
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineCap = 'round';
    for (var x = -10; x < w + 10; x += rand(2, 5) / density) {
      var bh = rand(0.3, 1) * height, lean = rand(-0.35, 0.35) * bh;
      c.lineWidth = rand(1, 2.6);
      c.beginPath();
      c.moveTo(x, baseY + 4);
      c.quadraticCurveTo(x + lean * 0.2, baseY - bh * 0.6, x + lean, baseY - bh);
      c.stroke();
    }
    c.fillRect(0, baseY, w, h - baseY);
  }

  defs.fireflies = {
    name: 'Luciérnagas', swatch: 'radial-gradient(circle at 35% 40%,#eaff9a 0 8%,transparent 22%),linear-gradient(180deg,#05140f,#103a2c)', res: 1,
    create: function () {
      var bg, fg, flies = null, sprite, light = false;
      return {
        setup: function (env) {
          var w = env.w, h = env.h;
          light = env.mode === 'light';
          var b = buffer(w, h), c = b.ctx;
          if (light) {
            c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#a9d6f5'], [0.55, '#e4f3fb'], [0.78, '#e8f3d6'], [1, '#c7e3b4']]);
            c.fillRect(0, 0, w, h);
            disk(c, w * 0.78, h * 0.12, Math.min(w, h) * 0.06, '#fffdf2', '#fff2c4', 0.8, 9);
            fillRidge(c, w, h, ridge(h * 0.72, h * 0.05, 6), '#a7cfa0');
          } else {
            c.fillStyle = linear(c, 0, 0, 0, h, [[0, '#020a08'], [0.6, '#06201a'], [1, '#0e3a2c']]);
            c.fillRect(0, 0, w, h);
            var g = c.createRadialGradient(w * 0.5, h * 1.1, 0, w * 0.5, h * 1.1, h * 1.1);
            g.addColorStop(0, 'rgba(60,140,100,0.25)');
            g.addColorStop(1, 'rgba(60,140,100,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, w, h);
            fillRidge(c, w, h, ridge(h * 0.68, h * 0.08, 6), '#04120d');
          }
          bg = b.canvas;
          var f = buffer(w, h), fc = f.ctx;
          grass(fc, w, h, h * 0.94, h * 0.13, light ? '#6faa68' : '#020806', 1);
          fg = f.canvas;
          sprite = light ? glow('#ffffff', 48, 0.18, 0.6) : glow('#e6ff8f', 64, 0.12, 0.55);
          var n = Math.round((light ? 46 : 70) * Math.max(0.5, w * h / 2073600));
          if (!flies || flies.length !== n) {
            flies = [];
            for (var i = 0; i < n; i++) {
              flies.push({
                x: rand(0, w), y: rand(h * 0.2, h * 0.95), ang: rand(0, TAU),
                v: rand(8, 26), r: rand(1.4, 3.4), ph: rand(0, TAU), pulse: rand(0.4, 1.1)
              });
            }
          }
        },
        draw: function (c, w, h, t, dt) {
          c.drawImage(bg, 0, 0, w, h);
          c.globalCompositeOperation = light ? 'source-over' : 'lighter';
          var k = h / 1080 * 0.6 + 0.4;
          for (var i = 0; i < flies.length; i++) {
            var f = flies[i];
            f.ang += rand(-1, 1) * dt * 1.6;
            f.x += Math.cos(f.ang) * f.v * k * dt;
            f.y += (Math.sin(f.ang) * f.v - (light ? 6 : 0)) * k * dt;
            if (f.x < -20) f.x = w + 20; else if (f.x > w + 20) f.x = -20;
            if (f.y < h * 0.1) { f.y = h * 0.1; f.ang = Math.abs(f.ang); }
            if (f.y > h * 0.98) { if (light) { f.y = h * 0.98; } else { f.y = h * 0.98; f.ang = -Math.abs(f.ang); } }
            var a = light ? 0.45 + 0.4 * Math.sin(t * f.pulse + f.ph)
              : 0.08 + 0.92 * Math.pow(Math.max(0, Math.sin(t * f.pulse + f.ph)), 2);
            var s = f.r * (light ? 6 : 14);
            c.globalAlpha = Math.max(0, a);
            c.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s);
          }
          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';
          c.drawImage(fg, 0, 0, w, h);
        }
      };
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
    var dpr = quality === 'eco' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    var res = defs[currentId].res;
    scale = dpr * res * (quality === 'eco' ? 0.75 : 1);
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
    var minGap = quality === 'eco' ? 1000 / 30 : 1000 / 61;
    if (last && ts - last < minGap) return;
    var dt = last ? Math.min((ts - last) / 1000, 0.1) : 0;
    last = ts;
    current.draw(ctx, W, H, (ts - t0) / 1000, dt);
  }

  function run() {
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }

  /* Funde a transparente, ejecuta fn (que vuelve a mostrar el canvas) */
  var pending = null;
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
    resizeTimer = setTimeout(resize, 150);
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
      resize();
    },

    current: function () { return currentId; }
  };
})(window);
