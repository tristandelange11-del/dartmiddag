/* Gedeeld dartbord: score berekenen, vizier laten bewegen en het bord tekenen. */
(function () {
  var ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

  function P(r, a) {
    var rad = a * Math.PI / 180;
    return (220 + r * Math.sin(rad)).toFixed(2) + ' ' + (220 - r * Math.cos(rad)).toFixed(2);
  }
  function ring(r1, r2, a1, a2) {
    return 'M ' + P(r2, a1) + ' A ' + r2 + ' ' + r2 + ' 0 0 1 ' + P(r2, a2) +
      ' L ' + P(r1, a2) + ' A ' + r1 + ' ' + r1 + ' 0 0 0 ' + P(r1, a1) + ' Z';
  }

  /* Score volgens de echte dartregels. Bord: viewBox 440, middelpunt 220,220. */
  function hit(x, y) {
    var dx = x - 220, dy = y - 220, r = Math.hypot(dx, dy);
    if (r > 180) return { score: 0, label: 'Mis', calc: 'Naast het bord = 0', miss: true };
    if (r <= 6.7) return { score: 50, label: 'Bullseye', calc: 'Roos = 50' };
    if (r <= 16.8) return { score: 25, label: 'Bull', calc: 'Buitenste roos = 25' };
    var ang = Math.atan2(dx, -dy) * 180 / Math.PI;
    ang = ((ang % 360) + 360) % 360;
    var num = ORDER[Math.floor(((ang + 9) % 360) / 18)];
    if (r >= 171.5) return { score: num * 2, label: 'Dubbel ' + num, calc: '2 × ' + num + ' = ' + (num * 2) };
    if (r >= 104.8 && r <= 113.3) return { score: num * 3, label: 'Triple ' + num, calc: '3 × ' + num + ' = ' + (num * 3) };
    return { score: num, label: 'Enkel ' + num, calc: 'Enkel ' + num + ' = ' + num };
  }

  function aimAt(t) {
    return {
      x: 220 + 138 * Math.sin(t * 1.21) + 42 * Math.sin(t * 2.93 + 0.7),
      y: 220 + 138 * Math.sin(t * 1.57 + 1.1) + 42 * Math.cos(t * 2.31)
    };
  }

  function boardSvg(label) {
    var s = '<svg class="board" viewBox="0 0 440 440" role="img" aria-label="' + (label || 'Dartbord') + '">' +
      '<circle cx="220" cy="220" r="214" fill="#14110F" stroke="#F5B02E" stroke-width="4"/>' +
      '<circle cx="220" cy="220" r="181" fill="#0A0A0A"/>';
    for (var i = 0; i < 20; i++) {
      var a1 = i * 18 - 9, a2 = i * 18 + 9, even = i % 2 === 0;
      var single = even ? '#17140F' : '#EFE3C2', bright = even ? '#C8233B' : '#1F8A5B';
      [[16.8, 104.8, single], [104.8, 113.3, bright], [113.3, 171.5, single], [171.5, 180, bright]].forEach(function (q) {
        s += '<path d="' + ring(q[0], q[1], a1, a2) + '" fill="' + q[2] + '" stroke="#0A0A0A" stroke-width="0.8"/>';
      });
      var rad = i * 18 * Math.PI / 180;
      s += '<text x="' + (220 + 197 * Math.sin(rad)).toFixed(1) + '" y="' + (220 - 197 * Math.cos(rad)).toFixed(1) +
        '" text-anchor="middle" dominant-baseline="central" style="font:800 16px Figtree,sans-serif;fill:#F4EAD0">' + ORDER[i] + '</text>';
    }
    s += '<circle cx="220" cy="220" r="16.8" fill="#1F8A5B" stroke="#0A0A0A" stroke-width="0.8"/>' +
      '<circle cx="220" cy="220" r="6.7" fill="#C8233B" stroke="#0A0A0A" stroke-width="0.8"/>' +
      '<g class="darts"></g>' +
      '<g class="cross" style="pointer-events:none" visibility="hidden">' +
      '<circle r="15" fill="none" stroke="#14110F" stroke-width="7"/><line x1="-26" y1="0" x2="26" y2="0" stroke="#14110F" stroke-width="7"/><line x1="0" y1="-26" x2="0" y2="26" stroke="#14110F" stroke-width="7"/>' +
      '<circle r="15" fill="none" stroke="#F5B02E" stroke-width="3"/><line x1="-26" y1="0" x2="26" y2="0" stroke="#F5B02E" stroke-width="3"/><line x1="0" y1="-26" x2="0" y2="26" stroke="#F5B02E" stroke-width="3"/>' +
      '</g></svg>';
    return s;
  }

  /* Pijlen tekenen. items: [{x, y, color, text, fresh}] */
  function drawDarts(svg, items) {
    var g = svg.querySelector('.darts');
    var s = '';
    items.forEach(function (d) {
      s += '<g transform="translate(' + d.x + ' ' + d.y + ')"><g' + (d.fresh ? ' class="dart-in"' : '') + '>' +
        '<circle r="10" fill="' + d.color + '" stroke="#14110F" stroke-width="2.5"/>' +
        '<text y="0.5" text-anchor="middle" dominant-baseline="central" style="font:800 11px Figtree,sans-serif;fill:#14110F">' + d.text + '</text></g></g>';
    });
    g.innerHTML = s;
  }

  /* Het vizier laten zweven. Geeft een functie terug met de huidige positie. */
  function startAim(svg, getSpeed) {
    var cross = svg.querySelector('.cross');
    var t = 0, last = null, pos = { x: 220, y: 220 }, raf = 0;
    function loop(ts) {
      raf = requestAnimationFrame(loop);
      if (!document.body.contains(svg)) { cancelAnimationFrame(raf); return; }
      /* De tijd loopt mee met de gekozen snelheid, zodat het vizier niet springt als je de snelheid wisselt. */
      var dt = last === null ? 0 : Math.min((ts - last) / 1000, 0.1);
      last = ts;
      t += dt * (getSpeed ? getSpeed() : 1);
      pos = aimAt(t);
      cross.setAttribute('transform', 'translate(' + pos.x.toFixed(1) + ' ' + pos.y.toFixed(1) + ')');
    }
    cross.setAttribute('visibility', 'visible');
    raf = requestAnimationFrame(loop);
    return function () { return pos; };
  }

  function roastFor(r) {
    var s = r.score;
    function pick(l) { return l[Math.floor(Math.random() * l.length)]; }
    if (r.miss) return pick(['Naast het bord. De muur heeft er een nieuwe vriend bij.', 'Die pijl is op eigen houtje de kroeg in gelopen.', 'Gemist. Het bord was nochtans groot.']);
    if (s === 50) return 'BULLSEYE! Dit gaat de familiekroniek in.';
    if (s >= 40) return pick(['Dat is bijna verdacht goed. Heb je geoefend?', 'Wie had dat gedacht. Zeker de pijl niet.']);
    if (s >= 20) return pick(['Dik in orde. Je mag nog even blijven.', 'Prima worp. Niemand heeft iets gezien, maar prima.']);
    if (s >= 6) return pick(['Een eerlijke poging. Eerlijk is niet hetzelfde als goed.', 'Het bord voelde je aanwezigheid nauwelijks.']);
    return pick(['Dat is geen gooien, dat is laten vallen met intentie.', 'De pijl zei: "ik wilde eigenlijk naar huis".']);
  }

  window.DM = { ORDER: ORDER, hit: hit, aimAt: aimAt, boardSvg: boardSvg, drawDarts: drawDarts, startAim: startAim, roastFor: roastFor };
})();
