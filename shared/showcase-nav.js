/* ============================================================
   LEVIATHAN NEWS — Showcase Navigator
   Injected floating dock: switch between variants + hub,
   live/fixture/WS status indicator.
   Requires window.VARIANT = { n: 1..6, name: '...' } set before load.
   ============================================================ */
(function () {
  'use strict';

  var VARIANTS = [
    { n: 1, file: 'variant-1-terminal.html', name: 'Terminal Intelligence', tag: 'Command Center' },
    { n: 2, file: 'variant-2-editorial.html', name: 'Prestige Broadsheet', tag: 'Editorial' },
    { n: 3, file: 'variant-3-abyssal.html', name: 'Bioluminescent Abyssal', tag: 'Web3 Glow' },
    { n: 4, file: 'variant-4-bento.html', name: 'Modular Bento', tag: 'Live Tiles' },
    { n: 5, file: 'variant-5-wire.html', name: 'The Wire', tag: 'Speed Reading' },
    { n: 6, file: 'variant-6-omarchy.html', name: 'Omarchy Wire', tag: 'Pixel Terminal' }
  ];

  var css = document.createElement('style');
  css.textContent = [
    '.lvx-dock{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:9999;',
    'display:flex;align-items:center;gap:2px;padding:5px;',
    'background:rgba(10,15,26,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
    'border:1px solid rgba(193,255,114,.22);border-radius:999px;',
    'font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;',
    'box-shadow:0 8px 32px rgba(0,0,0,.5);transition:opacity .2s;}',
    '.lvx-dock:hover{opacity:1;}',
    '.lvx-dock a,.lvx-dock button{display:flex;align-items:center;gap:5px;padding:5px 10px;',
    'border-radius:999px;color:#8b9bb4;text-decoration:none;border:0;background:none;',
    'font:inherit;cursor:pointer;white-space:nowrap;transition:all .15s;}',
    '.lvx-dock a:hover,.lvx-dock button:hover{color:#e6edf7;background:rgba(193,255,114,.10);}',
    '.lvx-dock a.lvx-active{color:#c1ff72;background:rgba(193,255,114,.14);}',
    '.lvx-dock .lvx-hub{color:#d9d9d9;}',
    '.lvx-dock .lvx-dot{width:7px;height:7px;border-radius:50%;flex:none;}',
    '.lvx-dot.live{background:#c1ff72;box-shadow:0 0 8px #c1ff72;animation:lvxPulse 2s infinite;}',
    '.lvx-dot.fixture{background:#d9d9d9;}',
    '.lvx-dot.connecting,.lvx-dot.reconnecting{background:#ffffff;animation:lvxPulse 1s infinite;}',
    '.lvx-dot.off{background:#5b6b84;}',
    '@keyframes lvxPulse{0%,100%{opacity:1}50%{opacity:.35}}',
    '.lvx-tip{position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:9999;',
    'background:rgba(10,15,26,.95);border:1px solid rgba(193,255,114,.30);border-radius:8px;',
    'padding:10px 14px;color:#c9d6e8;font-family:"JetBrains Mono",monospace;font-size:11px;',
    'pointer-events:none;opacity:0;transition:opacity .15s;white-space:nowrap;}',
    '.lvx-tip.show{opacity:1;}',
    '@media(max-width:760px){.lvx-dock a span.lvx-name{display:none}.lvx-dock a{padding:5px 8px}}',
    '@media(max-width:760px){.lvx-dock a,.lvx-dock button{min-width:32px;min-height:32px;justify-content:center}}'
  ].join('\n');
  document.head.appendChild(css);

  var current = window.VARIANT || { n: 0, name: 'Showcase Hub' };

  var dock = document.createElement('nav');
  dock.className = 'lvx-dock';
  dock.setAttribute('aria-label', 'Variant switcher');

  var hub = document.createElement('a');
  hub.href = 'index.html';
  hub.className = 'lvx-hub';
  hub.title = 'Showcase hub';
  hub.textContent = '◇';
  dock.appendChild(hub);

  VARIANTS.forEach(function (v) {
    var a = document.createElement('a');
    a.href = v.file;
    a.title = v.name + ' — ' + v.tag;
    if (v.n === current.n) a.className = 'lvx-active';
    a.innerHTML = '<span>0' + v.n + '</span><span class="lvx-name">' + v.name + '</span>';
    dock.appendChild(a);
  });

  var statusBtn = document.createElement('button');
  statusBtn.title = 'Data source status';
  var dot = document.createElement('span');
  dot.className = 'lvx-dot connecting';
  var statusTxt = document.createElement('span');
  statusTxt.textContent = '···';
  statusBtn.appendChild(dot);
  statusBtn.appendChild(statusTxt);
  dock.appendChild(statusBtn);

  var tip = document.createElement('div');
  tip.className = 'lvx-tip';

  function render() {
    if (!window.Leviathan) return;
    var s = window.Leviathan.state;
    var src = s.source, ws = s.ws;
    dot.className = 'lvx-dot ' + (src === 'live' ? 'live' : src === 'fixture' ? 'fixture' : 'connecting');
    statusTxt.textContent = src === 'live' ? 'LIVE' : src === 'fixture' ? 'STALE' : '···';
    var wsLabel = ws === 'live' ? 'WS:live' : ws === 'off' ? 'WS:off' : 'WS:' + ws;
    tip.textContent = 'REST: ' + (src === 'live' ? 'api.leviathannews.xyz' : src === 'fixture' ? 'local fixture snapshot' : 'connecting') + ' · ' + wsLabel + ' · ' + (current.name || 'hub');
  }

  statusBtn.addEventListener('mouseenter', function () { tip.classList.add('show'); });
  statusBtn.addEventListener('mouseleave', function () { tip.classList.remove('show'); });

  function boot() {
    document.body.appendChild(dock);
    document.body.appendChild(tip);
    if (window.Leviathan) {
      window.Leviathan.onStatus(render);
      render();
    }
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
