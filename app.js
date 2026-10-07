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
    prepareShare(loser, list);
  }

  /* ---------- de uitslag delen ---------- */
  var shareFile = null, shareText = '', shareToken = 0;

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
      var W = 1080, top = 548, rowH = 62, H = Math.max(1350, top + list.length * rowH + 210);
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
      g.fillText('gooide ' + h.label + ' (' + h.score + ' punten) en trakteert', 100, 398);

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
        g.fillText(first ? String(first.score) : '–', 990, y + 2);
        if (first) { g.fillStyle = '#B7C9BE'; g.font = '500 24px ' + BODY; g.fillText(first.label, 890, y + 3); }
      });

      // voet
      g.textAlign = 'center';
      g.fillStyle = '#B7C9BE'; g.font = '500 32px ' + BODY; g.fillText('Eén pijl per speler. De laagste score betaalt.', W / 2, H - 120);
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
    drawCard(loser, list).then(function (f) { if (token === shareToken) shareFile = f; }).catch(function () {});
  }

  function say(text) {
    var m = $('share-msg'); m.textContent = text;
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
  $('share').addEventListener('click', doShare);

  $('again').addEventListener('click', newGame);
  $('edit').addEventListener('click', function () { show('setup'); renderSetup(); });

  renderSetup();
  show('setup');
})();
