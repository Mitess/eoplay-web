/* EO Play PWA — cliente Xtream sobre proxy HLS (mediaflow-proxy).
   El proxy resuelve mixed-content + CORS + reescritura de segmentos.
   Config en window.EOCFG (config.js): { PROXY, API_PASSWORD }.
   La lista del usuario (host/user/pass) vive solo en localStorage. */
(function () {
  'use strict';
  var CFG = window.EOCFG || {};
  var PROXY = (CFG.PROXY || '').replace(/\/$/, '');   // mediaflow-proxy (streams HLS)
  var CORS = (CFG.CORS || '').replace(/\/$/, '');     // cors-anywhere (catálogo JSON)
  var APIPW = CFG.API_PASSWORD || '';
  var LS_KEY = 'eoplay.list';

  var $ = function (s) { return document.querySelector(s); };
  var el = { cats: $('#cats'), chans: $('#chanlist'), search: $('#search'),
    video: $('#video'), pstatus: $('#pstatus'), setup: $('#setup'),
    serr: $('#serr') };
  var list = null;        // { host, user, pass }
  var streams = [];       // canales de la categoría activa
  var hls = null;

  // ---- helpers de URL del proxy ----
  // Catálogo (player_api.php JSON): vía cors-anywhere (relaya completo + CORS).
  function api(action, extra) {
    var u = list.host + '/player_api.php?username=' + encodeURIComponent(list.user) +
      '&password=' + encodeURIComponent(list.pass) + '&action=' + action;
    if (extra) u += extra;
    return fetch(CORS + '/' + u).then(function (r) {
      if (!r.ok) throw new Error('api ' + r.status); return r.json();
    });
  }
  function hlsUrl(streamId) {
    var src = list.host + '/live/' + encodeURIComponent(list.user) + '/' +
      encodeURIComponent(list.pass) + '/' + streamId + '.m3u8';
    return PROXY + '/proxy/hls/manifest.m3u8?api_password=' + encodeURIComponent(APIPW) +
      '&d=' + encodeURIComponent(src);
  }

  // ---- persistencia de la lista ----
  function loadList() {
    try { list = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { list = null; }
    return list;
  }
  function saveList(l) { list = l; localStorage.setItem(LS_KEY, JSON.stringify(l)); }

  // Parsea "http://host:port/get.php?username=U&password=P..." o campos sueltos.
  function parseSetup() {
    var url = $('#iUrl').value.trim();
    if (url) {
      try {
        var u = new URL(url);
        return { host: u.protocol + '//' + u.host,
          user: u.searchParams.get('username') || '',
          pass: u.searchParams.get('password') || '' };
      } catch (e) { return null; }
    }
    var host = $('#iHost').value.trim().replace(/\/$/, '');
    var user = $('#iUser').value.trim(), pass = $('#iPass').value.trim();
    if (!/^https?:\/\//.test(host) || !user || !pass) return null;
    return { host: host, user: user, pass: pass };
  }

  // ---- UI ----
  function showSetup(show) { el.setup.classList.toggle('show', show); }
  function rowsEmpty(node, txt) { node.innerHTML = '<div class="empty">' + txt + '</div>'; }

  function renderCats(cats) {
    if (!cats.length) { rowsEmpty(el.cats, 'Sin categorías'); return; }
    el.cats.innerHTML = '';
    cats.forEach(function (c) {
      var d = document.createElement('div');
      d.className = 'row'; d.textContent = c.category_name || '—';
      d.onclick = function () {
        [].forEach.call(el.cats.children, function (x) { x.classList.remove('sel'); });
        d.classList.add('sel'); openCategory(c.category_id);
      };
      el.cats.appendChild(d);
    });
    el.cats.firstChild.click();   // abre la primera
  }

  function renderChans(items) {
    if (!items.length) { rowsEmpty(el.chans, 'Sin canales'); return; }
    el.chans.innerHTML = '';
    items.slice(0, 600).forEach(function (s) {
      var d = document.createElement('div'); d.className = 'row';
      var img = document.createElement('img'); img.loading = 'lazy';
      img.src = s.stream_icon || ''; img.onerror = function () { img.style.visibility = 'hidden'; };
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = s.name || '—';
      d.appendChild(img); d.appendChild(nm);
      d.onclick = function () {
        [].forEach.call(el.chans.children, function (x) { x.classList.remove('play'); });
        d.classList.add('play'); play(s);
      };
      el.chans.appendChild(d);
    });
  }

  function filterChans() {
    var q = el.search.value.toLowerCase();
    renderChans(!q ? streams : streams.filter(function (s) {
      return (s.name || '').toLowerCase().indexOf(q) >= 0;
    }));
  }

  // ---- carga de datos ----
  function start() {
    rowsEmpty(el.cats, 'Cargando…');
    api('get_live_categories').then(renderCats).catch(function (e) {
      rowsEmpty(el.cats, 'Error cargando la lista. Revisa los datos.'); console.error(e);
    });
  }
  function openCategory(catId) {
    rowsEmpty(el.chans, 'Cargando…'); el.search.value = '';
    api('get_live_streams', '&category_id=' + encodeURIComponent(catId)).then(function (s) {
      streams = s || []; renderChans(streams);
    }).catch(function (e) { rowsEmpty(el.chans, 'Error'); console.error(e); });
  }

  // ---- reproducción ----
  function play(s) {
    var url = hlsUrl(s.stream_id);
    el.pstatus.textContent = 'Cargando ' + (s.name || '') + '…';
    el.pstatus.style.display = 'flex';
    if (hls) { hls.destroy(); hls = null; }
    var v = el.video;
    var onPlaying = function () { el.pstatus.style.display = 'none'; };
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false, maxBufferLength: 20 });
      hls.loadSource(url); hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, function () { v.play().catch(function () {}); });
      hls.on(Hls.Events.ERROR, function (_e, data) {
        if (data.fatal) { el.pstatus.textContent = 'No se pudo reproducir (' + data.details + ')'; }
      });
    } else {                                   // Safari/iOS: HLS nativo
      v.src = url; v.play().catch(function () {});
    }
    v.onplaying = onPlaying;
  }

  // ---- arranque ----
  $('#btnSetup').onclick = function () { showSetup(true); };
  el.search.oninput = filterChans;
  $('#iSave').onclick = function () {
    var l = parseSetup();
    if (!l) { el.serr.textContent = 'Datos incompletos o URL inválida.'; return; }
    el.serr.textContent = ''; saveList(l); showSetup(false); start();
  };
  if (!PROXY || !CORS) { rowsEmpty(el.cats, 'Falta configurar el proxy (config.js).'); }
  else if (loadList()) {
    var l = list; $('#iHost').value = l.host; $('#iUser').value = l.user; $('#iPass').value = l.pass;
    start();
  } else { showSetup(true); }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
