/* Dartmaatje app. Eén telefoon: iedereen vult zijn naam in, kiest samen een snelheid en gooit één pijl. */
(function () {
  var MAX_PLAYERS = 15, MIN_PLAYERS = 2;
  var SPEEDS = [
    { id: 'rustig', n: 'Rustig', v: 0.7, d: 'Voor beginners' },
    { id: 'normaal', n: 'Normaal', v: 1.3, d: 'Lekker spannend' },
    { id: 'snel', n: 'Snel', v: 2.4, d: 'Alleen voor durvers' }
  ];
  var MODES = [
    { id: 'laagste', n: 'Laagste betaalt', d: 'Wie de laagste score gooit', hint: 'De laagste score betaalt. Mik dus hoog.', rule: 'De laagste score betaalt.' },
    { id: 'hoogste', n: 'Hoogste betaalt', d: 'Wie de hoogste score gooit', hint: 'De hoogste score betaalt. Mik dus laag.', rule: 'De hoogste score betaalt.' },
    { id: 'dichtstbij', n: 'Gooi in de roos', d: 'In de roos wint. Wie het verst weg gooit, betaalt', hint: 'Gooi in de roos om te winnen. Wie het verst weg gooit, betaalt. Mik dus op de roos.', rule: 'In de roos wint. Wie het verst weg gooit, betaalt.' }
  ];
  var ORDERS = [
    { id: 'invoer', n: 'Zoals ingevoerd', d: 'De eerste naam begint' },
    { id: 'rad', n: 'Draairad', d: 'Het rad kiest' }
  ];
  /* De straffen. Elke regel is één straf; pas ze hier aan, voeg toe of haal weg. */
  var STRAFFEN = [
    "Bestel de volgende ronde in een Frans accent.",
    "Speel de volgende worp met je zwakke hand.",
    "Na je eerstvolgende bullseye mag je niet juichen.",
    "Vertel je meest gênante verhaal.",
    "Je mag de eerstvolgende 30 minuten alleen nog fluisteren.",
    "Maak een compliment aan elke persoon, en meen het.",
    "Houd je volgende worp met je ogen dicht.",
    "Imiteer een persoon die je kent naar keuze, de rest raadt wie.",
    "Laat de groep je telefoon-achtergrond kiezen voor de rest van de dag.",
    "Doe een squat, zo diep mogelijk.",
    "Geef je rechter hand de naam van je geliefde. Heb je die niet, dan volstaat familie ook.",
    "Geef dertig seconden een serieuze toespraak over waarom sokken verdwijnen.",
    "Doe een modeshow van tien seconden met je huidige outfit.",
    "Bied een stoel uitgebreid excuses aan omdat je erop hebt gezeten.",
    "Verkoop een willekeurig voorwerp alsof het een revolutionaire uitvinding is.",
    "Laat de groep een woord kiezen dat je in je volgende drie zinnen moet verwerken.",
    "Geef jezelf een nieuwe bijnaam en stel je daarmee officieel voor.",
    "Doe een overwinningsdans voor een prestatie die niemand indrukwekkend vindt.",
    "Geef een weerbericht over de sfeer in de kamer.",
    "Verzin een complottheorie over een alledaags voorwerp.",
    "Geef een dankwoord voor het winnen van de prijs voor ‘meest gemiddelde persoon’.",
    "Beeld een emoji uit. De rest moet hem raden.",
    "Verzin een reclameslogan voor jezelf en presenteer die vol overtuiging.",
    "Laat de groep een onschuldige uitspraak kiezen die je drie keer op een natuurlijk moment moet zeggen.",
    "Leg uit hoe je een boterham maakt alsof je een topchef met drie Michelinsterren bent.",
    "Maak een liedje van vier regels over het eerste voorwerp dat je ziet."
  ];
  var STORE = 'dartmaatje-app';

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var S = {
    names: [], speed: 'normaal', mode: 'laagste', order: 'invoer', punish: false, currentPunish: '', lastLoser: null, lastList: null,
    view: 'setup',
    queue: [], qi: 0, round: 1,
    thrown: {},        // spelerindex -> worp van deze beurtronde
    totals: {},        // spelerindex -> worpen over alle beurtronden (voor de uitslag)
    darts: [], turnDone: false, aim: null, lastHit: null
  };

  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    if (Array.isArray(saved.names)) S.names = saved.names.filter(function (n) { return typeof n === 'string' && n.trim(); }).slice(0, MAX_PLAYERS);
    if (SPEEDS.some(function (s) { return s.id === saved.speed; })) S.speed = saved.speed;
    if (MODES.some(function (m) { return m.id === saved.mode; })) S.mode = saved.mode;
    if (ORDERS.some(function (o) { return o.id === saved.order; })) S.order = saved.order;
    S.punish = saved.punish === true;
  } catch (e) {}
  function persist() { try { localStorage.setItem(STORE, JSON.stringify({ names: S.names, speed: S.speed, mode: S.mode, order: S.order, punish: S.punish })); } catch (e) {} }

  /* ---------- spelmodus: wat telt en wie betaalt ---------- */
  function modeInfo() { return MODES.filter(function (m) { return m.id === S.mode; })[0]; }
  function fmtMm(dist) {   // het bord is 170 mm breed in de straal; in de tekening is dat 180
    var mm = dist * 170 / 180;
    return (mm < 10 ? mm.toFixed(1) : String(Math.round(mm))).replace('.', ',') + ' mm';
  }
  function metric(h) { return S.mode === 'dichtstbij' ? Math.round(h.dist * 10) / 10 : h.score; }
  function worstOf(vals) { return (S.mode === 'hoogste' || S.mode === 'dichtstbij') ? Math.max.apply(null, vals) : Math.min.apply(null, vals); }
  function bigText(h) { return S.mode === 'dichtstbij' ? fmtMm(h.dist) : String(h.score); }
  function sameText(h) { return S.mode === 'dichtstbij' ? 'even ver van de roos (' + fmtMm(h.dist) + ')' : h.score + ' punten'; }
  function resultLine(h, name) {
    if (S.mode === 'dichtstbij') return name + ' gooide het verst van de roos: ' + h.label + ', op ' + fmtMm(h.dist) + ' van het midden';
    if (S.mode === 'hoogste') return name + ' gooide de hoogste score: ' + h.label + ' (' + h.score + ' punten)';
    return name + ' gooide ' + h.label + ' (' + h.score + ' punten)';
  }

  function color(i) { return 'hsl(' + Math.round((i * 137.5) % 360) + ',78%,62%)'; }
  function speedValue() { return SPEEDS.filter(function (s) { return s.id === S.speed; })[0].v; }

  /* Trillen: via de app als die er is, anders de browser. */
  function buzz(ms) {
    try {
      var C = window.Capacitor;
      if (C && C.Plugins && C.Plugins.Haptics) { C.Plugins.Haptics.impact({ style: 'MEDIUM' }); return; }
      if (navigator.vibrate) navigator.vibrate(ms || 30);
    } catch (e) {}
  }

  function show(view) {
    S.view = view;
    ['setup', 'wheel', 'game', 'tie', 'result'].forEach(function (v) { $(v).hidden = v !== view; });
    window.scrollTo(0, 0);
  }

  /* ---------- 1. spelers en snelheid ---------- */
  function renderSetup() {
    $('counter').textContent = '(' + S.names.length + ' van ' + MAX_PLAYERS + ')';
    var ul = $('players'); ul.textContent = '';
    if (!S.names.length) {
      var li0 = el('li'); li0.style.display = 'block'; li0.style.border = 'none'; li0.style.background = 'none'; li0.style.padding = '0';
      li0.appendChild(el('p', 'empty', 'Nog geen spelers. Typ hierboven een naam en kies Toevoegen.'));
      ul.appendChild(li0);
    }
    S.names.forEach(function (name, i) {
      var li = el('li');
      var d = el('span', 'dot', String(i + 1)); d.style.background = color(i); d.setAttribute('aria-hidden', 'true');
      var nm = el('span', 'nm', name);
      var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Verwijder ' + name);
      x.addEventListener('click', function () { S.names.splice(i, 1); persist(); renderSetup(); });
      li.appendChild(d); li.appendChild(nm); li.appendChild(x);
      ul.appendChild(li);
    });
    var full = S.names.length >= MAX_PLAYERS;
    $('add-btn').disabled = full; $('name').disabled = full;
    $('name').placeholder = full ? 'Maximaal ' + MAX_PLAYERS + ' spelers' : 'Naam';

    var box = $('speeds'); box.textContent = '';
    SPEEDS.forEach(function (s) {
      var b = el('button', 'sp'); b.type = 'button';
      b.appendChild(document.createTextNode(s.n)); b.appendChild(el('small', '', s.d));
      b.setAttribute('aria-pressed', S.speed === s.id ? 'true' : 'false');
      b.addEventListener('click', function () { S.speed = s.id; persist(); renderSetup(); });
      box.appendChild(b);
    });

    var mbox = $('modes'); mbox.textContent = '';
    MODES.forEach(function (m) {
      var b = el('button', 'op'); b.type = 'button';
      b.appendChild(document.createTextNode(m.n)); b.appendChild(el('small', '', m.d));
      b.setAttribute('aria-pressed', S.mode === m.id ? 'true' : 'false');
      b.addEventListener('click', function () { S.mode = m.id; persist(); renderSetup(); });
      mbox.appendChild(b);
    });
    var obox = $('orders'); obox.textContent = '';
    ORDERS.forEach(function (o) {
      var b = el('button', 'sp'); b.type = 'button';
      b.appendChild(document.createTextNode(o.n)); b.appendChild(el('small', '', o.d));
      b.setAttribute('aria-pressed', S.order === o.id ? 'true' : 'false');
      b.addEventListener('click', function () { S.order = o.id; persist(); renderSetup(); });
      obox.appendChild(b);
    });

    $('punish-toggle').checked = S.punish;

    var ok = S.names.length >= MIN_PLAYERS;
    $('start').disabled = !ok;
    $('start-note').textContent = ok ? '' : 'Voeg minstens ' + MIN_PLAYERS + ' spelers toe om te starten.';
  }

  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = $('name').value.replace(/\s+/g, ' ').trim();
    var msg = $('add-msg');
    if (!raw) { msg.textContent = 'Typ eerst een naam.'; return; }
    if (S.names.length >= MAX_PLAYERS) { msg.textContent = 'Er kunnen maximaal ' + MAX_PLAYERS + ' spelers meedoen.'; return; }
    if (S.names.some(function (n) { return n.toLowerCase() === raw.toLowerCase(); })) { msg.textContent = raw + ' staat er al. Geef een andere naam of voeg een letter toe.'; return; }
    S.names.push(raw); persist(); msg.textContent = ''; $('name').value = '';
    renderSetup(); $('name').focus();
  });

  $('punish-toggle').addEventListener('change', function () { S.punish = this.checked; persist(); });

  $('start').addEventListener('click', function () { newGame(); });

  /* ---------- 2. gooien ---------- */
  function newGame() {
    if (S.order === 'rad') { startWheel(); return; }
    beginRound(S.names.map(function (_, i) { return i; }));
  }
  function beginRound(order) {
    S.queue = order.slice();
    S.round = 1; S.totals = {};
    startTurnRound();
  }

  /* ---------- draairad: het rad kiest de volgorde ---------- */
  var W = { remaining: [], order: [], rot: 0, spinning: false, timer: 0 };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function startWheel() {
    W.remaining = S.names.map(function (_, i) { return i; });
    W.order = []; W.rot = 0; W.spinning = false;
    show('wheel');
    renderWheel();
  }
  function polar(r, deg) {
    var a = deg * Math.PI / 180;
    return (r * Math.sin(a)).toFixed(2) + ' ' + (-r * Math.cos(a)).toFixed(2);
  }
  function renderWheel() {
    var n = W.remaining.length, svg = $('wheel-svg');
    var done = n === 0;
    var h = '';
    if (n > 0) {
      var seg = 360 / n, fs = n <= 6 ? 22 : n <= 10 ? 18 : 14, maxc = n <= 6 ? 11 : n <= 10 ? 10 : 8;
      h += '<g id="wheel-rot" style="transform:rotate(' + W.rot + 'deg);transform-origin:0 0' + (W.rot === 0 ? ';transition:none' : '') + '">';
      h += '<circle r="200" fill="#14110F" stroke="#F5B02E" stroke-width="6"/>';
      W.remaining.forEach(function (pi, k) {
        var a1 = k * seg, a2 = (k + 1) * seg, mid = (k + 0.5) * seg;
        var path = n === 1
          ? 'M 0 -190 A 190 190 0 1 1 -0.01 -190 Z'
          : 'M 0 0 L ' + polar(190, a1) + ' A 190 190 0 ' + (seg > 180 ? 1 : 0) + ' 1 ' + polar(190, a2) + ' Z';
        h += '<path d="' + path + '" fill="' + color(pi) + '" stroke="#14110F" stroke-width="3"/>';
        var nm = S.names[pi]; if (nm.length > maxc) nm = nm.slice(0, maxc - 1) + '…';
        nm = nm.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        h += '<g transform="rotate(' + (mid - 90) + ')"><text x="52" y="0" dominant-baseline="central" style="font:800 ' + fs + 'px Figtree,sans-serif;fill:#14110F">' + nm + '</text></g>';
      });
      h += '<circle r="26" fill="#14110F" stroke="#F5B02E" stroke-width="4"/><circle r="9" fill="#C8233B"/>';
      h += '</g>';
      h += '<polygon points="-16,-214 16,-214 0,-176" fill="#F4EAD0" stroke="#14110F" stroke-width="4" stroke-linejoin="round"/>';
    }
    svg.innerHTML = h;
    svg.style.display = n > 0 ? '' : 'none';

    var ol = $('order-list'); ol.textContent = '';
    W.order.forEach(function (pi, k) {
      var li = el('li');
      var pos = el('span', 'pos', String(k + 1) + '.');
      var d = el('span', 'dot', String(pi + 1)); d.style.background = color(pi); d.setAttribute('aria-hidden', 'true');
      li.appendChild(pos); li.appendChild(d); li.appendChild(el('span', 'nm', S.names[pi]));
      ol.appendChild(li);
    });
    $('wheel-spin').hidden = done; $('wheel-rest').hidden = done || n < 2;
    $('wheel-go').hidden = !done;
    $('wheel-spin').disabled = W.spinning; $('wheel-rest').disabled = W.spinning;
    $('wheel-spin').textContent = W.order.length === 0 ? 'Draai!' : 'Draai voor nummer ' + (W.order.length + 1);
    $('wheel-h').textContent = done ? 'De volgorde ligt vast' : (W.order.length === 0 ? 'Wie gooit eerst?' : 'Wie is nummer ' + (W.order.length + 1) + '?');
    $('wheel-sub').textContent = done ? 'Geef de telefoon door aan ' + S.names[W.order[0]] + '.' : 'Tik op Draai en het rad kiest.';
  }
  function spinWheel() {
    if (W.spinning || !W.remaining.length) return;
    var n = W.remaining.length;
    if (n === 1) { W.order.push(W.remaining.pop()); renderWheel(); return; }
    var seg = 360 / n, k = Math.floor(Math.random() * n);
    var jitter = (Math.random() - 0.5) * seg * 0.7;
    var target = -((k + 0.5) * seg + jitter);
    var cur = ((W.rot % 360) + 360) % 360;
    var delta = ((target - cur) % 360 + 360) % 360;
    W.rot += 360 * (5 + Math.floor(Math.random() * 3)) + delta;
    W.spinning = true;
    $('wheel-spin').disabled = true; $('wheel-rest').disabled = true;
    var rot = $('wheel-rot');
    rot.style.transition = '';
    void rot.getBoundingClientRect();   // zorgt dat de browser de draaiing echt animeert
    rot.style.transform = 'rotate(' + W.rot + 'deg)';
    W.timer = setTimeout(function () {
      var pi = W.remaining.splice(k, 1)[0];
      W.order.push(pi);
      if (W.remaining.length === 1) W.order.push(W.remaining.pop());
      W.spinning = false; W.rot = 0;
      $('wheel-live').textContent = S.names[pi] + ' is nummer ' + (W.order.indexOf(pi) + 1) + '.';
      buzz(60);
      renderWheel();
    }, reduceMotion ? 300 : 3700);
  }
  function finishWheel() {
    if (W.spinning) return;
    var rest = W.remaining.slice();
    for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    W.order = W.order.concat(rest); W.remaining = [];
    $('wheel-live').textContent = 'De rest is geloot.';
    renderWheel();
  }
  $('wheel-spin').addEventListener('click', spinWheel);
  $('wheel-rest').addEventListener('click', finishWheel);
  $('wheel-go').addEventListener('click', function () { beginRound(W.order); });
  $('wheel-back').addEventListener('click', function () { clearTimeout(W.timer); W.spinning = false; show('setup'); renderSetup(); });
  function startTurnRound() {
    S.qi = 0; S.thrown = {}; S.darts = []; S.turnDone = false; S.lastHit = null;
    show('game');
    $('board').innerHTML = DM.boardSvg('Dartbord met het balletje en de pijlen van deze ronde');
    renderTurn();
  }
  function currentSvg() { return $('board').querySelector('svg'); }

  function renderTurn() {
    var pi = S.queue[S.qi];
    $('round-lbl').textContent = (S.round === 1 ? 'Ronde' : 'Beslissingsworp ' + (S.round - 1)) + ' · ' + modeInfo().n;
    $('progress').textContent = 'Speler ' + (S.qi + 1) + ' van ' + S.queue.length;
    $('turn-dot').style.background = color(pi); $('turn-dot').textContent = String(pi + 1);
    $('who').textContent = S.names[pi];
    $('turn-sub').textContent = S.turnDone ? 'Gegooid' : 'Jouw beurt';
    DM.drawDarts(currentSvg(), S.darts);

    var area = $('throw-area'); area.textContent = '';
    if (!S.turnDone) {
      if (S.aim) S.aim.stop();
      S.aim = DM.startAim(currentSvg(), speedValue);
      var go = el('button', 'btn btn-big', 'Gooi!'); go.type = 'button';
      go.addEventListener('click', doThrow);
      area.appendChild(go);
      area.appendChild(el('p', 'note', modeInfo().hint));
    } else {
      var h = S.lastHit;
      var card = el('div', 'last pop');
      var left = el('div'); left.appendChild(el('div', 'lbl', 'Jouw worp')); left.appendChild(el('div', 'what', h.label)); left.appendChild(el('div', 'note', h.calc));
      card.appendChild(left); card.appendChild(el('div', 'big', bigText(h)));
      area.appendChild(card);
      area.appendChild(el('p', 'note', DM.roastFor(h)));
      var last = S.qi === S.queue.length - 1;
      var next = el('button', 'btn btn-big', last ? 'Bekijk de uitslag' : 'Volgende: ' + S.names[S.queue[S.qi + 1]]); next.type = 'button';
      next.addEventListener('click', nextTurn);
      area.appendChild(next);
    }
  }

  function doThrow() {
    if (S.turnDone || !S.aim) return;
    var p = S.aim.pos();
    var x = +(p.x + (Math.random() - 0.5) * 14).toFixed(1), y = +(p.y + (Math.random() - 0.5) * 14).toFixed(1);
    var h = DM.hit(x, y);
    h.dist = Math.hypot(x - 220, y - 220);
    var pi = S.queue[S.qi];
    S.aim.stop(); S.aim = null;
    S.thrown[pi] = h; S.lastHit = h; S.turnDone = true;
    (S.totals[pi] = S.totals[pi] || []).push(h);
    S.darts.push({ x: x, y: y, color: color(pi), text: String(pi + 1), fresh: true });
    buzz(h.score === 50 ? 80 : 30);
    renderTurn();
  }

  function nextTurn() {
    S.darts.forEach(function (d) { d.fresh = false; });
    if (S.qi < S.queue.length - 1) {
      S.qi++; S.turnDone = false; S.lastHit = null; renderTurn(); return;
    }
    evaluate();
  }

  /* ---------- 3 en 4. gelijkspel of uitslag ---------- */
  function evaluate() {
    var vals = S.queue.map(function (i) { return metric(S.thrown[i]); });
    var worst = worstOf(vals);
    var losers = S.queue.filter(function (i) { return metric(S.thrown[i]) === worst; });
    if (losers.length === 1) { showResult(losers[0]); return; }
    S.pendingTie = losers;
    $('tie-text').textContent = losers.map(function (i) { return S.names[i]; }).join(' en ') +
      ' gooiden allemaal ' + sameText(S.thrown[losers[0]]) + '. Alleen jullie gooien opnieuw, de rest is veilig.';
    show('tie');
  }
  $('tie-go').addEventListener('click', function () {
    S.queue = S.pendingTie.slice(); S.round++;
    startTurnRound();
  });

  function pickPunishment() {
    var pool = STRAFFEN.filter(function (t) { return t !== S.currentPunish; });
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function showPunishment() {
    var box = $('punish-box');
    box.hidden = !S.punish;
    if (S.punish) { $('punish-text').textContent = S.currentPunish; }
  }
  $('punish-again').addEventListener('click', function () {
    S.currentPunish = pickPunishment(); showPunishment();
    if (S.lastLoser !== null) prepareShare(S.lastLoser, S.lastList);
  });

  function showResult(loser) {
    var h = S.thrown[loser];
    $('loser').textContent = S.names[loser];
    var extra = '';
    if (S.mode === 'dichtstbij') {
      var inRoos = [], best = null;
      S.names.forEach(function (n, i) {
        var w = (S.totals[i] || [])[0];
        if (!w) return;
        if (w.dist <= 16.8) inRoos.push(n);
        if (best === null || w.dist < best.d) best = { i: i, d: w.dist };
      });
      if (inRoos.length) extra = ' In de roos: ' + inRoos.join(', ') + '. ' + (inRoos.length === 1 ? 'Die wint.' : 'Die winnen.');
      else if (best !== null && best.i !== loser) extra = ' Niemand gooide in de roos. ' + S.names[best.i] + ' kwam het dichtst (' + fmtMm(best.d) + ').';
    }
    $('loser-text').textContent = resultLine(h, S.names[loser]) + ' en trakteert.' + extra;
    var list = S.names.map(function (n, i) { return { i: i, n: n, w: S.totals[i] || [] }; })
      .sort(function (a, b) {
        var la = a.w.length ? metric(a.w[0]) : 0, lb = b.w.length ? metric(b.w[0]) : 0;
        var dir = (S.mode === 'hoogste' || S.mode === 'dichtstbij') ? -1 : 1;   // de verliezer staat altijd bovenaan, de beste onderaan
        return (a.i === loser ? -1 : 0) - (b.i === loser ? -1 : 0) || dir * (la - lb);
      });
    var ul = $('rank'); ul.textContent = '';
    list.forEach(function (p) {
      var first = p.w[0];
      var li = el('li'); if (p.i === loser) li.setAttribute('data-loser', '1');
      var d = el('span', 'dot', String(p.i + 1)); d.style.background = color(p.i); d.setAttribute('aria-hidden', 'true');
      var sc = el('span', 'sc', first ? bigText(first) : '–');
      if (first) sc.appendChild(el('small', '', first.label + (p.w.length > 1 ? ' · daarna ' + p.w.slice(1).map(function (w) { return bigText(w); }).join(', ') : '')));
      li.appendChild(d); li.appendChild(el('span', 'nm', p.n)); li.appendChild(sc);
      ul.appendChild(li);
    });
    S.lastLoser = loser; S.lastList = list;
    S.currentPunish = S.punish ? pickPunishment() : '';
    showPunishment();
    show('result');
    buzz(60);
    prepareShare(loser, list);
    maybeAskReview();
  }

  /* ---------- beoordelingsvraag (alleen in de iPhone-app) ----------
     Na de derde afgeronde ronde vragen we één keer om een beoordeling, en daarna hooguit eens per 120 dagen.
     Het aantal rondes staat alleen op dit toestel. Apple bepaalt zelf of het venster echt verschijnt. */
  var REVIEW_KEY = 'dartmaatje-beoordeling';
  function maybeAskReview() {
    try {
      var C = window.Capacitor;
      if (!C || !C.isNativePlatform || !C.isNativePlatform() || !C.nativePromise) return;
      var st = JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}');
      st.rondes = (st.rondes || 0) + 1;
      var ask = st.rondes >= 3 && (Date.now() - (st.gevraagd || 0)) > 120 * 24 * 3600 * 1000;
      if (ask) st.gevraagd = Date.now();
      localStorage.setItem(REVIEW_KEY, JSON.stringify(st));
      if (ask) {
        setTimeout(function () {
          if (S.view !== 'result') return;   // alleen als de uitslag nog in beeld is
          C.nativePromise('Review', 'request', {}).catch(function () {});
        }, 2500);
      }
    } catch (e) { /* de beoordelingsvraag mag de app nooit storen */ }
  }

  /* ---------- de uitslag delen ---------- */
  var shareFile = null, shareText = '', shareToken = 0, shareURL = '', lastFocus = null;

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /* Tekent een afbeelding met de uitslag. Geeft een Promise met een PNG-bestand (of null). */
  function drawCard(loser, list) {
    var fonts = (document.fonts && document.fonts.load)
      ? Promise.all([document.fonts.load('56px "Bowlby One"'), document.fonts.load('800 30px "Figtree"')]).catch(function () {})
      : Promise.resolve();
    return fonts.then(function () {
      var W = 1080, extra = (S.punish && S.currentPunish) ? 150 : 0, top = 548 + extra, rowH = 62, H = Math.max(1080, top + list.length * rowH + 210);
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d');
      var DISPLAY = '"Bowlby One","Arial Black",sans-serif', BODY = '"Figtree",system-ui,sans-serif';
      g.fillStyle = '#0F2B22'; g.fillRect(0, 0, W, H);
      g.textBaseline = 'middle';

      function circle(x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); }
      circle(120, 100, 48, '#F4EAD0'); circle(120, 100, 44, '#14110F'); circle(120, 100, 34, '#C8233B'); circle(120, 100, 20, '#F4EAD0'); circle(120, 100, 8, '#1F8A5B');
      g.fillStyle = '#F4EAD0'; g.font = '58px ' + DISPLAY; g.textAlign = 'left';
      g.fillText('Dartmaatje', 190, 102);

      // kaart met de verliezer
      g.fillStyle = '#14110F'; roundRect(g, 68, 206, 960, 250, 40); g.fill();
      g.fillStyle = '#F4EAD0'; roundRect(g, 60, 190, 960, 250, 40); g.fill();
      g.fillStyle = '#B31C30'; g.font = '800 30px ' + BODY; g.textAlign = 'left';
      g.fillText('HET EERSTE RONDJE IS VOOR', 100, 238);
      var name = S.names[loser], size = 104;
      g.fillStyle = '#14110F';
      do { g.font = size + 'px ' + DISPLAY; size -= 4; } while (g.measureText(name).width > 880 && size > 36);
      g.fillText(name, 100, 322);
      var h = S.thrown[loser];
      g.fillStyle = '#14110F'; g.font = '700 32px ' + BODY;
      var line;
      if (S.mode === 'dichtstbij') line = 'gooide het verst van de roos: ' + fmtMm(h.dist);
      else if (S.mode === 'hoogste') line = 'gooide de hoogste score: ' + h.label + ' (' + h.score + ')';
      else line = 'gooide ' + h.label + ' (' + h.score + ' punten)';
      line += ' en trakteert';
      var lsize = 32; g.fillStyle = '#14110F';
      do { g.font = '700 ' + lsize + 'px ' + BODY; lsize -= 2; } while (g.measureText(line).width > 880 && lsize > 18);
      g.fillText(line, 100, 398);

      // straf
      if (extra) {
        g.fillStyle = '#0B211A'; roundRect(g, 60, 470, 960, extra - 24, 28); g.fill();
        g.strokeStyle = '#F5B02E'; g.lineWidth = 4; roundRect(g, 60, 470, 960, extra - 24, 28); g.stroke();
        g.fillStyle = '#F5B02E'; g.font = '800 26px ' + BODY; g.textAlign = 'left'; g.fillText('DE STRAF', 90, 502);
        g.fillStyle = '#F4EAD0'; g.font = '700 32px ' + BODY;
        var words = S.currentPunish.split(' '), ln = '', ly = 546, lines = [];
        words.forEach(function (w) { var t = ln ? ln + ' ' + w : w; if (g.measureText(t).width > 880 && ln) { lines.push(ln); ln = w; } else ln = t; });
        lines.push(ln);
        lines.slice(0, 2).forEach(function (l, k) { g.fillText(l + (k === 1 && lines.length > 2 ? '…' : ''), 90, ly + k * 40); });
      }

      // alle scores
      g.fillStyle = '#F5B02E'; g.font = '800 28px ' + BODY;
      g.fillText('ALLE SCORES', 70, top - 40);
      list.forEach(function (p, idx) {
        var y = top + idx * rowH, first = p.w[0];
        if (p.i === loser) { g.fillStyle = 'rgba(224,57,77,.25)'; roundRect(g, 60, y - 26, 960, 54, 16); g.fill(); }
        circle(100, y + 1, 20, color(p.i));
        g.fillStyle = '#14110F'; g.font = '800 22px ' + BODY; g.textAlign = 'center'; g.fillText(String(p.i + 1), 100, y + 2);
        g.textAlign = 'left'; g.fillStyle = '#F4EAD0'; g.font = '700 32px ' + BODY;
        var nm = p.n; while (g.measureText(nm).width > 560 && nm.length > 3) nm = nm.slice(0, -2);
        g.fillText(nm === p.n ? nm : nm + '…', 142, y + 2);
        g.textAlign = 'right';
        g.fillStyle = '#F4EAD0'; g.font = '800 32px ' + BODY;
        var main = first ? bigText(first) : '–';
        g.fillText(main, 990, y + 2);
        if (first) { var mw = g.measureText(main).width; g.fillStyle = '#B7C9BE'; g.font = '500 24px ' + BODY; g.fillText(first.label, 990 - mw - 24, y + 3); }
      });

      // voet
      g.textAlign = 'center';
      g.fillStyle = '#B7C9BE'; g.font = '500 32px ' + BODY; g.fillText('Eén pijl per speler. ' + modeInfo().rule, W / 2, H - 120);
      g.fillStyle = '#F5B02E'; g.font = '44px ' + DISPLAY; g.fillText('dartmaatje.nl', W / 2, H - 62);

      return new Promise(function (resolve) {
        c.toBlob(function (blob) {
          if (!blob) return resolve(null);
          try { resolve(new File([blob], 'dartmaatje-uitslag.png', { type: 'image/png' })); } catch (e) { resolve(null); }
        }, 'image/png');
      });
    });
  }

  /* De afbeelding wordt klaargezet zodra de uitslag er is, zodat delen meteen na een tik kan. */
  function prepareShare(loser, list) {
    var token = ++shareToken;
    shareFile = null;
    shareText = S.names[loser] + ' trakteert het eerste rondje! Gegooid met Dartmaatje: https://dartmaatje.nl';
    $('share-msg').textContent = '';
    drawCard(loser, list).then(function (f) {
      if (token !== shareToken) return;
      shareFile = f;
      if (shareURL) { URL.revokeObjectURL(shareURL); shareURL = ''; }
      if (f) shareURL = URL.createObjectURL(f);
    }).catch(function () {});
  }

  function say(text) {
    var m = !$('sharebox').hidden ? $('save-done') : $('share-msg'); m.hidden = false; m.textContent = text;
    setTimeout(function () { if (m.textContent === text) m.textContent = ''; }, 4000);
  }

  function doShare() {
    function done(err) { if (err && err.name !== 'AbortError') fallback(); }
    function fallback() {
      try {
        navigator.clipboard.writeText(shareText).then(function () { say('Tekst gekopieerd. Plak hem in WhatsApp of je socials.'); },
          function () { say('Delen lukt hier niet. Maak een screenshot van de uitslag.'); });
      } catch (e) { say('Delen lukt hier niet. Maak een screenshot van de uitslag.'); }
    }
    try {
      if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        navigator.share({ files: [shareFile], text: shareText }).then(null, done); return;
      }
      if (navigator.share) { navigator.share({ text: shareText, url: 'https://dartmaatje.nl' }).then(null, done); return; }
    } catch (e) { /* val terug op kopiëren */ }
    fallback();
  }
  function isTouch() { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }

  function openShareBox() {
    lastFocus = document.activeElement;
    var img = $('share-img');
    if (shareURL) { img.src = shareURL; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
    $('save-hint').hidden = true; $('save-done').hidden = true; $('save-done').textContent = '';
    $('share-save').disabled = !shareFile;
    $('sharebox').hidden = false;
    $('share-go').focus();
  }
  function closeShareBox() {
    $('sharebox').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function saveImage() {
    if (!shareFile || !shareURL) return;
    if (isTouch()) {
      /* Op een telefoon: lang indrukken op de afbeelding geeft "Bewaar in Foto's". */
      $('save-hint').hidden = false;
      $('save-hint').scrollIntoView({ block: 'nearest' });
      return;
    }
    var a = document.createElement('a');
    a.href = shareURL; a.download = 'dartmaatje-uitslag.png';
    document.body.appendChild(a); a.click(); a.remove();
    $('save-done').textContent = 'De afbeelding staat in je map Downloads.'; $('save-done').hidden = false;
  }

  $('share').addEventListener('click', openShareBox);
  $('share-go').addEventListener('click', doShare);
  $('share-save').addEventListener('click', saveImage);
  $('share-close').addEventListener('click', closeShareBox);
  $('sharebox').addEventListener('click', function (e) { if (e.target === $('sharebox')) closeShareBox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sharebox').hidden) closeShareBox(); });

  $('again').addEventListener('click', newGame);
  $('edit').addEventListener('click', function () { show('setup'); renderSetup(); });

  renderSetup();
  show('setup');
})();
