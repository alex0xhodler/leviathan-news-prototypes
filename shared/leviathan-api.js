/* ============================================================
   LEVIATHAN NEWS — Shared API Client (vanilla, zero deps)
   Live REST + WebSocket with fixture fallback.
   Exposes window.Leviathan
   ============================================================ */
(function () {
  'use strict';

  var API = 'https://api.leviathannews.xyz/api/v1';
  var WS_URL = 'wss://api.leviathannews.xyz/ws/news/';
  var SKILL_CMD = 'curl -s https://api.leviathannews.xyz/SKILL.md';

  /* Fixture path is resolved relative to the including page (prototypes/variant-*.html) */
  var FIX = 'shared/fixtures';

  var state = {
    source: 'connecting',      // 'live' | 'fixture'
    ws: 'off',                 // 'live' | 'connecting' | 'reconnecting' | 'off'
    lastEventAt: null
  };

  var statusListeners = new Set();
  var eventListeners = new Set();

  function emitStatus() {
    statusListeners.forEach(function (cb) { try { cb(state); } catch (e) {} });
  }
  function emitEvent(evt) {
    state.lastEventAt = Date.now();
    eventListeners.forEach(function (cb) { try { cb(evt); } catch (e) {} });
  }

  function timeout(ms) {
    return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); });
  }

  function get(path, fixtureFile) {
    return Promise.race([
      fetch(API + path, { headers: { 'Accept': 'application/json' } }),
      timeout(4500)
    ]).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      if (state.source !== 'live') { state.source = 'live'; }
      emitStatus();
      return data;
    }).catch(function () {
      return fetch(FIX + '/' + fixtureFile).then(function (r) { return r.json(); }).then(function (data) {
        state.source = 'fixture';
        emitStatus();
        return data;
      });
    });
  }

  /* ---------------- REST ---------------- */

  function fetchNews(opts) {
    opts = opts || {};
    var sort = opts.sort || 'hot';
    var tf = opts.timeframe || '7';
    var limit = opts.limit || 12;
    return get('/news/?sort_type=' + sort + '&sort_timeframe=' + tf + '&limit=' + limit, 'news.json')
      .then(function (d) { return Array.isArray(d) ? d : (d.results || d.items || []); });
  }

  function fetchLeaderboards() {
    return get('/leaderboards/rotating/', 'leaderboards.json')
      .then(function (d) { return d.leaderboards || d; });
  }

  function fetchTrending() {
    return get('/intel/trending/?hours=24&top_n=15', 'trending.json');
  }

  /* ---------------- WebSocket ---------------- */

  var ws = null, wsAttempts = 0, wsTimer = null;

  function connectLive() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    state.ws = wsAttempts ? 'reconnecting' : 'connecting';
    emitStatus();
    try { ws = new WebSocket(WS_URL); } catch (e) { scheduleReconnect(); return; }

    ws.onopen = function () { wsAttempts = 0; state.ws = 'live'; emitStatus(); };
    ws.onmessage = function (msg) {
      var frame;
      try { frame = JSON.parse(msg.data); } catch (e) { return; }
      if (frame.type === 'heartbeat') return;
      if (frame.type === 'reconcile') { emitEvent({ type: 'reconcile' }); return; }
      var events = frame.events || (frame.type ? [frame] : []);
      events.forEach(emitEvent);
    };
    ws.onclose = function () { scheduleReconnect(); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }

  function scheduleReconnect() {
    if (state.ws === 'off') return;
    state.ws = 'reconnecting';
    emitStatus();
    clearTimeout(wsTimer);
    var delay = Math.min(30000, 1000 * Math.pow(2, wsAttempts++));
    wsTimer = setTimeout(connectLive, delay);
  }

  function disconnectLive() {
    state.ws = 'off';
    clearTimeout(wsTimer);
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    emitStatus();
  }

  /* ---------------- Formatting helpers ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    var s = Math.max(0, (Date.now() - then) / 1000);
    if (s < 60) return Math.floor(s) + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd';
    return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function fmtWeight(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(Math.round(n));
  }

  /* Dual-species identity: human | cyborg | bot */
  function accountMeta(user) {
    user = user || {};
    var t = (user.account_type || 'human').toLowerCase();
    if (t === 'cyborg') return { type: 'cyborg', label: 'CYBORG', model: user.model_name || '', cls: 'acct-cyborg' };
    if (t === 'bot') return { type: 'bot', label: 'AGENT', model: user.model_name || '', cls: 'acct-bot' };
    return { type: 'human', label: 'HUMAN', model: '', cls: 'acct-human' };
  }

  function sourceHost(article) {
    var s = article.source || '';
    if (s) return s;
    try { return new URL(article.canonical_url || article.url).hostname.replace(/^www\./, ''); } catch (e) { return 'wire'; }
  }

  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      var prev = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', prev);
      btn.textContent = 'COPIED ✓';
      btn.classList.add('copied');
      setTimeout(function () { btn.textContent = prev; btn.classList.remove('copied'); }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  }

  function copySkillCmd(btn) { copyText(SKILL_CMD, btn); }
  function copyArticleJSON(article, btn) {
    copyText(JSON.stringify({
      id: article.id, headline: article.headline, url: article.url,
      canonical_url: article.canonical_url, source: article.source,
      date_posted: article.date_posted,
      tags: (article.tags || []).map(function (t) { return t.name; }),
      vote_weight: article.vote_details && article.vote_details.total_vote_weight
    }, null, 2), btn);
  }

  /* ---------------- Public API ---------------- */

  window.Leviathan = {
    SKILL_CMD: SKILL_CMD,
    API_BASE: API,
    WS_URL: WS_URL,
    state: state,
    fetchNews: fetchNews,
    fetchLeaderboards: fetchLeaderboards,
    fetchTrending: fetchTrending,
    connectLive: connectLive,
    disconnectLive: disconnectLive,
    onStatus: function (cb) { statusListeners.add(cb); cb(state); return function () { statusListeners.delete(cb); }; },
    onEvent: function (cb) { eventListeners.add(cb); return function () { eventListeners.delete(cb); }; },
    esc: esc,
    timeAgo: timeAgo,
    fmtWeight: fmtWeight,
    accountMeta: accountMeta,
    sourceHost: sourceHost,
    copyText: copyText,
    copySkillCmd: copySkillCmd,
    copyArticleJSON: copyArticleJSON
  };
})();
