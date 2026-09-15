/* ============================================================
   LEVIATHAN ARTICLE ENGINE — shared data + conversion core
   Powers the variant article pages (Terminal / Broadsheet / Abyssal).
   Pure data & state: each variant renders in its own aesthetic.

   Hook model zones this engine feeds:
     HOOK   -> fetchArticle (headline, standfirst, media, meta)
     READ   -> buildBrief (AI summary bullets, key numbers, quotes)
     TRADE  -> consensusFromVotes (token-weighted odds bar)
               + placeWeight (vote-as-position; Kalshi/Polymarket seam)
     EARN   -> FirstSquid journey (yap -> vote -> position -> wallet)
     POD    -> fetchYaps + postYap (comments with species meta)
     RETURN -> fetchRelated (multi-source synthesis, next dispatch)
   ============================================================ */
(function () {
  'use strict';

  var API = 'https://api.leviathannews.xyz/api/v1';
  var ORIGIN_HEADERS = {
    'Origin': 'https://leviathannews.xyz',
    'Referer': 'https://leviathannews.xyz/'
  };

  /* ---------------- Article ID from URL ---------------- */
  function articleIdFromUrl() {
    var q = new URLSearchParams(window.location.search);
    return q.get('id') || q.get('article') || null;
  }

  /* ---------------- Fetchers (Live API with Fixture fallback) ---------------- */
  var FIX = 'shared/fixtures/news.json';

  function timeout(ms) {
    return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); });
  }
  function fetchTimeout(url, opts, ms) {
    return Promise.race([fetch(url, opts), timeout(ms || 2400)]);
  }

  function fetchArticle(id) {
    return fetchTimeout(API + '/news/' + encodeURIComponent(id) + '/')
      .then(function (r) { if (!r.ok) throw new Error('article ' + r.status); return r.json(); })
      .catch(function () {
        return fetch(FIX)
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var items = Array.isArray(d) ? d : (d.results || []);
            var found = items.find(function (a) { return String(a.id) === String(id); });
            if (found) return found;
            throw new Error('article not found: ' + id);
          });
      });
  }

  function fetchYaps(id) {
    return fetchTimeout(API + '/news/' + encodeURIComponent(id) + '/list_yaps')
      .then(function (r) { if (!r.ok) throw new Error('yaps ' + r.status); return r.json(); })
      .then(function (d) { return Array.isArray(d) ? d : (d.results || d.yaps || []); })
      .catch(function () {
        return fetch(FIX)
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var items = Array.isArray(d) ? d : (d.results || []);
            var found = items.find(function (a) { return String(a.id) === String(id); });
            return (found && found.top_yaps) || [];
          })
          .catch(function () { return []; });
      });
  }

  /* Related coverage: same-tag articles from the current feed */
  function fetchRelated(article, limit) {
    var tags = (article.tags || []).map(function (t) {
      return (typeof t === 'string' ? t : (t.name || '')).toLowerCase();
    });
    return fetchTimeout(API + '/news/?status=approved&sort_type=hot&per_page=40')
      .then(function (r) { if (!r.ok) throw new Error('news ' + r.status); return r.json(); })
      .catch(function () {
        return fetch(FIX).then(function (r) { return r.json(); });
      })
      .then(function (d) {
        var items = Array.isArray(d) ? d : (d.results || []);
        return items
          .filter(function (a) { return String(a.id) !== String(article.id); })
          .map(function (a) {
            var overlap = (a.tags || []).filter(function (t) {
              var tn = (typeof t === 'string' ? t : (t.name || '')).toLowerCase();
              return tags.indexOf(tn) !== -1;
            }).length;
            return { article: a, overlap: overlap };
          })
          .filter(function (x) { return x.overlap > 0; })
          .sort(function (a, b) { return b.overlap - a.overlap; })
          .slice(0, limit || 5)
          .map(function (x) { return x.article; });
      });
  }

  /* ---------------- THE BRIEF — AI summary structuring ----------------
     Input: top_tldr text + top_yaps (tldr/analysis tags).
     Output: { bullets: [..], numbers: [..], quote: {text, author, meta} }
     Real data only — no fabricated facts. */
  function buildBrief(article, yaps) {
    var tldr = (article.top_tldr && (article.top_tldr.text || article.top_tldr)) || '';
    if (typeof tldr !== 'string') tldr = '';

    var analysisYap = null;
    (yaps || []).forEach(function (y) {
      var tags = (y.tags || []).map(function (t) {
        return (typeof t === 'string' ? t : (t.name || '')).toLowerCase();
      });
      if (!analysisYap && (tags.indexOf('analysis') !== -1 || tags.indexOf('tldr') !== -1)) analysisYap = y;
    });
    if (!analysisYap && article.top_yaps && article.top_yaps.length) analysisYap = article.top_yaps[0];

    var body = tldr || (analysisYap && analysisYap.text) || '';

    // Sentence-split into bullets, strip noise, cap 5
    var bullets = body
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z0-9$])/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 24; })
      .slice(0, 5);

    // Key numbers: $ amounts, %, multiples, big figures from headline + brief
    var numSource = (article.headline || '') + ' ' + body;
    var numbers = [];
    var rx = /(\$[\d,.]+[MBK]?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?x\b|\$?\d+(?:\.\d+)?\s?(?:million|billion|mn|bn))/gi;
    var m;
    while ((m = rx.exec(numSource)) !== null && numbers.length < 6) {
      if (numbers.indexOf(m[0]) === -1) numbers.push(m[0]);
    }

    var quote = null;
    if (analysisYap && analysisYap.text && analysisYap.text.length > 40) {
      quote = {
        text: analysisYap.text,
        author: (analysisYap.author && analysisYap.author.display_name) || 'Analyst',
        user: analysisYap.author || null
      };
    }

    return { bullets: bullets, numbers: numbers, quote: quote, hasSummary: bullets.length > 0 };
  }

  /* ---------------- CONSENSUS — token-weighted "market" ----------------
     The honest wedge: Leviathan's SQUID-weighted votes ARE the position
     market today. Ratio of up/down weight = the odds bar.
     SEAM: swap consensusFromVotes for a Kalshi/Polymarket provider
     (Zero's aggregator PR) without touching variant markup. */
  function consensusFromVotes(article) {
    var vd = article.vote_details || {};
    var up = vd.upvotes || 0;
    var down = vd.downvotes || 0;
    var total = up + down;
    var pct = total > 0 ? Math.round((up / total) * 100) : 50;
    return {
      pct: pct,                       // 0-100 confidence
      up: up,
      down: down,
      totalWeight: vd.total_vote_weight || 0,
      label: total === 0 ? 'UNPRICED' : (pct >= 67 ? 'CONSENSUS LONG' : pct >= 50 ? 'LEAN LONG' : 'CONTESTED'),
      isLive: total > 0
    };
  }

  /* ---------------- Wallet auth (optional, progressive) ----------------
     EIP-191 personal_sign via window.ethereum when available.
     Sets access_token cookie via API verify. */
  function connectWallet() {
    if (!window.ethereum) {
      return Promise.reject(new Error('no-wallet'));
    }
    var address;
    return window.ethereum.request({ method: 'eth_requestAccounts' })
      .then(function (accounts) {
        address = accounts[0];
        return fetch(API + '/wallet/nonce/' + address + '/').then(function (r) { return r.json(); });
      })
      .then(function (n) {
        return window.ethereum.request({
          method: 'personal_sign',
          params: [n.message, address]
        }).then(function (sig) {
          return fetch(API + '/wallet/verify/', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, ORIGIN_HEADERS),
            credentials: 'include',
            body: JSON.stringify({ address: address, nonce: n.nonce, signature: sig })
          });
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error('verify ' + r.status);
        return { address: address };
      });
  }

  function isAuthed() {
    return document.cookie.indexOf('access_token=') !== -1;
  }

  /* ---------------- Actions (auth-gated) ---------------- */
  function postYap(articleId, text, tags) {
    return fetch(API + '/news/' + encodeURIComponent(articleId) + '/post_yap', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ORIGIN_HEADERS),
      credentials: 'include',
      body: JSON.stringify({ text: text, tags: tags || [] })
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('auth-required');
      if (!r.ok) throw new Error('yap ' + r.status);
      return r.json();
    });
  }

  function placeWeight(articleId, weight) {
    return fetch(API + '/news/' + encodeURIComponent(articleId) + '/vote', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ORIGIN_HEADERS),
      credentials: 'include',
      body: JSON.stringify({ weight: weight })
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('auth-required');
      if (!r.ok) throw new Error('vote ' + r.status);
      return r.json().catch(function () { return { ok: true }; });
    });
  }

  /* ---------------- FIRST-SQUID JOURNEY (progressive disclosure) --------
     Steps: yap -> weight -> position -> wallet. Persisted per-browser.
     Anonymous visitors see the nudge; completed steps stay checked. */
  var JOURNEY_KEY = 'lvx_first_squid_journey';
  var JOURNEY_STEPS = [
    { id: 'yap',      label: 'Yap once',            reward: 'Earn your first SQUID' },
    { id: 'weight',   label: 'Add vote weight',     reward: 'Your SQUID is your position' },
    { id: 'position', label: 'Back a narrative',    reward: 'Skin in the game' },
    { id: 'wallet',   label: 'Connect wallet',      reward: 'Unlock monthly drops' }
  ];

  function journeyGet() {
    try { return JSON.parse(localStorage.getItem(JOURNEY_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function journeyComplete(stepId) {
    var j = journeyGet();
    j[stepId] = Date.now();
    try { localStorage.setItem(JOURNEY_KEY, JSON.stringify(j)); } catch (e) {}
    return j;
  }
  function journeyState() {
    var done = journeyGet();
    return JOURNEY_STEPS.map(function (s, i) {
      var prevDone = i === 0 || !!done[JOURNEY_STEPS[i - 1].id];
      return {
        id: s.id,
        label: s.label,
        reward: s.reward,
        done: !!done[s.id],
        unlocked: prevDone,          // progressive disclosure
        current: !done[s.id] && prevDone
      };
    });
  }

  /* ---------------- Reading progress ---------------- */
  function trackReadingProgress(el, cb) {
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement;
        var max = h.scrollHeight - h.clientHeight;
        cb(max > 0 ? Math.min(1, (h.scrollTop || 0) / max) : 1);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Public API ---------------- */
  window.ArticleEngine = {
    articleIdFromUrl: articleIdFromUrl,
    fetchArticle: fetchArticle,
    fetchYaps: fetchYaps,
    fetchRelated: fetchRelated,
    buildBrief: buildBrief,
    consensusFromVotes: consensusFromVotes,
    connectWallet: connectWallet,
    isAuthed: isAuthed,
    postYap: postYap,
    placeWeight: placeWeight,
    journeySteps: JOURNEY_STEPS,
    journeyState: journeyState,
    journeyComplete: journeyComplete,
    trackReadingProgress: trackReadingProgress,
    articleUrl: function (variantFile, id) { return variantFile + '?id=' + encodeURIComponent(id); }
  };
})();
