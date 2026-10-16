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
       { id: 'v-mio', name: { es: 'Mi video', en: 'My video' }, src: 'videos/mi-video.mp4', swatch: '#345' }
     -------------------------------------------------------------------------- */
  function mixkit(id) { return 'https://assets.mixkit.co/videos/' + id + '/' + id + '-720.mp4'; }
  var VIDEOS = [
    { id: 'v-olas', name: { es: 'Olas en la playa', en: 'Beach waves' }, src: mixkit(5016), swatch: 'linear-gradient(180deg,#7cc4e4,#1f7fa8)' },
    { id: 'v-atardecer', name: { es: 'Atardecer en la playa', en: 'Beach sunset' }, src: mixkit(44498), swatch: 'linear-gradient(180deg,#f7b267,#c0577a)' },
    { id: 'v-lluvia-hojas', name: { es: 'Lluvia en las hojas', en: 'Rain on leaves' }, src: mixkit(2206), swatch: 'linear-gradient(180deg,#5c8a4a,#1f3d2a)' },
    { id: 'v-lluvia-lago', name: { es: 'Lluvia en el lago', en: 'Rain on the lake' }, src: mixkit(18312), swatch: 'linear-gradient(180deg,#8aa0ad,#3b4f5c)' },
    { id: 'v-cascada', name: { es: 'Cascada en el bosque', en: 'Forest waterfall' }, src: mixkit(2213), swatch: 'linear-gradient(180deg,#9fd3c7,#2f6b4f)' },
    { id: 'v-aurora', name: { es: 'Aurora boreal', en: 'Northern lights' }, src: mixkit(4038), swatch: 'linear-gradient(180deg,#0b1d3a,#28c08a)' },
    { id: 'v-estrellas', name: { es: 'Estrellas sobre el lago', en: 'Stars over the lake' }, src: mixkit(1704), swatch: 'linear-gradient(180deg,#0a0f2c,#3b4a8a)' },
    { id: 'v-nieve', name: { es: 'Nieve en el bosque', en: 'Snowy forest' }, src: mixkit(3352), swatch: 'linear-gradient(180deg,#dfe8f1,#7d93ad)' },
    { id: 'v-chimenea', name: { es: 'Chimenea', en: 'Fireplace' }, src: mixkit(2709), swatch: 'linear-gradient(180deg,#ffb347,#7a2e0e)' },
    { id: 'v-nubes', name: { es: 'Nubes', en: 'Clouds' }, src: mixkit(2408), swatch: 'linear-gradient(180deg,#3f8fdc,#ffffff)' }
  ];

  /* Fuentes disponibles para el reloj y los widgets (cargadas en index.html).
     w = grosor del reloj, ww = grosor de la temperatura en los widgets */
  var FONTS = [
    { id: 'inter', family: "'Inter'", w: 200, ww: 300, name: { es: 'Moderna', en: 'Modern' } },
    { id: 'quicksand', family: "'Quicksand'", w: 300, ww: 400, name: { es: 'Redondeada', en: 'Rounded' } },
    { id: 'playfair', family: "'Playfair Display'", w: 400, ww: 500, name: { es: 'Elegante', en: 'Elegant' } },
    { id: 'bebas', family: "'Bebas Neue'", w: 400, ww: 400, name: { es: 'Condensada', en: 'Condensed' } },
    { id: 'orbitron', family: "'Orbitron'", w: 400, ww: 500, name: { es: 'Futurista', en: 'Futuristic' } },
    { id: 'mono', family: "'JetBrains Mono'", w: 200, ww: 300, name: { es: 'Monoespaciada', en: 'Monospace' } },
    { id: 'caveat', family: "'Caveat'", w: 500, ww: 600, name: { es: 'Manuscrita', en: 'Handwritten' } },
    { id: 'righteous', family: "'Righteous'", w: 400, ww: 400, name: { es: 'Retro', en: 'Retro' } }
  ];

  var CLOCK_STYLES = ['classic', 'floating', 'stacked', 'analog', 'flip', 'neon'];
  var CLOCK_COLORS = [
    { id: 'auto', sw: 'linear-gradient(135deg,#ffffff 50%,#1b1f2a 50%)' },
    { id: 'gold', sw: '#ffd58a' },
    { id: 'mint', sw: '#8ff3d2' },
    { id: 'lavender', sw: '#cbb8ff' },
    { id: 'coral', sw: '#ffab94' },
    { id: 'ice', sw: '#a9dcff' },
    { id: 'gradient', sw: 'linear-gradient(135deg,#ffb2d6,#c9a7ff 50%,#8fd6ff)' }
  ];
  var WIDGET_STYLES = ['full', 'compact', 'side', 'tiles', 'hidden'];
  var GLASS_STYLES = ['liquid', 'clear', 'frosted', 'solid'];

  /* --------------------------------------------------------------------------
     Textos de la interfaz (español / inglés)
     -------------------------------------------------------------------------- */
  var I18N = {
    es: {
      title: 'Calma — Reloj y clima',
      days: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
      daysShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      am: 'a. m.', pm: 'p. m.',
      now: 'Ahora', today: 'Hoy',
      hiLoFeels: 'Máx {0}° · Mín {1}° · Sensación {2}°',
      hiLo: 'Máx {0}° · Mín {1}°',
      feels: 'Sensación {0}°',
      humidity: 'Humedad', wind: 'Viento', rain: 'Lluvia', uv: 'Índice UV', sunrise: 'Amanecer', sunset: 'Atardecer',
      updatedNow: 'Actualizado hace un momento', updatedMin: 'Actualizado hace {0} min', updatedH: 'Actualizado hace {0} h',
      weatherCredit: 'Clima: Open-Meteo.com',
      gettingWeather: 'Obteniendo clima…',
      offline: 'Sin conexión, mostrando datos guardados',
      weatherFail: 'No se pudo cargar el clima, reintentando…',
      loadingWeather: 'Cargando clima…',
      findingLocation: 'Buscando ubicación…',
      myLocation: 'Mi ubicación', approxLocation: 'Ubicación aproximada', noLocation: 'Sin ubicación', chooseCity: 'Elige tu ciudad',
      src_gps: 'GPS', src_ip: 'Aproximada', src_manual: 'Elegida',
      locating: 'Buscando tu ubicación…',
      gpsDenied: 'Permiso de ubicación denegado. Usando ubicación aproximada.',
      gpsUnavailable: 'GPS no disponible. Usando ubicación aproximada.',
      locationIs: 'Ubicación: {0}',
      locateFail: 'No se pudo detectar tu ubicación. Elígela en Ajustes.',
      searching: 'Buscando…',
      notFound: 'No encontré esa ciudad. Prueba con otro nombre.',
      searchOffline: 'Sin conexión. Inténtalo de nuevo.',
      videoFail: 'No se pudo cargar el video. Mostrando una animación.',
      bgIs: 'Fondo: {0}',
      autoBg: 'Automático (según el clima)',
      myVideo: 'Mi video',
      themeToast_auto: 'Tema automático (día/noche)', themeToast_light: 'Modo claro', themeToast_dark: 'Modo oscuro',
      fsIos: 'En iPhone/iPad: toca Compartir → "Agregar a inicio" y ábrela desde ahí, sin barra de URL.',
      fsUnsupported: 'Este navegador no permite pantalla completa. Busca la opción en el menú del navegador.',
      fsBlocked: 'El navegador bloqueó la pantalla completa.',
      badVideo: 'Pega un enlace a un video (.mp4 o .webm)',
      langToast: 'Idioma: Español',
      scene_aurora: 'Aurora', scene_ocean: 'Océano', scene_clouds: 'Cielo', scene_rain: 'Lluvia',
      scene_snow: 'Nieve', scene_stars: 'Noche estrellada', scene_fireflies: 'Luciérnagas',
      cstyle_classic: 'Clásico', cstyle_floating: 'Flotante', cstyle_stacked: 'Apilado',
      cstyle_analog: 'Analógico', cstyle_flip: 'Flip', cstyle_neon: 'Neón',
      color_auto: 'Automático', color_gold: 'Dorado', color_mint: 'Menta', color_lavender: 'Lavanda',
      color_coral: 'Coral', color_ice: 'Hielo', color_gradient: 'Degradado',
      wstyle_full: 'Completo', wstyle_compact: 'Compacto', wstyle_side: 'Lateral', wstyle_tiles: 'Mosaico', wstyle_hidden: 'Oculto',
      // textos fijos del HTML (data-i18n)
      changeLocation: 'Cambiar ubicación',
      controls: 'Controles',
      changeBg: 'Cambiar fondo', changeBgKey: 'Cambiar fondo (B)',
      changeTheme: 'Cambiar tema', changeThemeKey: 'Modo claro / oscuro (T)',
      fullscreen: 'Pantalla completa', fullscreenKey: 'Pantalla completa (F)',
      settings: 'Ajustes', settingsKey: 'Ajustes (S)', closeSettings: 'Cerrar ajustes',
      nextHours: 'Próximas horas', nextDays: 'Próximos días',
      appearance: 'Apariencia', clock: 'Reloj', weatherTab: 'Clima',
      theme: 'Tema', light: 'Claro', dark: 'Oscuro', auto: 'Automático',
      themeHint: 'Automático usa modo claro de día y oscuro al anochecer en tu ciudad.',
      language: 'Idioma',
      glass: 'Vidrio', glass_liquid: 'Líquido', glass_clear: 'Transparente', glass_frosted: 'Esmerilado', glass_solid: 'Sólido (más rápido)',
      glassHint: 'Sólido quita la transparencia: úsalo si tu TV va lenta.',
      style: 'Estilo', font: 'Fuente', color: 'Color', layout: 'Diseño',
      background: 'Fondo', animations: 'Animaciones', videos: 'Videos',
      videoPh: 'O pega la URL de un video .mp4', use: 'Usar',
      location: 'Ubicación', current: 'Actual', useMyLocation: 'Usar mi ubicación actual', searchPh: 'Buscar otra ciudad…', search: 'Buscar',
      timeFormat: 'Formato de hora', seconds: 'Segundos', show: 'Mostrar', hide: 'Ocultar',
      temperature: 'Temperatura',
      performance: 'Rendimiento', highQuality: 'Alta calidad', eco: 'Ahorro (Smart TV)',
      footHtml: 'Control remoto: flechas para moverte, OK para elegir y CH+/CH− para desplazarte. Teclado: <kbd>F</kbd> pantalla completa · <kbd>T</kbd> tema · <kbd>L</kbd> idioma · <kbd>B</kbd> fondo · <kbd>S</kbd> ajustes.',
      wmo: {
        0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
        45: 'Niebla', 48: 'Niebla con escarcha',
        51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada',
        61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada fuerte',
        71: 'Nevada ligera', 73: 'Nevada', 75: 'Nevada fuerte', 77: 'Granizo fino',
        80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos fuertes', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve',
        95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo'
      }
    },
    en: {
      title: 'Calma — Clock & weather',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      am: 'AM', pm: 'PM',
      now: 'Now', today: 'Today',
      hiLoFeels: 'High {0}° · Low {1}° · Feels like {2}°',
      hiLo: 'High {0}° · Low {1}°',
      feels: 'Feels like {0}°',
      humidity: 'Humidity', wind: 'Wind', rain: 'Rain', uv: 'UV index', sunrise: 'Sunrise', sunset: 'Sunset',
      updatedNow: 'Updated just now', updatedMin: 'Updated {0} min ago', updatedH: 'Updated {0} h ago',
      weatherCredit: '',
      gettingWeather: 'Getting the weather…',
      offline: 'Offline, showing saved data',
      weatherFail: "Couldn't load the weather, retrying…",
      loadingWeather: 'Loading weather…',
      findingLocation: 'Finding your location…',
      myLocation: 'My location', approxLocation: 'Approximate location', noLocation: 'No location', chooseCity: 'Choose your city',
      src_gps: 'GPS', src_ip: 'Approximate', src_manual: 'Chosen',
      locating: 'Finding your location…',
      gpsDenied: 'Location permission denied. Using an approximate location.',
      gpsUnavailable: 'GPS unavailable. Using an approximate location.',
      locationIs: 'Location: {0}',
      locateFail: "Couldn't detect your location. Choose it in Settings.",
      searching: 'Searching…',
      notFound: "Couldn't find that city. Try another name.",
      searchOffline: 'No connection. Please try again.',
      videoFail: "Couldn't load the video. Showing an animation instead.",
      bgIs: 'Background: {0}',
      autoBg: 'Automatic (matches the weather)',
      myVideo: 'My video',
      themeToast_auto: 'Automatic theme (day/night)', themeToast_light: 'Light mode', themeToast_dark: 'Dark mode',
      fsIos: 'On iPhone/iPad: tap Share → "Add to Home Screen" and open it from there, without the URL bar.',
      fsUnsupported: "This browser doesn't support full screen. Look for the option in the browser menu.",
      fsBlocked: 'The browser blocked full screen.',
      badVideo: 'Paste a link to a video (.mp4 or .webm)',
      langToast: 'Language: English',
      scene_aurora: 'Aurora', scene_ocean: 'Ocean', scene_clouds: 'Sky', scene_rain: 'Rain',
      scene_snow: 'Snow', scene_stars: 'Starry night', scene_fireflies: 'Fireflies',
      cstyle_classic: 'Classic', cstyle_floating: 'Floating', cstyle_stacked: 'Stacked',
      cstyle_analog: 'Analog', cstyle_flip: 'Flip', cstyle_neon: 'Neon',
      color_auto: 'Automatic', color_gold: 'Gold', color_mint: 'Mint', color_lavender: 'Lavender',
      color_coral: 'Coral', color_ice: 'Ice', color_gradient: 'Gradient',
      wstyle_full: 'Full', wstyle_compact: 'Compact', wstyle_side: 'Sidebar', wstyle_tiles: 'Tiles', wstyle_hidden: 'Hidden',
      changeLocation: 'Change location',
      controls: 'Controls',
      changeBg: 'Change background', changeBgKey: 'Change background (B)',
      changeTheme: 'Change theme', changeThemeKey: 'Light / dark mode (T)',
      fullscreen: 'Full screen', fullscreenKey: 'Full screen (F)',
      settings: 'Settings', settingsKey: 'Settings (S)', closeSettings: 'Close settings',
      nextHours: 'Next hours', nextDays: 'Next days',
      appearance: 'Appearance', clock: 'Clock', weatherTab: 'Weather',
      theme: 'Theme', light: 'Light', dark: 'Dark', auto: 'Automatic',
      themeHint: 'Automatic uses light mode during the day and dark mode after sunset in your city.',
      language: 'Language',
      glass: 'Glass', glass_liquid: 'Liquid', glass_clear: 'Clear', glass_frosted: 'Frosted', glass_solid: 'Solid (faster)',
      glassHint: 'Solid removes transparency: use it if your TV feels slow.',
      style: 'Style', font: 'Font', color: 'Color', layout: 'Layout',
      background: 'Background', animations: 'Animations', videos: 'Videos',
      videoPh: 'Or paste the URL of an .mp4 video', use: 'Use',
      location: 'Location', current: 'Current', useMyLocation: 'Use my current location', searchPh: 'Search for another city…', search: 'Search',
      timeFormat: 'Time format', seconds: 'Seconds', show: 'Show', hide: 'Hide',
      temperature: 'Temperature',
      performance: 'Performance', highQuality: 'High quality', eco: 'Power saving (Smart TV)',
      footHtml: 'Remote: arrows to move, OK to select and CH+/CH− to scroll. Keyboard: <kbd>F</kbd> full screen · <kbd>T</kbd> theme · <kbd>L</kbd> language · <kbd>B</kbd> background · <kbd>S</kbd> settings.',
      wmo: {
        0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy',
        45: 'Fog', 48: 'Freezing fog',
        51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
        61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
        71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
        80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail'
      }
    }
  };

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

  function ids(list) { return list.map(function (x) { return typeof x === 'string' ? x : x.id; }); }

  var DEFAULTS = {
    lang: 'es', theme: 'auto', bg: 'auto', hour12: false, seconds: true, unit: 'c',
    quality: IS_TV ? 'eco' : 'high', customVideo: '',
    clockStyle: 'classic', clockFont: 'inter', clockColor: 'auto',
    widgetStyle: 'full', widgetFont: 'inter', glass: 'liquid'
  };
  /* Valores válidos de cada ajuste (lo demás se descarta) */
  var ENUMS = {
    lang: ['es', 'en'], theme: ['auto', 'light', 'dark'], unit: ['c', 'f'], quality: ['high', 'eco'],
    clockStyle: CLOCK_STYLES, clockFont: ids(FONTS), clockColor: ids(CLOCK_COLORS),
    widgetStyle: WIDGET_STYLES, widgetFont: ids(FONTS), glass: GLASS_STYLES
  };
  function isValid(key, v) {
    if (ENUMS[key]) return ENUMS[key].indexOf(v) >= 0;
    if (typeof DEFAULTS[key] === 'boolean') return typeof v === 'boolean';
    return typeof v === 'string';
  }

  var settings = {};
  (function () {
    for (var k in DEFAULTS) {
      var v = store.get(k, DEFAULTS[k]);
      settings[k] = isValid(k, v) ? v : DEFAULTS[k];
    }
    // versiones anteriores tenían "forecast: false" (solo reloj)
    if (store.get('widgetStyle', null) === null && store.get('forecast', true) === false) settings.widgetStyle = 'compact';
  })();

  var state = {
    loc: store.get('loc', null),             // { lat, lon, name, source: gps|ip|manual }
    weather: null,
    offset: null,                            // desfase UTC de la ciudad (segundos)
    isDay: null
  };

  /* ---------- traducción ---------- */
  function dict() { return I18N[settings.lang] || I18N.es; }
  function t(key, a, b, c) {
    var s = dict()[key];
    if (s === undefined) s = I18N.es[key];
    if (s === undefined) return key;
    return typeof s === 'string' ? s.replace('{0}', a).replace('{1}', b).replace('{2}', c) : s;
  }
  function localized(name) {
    return typeof name === 'string' ? name : (name[settings.lang] || name.es);
  }

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }
  var root = document.documentElement, body = document.body;
  var el = {
    stage: $('stage'), locBtn: $('locBtn'), locName: $('locName'), toolbar: $('toolbar'),
    time: $('time'), hh: $('hh'), mm: $('mm'), ss: $('ss'), ampm: $('ampm'), date: $('date'), analog: $('analog'),
    weather: $('weather'), status: $('status'),
    overlay: $('overlay'), panel: $('panel'), panelBody: $('panelBody'),
    sceneChips: $('sceneChips'), videoChips: $('videoChips'), videoForm: $('videoForm'), videoUrl: $('videoUrl'),
    clockStyles: $('clockStyles'), clockFonts: $('clockFonts'), clockColors: $('clockColors'),
    widgetStyles: $('widgetStyles'), widgetFonts: $('widgetFonts'),
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
  function hasClass(node, c) { return !!(node && node.classList && node.classList.contains(c)); }
  function closest(node, selector) {
    while (node && node !== document) {
      if (node.nodeType === 1 && (node.matches || node.webkitMatchesSelector).call(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function findById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
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

  /* "Jueves, 15 de octubre" / "Thursday, October 15" */
  function fmtDate(n) {
    if (settings.lang === 'en') return t('days')[n.wd] + ', ' + t('months')[n.mon] + ' ' + n.day;
    return cap(t('days')[n.wd]) + ', ' + n.day + ' de ' + t('months')[n.mon];
  }
  function meridiem(h) { return h < 12 ? t('am') : t('pm'); }
  function fmtHM(h, m) {
    if (!settings.hour12) return pad2(h) + ':' + pad2(m);
    return (h % 12 || 12) + ':' + pad2(m) + ' ' + meridiem(h);
  }
  function fmtHour(h) {
    if (!settings.hour12) return pad2(h) + ':00';
    return (h % 12 || 12) + ' ' + meridiem(h);
  }
  /* "2026-10-15T07:32" → "07:32" en el formato elegido */
  function fmtIsoTime(iso) {
    if (!iso) return '—';
    var hm = iso.split('T')[1] || '';
    return fmtHM(parseInt(hm.slice(0, 2), 10), parseInt(hm.slice(3, 5), 10));
  }

  /* Cada dígito vive en su propia caja: ancho fijo (no "baila") y ficha en estilo flip */
  function setDigits(node, str) {
    var kids = node.children, i;
    if (kids.length !== str.length) {
      node.innerHTML = '';
      for (i = 0; i < str.length; i++) {
        var d = document.createElement('span');
        d.className = 'd';
        d.textContent = str.charAt(i);
        node.appendChild(d);
      }
      return;
    }
    for (i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (kids[i].textContent === ch || kids[i].getAttribute('data-next') === ch) continue;
      if (settings.clockStyle === 'flip' && document.visibilityState !== 'hidden') flipDigit(kids[i], ch);
      else kids[i].textContent = ch;
    }
  }
  function flipDigit(d, ch) {
    d.setAttribute('data-next', ch);
    d.className = 'd flip';
    setTimeout(function () { d.textContent = ch; }, 190);
    setTimeout(function () { d.className = 'd'; d.removeAttribute('data-next'); }, 440);
  }

  /* Mide el dígito más ancho de la fuente actual para fijar el ancho de las cajas */
  function measureDigits() {
    if (!el.hh.firstChild) return;
    var probe = document.createElement('span');
    probe.className = 'd';
    probe.style.cssText = 'position:absolute;visibility:hidden;width:auto;padding:0;margin:0;';
    el.hh.appendChild(probe);
    var fs = parseFloat(window.getComputedStyle(probe).fontSize) || 0, max = 0;
    for (var i = 0; i <= 9; i++) {
      probe.textContent = String(i);
      max = Math.max(max, probe.getBoundingClientRect().width);
    }
    el.hh.removeChild(probe);
    if (fs && max) el.time.style.setProperty('--dw', (max / fs + 0.02).toFixed(3) + 'em');
  }
  function measureWhenFontReady() {
    measureDigits();
    if (document.fonts && document.fonts.load) {
      var f = findById(FONTS, settings.clockFont);
      document.fonts.load(f.w + ' 100px ' + f.family).then(measureDigits, function () { /* sin fuente: se queda la medida */ });
    }
  }

  /* ---------- reloj analógico ---------- */
  var hands = {}, handAngle = {}, handTurns = {};
  function buildAnalog() {
    var s = '<svg viewBox="0 0 200 200" aria-hidden="true">', i;
    for (i = 0; i < 60; i++) {
      var big = i % 5 === 0;
      s += '<line class="tk' + (big ? ' big' : '') + '" x1="100" y1="' + (big ? 12 : 13) + '" x2="100" y2="' + (big ? 24 : 18) +
        '" transform="rotate(' + (i * 6) + ' 100 100)"/>';
    }
    [[12, 100, 40], [3, 160, 100], [6, 100, 160], [9, 40, 100]].forEach(function (q) {
      s += '<text class="num" x="' + q[1] + '" y="' + q[2] + '">' + q[0] + '</text>';
    });
    s += '<g class="hand h" id="handH"><line x1="100" y1="110" x2="100" y2="56"/></g>' +
      '<g class="hand m" id="handM"><line x1="100" y1="114" x2="100" y2="32"/></g>' +
      '<g class="hand s" id="handS"><line x1="100" y1="124" x2="100" y2="26"/><circle cx="100" cy="100" r="3.6"/></g>' +
      '<circle class="pin" cx="100" cy="100" r="1.8"/></svg>';
    el.analog.innerHTML = s;
    hands = { h: $('handH'), m: $('handM'), s: $('handS') };
    resetHands();
  }
  function resetHands() { handAngle = { h: null, m: null, s: null }; handTurns = { h: 0, m: 0, s: 0 }; }
  function setHand(k, deg) {
    var prev = handAngle[k];
    // siempre hacia adelante: de 59 s a 0 s la aguja da la vuelta en lugar de regresar
    if (prev !== null && deg + handTurns[k] < prev - 0.01) handTurns[k] += 360;
    var a = deg + handTurns[k];
    var jump = prev === null || Math.abs(a - prev) > 45;
    hands[k].style.transition = jump ? 'none' : '';
    hands[k].style.transform = 'rotate(' + a.toFixed(2) + 'deg)';
    handAngle[k] = a;
  }
  function updateAnalog(n) {
    if (settings.clockStyle !== 'analog' || !hands.h) return;
    setHand('h', (n.h % 12) * 30 + n.m * 0.5);
    setHand('m', n.m * 6 + n.s * 0.1);
    setHand('s', n.s * 6);
  }

  var lastMinute = -1, lastHour = -1;
  function tick() {
    var n = localNow();
    var h = n.h;
    if (settings.hour12) {
      setText(el.ampm, meridiem(h));
      setDigits(el.hh, String(h % 12 || 12));
    } else {
      setText(el.ampm, '');
      setDigits(el.hh, pad2(h));
    }
    setDigits(el.mm, pad2(n.m));
    setText(el.ss, pad2(n.s));
    updateAnalog(n);

    if (n.m !== lastMinute) {
      lastMinute = n.m;
      setText(el.date, fmtDate(n));
      updateDayNight();
      if (n.h !== lastHour) { lastHour = n.h; renderWeather(); }
      renderStatus();
    }
    clearTimeout(tick.timer);
    tick.timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
  }

  /* ==========================================================================
     Tema y aspecto
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
    var mode = resolvedTheme();
    root.setAttribute('data-theme', mode);
    if (el.metaTheme) el.metaTheme.setAttribute('content', mode === 'light' ? '#eef2f8' : '#05070f');
    el.themeIcon.innerHTML = THEME_ICONS[settings.theme] || THEME_ICONS.auto;
    if (window.Scenes) Scenes.setMode(mode);
  }

  /* Estilo, fuente y color del reloj; diseño y fuente de los widgets; vidrio */
  function applyLook() {
    root.setAttribute('data-clock-style', settings.clockStyle);
    root.setAttribute('data-clock-font', settings.clockFont);
    root.setAttribute('data-clock-color', settings.clockColor);
    root.setAttribute('data-widget-style', settings.widgetStyle);
    root.setAttribute('data-widget-font', settings.widgetFont);
    root.setAttribute('data-glass', settings.glass);
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
     Idioma
     ========================================================================== */
  function eachNode(selector, fn) { toArray(document.querySelectorAll(selector)).forEach(fn); }

  function applyLanguage() {
    root.setAttribute('lang', settings.lang);
    document.title = t('title');
    eachNode('[data-i18n]', function (n) { setText(n, t(n.getAttribute('data-i18n'))); });
    eachNode('[data-i18n-html]', function (n) { n.innerHTML = t(n.getAttribute('data-i18n-html')); });
    eachNode('[data-i18n-title]', function (n) { n.setAttribute('title', t(n.getAttribute('data-i18n-title'))); });
    eachNode('[data-i18n-aria]', function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
    eachNode('[data-i18n-ph]', function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    buildPanelOptions();
    renderLocation();
    lastMinute = -1;
    tick();
    renderWeather();
    renderStatus();
  }

  /* El nombre de la ciudad detectada también se pide en el nuevo idioma */
  function relocalizeName() {
    var loc = state.loc;
    if (!loc || loc.source === 'manual') return;
    reverseGeocode(loc.lat, loc.lon).then(function (name) {
      if (state.loc !== loc) return;
      loc.name = name;
      store.set('loc', loc);
      renderLocation();
    }, function () { /* se queda el nombre anterior */ });
  }

  function toggleLanguage() {
    setSetting('lang', settings.lang === 'es' ? 'en' : 'es');
  }

  /* ==========================================================================
     Fondo (animaciones y videos)
     ========================================================================== */
  function videoList() {
    var list = VIDEOS.slice();
    if (settings.customVideo) list.push({ id: 'v-custom', name: t('myVideo'), src: settings.customVideo, swatch: 'linear-gradient(135deg,#888,#333)' });
    return list;
  }
  function findVideo(id) {
    var list = videoList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function bgOptions() {
    var out = [{ id: 'auto', name: t('autoBg') }];
    Scenes.list.forEach(function (s) { out.push({ id: s.id, name: t('scene_' + s.id), swatch: s.swatch }); });
    videoList().forEach(function (v) { out.push({ id: v.id, name: localized(v.name), swatch: v.swatch }); });
    return out;
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
    toast(t('videoFail'));
    stopVideo();
    Scenes.start(autoScene());
  });

  function nextBackground() {
    var list = bgOptions(), i = 0;
    for (; i < list.length; i++) if (list[i].id === settings.bg) break;
    var next = list[(i + 1) % list.length];
    setSetting('bg', next.id);
    toast(t('bgIs', next.name));
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
  var WMO_ICON = {
    0: 'clear', 1: 'clear', 2: 'partly', 3: 'cloudy', 45: 'fog', 48: 'fog',
    51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 56: 'drizzle', 57: 'drizzle',
    61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
    71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
    80: 'rain', 81: 'rain', 82: 'rain', 85: 'snow', 86: 'snow',
    95: 'storm', 96: 'storm', 99: 'storm'
  };
  function wmo(code) {
    return { text: t('wmo')[code] || '—', icon: WMO_ICON[code] || 'cloudy' };
  }

  var STAT_ICONS = {
    hum: '<path d="M12 3.5c-3 4-6 7.2-6 10.5a6 6 0 0 0 12 0c0-3.3-3-6.5-6-10.5z"/>',
    wind: '<path d="M3 8h10.5a2.75 2.75 0 1 0-2.6-3.6M3 12h15a3 3 0 1 1-2.8 4M3 16h7"/>',
    rain: '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v6.5a2 2 0 0 0 4 0"/>',
    uv: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',
    rise: '<path d="M3.5 19h17M7 19a5 5 0 0 1 10 0M12 4.5v6M9 7.5l3-3 3 3"/>',
    set: '<path d="M3.5 19h17M7 19a5 5 0 0 1 10 0M12 4.5v6M9 7.5l3 3 3-3"/>'
  };
  function statIcon(icon, inline) {
    return '<svg class="ico' + (inline ? ' ico-inline' : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + STAT_ICONS[icon] + '</svg>';
  }

  /* ==========================================================================
     Clima: datos y diseños de widgets
     ========================================================================== */
  function weatherData() {
    var w = state.weather;
    if (!w || !w.current || !w.daily) return null;
    var c = w.current, d = w.daily, hr = w.hourly;
    var n = localNow(), today = dateKey(n);
    var di = d.time.indexOf(today);
    if (di < 0) di = 0;
    var info = wmo(c.weather_code);
    var day = state.isDay !== null ? state.isDay : !!c.is_day;
    var pp = d.precipitation_probability_max ? d.precipitation_probability_max[di] : null;
    var uv = d.uv_index_max ? d.uv_index_max[di] : null;
    var D = {
      icon: weatherIcon(info.icon, day),
      temp: round(c.temperature_2m),
      desc: info.text,
      hi: round(d.temperature_2m_max[di]),
      lo: round(d.temperature_2m_min[di]),
      feels: round(c.apparent_temperature),
      stats: [
        { icon: 'hum', k: t('humidity'), v: round(c.relative_humidity_2m) + '%' },
        { icon: 'wind', k: t('wind'), v: round(c.wind_speed_10m) + (settings.unit === 'f' ? ' mph' : ' km/h') },
        { icon: 'rain', k: t('rain'), v: pp === null || pp === undefined ? '—' : round(pp) + '%' },
        { icon: 'uv', k: t('uv'), v: round(uv) },
        { icon: 'rise', k: t('sunrise'), v: fmtIsoTime(d.sunrise[di]) },
        { icon: 'set', k: t('sunset'), v: fmtIsoTime(d.sunset[di]) }
      ],
      hours: [],
      days: []
    };
    if (hr && hr.time) {
      var start = hr.time.indexOf(today + 'T' + pad2(n.h) + ':00');
      if (start < 0) start = 0;
      for (var i = start; i < Math.min(start + 8, hr.time.length); i++) {
        var p = hr.precipitation_probability ? hr.precipitation_probability[i] : null;
        D.hours.push({
          label: i === start ? t('now') : fmtHour(parseInt(hr.time[i].split('T')[1], 10)),
          now: i === start,
          icon: weatherIcon(wmo(hr.weather_code[i]).icon, hr.is_day ? !!hr.is_day[i] : true),
          temp: round(i === start ? c.temperature_2m : hr.temperature_2m[i]),
          p: p >= 20 ? p + '%' : ''
        });
      }
    }
    for (var j = di; j < Math.min(di + 6, d.time.length); j++) {
      var parts = d.time[j].split('-');
      var wd = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])).getUTCDay();
      var pj = d.precipitation_probability_max ? d.precipitation_probability_max[j] : null;
      D.days.push({
        label: j === di ? t('today') : t('daysShort')[wd],
        today: j === di,
        icon: weatherIcon(wmo(d.weather_code[j]).icon, true),
        hi: round(d.temperature_2m_max[j]), lo: round(d.temperature_2m_min[j]),
        hiN: d.temperature_2m_max[j], loN: d.temperature_2m_min[j],
        p: pj >= 30 ? pj + '%' : ''
      });
    }
    return D;
  }

  function nowMainHtml(D) {
    return '<div class="now-main"><div class="now-icon">' + D.icon + '</div><div class="now-text">' +
      '<div class="now-temp">' + D.temp + '°</div><div class="now-desc">' + esc(D.desc) + '</div></div></div>';
  }
  function statsHtml(D) {
    return '<ul class="stats">' + D.stats.map(function (s) {
      return '<li>' + statIcon(s.icon) + '<span><span class="k">' + esc(s.k) + '</span><span class="v">' + esc(s.v) + '</span></span></li>';
    }).join('') + '</ul>';
  }
  function hoursHtml(D, n) {
    return '<div class="hours">' + D.hours.slice(0, n).map(function (h) {
      return '<div class="hour' + (h.now ? ' now-h' : '') + '"><span class="t">' + esc(h.label) + '</span><span class="i">' + h.icon +
        '</span><span class="v">' + h.temp + '°</span><span class="p">' + h.p + '</span></div>';
    }).join('') + '</div>';
  }
  function daysRowHtml(D) {
    return '<div class="days">' + D.days.map(function (d) {
      return '<div class="day' + (d.today ? ' today' : '') + '"><span class="t">' + esc(d.label) + '</span><span class="i">' + d.icon +
        '</span><span class="v">' + d.hi + '°<small>' + d.lo + '°</small></span><span class="p">' + d.p + '</span></div>';
    }).join('') + '</div>';
  }
  /* Lista vertical con barra de rango de temperatura (como en iOS) */
  function daysListHtml(D) {
    var min = Infinity, max = -Infinity;
    D.days.forEach(function (d) {
      if (typeof d.loN === 'number') min = Math.min(min, d.loN);
      if (typeof d.hiN === 'number') max = Math.max(max, d.hiN);
    });
    var span = Math.max(1, max - min);
    return '<div class="dlist">' + D.days.map(function (d) {
      var bar = '';
      if (typeof d.loN === 'number' && typeof d.hiN === 'number') {
        var width = Math.max(6, (d.hiN - d.loN) / span * 100), left = Math.max(0, (d.loN - min) / span * 100);
        if (left + width > 100) left = 100 - width;
        // el degradado se estira a todo el riel: cada barra muestra los colores de su rango de temperatura
        var pos = width >= 100 ? 0 : left / (100 - width) * 100;
        bar = '<i style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%;background-size:' + (10000 / width).toFixed(1) +
          '% 100%;background-position:' + pos.toFixed(1) + '% 0"></i>';
      }
      return '<div class="row' + (d.today ? ' today' : '') + '"><span class="t">' + esc(d.label) + '</span><span class="i">' + d.icon +
        '</span><span class="p">' + d.p + '</span><span class="lo">' + d.lo + '°</span><span class="bar">' + bar +
        '</span><span class="hi">' + d.hi + '°</span></div>';
    }).join('') + '</div>';
  }

  var LAYOUTS = {
    full: function (D) {
      return '<article class="glass card now">' + nowMainHtml(D) +
        '<div class="now-sub">' + esc(t('hiLoFeels', D.hi, D.lo, D.feels)) + '</div>' + statsHtml(D) + '</article>' +
        '<article class="glass card forecast"><h3 class="label">' + esc(t('nextHours')) + '</h3>' + hoursHtml(D, 8) +
        '<div class="divider"></div><h3 class="label">' + esc(t('nextDays')) + '</h3>' + daysRowHtml(D) + '</article>';
    },
    compact: function (D) {
      return '<article class="glass card now">' + nowMainHtml(D) +
        '<div class="now-sub">' + esc(t('hiLo', D.hi, D.lo)) + '<br>' + esc(t('feels', D.feels)) + '</div></article>';
    },
    side: function (D) {
      return '<div class="side-col"><article class="glass card now">' + nowMainHtml(D) +
        '<div class="now-sub">' + esc(t('hiLoFeels', D.hi, D.lo, D.feels)) + '</div>' + statsHtml(D) + '</article>' +
        '<article class="glass card forecast"><h3 class="label lh">' + esc(t('nextHours')) + '</h3>' + hoursHtml(D, 6) +
        '<div class="divider"></div><h3 class="label">' + esc(t('nextDays')) + '</h3>' + daysListHtml(D) + '</article></div>';
    },
    tiles: function (D) {
      var html = '<div class="bento"><article class="glass tile t-now">' + nowMainHtml(D) +
        '<div class="now-sub">' + esc(t('hiLo', D.hi, D.lo)) + ' · ' + statIcon('rise', true) + esc(D.stats[4].v) +
        ' ' + statIcon('set', true) + esc(D.stats[5].v) + '</div></article>';
      for (var i = 0; i < 4; i++) {
        var s = D.stats[i];
        html += '<article class="glass tile t-stat"><span class="k">' + statIcon(s.icon) + esc(s.k) + '</span><span class="v">' + esc(s.v) + '</span></article>';
      }
      D.days.forEach(function (d) {
        html += '<article class="glass tile t-day' + (d.today ? ' today' : '') + '"><span class="t">' + esc(d.label) + '</span><span class="i">' + d.icon +
          '</span><span class="v">' + d.hi + '°<small>' + d.lo + '°</small></span></article>';
      });
      return html + '</div>';
    }
  };

  function renderWeather() {
    var style = settings.widgetStyle;
    if (style === 'hidden') { el.weather.innerHTML = ''; return; }
    var D = weatherData();
    if (!D) {
      el.weather.innerHTML = '<article class="glass card now loading"><div class="now-desc">' + esc(t('loadingWeather')) + '</div></article>';
      return;
    }
    el.weather.innerHTML = (LAYOUTS[style] || LAYOUTS.full)(D);
  }

  var statusKey = '';   // clave del mensaje de estado, para poder traducirlo
  function renderStatus() {
    var w = state.weather, parts = [];
    if (statusKey) parts.push(t(statusKey));
    else if (w && w.fetchedAt) {
      var mins = Math.round((Date.now() - w.fetchedAt) / 60000);
      parts.push(mins < 1 ? t('updatedNow') : mins < 60 ? t('updatedMin', mins) : t('updatedH', Math.round(mins / 60)));
    }
    if (t('weatherCredit')) parts.push(t('weatherCredit'));
    setText(el.status, parts.join(' · ') || ' ');
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
    if (!state.weather) { statusKey = 'gettingWeather'; renderStatus(); }
    getJSON(url, 15000).then(function (w) {
      if (req !== weatherReq) return;
      w.fetchedAt = Date.now();
      w.key = weatherKey();
      setWeather(w);
      store.set('weather', w);
      statusKey = '';
      renderStatus();
      weatherTimer = setTimeout(fetchWeather, 15 * 60 * 1000);
    }, function () {
      if (req !== weatherReq) return;
      statusKey = state.weather ? 'offline' : 'weatherFail';
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
    resetHands();
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

  /* Nombre visible: si no se pudo averiguar la ciudad, un texto genérico traducido */
  function locLabel(loc) {
    if (!loc) return t('findingLocation');
    return loc.name || t(loc.source === 'ip' ? 'approxLocation' : 'myLocation');
  }

  function reverseGeocode(lat, lon) {
    var lang = settings.lang;
    return getJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=' + lang, 8000)
      .then(function (r) {
        var name = joinName(r.city || r.locality, r.principalSubdivision || r.countryName);
        if (!name) throw new Error('vacío');
        return name;
      })
      .catch(function () {
        return getJSON('https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=' + lang + '&lat=' + lat + '&lon=' + lon, 8000)
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
      return { lat: round3(lat), lon: round3(lon), name: joinName(city, region), source: 'ip' };
    }
    return firstOk([
      function () { return getJSON('https://get.geojs.io/v1/ip/geo.json', 8000).then(function (r) { return make(r.latitude, r.longitude, r.city, r.region); }); },
      function () { return getJSON('https://ipapi.co/json/', 8000).then(function (r) { return make(r.latitude, r.longitude, r.city, r.region); }); },
      function () { return getJSON('https://ipwho.is/', 8000).then(function (r) { if (r.success === false) throw new Error('ipwho'); return make(r.latitude, r.longitude, r.city, r.region); }); }
    ]).then(function (loc) {
      // nombre en el idioma elegido a partir de las coordenadas
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
      return { lat: lat, lon: lon, name: '', source: 'gps' };
    });
  }

  var locating = false;
  function locate(userAsked) {
    if (locating) return;
    locating = true;
    if (!state.loc) setText(el.locName, t('findingLocation'));
    if (userAsked) toast(t('locating'));
    gpsPosition(function late(p) {
      // el usuario aceptó el permiso tarde: mejoramos la ubicación aproximada
      if (state.loc && state.loc.source === 'ip') fromPosition(p).then(setLocation);
    })
      .then(fromPosition, function (err) {
        if (userAsked) toast(t(err && err.code === 1 ? 'gpsDenied' : 'gpsUnavailable'), 3600);
        return ipLocation();
      })
      .then(function (loc) {
        locating = false;
        setLocation(loc);
        if (userAsked) toast(t('locationIs', locLabel(loc)));
      }, function () {
        locating = false;
        if (!state.loc) {
          setText(el.locName, t('chooseCity'));
          toast(t('locateFail'), 4500);
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

  function renderLocation() {
    var loc = state.loc;
    setText(el.locName, locLabel(loc));
    setText(el.panelLoc, loc ? locLabel(loc) : t('noLocation'));
    setText(el.panelLocSrc, loc ? t('src_' + loc.source) : '');
    el.panelLocSrc.style.display = loc ? '' : 'none';
  }

  function searchCity(q) {
    el.results.innerHTML = '<p class="empty">' + esc(t('searching')) + '</p>';
    getJSON('https://geocoding-api.open-meteo.com/v1/search?count=8&format=json&language=' + settings.lang + '&name=' + encodeURIComponent(q), 10000)
      .then(function (r) {
        var list = r.results || [];
        if (!list.length) { el.results.innerHTML = '<p class="empty">' + esc(t('notFound')) + '</p>'; return; }
        el.results.innerHTML = list.map(function (c) {
          var region = [c.admin1, c.country].filter(Boolean).join(', ');
          return '<button class="chip" type="button" data-city="' + esc(JSON.stringify({ lat: round3(c.latitude), lon: round3(c.longitude), name: joinName(c.name, c.admin1 || c.country) })) + '">' +
            esc(c.name) + (region ? '<small>' + esc(region) + '</small>' : '') + '</button>';
        }).join('');
        var first = el.results.querySelector('button');
        if (first && root.className.indexOf('using-keys') >= 0) focusEl(first);
      }, function () {
        el.results.innerHTML = '<p class="empty">' + esc(t('searchOffline')) + '</p>';
      });
  }

  /* ==========================================================================
     Ajustes: opciones con vista previa
     ========================================================================== */
  function chip(attrs, label, swatch) {
    return '<button class="chip" type="button" ' + attrs + '>' +
      (swatch ? '<span class="sw" style="background:' + swatch + '"></span>' : '') + esc(label) + '</button>';
  }
  function pick(key, value, preview, label) {
    return '<button class="pick" type="button" data-set="' + key + '" data-value="' + value + '"><span class="pv">' + preview +
      '</span><span class="pick-label">' + esc(label) + '</span></button>';
  }

  var MINI_ANALOG = '<svg class="pv-analog" viewBox="0 0 40 40"><circle class="f" cx="20" cy="20" r="18"/>' +
    '<line x1="20" y1="20" x2="20" y2="9" stroke-width="2.4"/><line x1="20" y1="20" x2="28" y2="23" stroke-width="2.4"/>' +
    '<line x1="20" y1="22" x2="13" y2="9" stroke-width="1" style="stroke:var(--hand-accent)"/></svg>';
  var CLOCK_PREVIEWS = {
    classic: '<span class="ck pv-card">12:45</span>',
    floating: '<span class="ck pv-txt">12:45</span>',
    stacked: '<span class="ck pv-stack">12<br>45</span>',
    analog: MINI_ANALOG,
    flip: '<span class="ck pv-flip"><i>1</i><i>2</i><b>:</b><i>4</i><i>5</i></span>',
    neon: '<span class="ck pv-neon">12:45</span>'
  };
  /* Esquemas de los diseños de widgets: b = bloque de vidrio [izq, arriba, ancho, alto, píldora] */
  function blocks(list) {
    return list.map(function (b) {
      return '<i class="b" style="left:' + b[0] + '%;top:' + b[1] + '%;width:' + b[2] + '%;height:' + b[3] + '%' + (b[4] ? ';border-radius:99px' : '') + '"></i>';
    }).join('');
  }
  function miniClock(left, top, size) {
    return '<span class="ck mini" style="left:' + left + '%;top:' + top + '%;font-size:' + size + 'rem">12:45</span>';
  }
  var WIDGET_PREVIEWS = {
    full: miniClock(31, 12, 1.15) + blocks([[6, 56, 30, 34], [40, 56, 54, 34]]),
    compact: miniClock(26, 16, 1.45) + blocks([[28, 66, 44, 18, 1]]),
    side: miniClock(8, 38, 1.15) + blocks([[60, 10, 34, 80]]),
    tiles: miniClock(31, 8, 1.1) + blocks([[6, 44, 28, 21], [37, 44, 12, 21], [52, 44, 12, 21], [67, 44, 12, 21], [82, 44, 12, 21],
      [6, 70, 12, 21], [21, 70, 12, 21], [36, 70, 12, 21], [51, 70, 12, 21], [66, 70, 12, 21], [81, 70, 13, 21]]),
    hidden: miniClock(17, 30, 2)
  };

  function buildPanelOptions() {
    // fondo
    var html = chip('data-set="bg" data-value="auto"', t('auto'), 'linear-gradient(135deg,#ffd56b,#7cc4e4 50%,#5a6b8c)');
    Scenes.list.forEach(function (s) { html += chip('data-set="bg" data-value="' + s.id + '"', t('scene_' + s.id), s.swatch); });
    el.sceneChips.innerHTML = html;
    html = '';
    videoList().forEach(function (v) { html += chip('data-set="bg" data-value="' + v.id + '"', localized(v.name), v.swatch); });
    el.videoChips.innerHTML = html;

    // reloj
    el.clockStyles.innerHTML = CLOCK_STYLES.map(function (s) { return pick('clockStyle', s, CLOCK_PREVIEWS[s], t('cstyle_' + s)); }).join('');
    el.clockFonts.innerHTML = FONTS.map(function (f) {
      return pick('clockFont', f.id, '<span class="pv-font" style="font-family:' + f.family + ';font-weight:' + f.w + '">12:45</span>', localized(f.name));
    }).join('');
    el.clockColors.innerHTML = CLOCK_COLORS.map(function (c) { return chip('data-set="clockColor" data-value="' + c.id + '"', t('color_' + c.id), c.sw); }).join('');

    // widgets
    el.widgetStyles.innerHTML = WIDGET_STYLES.map(function (s) { return pick('widgetStyle', s, WIDGET_PREVIEWS[s], t('wstyle_' + s)); }).join('');
    el.widgetFonts.innerHTML = FONTS.map(function (f) {
      return pick('widgetFont', f.id, '<span class="pv-font" style="font-family:' + f.family + ';font-weight:' + f.ww + '">23°</span>' +
        '<span class="pv-sub" style="font-family:' + f.family + '">' + esc(t('wmo')[0]) + '</span>', localized(f.name));
    }).join('');

    syncChips();
  }

  function syncChips() {
    toArray(el.panel.querySelectorAll('[data-set]')).forEach(function (b) {
      var key = b.getAttribute('data-set');
      b.setAttribute('aria-pressed', String(settings[key]) === b.getAttribute('data-value') ? 'true' : 'false');
    });
  }

  function parseValue(v) { return v === 'true' ? true : v === 'false' ? false : v; }

  function setSetting(key, value) {
    if (!isValid(key, value)) return;
    var changed = settings[key] !== value;
    settings[key] = value;
    store.set(key, value);
    switch (key) {
      case 'lang':
        if (changed) { applyLanguage(); relocalizeName(); toast(t('langToast')); }
        break;
      case 'theme': applyTheme(); break;
      case 'bg': applyBackground(); break;
      case 'hour12': lastMinute = -1; tick(); renderWeather(); break;
      case 'seconds': body.classList.toggle('no-seconds', !value); break;
      case 'unit': fetchWeather(); break;
      case 'quality': root.setAttribute('data-quality', value); Scenes.setQuality(value); break;
      case 'customVideo': buildPanelOptions(); break;
      case 'clockStyle': applyLook(); resetHands(); tick(); measureDigits(); break;
      case 'clockFont': applyLook(); measureWhenFontReady(); break;
      case 'clockColor': case 'glass': case 'widgetFont': applyLook(); break;
      case 'widgetStyle': applyLook(); renderWeather(); break;
    }
    syncChips();
  }

  /* Ajustes desde la URL, útil para guardar un favorito en la TV:
     ?lang=en&bg=v-olas&clockStyle=flip&widgetStyle=side */
  function readUrlParams() {
    var q = location.search.replace(/^\?/, '');
    if (!q) return;
    q.split('&').forEach(function (pair) {
      var kv = pair.split('='), k = decodeURIComponent(kv[0] || ''), v = parseValue(decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')));
      if (k === 'forecast') { k = 'widgetStyle'; v = v === false ? 'compact' : 'full'; }
      if (!(k in settings) || k === 'customVideo' || !isValid(k, v)) return;
      settings[k] = v;
      store.set(k, v);
    });
  }

  /* ---------- panel con pestañas ---------- */
  var panelOpen = false, lastFocus = null, closeTimer = 0, currentTab = 'appearance', savedScroll = 0;

  function selectTab(id) {
    if (!el.panel.querySelector('[data-pane="' + id + '"]')) id = 'appearance';
    var changed = id !== currentTab;
    currentTab = id;
    toArray(el.panel.querySelectorAll('.tab')).forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-tab') === id ? 'true' : 'false');
    });
    toArray(el.panel.querySelectorAll('.pane')).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== id; });
    // al cambiar de pestaña, volver arriba si el panel quedó desplazado
    if (changed && el.panel.getBoundingClientRect().top < 0) window.scrollTo(0, 0);
  }
  function activeTab() { return el.panel.querySelector('.tab[data-tab="' + currentTab + '"]'); }
  function paneEntry() {
    var pane = el.panel.querySelector('[data-pane="' + currentTab + '"]');
    return pane.querySelector('[aria-pressed="true"]') || pane.querySelector('button, input');
  }

  function openPanel(tab) {
    clearTimeout(closeTimer);
    if (!panelOpen) {
      // la página de fondo se queda quieta y el panel usa el desplazamiento de la página
      savedScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
      el.stage.style.top = -savedScroll + 'px';
      body.classList.add('panel-open');
      lastFocus = document.activeElement;
    }
    panelOpen = true;
    selectTab(tab || currentTab);
    syncChips();
    renderLocation();
    el.overlay.hidden = false;
    window.scrollTo(0, 0);
    // forzar reflow para que se vea la transición
    void el.overlay.offsetWidth;
    el.overlay.className = 'overlay open';
    body.classList.remove('idle');
    var target = activeTab();
    setTimeout(function () { if (target && panelOpen) focusEl(target); }, 60);
  }
  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    el.overlay.className = 'overlay';
    closeTimer = setTimeout(function () {
      el.overlay.hidden = true;
      body.classList.remove('panel-open');
      el.stage.style.top = '';
      window.scrollTo(0, savedScroll);
    }, 320);
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
      toast(t(IS_IOS ? 'fsIos' : 'fsUnsupported'), 5500);
      return;
    }
    try {
      r = req.call(d, { navigationUI: 'hide' });
      if (r && r.catch) r.catch(function () { toast(t('fsBlocked')); });
    } catch (e) {
      toast(t('fsBlocked'));
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
     Controles: ocultar al estar inactivo, foco y desplazamiento con control remoto
     ========================================================================== */
  var idleTimer = 0;
  function wake() {
    body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!panelOpen) body.classList.add('idle');
    }, 5000);
  }

  function viewportH() { return window.innerHeight || document.documentElement.clientHeight; }
  function scrollPage(dy) { window.scrollBy(0, dy); }

  /* Enfoca y se asegura de que el elemento quede visible con margen (hay TVs que no desplazan solas) */
  function focusEl(node) {
    node.focus();
    var r = node.getBoundingClientRect(), vh = viewportH(), m = Math.min(120, vh * 0.12);
    if (r.bottom > vh - m) scrollPage(r.bottom - vh + m);
    else if (r.top < m) scrollPage(r.top - m);
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
      focusEl(panelOpen ? activeTab() : el.toolbar.querySelector('button'));
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
    if (panelOpen && best) {
      // de las opciones a las pestañas: siempre a la pestaña activa; y al revés, a la opción elegida
      var curTab = hasClass(cur, 'tab'), bestTab = hasClass(best, 'tab');
      if (!curTab && bestTab) best = activeTab();
      else if (curTab && !bestTab && closest(best, '.pane')) best = paneEntry() || best;
    }
    if (best) focusEl(best);
    else if (dir === 'down' || dir === 'up') scrollPage((dir === 'down' ? 1 : -1) * viewportH() * 0.4);
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

    // Re Pág / Av Pág y CH+ / CH− del control (LG los envía como Re/Av Pág; Samsung como 427/428)
    if (c === 33 || c === 427 || k === 'PageUp' || k === 'ChannelUp') { e.preventDefault(); scrollPage(-viewportH() * 0.8); return; }
    if (c === 34 || c === 428 || k === 'PageDown' || k === 'ChannelDown') { e.preventDefault(); scrollPage(viewportH() * 0.8); return; }

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
    else if (ch === 'l') { e.preventDefault(); toggleLanguage(); }
    else if (ch === 'b' || ch === 'n' || c === 403) { e.preventDefault(); nextBackground(); }
    else if (ch === 's' || ch === ',' || c === 406) { e.preventDefault(); if (panelOpen) closePanel(); else openPanel(); }
  });

  ['mousemove', 'mousedown', 'touchstart', 'wheel'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (ev !== 'mousemove') root.classList.remove('using-keys');
      wake();
      if (ev !== 'mousemove') { requestWakeLock(); resumeVideo(); }
    }, { passive: true });
  });

  /* Reflejo del vidrio que sigue al puntero */
  var pointer = null, pointerRaf = 0;
  document.addEventListener('mousemove', function (e) {
    pointer = e;
    if (!pointerRaf) pointerRaf = requestAnimationFrame(function () {
      pointerRaf = 0;
      var list = document.querySelectorAll('.glass');
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getBoundingClientRect();
        if (!r.width) continue;
        list[i].style.setProperty('--mx', ((pointer.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        list[i].style.setProperty('--my', ((pointer.clientY - r.top) / r.height * 100).toFixed(1) + '%');
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
    toast(t('themeToast_' + next));
  }

  /* ---------- clics ---------- */
  document.addEventListener('click', function (e) {
    var target = closest(e.target, '[data-action], [data-set], [data-city], [data-tab], #locBtn');
    if (!target) {
      if (panelOpen && !closest(e.target, '.panel')) closePanel();
      return;
    }
    if (target.id === 'locBtn') { openPanel('location'); return; }
    if (target.hasAttribute('data-tab')) { selectTab(target.getAttribute('data-tab')); return; }
    if (target.hasAttribute('data-set')) {
      setSetting(target.getAttribute('data-set'), parseValue(target.getAttribute('data-value')));
      return;
    }
    if (target.hasAttribute('data-city')) {
      var c = JSON.parse(target.getAttribute('data-city'));
      c.source = 'manual';
      setLocation(c);
      el.results.innerHTML = '';
      el.searchInput.value = '';
      toast(t('locationIs', locLabel(c)));
      closePanel();
      return;
    }
    switch (target.getAttribute('data-action')) {
      case 'bg': nextBackground(); break;
      case 'theme': cycleTheme(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'settings': openPanel(); break;
      case 'close': closePanel(); break;
      case 'locate': locate(true); break;
    }
  });

  /* Con el control remoto, llegar a una pestaña ya la abre (no hace falta pulsar OK) */
  el.panel.addEventListener('focus', function (e) {
    if (hasClass(e.target, 'tab')) selectTab(e.target.getAttribute('data-tab'));
  }, true);

  el.searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = el.searchInput.value.replace(/^\s+|\s+$/g, '');
    if (q.length > 1) searchCity(q);
  });

  el.videoForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = el.videoUrl.value.replace(/^\s+|\s+$/g, '');
    if (!/^https?:\/\//i.test(url) && !/\.(mp4|webm|m4v|mov)(\?|$)/i.test(url)) { toast(t('badVideo')); return; }
    delete videoFailed[url];
    setSetting('customVideo', url);
    setSetting('bg', 'v-custom');
    toast(t('bgIs', t('myVideo')));
  });

  /* Protección contra marcas en pantallas OLED: el contenido se mueve unos píxeles */
  setInterval(function () {
    if (panelOpen) return;
    el.stage.style.setProperty('--sx', Math.round((Math.random() - 0.5) * 12) + 'px');
    el.stage.style.setProperty('--sy', Math.round((Math.random() - 0.5) * 10) + 'px');
  }, 120000);

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onScheme = function () { if (settings.theme === 'auto' && state.isDay === null) applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
  }

  // cuando termina de cargar una fuente, volver a medir los dígitos
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', measureDigits);

  /* ==========================================================================
     Inicio
     ========================================================================== */
  function boot() {
    readUrlParams();
    root.setAttribute('data-quality', settings.quality);
    body.classList.toggle('no-seconds', !settings.seconds);
    applyLook();
    Scenes.init(el.canvas);
    Scenes.setQuality(settings.quality);
    buildAnalog();
    applyLanguage();
    selectTab(currentTab);

    // datos guardados para mostrar algo al instante
    var cached = store.get('weather', null);
    if (state.loc && cached && cached.key === weatherKey() && Date.now() - cached.fetchedAt < 6 * 3600 * 1000) {
      setWeather(cached);
    } else {
      applyTheme();
      tick();
    }
    measureWhenFontReady();
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
