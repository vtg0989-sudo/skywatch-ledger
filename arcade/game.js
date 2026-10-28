// Skywatch Defense: a small Space Invaders-style game. Logical canvas 480x640, scaled to fit.
(function () {
  var W = 480, H = 640;
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var css = getComputedStyle(document.documentElement);
  var C = {
    bg: '#0a0d14', fg: '#e3e8f2', muted: '#8c97ad', accent: '#ffb547', signal: '#7fd3ff',
    red: '#ff6b6b', green: '#7dffb0', line: '#232c40'
  };
  var scoreEl = document.getElementById('score'), hiEl = document.getElementById('hi'),
      livesEl = document.getElementById('lives'), waveEl = document.getElementById('wave'),
      overlay = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title'),
      ovText = document.getElementById('ov-text'), ovBtn = document.getElementById('ov-btn'),
      shareEl = document.getElementById('share');

  function getHi() { try { return +localStorage.getItem('swd-hi') || 0; } catch (e) { return 0; } }
  function setHi(v) { try { localStorage.setItem('swd-hi', v); } catch (e) {} }

  // Enemy types: row 0 saucers (40), rows 1-2 triangles (30), rows 3-4 Tic Tacs (20), orbs (10) appear from wave 2 in row 5.
  var TYPES = {
    saucer: { pts: 40, color: C.accent },
    triangle: { pts: 30, color: C.signal },
    tictac: { pts: 20, color: C.fg },
    orb: { pts: 10, color: C.green }
  };

  var state, keys = {}, stars = [];
  for (var i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + .3, t: Math.random() * 6 });

  function newGame() {
    state = { score: 0, lives: 3, wave: 0, running: false, over: false, hi: getHi(), t: 0 };
    nextWave();
    hud();
  }

  function nextWave() {
    state.wave++;
    var rows = ['saucer', 'triangle', 'triangle', 'tictac', 'tictac'];
    if (state.wave >= 2) rows.push('orb');
    var cols = 8, gx = 46, gy = 38;
    state.enemies = [];
    var top = 80 + Math.min(state.wave - 1, 5) * 12;
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < cols; c++) {
      state.enemies.push({ x: 60 + c * gx, y: top + r * gy, type: rows[r], alive: true, w: 30, h: 20 });
    }
    state.dir = 1;
    state.stepTimer = 0;
    state.frame = 0;
    state.player = { x: W / 2, y: H - 50, w: 36, h: 18, cool: 0, hitT: 0 };
    state.shots = [];
    state.bombs = [];
    state.parts = [];
    state.mother = null;
    state.motherTimer = 600 + Math.random() * 600;
    state.shields = makeShields();
    state.banner = 90;
    hud();
  }

  function makeShields() {
    var out = [], n = 4, bw = 48, bh = 30, cell = 6;
    for (var s = 0; s < n; s++) {
      var x0 = 50 + s * ((W - 100 - bw) / (n - 1)), y0 = H - 130;
      for (var y = 0; y < bh; y += cell) for (var x = 0; x < bw; x += cell) {
        // notch the bottom middle like a bunker
        if (y >= bh - 12 && x >= 12 && x < bw - 12) continue;
        if (y < 6 && (x < 6 || x >= bw - 6)) continue;
        out.push({ x: x0 + x, y: y0 + y, s: cell, hp: 3 });
      }
    }
    return out;
  }

  function hud() {
    scoreEl.textContent = state.score;
    hiEl.textContent = Math.max(state.hi, state.score);
    livesEl.textContent = state.lives;
    waveEl.textContent = state.wave;
  }

  // Drawing helpers
  function drawEnemy(e, flap) {
    var c = TYPES[e.type].color, x = e.x, y = e.y;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2;
    if (e.type === 'saucer') {
      ctx.beginPath(); ctx.ellipse(0, 3, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -1, 7, 6, 0, Math.PI, 0); ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = C.bg;
      for (var k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(k * 5, 3, 1.4, 0, 7); ctx.fill(); }
      ctx.fillStyle = c; ctx.fillRect(-9 + (flap ? 2 : 0), 8, 2, 3); ctx.fillRect(7 - (flap ? 2 : 0), 8, 2, 3);
    } else if (e.type === 'triangle') {
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(14, 9); ctx.lineTo(-14, 9); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = flap ? C.red : C.signal;
      [[0, -5], [9, 6], [-9, 6]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, 7); ctx.fill(); });
    } else if (e.type === 'tictac') {
      ctx.beginPath();
      ctx.moveTo(-8, -5); ctx.lineTo(8, -5); ctx.arc(8, 0, 5, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-8, 5); ctx.arc(-8, 0, 5, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .35; ctx.fillRect(flap ? -14 : -17, -1, 4, 2); ctx.fillRect(flap ? 10 : 13, -1, 4, 2); ctx.globalAlpha = 1;
    } else {
      var g = ctx.createRadialGradient(0, 0, 1, 0, 0, 10);
      g.addColorStop(0, '#fff'); g.addColorStop(.4, c); g.addColorStop(1, 'rgba(125,255,176,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, flap ? 10 : 8.5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(p) {
    if (p.hitT > 0 && Math.floor(p.hitT / 5) % 2) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.moveTo(-18, 9); ctx.lineTo(18, 9); ctx.lineTo(14, 1); ctx.lineTo(-14, 1); ctx.closePath(); ctx.fill();
    ctx.fillRect(-7, -5, 14, 7);
    ctx.fillRect(-2, -13, 4, 9);
    ctx.strokeStyle = C.signal; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -5, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.restore();
  }

  function drawMother(m) {
    ctx.save(); ctx.translate(m.x, m.y); ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.moveTo(-24, -5); ctx.lineTo(24, -5); ctx.arc(24, 0, 5, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-24, 5); ctx.arc(-24, 0, 5, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    for (var k = -3; k <= 3; k++) if ((k + (state.frame >> 3)) % 2 === 0) { ctx.beginPath(); ctx.arc(k * 7, 0, 1.6, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function boom(x, y, color, n) {
    for (var i = 0; i < (n || 14); i++) {
      var a = Math.random() * Math.PI * 2, s = Math.random() * 3 + .5;
      state.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20, c: color });
    }
  }

  function hitShield(b) {
    for (var i = 0; i < state.shields.length; i++) {
      var s = state.shields[i];
      if (b.x > s.x && b.x < s.x + s.s && b.y > s.y - 4 && b.y < s.y + s.s + 4) {
        s.hp--; if (s.hp <= 0) state.shields.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function update() {
    var p = state.player, alive = state.enemies.filter(function (e) { return e.alive; });
    state.frame++;
    if (state.banner > 0) state.banner--;

    // Player
    var sp = 4.2;
    if (keys.left) p.x -= sp;
    if (keys.right) p.x += sp;
    p.x = Math.max(22, Math.min(W - 22, p.x));
    if (p.cool > 0) p.cool--;
    if (p.hitT > 0) p.hitT--;
    if (keys.fire && p.cool === 0 && state.shots.length < 2 && state.banner < 40) {
      state.shots.push({ x: p.x, y: p.y - 14 }); p.cool = 16;
    }

    // Formation movement: faster as enemies thin out and waves climb
    var interval = Math.max(3, Math.floor(alive.length * 0.75) - state.wave * 2 + 6);
    state.stepTimer++;
    if (state.stepTimer >= interval) {
      state.stepTimer = 0; state.flap = !state.flap;
      var edge = false, dx = 8 * state.dir;
      alive.forEach(function (e) { if (e.x + dx > W - 20 || e.x + dx < 20) edge = true; });
      if (edge) { state.dir *= -1; alive.forEach(function (e) { e.y += 16; }); }
      else alive.forEach(function (e) { e.x += dx; });
    }

    // Enemy fire: only from the lowest enemy in a column
    var fireChance = 0.007 + state.wave * 0.003;
    if (Math.random() < fireChance * Math.min(alive.length, 12) / 6 && state.banner === 0) {
      var cols = {};
      alive.forEach(function (e) { var k = Math.round(e.x); if (!cols[k] || cols[k].y < e.y) cols[k] = e; });
      var shooters = Object.keys(cols).map(function (k) { return cols[k]; });
      var s = shooters[Math.floor(Math.random() * shooters.length)];
      if (s && state.bombs.length < 3 + state.wave) state.bombs.push({ x: s.x, y: s.y + 10, v: 2.6 + state.wave * 0.25, c: TYPES[s.type].color });
    }

    // Mothership (red cigar) crosses the top now and then
    if (!state.mother) {
      if (--state.motherTimer <= 0) {
        var fromLeft = Math.random() < .5;
        state.mother = { x: fromLeft ? -30 : W + 30, y: 48, v: fromLeft ? 1.8 : -1.8 };
      }
    } else {
      state.mother.x += state.mother.v;
      if (state.mother.x < -40 || state.mother.x > W + 40) { state.mother = null; state.motherTimer = 700 + Math.random() * 700; }
    }

    // Player shots
    for (var i = state.shots.length - 1; i >= 0; i--) {
      var sh = state.shots[i]; sh.y -= 8; var gone = sh.y < 30;
      if (!gone && hitShield(sh)) gone = true;
      if (!gone) for (var j = 0; j < alive.length; j++) {
        var e = alive[j];
        if (Math.abs(sh.x - e.x) < e.w / 2 && Math.abs(sh.y - e.y) < e.h / 2 + 2) {
          e.alive = false; gone = true; state.score += TYPES[e.type].pts;
          boom(e.x, e.y, TYPES[e.type].color); break;
        }
      }
      if (!gone && state.mother && Math.abs(sh.x - state.mother.x) < 28 && Math.abs(sh.y - state.mother.y) < 8) {
        var bonus = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
        state.score += bonus; boom(state.mother.x, state.mother.y, C.red, 24);
        state.parts.push({ x: state.mother.x, y: state.mother.y, vx: 0, vy: -.4, life: 60, txt: '+' + bonus, c: C.red });
        state.mother = null; state.motherTimer = 800 + Math.random() * 700; gone = true;
      }
      if (gone) state.shots.splice(i, 1);
    }

    // Bombs
    for (i = state.bombs.length - 1; i >= 0; i--) {
      var b = state.bombs[i]; b.y += b.v; gone = b.y > H - 20;
      if (!gone && hitShield(b)) gone = true;
      if (!gone && p.hitT === 0 && Math.abs(b.x - p.x) < 17 && Math.abs(b.y - p.y) < 10) {
        gone = true; loseLife();
      }
      if (gone) state.bombs.splice(i, 1);
    }

    // Enemies crushing shields / reaching the ground
    alive.forEach(function (e) {
      state.shields = state.shields.filter(function (s) { return !(Math.abs(s.x - e.x) < 18 && Math.abs(s.y - e.y) < 14); });
      if (e.y > p.y - 20) { state.lives = 0; endGame(); }
    });

    // Particles
    for (i = state.parts.length - 1; i >= 0; i--) {
      var q = state.parts[i]; q.x += q.vx; q.y += q.vy; q.vx *= .96; q.vy *= .96;
      if (--q.life <= 0) state.parts.splice(i, 1);
    }

    if (!state.enemies.some(function (e) { return e.alive; }) && !state.over) {
      state.score += 100 * state.wave; nextWave();
    }
    hud();
  }

  function loseLife() {
    boom(state.player.x, state.player.y, C.accent, 22);
    state.lives--; state.player.hitT = 90; state.bombs = [];
    if (state.lives <= 0) endGame();
  }

  function endGame() {
    if (state.over) return;
    state.over = true; state.running = false;
    var best = state.score > state.hi;
    if (best) { state.hi = state.score; setHi(state.score); }
    hud();
    ovTitle.textContent = 'Sky lost';
    ovText.textContent = (best ? 'New high score! ' : '') + 'You scored ' + state.score + ' and reached wave ' + state.wave + '.';
    ovBtn.textContent = 'Play again';
    var txt = 'I held the sky for ' + state.wave + ' wave' + (state.wave > 1 ? 's' : '') + ' and scored ' + state.score + ' in Skywatch Defense. Think you can beat it? \u{1F6F8}';
    shareEl.href = 'https://x.com/intent/post?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent('https://skywatchledger.com/arcade/');
    shareEl.hidden = false;
    overlay.hidden = false;
  }

  function draw() {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    stars.forEach(function (s) {
      s.t += .03; ctx.globalAlpha = .35 + Math.sin(s.t) * .25; ctx.fillStyle = C.fg;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // ground
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H - 24); ctx.lineTo(W, H - 24); ctx.stroke();

    ctx.fillStyle = C.signal; ctx.globalAlpha = .75;
    state.shields.forEach(function (s) { ctx.globalAlpha = .25 + s.hp * .2; ctx.fillRect(s.x, s.y, s.s - 1, s.s - 1); });
    ctx.globalAlpha = 1;

    state.enemies.forEach(function (e) { if (e.alive) drawEnemy(e, state.flap); });
    if (state.mother) drawMother(state.mother);
    if (!state.over) drawPlayer(state.player);

    ctx.fillStyle = C.accent; state.shots.forEach(function (s) { ctx.fillRect(s.x - 1.5, s.y - 7, 3, 10); });
    state.bombs.forEach(function (b) {
      ctx.strokeStyle = b.c; ctx.lineWidth = 2; ctx.beginPath();
      var z = (state.frame >> 2) % 2 ? 3 : -3;
      ctx.moveTo(b.x, b.y - 8); ctx.lineTo(b.x + z, b.y - 4); ctx.lineTo(b.x - z, b.y); ctx.lineTo(b.x, b.y + 4); ctx.stroke();
    });
    state.parts.forEach(function (q) {
      ctx.globalAlpha = Math.min(1, q.life / 30); ctx.fillStyle = q.c;
      if (q.txt) { ctx.font = '700 16px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(q.txt, q.x, q.y); }
      else ctx.fillRect(q.x, q.y, 2.5, 2.5);
    });
    ctx.globalAlpha = 1;

    if (state.banner > 0 && state.running) {
      ctx.globalAlpha = Math.min(1, state.banner / 30);
      ctx.fillStyle = C.accent; ctx.textAlign = 'center';
      ctx.font = '700 34px "Chakra Petch", sans-serif'; ctx.fillText('WAVE ' + state.wave, W / 2, H / 2);
      ctx.globalAlpha = 1;
    }
  }

  var last = 0, acc = 0, STEP = 1000 / 60;
  function loop(ts) {
    if (!last) last = ts;
    acc += Math.min(100, ts - last); last = ts;
    while (acc >= STEP) { if (state.running) update(); acc -= STEP; }
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    if (state.over) newGame();
    overlay.hidden = true; shareEl.hidden = true;
    state.running = true;
    cv.focus({ preventScroll: true });
  }
  function pause() {
    if (!state.running || state.over) return;
    state.running = false;
    ovTitle.textContent = 'Paused'; ovText.textContent = 'Take a breath. The sky can wait.'; ovBtn.textContent = 'Resume';
    overlay.hidden = false;
  }

  // Keyboard
  var map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'fire', ArrowUp: 'fire', w: 'fire', W: 'fire' };
  addEventListener('keydown', function (e) {
    if (map[e.key]) {
      // Only hijack keys when the game area is in play, so the page still scrolls otherwise.
      if (state.running || document.activeElement === cv) e.preventDefault();
      keys[map[e.key]] = true;
    }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && state.running) pause();
    else if ((e.key === 'Enter' || ((e.key === 'p' || e.key === 'P') && !state.running)) && !overlay.hidden) start();
  });
  addEventListener('keyup', function (e) { if (map[e.key]) keys[map[e.key]] = false; });
  addEventListener('blur', function () { keys = {}; pause(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  // Touch buttons (press-and-hold)
  document.querySelectorAll('[data-k]').forEach(function (b) {
    var k = b.getAttribute('data-k');
    function on(e) { e.preventDefault(); keys[k] = true; b.classList.add('on'); if (!state.running && !state.over && !overlay.hidden) start(); }
    function off(e) { e.preventDefault(); keys[k] = false; b.classList.remove('on'); }
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  ovBtn.addEventListener('click', start);

  newGame();
  requestAnimationFrame(loop);
})();
