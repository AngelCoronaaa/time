/* ==========================================================================
   Calma — reloj y clima
   Clima: Open-Meteo (sin API key). Ubicación: GPS del navegador y, si no hay
   (lo normal en una Smart TV), ubicación aproximada por IP.
   ES5 a propósito para que funcione en navegadores de TV antiguos.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     Videos de fondo (Mixkit, licencia gratuita). Puedes añadir los tuyos, por
     ejemplo un archivo en la carpeta videos/:
       { id: 'v-mio', name: 'Mi video', src: 'videos/mi-video.mp4', swatch: '#345' }
     -------------------------------------------------------------------------- */
  function mixkit(id) { return 'https://assets.mixkit.co/videos/' + id + '/' + id + '-720.mp4'; }
  var VIDEOS = [
    { id: 'v-olas', name: 'Olas en la playa', src: mixkit(5016), swatch: 'linear-gradient(180deg,#7cc4e4,#1f7fa8)' },
    { id: 'v-atardecer', name: 'Atardecer en la playa', src: mixkit(44498), swatch: 'linear-gradient(180deg,#f7b267,#c0577a)' },
    { id: 'v-lluvia-hojas', name: 'Lluvia en las hojas', src: mixkit(2206), swatch: 'linear-gradient(180deg,#5c8a4a,#1f3d2a)' },
    { id: 'v-lluvia-lago', name: 'Lluvia en el lago', src: mixkit(18312), swatch: 'linear-gradient(180deg,#8aa0ad,#3b4f5c)' },
    { id: 'v-cascada', name: 'Cascada en el bosque', src: mixkit(2213), swatch: 'linear-gradient(180deg,#9fd3c7,#2f6b4f)' },
    { id: 'v-aurora', name: 'Aurora boreal', src: mixkit(4038), swatch: 'linear-gradient(180deg,#0b1d3a,#28c08a)' },
    { id: 'v-estrellas', name: 'Estrellas sobre el lago', src: mixkit(1704), swatch: 'linear-gradient(180deg,#0a0f2c,#3b4a8a)' },
    { id: 'v-nieve', name: 'Nieve en el bosque', src: mixkit(3352), swatch: 'linear-gradient(180deg,#dfe8f1,#7d93ad)' },
    { id: 'v-chimenea', name: 'Chimenea', src: mixkit(2709), swatch: 'linear-gradient(180deg,#ffb347,#7a2e0e)' },
    { id: 'v-nubes', name: 'Nubes', src: mixkit(2408), swatch: 'linear-gradient(180deg,#3f8fdc,#ffffff)' }
  ];

  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var IS_TV = /SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|AFT[A-Z]|CrKey|GoogleTV|Android TV|VIDAA|Roku|Viera|AQUOS|NETTV|PhilipsTV/i.test(navigator.userAgent);
  var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* ---------- almacenamiento seguro ---------- */
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('calma.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('calma.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
    }
  };

  var settings = {
    theme: store.get('theme', 'auto'),       // light | dark | auto
    bg: store.get('bg', 'auto'),             // auto | id de escena | id de video
    hour12: store.get('hour12', false),
    seconds: store.get('seconds', true),
    unit: store.get('unit', 'c'),
    forecast: store.get('forecast', true),
    quality: store.get('quality', IS_TV ? 'eco' : 'high'),
    customVideo: store.get('customVideo', '')
  };

  var state = {
    loc: store.get('loc', null),             // { lat, lon, name, source: gps|ip|manual }
    weather: null,
    offset: null,                            // desfase UTC de la ciudad (segundos)
    isDay: null
  };

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }
  var root = document.documentElement, body = document.body;
  var el = {
    stage: $('stage'), locBtn: $('locBtn'), locName: $('locName'), toolbar: $('toolbar'),
    hh: $('hh'), mm: $('mm'), ss: $('ss'), ampm: $('ampm'), date: $('date'),
    nowIcon: $('nowIcon'), nowTemp: $('nowTemp'), nowDesc: $('nowDesc'), nowSub: $('nowSub'),
    stats: $('stats'), hours: $('hours'), days: $('days'), status: $('status'),
    overlay: $('overlay'), panel: $('panel'), panelBody: $('panelBody'),
    sceneChips: $('sceneChips'), videoChips: $('videoChips'), videoForm: $('videoForm'), videoUrl: $('videoUrl'),
    panelLoc: $('panelLoc'), panelLocSrc: $('panelLocSrc'), searchForm: $('searchForm'), searchInput: $('searchInput'), results: $('results'),
    toast: $('toast'), themeIcon: $('themeIcon'), fsIcon: $('fsIcon'),
    canvas: $('bgCanvas'), video: $('bgVideo'), metaTheme: document.querySelector('meta[name="theme-color"]')
  };

  /* ---------- utilidades ---------- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function setText(node, txt) { if (node.textContent !== txt) node.textContent = txt; }
  function round(n) { return n === null || n === undefined || isNaN(n) ? '—' : String(Math.round(n)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toArray(list) { return Array.prototype.slice.call(list); }
  function closest(node, selector) {
    while (node && node !== document) {
      if (node.nodeType === 1 && (node.matches || node.webkitMatchesSelector).call(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function getJSON(url, timeout) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.timeout = timeout || 12000;
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) {
          try { resolve(JSON.parse(x.responseText)); } catch (e) { reject(e); }
        } else {
          reject(new Error('HTTP ' + x.status));
        }
      };
      x.onerror = x.ontimeout = function () { reject(new Error('red')); };
      x.send();
    });
  }

  /* Prueba proveedores en orden hasta que uno responda */
  function firstOk(fns) {
    var i = 0;
    return new Promise(function (resolve, reject) {
      (function next(err) {
        if (i >= fns.length) { reject(err || new Error('sin proveedores')); return; }
        var fn = fns[i++];
        try { fn().then(resolve, next); } catch (e) { next(e); }
      })();
    });
  }

  var toastTimer = 0;
  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.className = 'toast glass pill show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = 'toast glass pill'; }, ms || 2800);
  }

  /* ==========================================================================
     Reloj
     ========================================================================== */
  function localNow() {
    var d = new Date();
    if (state.offset === null) {
      return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), wd: d.getDay(), day: d.getDate(), mon: d.getMonth(), year: d.getFullYear() };
    }
    var u = new Date(d.getTime() + state.offset * 1000);
    return { h: u.getUTCHours(), m: u.getUTCMinutes(), s: u.getUTCSeconds(), wd: u.getUTCDay(), day: u.getUTCDate(), mon: u.getUTCMonth(), year: u.getUTCFullYear() };
  }
  function dateKey(n) { return n.year + '-' + pad2(n.mon + 1) + '-' + pad2(n.day); }

  function fmtHM(h, m) {
    if (!settings.hour12) return pad2(h) + ':' + pad2(m);
    return (h % 12 || 12) + ':' + pad2(m) + (h < 12 ? ' a. m.' : ' p. m.');
  }
  function fmtHour(h) {
    if (!settings.hour12) return pad2(h) + ':00';
    return (h % 12 || 12) + (h < 12 ? ' a. m.' : ' p. m.');
  }
  /* "2026-10-15T07:32" → "07:32" en el formato elegido */
  function fmtIsoTime(iso) {
    if (!iso) return '—';
    var t = iso.split('T')[1] || '';
    return fmtHM(parseInt(t.slice(0, 2), 10), parseInt(t.slice(3, 5), 10));
  }

  var lastMinute = -1, lastHour = -1;
  function tick() {
    var n = localNow();
    var h = n.h;
    if (settings.hour12) {
      setText(el.ampm, h < 12 ? 'a. m.' : 'p. m.');
      h = h % 12 || 12;
      setText(el.hh, String(h));
    } else {
      setText(el.ampm, '');
      setText(el.hh, pad2(h));
    }
    setText(el.mm, pad2(n.m));
    setText(el.ss, pad2(n.s));

    if (n.m !== lastMinute) {
      lastMinute = n.m;
      setText(el.date, cap(DAYS[n.wd]) + ', ' + n.day + ' de ' + MONTHS[n.mon]);
      updateDayNight();
      if (n.h !== lastHour) { lastHour = n.h; renderWeather(); }
      renderStatus();
    }
    clearTimeout(tick.timer);
    tick.timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
  }

  /* ==========================================================================
     Tema
     ========================================================================== */
  function resolvedTheme() {
    if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
    if (state.isDay !== null) return state.isDay ? 'light' : 'dark';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  var THEME_ICONS = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    auto: '<circle cx="12" cy="12" r="8.5"/><path class="fill" d="M12 3.5a8.5 8.5 0 0 1 0 17z"/>'
  };

  function applyTheme() {
    var t = resolvedTheme();
    root.setAttribute('data-theme', t);
    if (el.metaTheme) el.metaTheme.setAttribute('content', t === 'light' ? '#eef2f8' : '#05070f');
    el.themeIcon.innerHTML = THEME_ICONS[settings.theme] || THEME_ICONS.auto;
    if (window.Scenes) Scenes.setMode(t);
  }

  function updateDayNight() {
    var day = computeIsDay();
    if (day === state.isDay) return;
    state.isDay = day;
    if (settings.theme === 'auto') applyTheme();
    if (settings.bg === 'auto') applyBackground();
  }

  function computeIsDay() {
    var w = state.weather;
    if (!w || !w.daily) return null;
    var n = localNow(), today = dateKey(n);
    var i = w.daily.time.indexOf(today);
    if (i < 0) return w.current ? !!w.current.is_day : null;
    var nowIso = today + 'T' + pad2(n.h) + ':' + pad2(n.m);
    return nowIso >= w.daily.sunrise[i] && nowIso < w.daily.sunset[i];
  }

  /* ==========================================================================
     Fondo (animaciones y videos)
     ========================================================================== */
  function videoList() {
    var list = VIDEOS.slice();
    if (settings.customVideo) list.push({ id: 'v-custom', name: 'Mi video', src: settings.customVideo, swatch: 'linear-gradient(135deg,#888,#333)' });
    return list;
  }
  function findVideo(id) {
    var list = videoList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function bgOptions() {
    var out = [{ id: 'auto', name: 'Automático (según el clima)' }];
    Scenes.list.forEach(function (s) { out.push(s); });
    videoList().forEach(function (v) { out.push(v); });
    return out;
  }
  function bgName(id) {
    var list = bgOptions();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return id;
  }

  /* Escena que acompaña al clima actual */
  function autoScene() {
    var w = state.weather, code = w && w.current ? w.current.weather_code : null;
    var day = state.isDay !== null ? state.isDay : resolvedTheme() === 'light';
    if (code === null) return day ? 'aurora' : 'stars';
    if (code >= 95 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code === 45 || code === 48 || code === 3) return 'clouds';
    if (!day) return 'stars';
    return code <= 1 ? 'ocean' : 'clouds';
  }

  var videoFailed = {};
  function applyBackground() {
    var id = settings.bg;
    var v = id.indexOf('v-') === 0 ? findVideo(id) : null;
    if (v && !videoFailed[v.src]) {
      // la animación sigue debajo hasta que el video empieza a reproducirse
      if (!Scenes.current()) Scenes.start(autoScene());
      playVideo(v.src);
      return;
    }
    stopVideo();
    Scenes.start(id === 'auto' || id.indexOf('v-') === 0 ? autoScene() : id);
  }

  function playVideo(src) {
    var vid = el.video;
    if (vid.getAttribute('src') !== src) {
      vid.className = '';
      body.classList.remove('has-video');
      vid.setAttribute('src', src);
      try { vid.load(); } catch (e) { /* noop */ }
    }
    var p = vid.play();
    if (p && p.catch) p.catch(function () { /* se reintenta con la siguiente interacción */ });
  }

  function stopVideo() {
    var vid = el.video;
    if (!vid.getAttribute('src')) return;
    vid.className = '';
    body.classList.remove('has-video');
    try { vid.pause(); } catch (e) { /* noop */ }
    vid.removeAttribute('src');
    try { vid.load(); } catch (e) { /* noop */ }
  }

  el.video.addEventListener('playing', function () {
    if (!el.video.getAttribute('src')) return;
    el.video.className = 'ready';
    body.classList.add('has-video');
    // detener el canvas cuando el video ya cubre la pantalla
    setTimeout(function () { if (el.video.className === 'ready') Scenes.stop(); }, 1300);
  });
  el.video.addEventListener('error', function () {
    var src = el.video.getAttribute('src');
    if (!src) return;
    videoFailed[src] = true;
    toast('No se pudo cargar el video. Mostrando una animación.');
    stopVideo();
    Scenes.start(autoScene());
  });

  function nextBackground() {
    var list = bgOptions(), i = 0;
    for (; i < list.length; i++) if (list[i].id === settings.bg) break;
    var next = list[(i + 1) % list.length];
    setSetting('bg', next.id);
    toast('Fondo: ' + next.name);
  }

  /* ==========================================================================
     Iconos del clima (SVG)
     ========================================================================== */
  var CLOUD = 'M20 48h26a11 11 0 0 0 1.5-21.9a15 15 0 0 0-28.6-3.2A12.5 12.5 0 0 0 20 48z';

  function sunSvg(cx, cy, r) {
    var rays = '', i, a, r1 = r + 5, r2 = r + 10;
    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4;
      rays += 'M' + (cx + Math.cos(a) * r1).toFixed(1) + ' ' + (cy + Math.sin(a) * r1).toFixed(1) +
        'L' + (cx + Math.cos(a) * r2).toFixed(1) + ' ' + (cy + Math.sin(a) * r2).toFixed(1);
    }
    return '<g class="rays"><path d="' + rays + '" stroke="url(#gSun)" stroke-width="3.2" stroke-linecap="round" fill="none"/></g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#gSun)"/>';
  }
  function moonSvg(tx, ty, s) {
    return '<path transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="url(#gMoon)"/>';
  }
  function cloudSvg(tx, ty, s, fill, cls) {
    return '<path class="' + (cls || '') + '" transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')" d="' + CLOUD + '" fill="url(#' + (fill || 'gCloud') + ')"/>';
  }
  function drops(xs, color, len) {
    var out = '<g stroke="' + color + '" stroke-width="3" stroke-linecap="round">';
    for (var i = 0; i < xs.length; i++) {
      var y = 46 + (i % 2) * 4;
      out += '<path class="drop" d="M' + xs[i] + ' ' + y + 'l-2.5 ' + len + '"/>';
    }
    return out + '</g>';
  }
  function flakes() {
    var pts = [[23, 49], [33, 54], [43, 49], [28, 58], [38, 59]], out = '<g fill="#ffffff" stroke="#9cc8f0" stroke-width="1">';
    for (var i = 0; i < pts.length; i++) out += '<circle class="drop" cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="2.6"/>';
    return out + '</g>';
  }

  function weatherIcon(kind, day) {
    var s = '';
    switch (kind) {
      case 'clear':
        s = day ? sunSvg(32, 32, 12) : moonSvg(6, 6, 2.2);
        break;
      case 'partly':
        s = (day ? sunSvg(25, 24, 9.5) : moonSvg(4, 2, 1.55)) + cloudSvg(9, 13, 0.82, 'gCloud', 'float');
        break;
      case 'cloudy':
        s = cloudSvg(17, -2, 0.7, 'gCloudDark') + cloudSvg(2, 8, 0.86, 'gCloud', 'float');
        break;
      case 'fog':
        s = cloudSvg(4, -6, 0.88, 'gCloud') +
          '<g class="fogl" stroke-width="3.2" stroke-linecap="round"><path d="M14 48h30"/><path d="M20 55h32"/><path d="M12 62h24"/></g>';
        break;
      case 'drizzle':
        s = cloudSvg(3, -7, 0.92, 'gCloud') + drops([24, 33, 42], '#7cc2ff', 5);
        break;
      case 'rain':
        s = cloudSvg(3, -7, 0.92, 'gCloudDark') + drops([21, 29, 37, 45], '#5aafff', 8);
        break;
      case 'snow':
        s = cloudSvg(3, -8, 0.92, 'gCloud') + flakes();
        break;
      case 'storm':
        s = cloudSvg(3, -8, 0.92, 'gCloudDark') +
          '<path d="M34 40l-8 12h7l-4 11 11-15h-7l5-8z" fill="url(#gBolt)"/>' + drops([20, 48], '#5aafff', 6);
        break;
    }
    return '<svg class="wi" viewBox="0 0 64 64" aria-hidden="true">' + s + '</svg>';
  }

  /* Códigos WMO → texto e icono */
  function wmo(code) {
    var map = {
      0: ['Despejado', 'clear'], 1: ['Mayormente despejado', 'clear'], 2: ['Parcialmente nublado', 'partly'], 3: ['Nublado', 'cloudy'],
      45: ['Niebla', 'fog'], 48: ['Niebla con escarcha', 'fog'],
      51: ['Llovizna ligera', 'drizzle'], 53: ['Llovizna', 'drizzle'], 55: ['Llovizna intensa', 'drizzle'],
      56: ['Llovizna helada', 'drizzle'], 57: ['Llovizna helada', 'drizzle'],
      61: ['Lluvia ligera', 'rain'], 63: ['Lluvia', 'rain'], 65: ['Lluvia fuerte', 'rain'],
      66: ['Lluvia helada', 'rain'], 67: ['Lluvia helada fuerte', 'rain'],
      71: ['Nevada ligera', 'snow'], 73: ['Nevada', 'snow'], 75: ['Nevada fuerte', 'snow'], 77: ['Granizo fino', 'snow'],
      80: ['Chubascos ligeros', 'rain'], 81: ['Chubascos', 'rain'], 82: ['Chubascos fuertes', 'rain'],
      85: ['Chubascos de nieve', 'snow'], 86: ['Chubascos de nieve', 'snow'],
      95: ['Tormenta', 'storm'], 96: ['Tormenta con granizo', 'storm'], 99: ['Tormenta con granizo', 'storm']
    };
    var m = map[code] || ['—', 'cloudy'];
    return { text: m[0], icon: m[1] };
  }

  var STAT_ICONS = {
    hum: '<path d="M12 3.5c-3 4-6 7.2-6 10.5a6 6 0 0 0 12 0c0-3.3-3-6.5-6-10.5z"/>',
    wind: '<path d="M3 8h10.5a2.75 2.75 0 1 0-2.6-3.6M3 12h15a3 3 0 1 1-2.8 4M3 16h7"/>',
    rain: '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v6.5a2 2 0 0 0 4 0"/>',
    uv: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',
    rise: '<path d="M3.5 19h17M7 19a5 5 0 0 1 10 0M12 4.5v6M9 7.5l3-3 3 3"/>',
    set: '<path d="M3.5 19h17M7 19a5 5 0 0 1 10 0M12 4.5v6M9 7.5l3 3 3-3"/>'
  };
  function stat(icon, k, v) {
    return '<li><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + STAT_ICONS[icon] + '</svg><span><span class="k">' + k + '</span><span class="v">' + v + '</span></span></li>';
  }

  /* ==========================================================================
     Clima
     ========================================================================== */
  function renderWeather() {
    var w = state.weather;
    if (!w || !w.current || !w.daily) return;
    var c = w.current, d = w.daily, hr = w.hourly;
    var n = localNow(), today = dateKey(n);
    var di = d.time.indexOf(today);
    if (di < 0) di = 0;
    var info = wmo(c.weather_code);
    var day = state.isDay !== null ? state.isDay : !!c.is_day;
    var windUnit = settings.unit === 'f' ? ' mph' : ' km/h';

    el.nowIcon.innerHTML = weatherIcon(info.icon, day);
    setText(el.nowTemp, round(c.temperature_2m) + '°');
    setText(el.nowDesc, info.text);
    setText(el.nowSub, 'Máx ' + round(d.temperature_2m_max[di]) + '° · Mín ' + round(d.temperature_2m_min[di]) + '° · Sensación ' + round(c.apparent_temperature) + '°');

    var pp = d.precipitation_probability_max ? d.precipitation_probability_max[di] : null;
    var uv = d.uv_index_max ? d.uv_index_max[di] : null;
    el.stats.innerHTML =
      stat('hum', 'Humedad', round(c.relative_humidity_2m) + '%') +
      stat('wind', 'Viento', round(c.wind_speed_10m) + windUnit) +
      stat('rain', 'Lluvia', (pp === null || pp === undefined ? '—' : round(pp) + '%')) +
      stat('uv', 'Índice UV', round(uv)) +
      stat('rise', 'Amanecer', fmtIsoTime(d.sunrise[di])) +
      stat('set', 'Atardecer', fmtIsoTime(d.sunset[di]));

    // próximas horas
    var html = '';
    if (hr && hr.time) {
      var start = hr.time.indexOf(today + 'T' + pad2(n.h) + ':00');
      if (start < 0) start = 0;
      for (var i = start; i < Math.min(start + 8, hr.time.length); i++) {
        var hi = wmo(hr.weather_code[i]);
        var hh = parseInt(hr.time[i].split('T')[1], 10);
        var p = hr.precipitation_probability ? hr.precipitation_probability[i] : null;
        html += '<div class="hour' + (i === start ? ' now-h' : '') + '">' +
          '<span class="t">' + (i === start ? 'Ahora' : fmtHour(hh)) + '</span>' +
          '<span class="i">' + weatherIcon(hi.icon, hr.is_day ? !!hr.is_day[i] : true) + '</span>' +
          '<span class="v">' + round(i === start ? c.temperature_2m : hr.temperature_2m[i]) + '°</span>' +
          '<span class="p">' + (p >= 20 ? p + '%' : '') + '</span></div>';
      }
    }
    el.hours.innerHTML = html;

    // próximos días
    html = '';
    for (var j = di; j < Math.min(di + 6, d.time.length); j++) {
      var dj = wmo(d.weather_code[j]);
      var parts = d.time[j].split('-');
      var wd = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])).getUTCDay();
      var pj = d.precipitation_probability_max ? d.precipitation_probability_max[j] : null;
      html += '<div class="day' + (j === di ? ' today' : '') + '">' +
        '<span class="t">' + (j === di ? 'Hoy' : DAYS_SHORT[wd]) + '</span>' +
        '<span class="i">' + weatherIcon(dj.icon, true) + '</span>' +
        '<span class="v">' + round(d.temperature_2m_max[j]) + '°<small>' + round(d.temperature_2m_min[j]) + '°</small></span>' +
        '<span class="p">' + (pj >= 30 ? pj + '%' : '') + '</span></div>';
    }
    el.days.innerHTML = html;
  }

  var statusMsg = '';
  function renderStatus() {
    var w = state.weather, txt = '';
    if (statusMsg) txt = statusMsg;
    else if (w && w.fetchedAt) {
      var mins = Math.round((Date.now() - w.fetchedAt) / 60000);
      txt = 'Actualizado ' + (mins < 1 ? 'hace un momento' : mins < 60 ? 'hace ' + mins + ' min' : 'hace ' + Math.round(mins / 60) + ' h');
    }
    setText(el.status, (txt ? txt + ' · ' : '') + 'Clima: Open-Meteo.com');
  }

  var weatherTimer = 0, weatherReq = 0;
  function fetchWeather() {
    clearTimeout(weatherTimer);
    var loc = state.loc;
    if (!loc) return;
    var req = ++weatherReq;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max' +
      '&timezone=auto&forecast_days=7' +
      (settings.unit === 'f' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '');
    if (!state.weather) { statusMsg = 'Obteniendo clima…'; renderStatus(); }
    getJSON(url, 15000).then(function (w) {
      if (req !== weatherReq) return;
      w.fetchedAt = Date.now();
      w.key = weatherKey();
      setWeather(w);
      store.set('weather', w);
      statusMsg = '';
      renderStatus();
      weatherTimer = setTimeout(fetchWeather, 15 * 60 * 1000);
    }, function () {
      if (req !== weatherReq) return;
      statusMsg = state.weather ? 'Sin conexión, mostrando datos guardados' : 'No se pudo cargar el clima, reintentando…';
      renderStatus();
      weatherTimer = setTimeout(fetchWeather, 60 * 1000);
    });
  }

  function weatherKey() {
    return state.loc ? state.loc.lat + ',' + state.loc.lon + ',' + settings.unit : '';
  }

  function setWeather(w) {
    var hadAuto = settings.bg === 'auto' ? autoScene() : null;
    state.weather = w;
    state.offset = typeof w.utc_offset_seconds === 'number' ? w.utc_offset_seconds : null;
    lastMinute = -1;
    lastHour = -1;
    state.isDay = computeIsDay();
    applyTheme();
    tick();
    renderWeather();
    if (settings.bg === 'auto' && autoScene() !== hadAuto) applyBackground();
  }

  /* ==========================================================================
     Ubicación
     ========================================================================== */
  function joinName(city, region) {
    if (!city && !region) return '';
    if (!city) return region;
    if (!region || region === city) return city;
    return city + ', ' + region;
  }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  function reverseGeocode(lat, lon) {
    return getJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=es', 8000)
      .then(function (r) {
        var name = joinName(r.city || r.locality, r.principalSubdivision || r.countryName);
        if (!name) throw new Error('vacío');
        return name;
      })
      .catch(function () {
        return getJSON('https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=es&lat=' + lat + '&lon=' + lon, 8000)
          .then(function (r) {
            var a = r.address || {};
            var name = joinName(a.city || a.town || a.village || a.municipality || a.county, a.state || a.country);
            if (!name) throw new Error('vacío');
            return name;
          });
      });
  }

  function ipLocation() {
    function make(lat, lon, city, region) {
      lat = parseFloat(lat); lon = parseFloat(lon);
      if (isNaN(lat) || isNaN(lon)) throw new Error('sin coordenadas');
      return { lat: round3(lat), lon: round3(lon), name: joinName(city, region) || 'Ubicación aproximada', source: 'ip' };
    }
    return firstOk([
      function () { return getJSON('https://get.geojs.io/v1/ip/geo.json', 8000).then(function (r) { return make(r.latitude, r.longitude, r.city, r.region); }); },
      function () { return getJSON('https://ipapi.co/json/', 8000).then(function (r) { return make(r.latitude, r.longitude, r.city, r.region); }); },
      function () { return getJSON('https://ipwho.is/', 8000).then(function (r) { if (r.success === false) throw new Error('ipwho'); return make(r.latitude, r.longitude, r.city, r.region); }); }
    ]).then(function (loc) {
      // nombre en español a partir de las coordenadas
      return reverseGeocode(loc.lat, loc.lon).then(function (name) { loc.name = name; return loc; }, function () { return loc; });
    });
  }

  function gpsPosition(onLate) {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject({ code: 0 }); return; }
      var settled = false;
      // algunas TV nunca responden: no esperamos más de 20 s
      var timer = setTimeout(function () { settled = true; reject({ code: 3 }); }, 20000);
      navigator.geolocation.getCurrentPosition(function (p) {
        if (settled) { if (onLate) onLate(p); return; }
        settled = true; clearTimeout(timer); resolve(p);
      }, function (e) {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(e);
      }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60 * 1000 });
    });
  }

  function fromPosition(p) {
    var lat = round3(p.coords.latitude), lon = round3(p.coords.longitude);
    return reverseGeocode(lat, lon).then(function (name) {
      return { lat: lat, lon: lon, name: name, source: 'gps' };
    }, function () {
      return { lat: lat, lon: lon, name: 'Mi ubicación', source: 'gps' };
    });
  }

  var locating = false;
  function locate(userAsked) {
    if (locating) return;
    locating = true;
    if (!state.loc) setText(el.locName, 'Buscando ubicación…');
    if (userAsked) toast('Buscando tu ubicación…');
    gpsPosition(function late(p) {
      // el usuario aceptó el permiso tarde: mejoramos la ubicación aproximada
      if (state.loc && state.loc.source === 'ip') fromPosition(p).then(setLocation);
    })
      .then(fromPosition, function (err) {
        if (userAsked) {
          toast(err && err.code === 1
            ? 'Permiso de ubicación denegado. Usando ubicación aproximada.'
            : 'GPS no disponible. Usando ubicación aproximada.', 3600);
        }
        return ipLocation();
      })
      .then(function (loc) {
        locating = false;
        setLocation(loc);
        if (userAsked) toast('Ubicación: ' + loc.name);
      }, function () {
        locating = false;
        if (!state.loc) {
          setText(el.locName, 'Elige tu ciudad');
          toast('No se pudo detectar tu ubicación. Elígela en Ajustes.', 4500);
        }
      });
  }

  function setLocation(loc) {
    // el GPS varía unos metros entre lecturas: no recargar el clima por eso
    var old = state.loc;
    var near = old && Math.abs(old.lat - loc.lat) < 0.02 && Math.abs(old.lon - loc.lon) < 0.02;
    if (near) { loc.lat = old.lat; loc.lon = old.lon; }
    state.loc = loc;
    store.set('loc', loc);
    renderLocation();
    if (!near || !state.weather) fetchWeather();
  }

  var SOURCE_LABEL = { gps: 'GPS', ip: 'Aproximada', manual: 'Elegida' };
  function renderLocation() {
    var loc = state.loc;
    setText(el.locName, loc ? loc.name : 'Buscando ubicación…');
    setText(el.panelLoc, loc ? loc.name : 'Sin ubicación');
    setText(el.panelLocSrc, loc ? SOURCE_LABEL[loc.source] || '' : '');
    el.panelLocSrc.style.display = loc ? '' : 'none';
  }

  function searchCity(q) {
    el.results.innerHTML = '<p class="empty">Buscando…</p>';
    getJSON('https://geocoding-api.open-meteo.com/v1/search?count=8&language=es&format=json&name=' + encodeURIComponent(q), 10000)
      .then(function (r) {
        var list = r.results || [];
        if (!list.length) { el.results.innerHTML = '<p class="empty">No encontré esa ciudad. Prueba con otro nombre.</p>'; return; }
        el.results.innerHTML = list.map(function (c) {
          var region = [c.admin1, c.country].filter(Boolean).join(', ');
          return '<button class="chip" type="button" data-city="' + esc(JSON.stringify({ lat: round3(c.latitude), lon: round3(c.longitude), name: joinName(c.name, c.admin1 || c.country) })) + '">' +
            esc(c.name) + (region ? '<small>' + esc(region) + '</small>' : '') + '</button>';
        }).join('');
        var first = el.results.querySelector('button');
        if (first && root.className.indexOf('using-keys') >= 0) first.focus();
      }, function () {
        el.results.innerHTML = '<p class="empty">Sin conexión. Inténtalo de nuevo.</p>';
      });
  }

  /* ==========================================================================
     Ajustes
     ========================================================================== */
  function chip(attrs, label, swatch) {
    return '<button class="chip" type="button" ' + attrs + '>' +
      (swatch ? '<span class="sw" style="background:' + swatch + '"></span>' : '') + esc(label) + '</button>';
  }

  function buildBgChips() {
    var html = chip('data-set="bg" data-value="auto"', 'Automático', 'conic-gradient(#ffd56b,#7cc4e4,#5a6b8c,#ffd56b)');
    Scenes.list.forEach(function (s) { html += chip('data-set="bg" data-value="' + s.id + '"', s.name, s.swatch); });
    el.sceneChips.innerHTML = html;
    html = '';
    videoList().forEach(function (v) { html += chip('data-set="bg" data-value="' + v.id + '"', v.name, v.swatch); });
    el.videoChips.innerHTML = html;
  }

  function syncChips() {
    toArray(el.panel.querySelectorAll('[data-set]')).forEach(function (b) {
      var key = b.getAttribute('data-set');
      b.setAttribute('aria-pressed', String(settings[key]) === b.getAttribute('data-value') ? 'true' : 'false');
    });
  }

  function parseValue(v) { return v === 'true' ? true : v === 'false' ? false : v; }

  function setSetting(key, value) {
    settings[key] = value;
    store.set(key, value);
    switch (key) {
      case 'theme': applyTheme(); break;
      case 'bg': applyBackground(); break;
      case 'hour12': lastMinute = -1; tick(); renderWeather(); break;
      case 'seconds': body.classList.toggle('no-seconds', !value); break;
      case 'forecast': body.classList.toggle('minimal', !value); break;
      case 'unit': fetchWeather(); break;
      case 'quality': root.setAttribute('data-quality', value); Scenes.setQuality(value); break;
      case 'customVideo': buildBgChips(); break;
    }
    syncChips();
  }

  /* Ajustes desde la URL, útil para guardar un favorito en la TV:
     ?bg=v-olas&theme=dark&forecast=false */
  function readUrlParams() {
    var q = location.search.replace(/^\?/, '');
    if (!q) return;
    q.split('&').forEach(function (pair) {
      var kv = pair.split('='), k = decodeURIComponent(kv[0] || ''), v = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      if (!(k in settings) || k === 'customVideo') return;
      settings[k] = parseValue(v);
      store.set(k, settings[k]);
    });
  }

  /* ---------- panel ---------- */
  var panelOpen = false, lastFocus = null, closeTimer = 0;
  function openPanel(sectionId) {
    clearTimeout(closeTimer);
    panelOpen = true;
    lastFocus = document.activeElement;
    syncChips();
    renderLocation();
    el.overlay.hidden = false;
    // forzar reflow para que se vea la transición
    void el.overlay.offsetWidth;
    el.overlay.className = 'overlay open';
    body.classList.remove('idle');
    var section = sectionId ? $(sectionId) : null;
    var target = (section || el.panel).querySelector('[aria-pressed="true"]') || (section || el.panel).querySelector('button');
    if (section) el.panelBody.scrollTop = section.offsetTop - 12;
    else el.panelBody.scrollTop = 0;
    if (target) setTimeout(function () { target.focus(); }, 60);
  }
  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    el.overlay.className = 'overlay';
    closeTimer = setTimeout(function () { el.overlay.hidden = true; }, 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    wake();
  }

  /* ==========================================================================
     Pantalla completa y pantalla siempre encendida
     ========================================================================== */
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
  }
  function toggleFullscreen() {
    var d = document.documentElement, r;
    if (fsElement()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) exit.call(document);
      return;
    }
    var req = d.requestFullscreen || d.webkitRequestFullscreen || d.webkitRequestFullScreen || d.mozRequestFullScreen || d.msRequestFullscreen;
    if (!req) {
      toast(IS_IOS
        ? 'En iPhone/iPad: toca Compartir → "Agregar a inicio" y ábrela desde ahí, sin barra de URL.'
        : 'Este navegador no permite pantalla completa. Busca la opción en el menú del navegador.', 5500);
      return;
    }
    try {
      r = req.call(d, { navigationUI: 'hide' });
      if (r && r.catch) r.catch(function () { toast('El navegador bloqueó la pantalla completa.'); });
    } catch (e) {
      toast('El navegador bloqueó la pantalla completa.');
    }
    requestWakeLock();
  }
  function onFsChange() {
    el.fsIcon.innerHTML = fsElement()
      ? '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'
      : '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
  }
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (ev) {
    document.addEventListener(ev, onFsChange);
  });

  var wakeLock = null;
  function requestWakeLock() {
    if (wakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* no disponible */ });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      // al volver tras horas en segundo plano, refrescar datos viejos
      if (state.weather && Date.now() - state.weather.fetchedAt > 15 * 60 * 1000) fetchWeather();
    }
  });

  /* ==========================================================================
     Controles: ocultar al estar inactivo, foco con control remoto
     ========================================================================== */
  var idleTimer = 0;
  function wake() {
    body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!panelOpen) body.classList.add('idle');
    }, 5000);
  }

  function isVisible(node) {
    if (node.disabled) return false;
    var r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function focusables() {
    var scope = panelOpen ? el.panel : el.stage;
    return toArray(scope.querySelectorAll('button, input')).filter(isVisible);
  }

  /* Navegación espacial: mueve el foco al elemento más cercano en esa dirección */
  function moveFocus(dir) {
    var items = focusables();
    if (!items.length) return;
    var cur = document.activeElement;
    if (items.indexOf(cur) < 0) {
      var start = panelOpen ? (el.panel.querySelector('[aria-pressed="true"]') || items[0]) : el.toolbar.querySelector('button');
      start.focus();
      return;
    }
    var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = null, bestScore = Infinity;
    for (var i = 0; i < items.length; i++) {
      var node = items[i];
      if (node === cur) continue;
      var b = node.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      var main, cross, overlap;
      if (dir === 'left' || dir === 'right') {
        main = dir === 'left' ? a.left - b.right : b.left - a.right;
        if ((dir === 'left' ? ax - bx : bx - ax) <= 1) continue;
        cross = Math.abs(by - ay);
        overlap = b.bottom > a.top + 2 && b.top < a.bottom - 2;
      } else {
        main = dir === 'up' ? a.top - b.bottom : b.top - a.bottom;
        if ((dir === 'up' ? ay - by : by - ay) <= 1) continue;
        cross = Math.abs(bx - ax);
        overlap = b.right > a.left + 2 && b.left < a.right - 2;
      }
      var score = Math.max(main, 0) + cross * (overlap ? 0.3 : 2.5) + (overlap ? 0 : 40);
      if (score < bestScore) { bestScore = score; best = node; }
    }
    if (best) best.focus();
  }

  function keyDir(e) {
    var k = e.key, c = e.keyCode;
    if (k === 'ArrowLeft' || k === 'Left' || c === 37) return 'left';
    if (k === 'ArrowUp' || k === 'Up' || c === 38) return 'up';
    if (k === 'ArrowRight' || k === 'Right' || c === 39) return 'right';
    if (k === 'ArrowDown' || k === 'Down' || c === 40) return 'down';
    return null;
  }

  document.addEventListener('keydown', function (e) {
    var c = e.keyCode, k = e.key;
    var wasIdle = body.classList.contains('idle');
    wake();
    root.classList.add('using-keys');
    requestWakeLock();
    resumeVideo();

    var isBack = c === 27 || c === 10009 || c === 461 || k === 'Escape' || k === 'Esc' || k === 'GoBack' || k === 'BrowserBack';
    if (isBack) {
      if (panelOpen) { e.preventDefault(); closePanel(); }
      return;
    }

    var active = document.activeElement;
    var typing = active && active.tagName === 'INPUT';
    var dir = keyDir(e);
    if (dir) {
      if (typing && (dir === 'left' || dir === 'right')) return;
      e.preventDefault();
      moveFocus(dir);
      return;
    }
    if (typing) return;
    if ((c === 13 || k === 'Enter') && wasIdle && !panelOpen) { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    var ch = (k || '').toLowerCase();
    if (ch === 'f' || c === 405) { e.preventDefault(); toggleFullscreen(); }
    else if (ch === 't' || c === 404) { e.preventDefault(); cycleTheme(); }
    else if (ch === 'b' || ch === 'n' || c === 403) { e.preventDefault(); nextBackground(); }
    else if (ch === 's' || ch === ',' || c === 406) { e.preventDefault(); if (panelOpen) closePanel(); else openPanel(); }
  });

  ['mousemove', 'mousedown', 'touchstart', 'wheel'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (ev !== 'mousemove') root.classList.remove('using-keys');
      wake();
      if (ev !== 'mousemove') { requestWakeLock(); resumeVideo(); }
    }, { passive: true });
  });

  /* Reflejo del vidrio que sigue al puntero */
  var glassEls = toArray(document.querySelectorAll('.glass')), pointer = null, pointerRaf = 0;
  document.addEventListener('mousemove', function (e) {
    pointer = e;
    if (!pointerRaf) pointerRaf = requestAnimationFrame(function () {
      pointerRaf = 0;
      for (var i = 0; i < glassEls.length; i++) {
        var r = glassEls[i].getBoundingClientRect();
        if (!r.width) continue;
        glassEls[i].style.setProperty('--mx', ((pointer.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        glassEls[i].style.setProperty('--my', ((pointer.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      }
    });
  });

  function resumeVideo() {
    if (el.video.getAttribute('src') && el.video.paused) {
      var p = el.video.play();
      if (p && p.catch) p.catch(function () { /* noop */ });
    }
  }

  function cycleTheme() {
    var order = ['auto', 'light', 'dark'];
    var next = order[(order.indexOf(settings.theme) + 1) % order.length];
    setSetting('theme', next);
    toast({ auto: 'Tema automático (día/noche)', light: 'Modo claro', dark: 'Modo oscuro' }[next]);
  }

  /* ---------- clics ---------- */
  document.addEventListener('click', function (e) {
    var t = closest(e.target, '[data-action], [data-set], [data-city], #locBtn');
    if (!t) {
      if (panelOpen && e.target === el.overlay) closePanel();
      return;
    }
    if (t.id === 'locBtn') { openPanel('secLoc'); return; }
    if (t.hasAttribute('data-set')) {
      setSetting(t.getAttribute('data-set'), parseValue(t.getAttribute('data-value')));
      return;
    }
    if (t.hasAttribute('data-city')) {
      var c = JSON.parse(t.getAttribute('data-city'));
      c.source = 'manual';
      setLocation(c);
      el.results.innerHTML = '';
      el.searchInput.value = '';
      toast('Ubicación: ' + c.name);
      closePanel();
      return;
    }
    switch (t.getAttribute('data-action')) {
      case 'bg': nextBackground(); break;
      case 'theme': cycleTheme(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'settings': openPanel(); break;
      case 'close': closePanel(); break;
      case 'locate': locate(true); break;
    }
  });

  el.searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = el.searchInput.value.replace(/^\s+|\s+$/g, '');
    if (q.length > 1) searchCity(q);
  });

  el.videoForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = el.videoUrl.value.replace(/^\s+|\s+$/g, '');
    if (!/^https?:\/\//i.test(url) && !/\.(mp4|webm|m4v|mov)(\?|$)/i.test(url)) { toast('Pega un enlace a un video (.mp4 o .webm)'); return; }
    delete videoFailed[url];
    setSetting('customVideo', url);
    setSetting('bg', 'v-custom');
    toast('Fondo: Mi video');
  });

  /* Protección contra marcas en pantallas OLED: el contenido se mueve unos píxeles */
  setInterval(function () {
    if (panelOpen) return;
    var x = Math.round((Math.random() - 0.5) * 12), y = Math.round((Math.random() - 0.5) * 10);
    el.stage.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }, 120000);

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onScheme = function () { if (settings.theme === 'auto' && state.isDay === null) applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
  }

  /* ==========================================================================
     Inicio
     ========================================================================== */
  function boot() {
    readUrlParams();
    root.setAttribute('data-quality', settings.quality);
    body.classList.toggle('no-seconds', !settings.seconds);
    body.classList.toggle('minimal', !settings.forecast);
    Scenes.init(el.canvas);
    Scenes.setQuality(settings.quality);
    buildBgChips();

    // datos guardados para mostrar algo al instante
    var cached = store.get('weather', null);
    renderLocation();
    if (state.loc && cached && cached.key === weatherKey() && Date.now() - cached.fetchedAt < 6 * 3600 * 1000) {
      setWeather(cached);
    } else {
      applyTheme();
      tick();
    }
    applyBackground();
    renderStatus();
    onFsChange();
    wake();
    requestWakeLock();

    if (state.loc && state.loc.source === 'manual') {
      fetchWeather();
    } else {
      if (state.loc) fetchWeather();
      locate(false);
    }
  }

  boot();
})();
