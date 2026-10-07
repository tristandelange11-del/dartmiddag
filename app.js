/* Dartmaatje app. Eén telefoon: iedereen vult zijn naam in, kiest samen een snelheid en gooit één pijl. */
(function () {
  var MAX_PLAYERS = 15, MIN_PLAYERS = 2;
  var SPEEDS = [
    { id: 'rustig', n: 'Rustig', v: 0.7, d: 'Voor beginners' },
    { id: 'normaal', n: 'Normaal', v: 1.3, d: 'Lekker spannend' },
    { id: 'snel', n: 'Snel', v: 2.4, d: 'Alleen voor durvers' }
  ];
  var STORE = 'dartmaatje-app';

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var S = {
    names: [], speed: 'normaal',
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
  } catch (e) {}
  function persist() { try { localStorage.setItem(STORE, JSON.stringify({ names: S.names, speed: S.speed })); } catch (e) {} }

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
    ['setup', 'game', 'tie', 'result'].forEach(function (v) { $(v).hidden = v !== view; });
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

  $('start').addEventListener('click', function () { newGame(); });

  /* ---------- 2. gooien ---------- */
  function newGame() {
    S.queue = S.names.map(function (_, i) { return i; });
    S.round = 1; S.totals = {};
    startTurnRound();
  }
  function startTurnRound() {
    S.qi = 0; S.thrown = {}; S.darts = []; S.turnDone = false; S.lastHit = null;
    show('game');
    $('board').innerHTML = DM.boardSvg('Dartbord met het balletje en de pijlen van deze ronde');
    renderTurn();
  }
  function currentSvg() { return $('board').querySelector('svg'); }

  function renderTurn() {
    var pi = S.queue[S.qi];
    $('round-lbl').textContent = S.round === 1 ? 'Ronde' : 'Beslissingsworp ' + (S.round - 1);
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
      area.appendChild(el('p', 'note', 'Druk op Gooi als het balletje goed staat.'));
    } else {
      var h = S.lastHit;
      var card = el('div', 'last pop');
      var left = el('div'); left.appendChild(el('div', 'lbl', 'Jouw worp')); left.appendChild(el('div', 'what', h.label)); left.appendChild(el('div', 'note', h.calc));
      card.appendChild(left); card.appendChild(el('div', 'big', String(h.score)));
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
    var scores = S.queue.map(function (i) { return S.thrown[i].score; });
    var min = Math.min.apply(null, scores);
    var losers = S.queue.filter(function (i) { return S.thrown[i].score === min; });
    if (losers.length === 1) { showResult(losers[0]); return; }
    S.pendingTie = losers;
    $('tie-text').textContent = losers.map(function (i) { return S.names[i]; }).join(' en ') +
      ' gooiden allemaal ' + min + ' punten. Alleen jullie gooien opnieuw, de rest is veilig.';
    show('tie');
  }
  $('tie-go').addEventListener('click', function () {
    S.queue = S.pendingTie.slice(); S.round++;
    startTurnRound();
  });

  function showResult(loser) {
    var h = S.thrown[loser];
    $('loser').textContent = S.names[loser];
    $('loser-text').textContent = S.names[loser] + ' gooide ' + h.label + ' (' + h.score + ' punten) en trakteert.';
    var list = S.names.map(function (n, i) { return { i: i, n: n, w: S.totals[i] || [] }; })
      .sort(function (a, b) {
        var la = a.w.length ? a.w[0].score : 0, lb = b.w.length ? b.w[0].score : 0;
        return (a.i === loser ? -1 : 0) - (b.i === loser ? -1 : 0) || la - lb;
      });
    var ul = $('rank'); ul.textContent = '';
    list.forEach(function (p) {
      var first = p.w[0];
      var li = el('li'); if (p.i === loser) li.setAttribute('data-loser', '1');
      var d = el('span', 'dot', String(p.i + 1)); d.style.background = color(p.i); d.setAttribute('aria-hidden', 'true');
      var sc = el('span', 'sc', first ? String(first.score) : '–');
      if (first) sc.appendChild(el('small', '', first.label + (p.w.length > 1 ? ' · daarna ' + p.w.slice(1).map(function (w) { return w.score; }).join(', ') : '')));
      li.appendChild(d); li.appendChild(el('span', 'nm', p.n)); li.appendChild(sc);
      ul.appendChild(li);
    });
    show('result');
    buzz(60);
  }

  $('again').addEventListener('click', newGame);
  $('edit').addEventListener('click', function () { show('setup'); renderSetup(); });

  renderSetup();
  show('setup');
})();
