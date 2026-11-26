// xTrails footstep trail: prints that walk along the mouse track and fade out behind it.
// Shared by every xTrails app. Colour comes from the page's --accent (mud stays brown).
//
// Most walks use plain shoe prints. Now and then (about 1 walk in 6) a walk uses a rare
// variant instead: bare feet, sneaker tread, high heels, muddy boots, cat paws, bird tracks
// or hooves. A "walk" starts when the pointer moves again after resting, so people who play
// with it keep finding new ones.
//
// Use as a classic script:  <script src="footsteps.js"></script>
//   data-scope="#landing"   draw inside that element and only while it is shown
//   data-special="hoof"     an app's own variant, picked more often than the others
// Or from code (React):      const stop = window.xtFootsteps.start(canvas, { special: 'hoof' })
(function () {
  if (window.xtFootsteps) return;

  var SCALE = 0.55, LIFE = 1600, MAX = 18, IDLE = 1500, RARE = 0.17;
  var VARIANTS = {
    shoe:    { stride: 22, spread: 4, draw: shoe },
    bare:    { size: 1.15, stride: 20, spread: 4, draw: bare },
    sneaker: { size: 1.1, stride: 24, spread: 4.5, draw: sneaker },
    heel:    { size: 1.1, stride: 18, spread: 2, draw: heel },
    mud:     { size: 1.15, stride: 24, spread: 4.5, draw: mud, color: '#7a5230' },
    paw:     { size: 1.25, stride: 14, spread: 3, draw: paw },
    bird:    { size: 1.25, stride: 12, spread: 2.5, draw: bird },
    hoof:    { size: 1.2, stride: 20, spread: 4, draw: hoof },
  };
  var RARE_NAMES = ['bare', 'sneaker', 'heel', 'mud', 'paw', 'bird', 'hoof'];

  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); ctx.fill(); }
  function shoe(ctx) { ell(ctx, 0, -4, 4.4, 7.2); ell(ctx, 0, 8.5, 3.4, 4); }
  function bare(ctx, p) {
    ell(ctx, 0, 1, 3.8, 7.8); ell(ctx, 0, 9, 3.2, 3.4);
    var s = p.left ? -1 : 1, toes = [[-3.4, -9, 1.7], [-1, -10.4, 1.4], [1.1, -10.2, 1.2], [2.9, -9.2, 1.05], [4.2, -7.6, 0.9]];
    for (var i = 0; i < toes.length; i++) ell(ctx, toes[i][0] * s, toes[i][1], toes[i][2], toes[i][2] * 1.15);
  }
  function sneaker(ctx) {
    shoe(ctx);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 1.1; ctx.strokeStyle = '#000';
    for (var y = -9; y <= 2; y += 2.6) { ctx.beginPath(); ctx.moveTo(-4, y); ctx.lineTo(4, y + 1.2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-2.6, 8); ctx.lineTo(2.6, 9); ctx.stroke();
    ctx.restore();
  }
  function heel(ctx) { ell(ctx, 0, -5, 3.6, 5.8); ell(ctx, 0, 11, 1.5, 1.5); }
  function mud(ctx, p) {
    shoe(ctx);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 1.4; ctx.strokeStyle = '#000';
    for (var y = -9; y <= 0; y += 3) { ctx.beginPath(); ctx.moveTo(-4.4, y); ctx.lineTo(4.4, y); ctx.stroke(); }
    ctx.restore();
    var r = p.seed;
    for (var i = 0; i < 5; i++) { r = (r * 9301 + 49297) % 233280; var a = r / 233280 * 6.28; r = (r * 9301 + 49297) % 233280; var d = 7 + r / 233280 * 6; ell(ctx, Math.cos(a) * d, Math.sin(a) * d * 1.4, 0.8 + (i % 3) * 0.5, 0.8 + (i % 2) * 0.5); }
  }
  function paw(ctx) {
    ell(ctx, 0, 3, 3.6, 3.1);
    ell(ctx, -3.8, -2.6, 1.35, 1.7, -0.35); ell(ctx, -1.3, -4.6, 1.35, 1.75); ell(ctx, 1.3, -4.6, 1.35, 1.75); ell(ctx, 3.8, -2.6, 1.35, 1.7, 0.35);
  }
  function bird(ctx) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -6); ctx.moveTo(0, 3); ctx.lineTo(-4.5, -4); ctx.moveTo(0, 3); ctx.lineTo(4.5, -4); ctx.moveTo(0, 3); ctx.lineTo(0, 7.5); ctx.stroke();
    ctx.restore();
  }
  function hoof(ctx) {
    ctx.beginPath(); ctx.ellipse(-2, 0, 2.2, 6, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2, 0, 2.2, 6, 0.12, 0, Math.PI * 2); ctx.fill();
  }

  function start(canvas, opts) {
    opts = opts || {};
    if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
    var ctx = canvas.getContext('2d');
    var prints = [], last = null, travelled = 0, left = false, raf = 0, color = '';
    var lastMove = -Infinity, walkLen = 0, variant = 'shoe', lastRare = '';
    var special = opts.special && VARIANTS[opts.special] ? opts.special : '';
    var active = opts.active || function () { return true; };

    function pick() {
      if (opts.variant) return opts.variant; // forced, for demos and tests
      if (Math.random() >= RARE) return 'shoe';
      if (special && special !== lastRare && Math.random() < 0.4) return (lastRare = special);
      var pool = RARE_NAMES.filter(function (n) { return n !== lastRare; });
      return (lastRare = pool[Math.floor(Math.random() * pool.length)]);
    }
    function resize() {
      var dpr = window.devicePixelRatio || 1;
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      while (prints.length && now - prints[0].t > LIFE) prints.shift();
      for (var i = 0; i < prints.length; i++) {
        var p = prints[i], v = VARIANTS[p.v];
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.a + Math.PI / 2); ctx.scale(SCALE * (v.size || 1), SCALE * (v.size || 1));
        ctx.globalAlpha = 0.55 * (1 - (now - p.t) / LIFE);
        ctx.fillStyle = v.color || color;
        v.draw(ctx, p);
        ctx.restore();
      }
      raf = prints.length ? requestAnimationFrame(frame) : 0;
    }
    function move(e) {
      if (e.pointerType !== 'mouse') return;
      var x = e.clientX, y = e.clientY, now = performance.now();
      if (now - lastMove > IDLE || walkLen > 80) { variant = pick(); walkLen = 0; }
      lastMove = now;
      if (!last) { last = { x: x, y: y }; return; }
      var dx = x - last.x, dy = y - last.y, d = Math.hypot(dx, dy);
      if (d > 200) { last = { x: x, y: y }; travelled = 0; return; } // jumped, do not draw a stride across
      travelled += d;
      var v = VARIANTS[variant];
      if (travelled >= v.stride && d > 0) {
        travelled = 0;
        if (active()) {
          var a = Math.atan2(dy, dx), side = left ? -v.spread : v.spread;
          prints.push({ x: x - Math.sin(a) * side, y: y + Math.cos(a) * side, a: a, t: now, v: variant, left: left, seed: (Math.random() * 233280) | 0 });
          left = !left; walkLen++;
          if (prints.length > MAX) prints.shift();
          if (!raf) {
            color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#888';
            raf = requestAnimationFrame(frame);
          }
        }
      }
      last = { x: x, y: y };
    }
    function leave() { last = null; }
    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return function stop() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
    };
  }

  window.xtFootsteps = { start: start, variants: Object.keys(VARIANTS) };

  // Auto-start only when loaded with a <script> tag (not when imported as a module).
  var me = document.currentScript;
  if (!me || me.hasAttribute('data-manual')) return;
  var scope = me.getAttribute('data-scope'), special = me.getAttribute('data-special') || '';
  function boot() {
    var canvas = document.createElement('canvas');
    canvas.className = 'footsteps';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
    var host = (scope && document.querySelector(scope)) || document.body;
    if (host !== document.body && getComputedStyle(host).isolation !== 'isolate') host.style.isolation = 'isolate';
    host.prepend(canvas);
    start(canvas, {
      special: special,
      active: function () {
        if (!scope) return true;
        var el = document.querySelector(scope);
        return !!(el && !el.hidden && el.getClientRects().length);
      },
    });
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
