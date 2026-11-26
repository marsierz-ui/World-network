// xTrails Liquid Glass helper (pairs with liquid-glass.css).
//  - Chromium only: gives each .lg element an SVG refraction filter sized to it and sets
//    html.lg-refract, so the rim bends what is behind it like the edge of a lens. Other
//    browsers keep the blur-only material.
//  - Moves the sheen of any .lg element towards the pointer (skipped with reduced motion).
// Use as <script src="liquid-glass.js"></script> or import './liquid-glass.js'. Safe to load twice.
// Opt an element out of refraction with .lg-flat, or the whole page with html.lg-no-refract.
(function () {
  if (window.xtGlass) return;
  var doc = document, html = doc.documentElement, NS = 'http://www.w3.org/2000/svg';
  var STRENGTH = 22; // displacement in px at the very rim

  function chromium() {
    var b = navigator.userAgentData && navigator.userAgentData.brands;
    if (b) return b.some(function (x) { return /Chromium|Google Chrome|Microsoft Edge/.test(x.brand); });
    return /Chrome\//.test(navigator.userAgent) && !/OPR\//.test(navigator.userAgent);
  }
  function quiet() {
    var m = window.matchMedia;
    return !m || m('(prefers-reduced-transparency: reduce)').matches || m('(prefers-contrast: more)').matches;
  }

  // Displacement map for a w x h box: red ramps left->right, green top->bottom, and a neutral
  // (128,128) rounded centre, so only a band along the rim is pulled inwards.
  function mapSvg(w, h, r) {
    var band = Math.max(6, Math.min(18, Math.min(w, h) * 0.28));
    var rr = Math.max(0, Math.min(r, Math.min(w, h) / 2) - band / 2);
    return "<svg xmlns='" + NS + "' width='" + w + "' height='" + h + "' viewBox='0 0 " + w + ' ' + h + "'>" +
      "<defs><linearGradient id='r' x1='0' x2='1'><stop offset='0' stop-color='#f00'/><stop offset='1' stop-color='#000'/></linearGradient>" +
      "<linearGradient id='g' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#0f0'/><stop offset='1' stop-color='#000'/></linearGradient>" +
      "<filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='" + (band / 2.5).toFixed(1) + "'/></filter></defs>" +
      "<rect width='" + w + "' height='" + h + "' fill='url(#r)'/>" +
      "<rect width='" + w + "' height='" + h + "' fill='url(#g)' style='mix-blend-mode:screen'/>" +
      "<rect x='" + band + "' y='" + band + "' width='" + Math.max(1, w - band * 2) + "' height='" + Math.max(1, h - band * 2) +
      "' rx='" + rr + "' fill='#808000' filter='url(#b)'/></svg>";
  }

  var defs = null, made = {};
  function filterFor(w, h, r) {
    w = Math.max(8, Math.round(w / 4) * 4); h = Math.max(8, Math.round(h / 4) * 4); r = Math.round(r);
    var id = 'lg-r-' + w + '-' + h + '-' + r;
    if (made[id]) return id;
    if (!defs) {
      var svg = doc.createElementNS(NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      defs = doc.createElementNS(NS, 'defs');
      svg.appendChild(defs);
      (doc.body || html).appendChild(svg);
    }
    var f = doc.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '0'); f.setAttribute('y', '0');
    f.setAttribute('width', w); f.setAttribute('height', h);
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML =
      "<feImage href=\"data:image/svg+xml;utf8," + encodeURIComponent(mapSvg(w, h, r)) + "\" x='0' y='0' width='" + w + "' height='" + h + "' result='map'/>" +
      "<feDisplacementMap in='SourceGraphic' in2='map' scale='" + STRENGTH + "' xChannelSelector='R' yChannelSelector='G'/>";
    defs.appendChild(f);
    made[id] = true;
    return id;
  }

  function fit(el) {
    if (el.classList.contains('lg-flat')) return;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    var r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    el.style.setProperty('--lg-filter', 'url(#' + filterFor(w, h, Math.min(r, h / 2)) + ')');
  }

  function refraction() {
    html.classList.add('lg-refract');
    var ro = new ResizeObserver(function (es) { es.forEach(function (e) { fit(e.target); }); });
    var seen = new WeakSet();
    function scan(root) {
      var list = root.querySelectorAll ? root.querySelectorAll('.lg') : [];
      if (root.classList && root.classList.contains('lg')) list = [root].concat([].slice.call(list));
      for (var i = 0; i < list.length; i++) if (!seen.has(list[i])) { seen.add(list[i]); ro.observe(list[i]); }
    }
    scan(doc);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        if (ms[i].type === 'attributes') { scan(ms[i].target); continue; }
        for (var j = 0; j < ms[i].addedNodes.length; j++) if (ms[i].addedNodes[j].nodeType === 1) scan(ms[i].addedNodes[j]);
      }
    }).observe(doc.body || html, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function sheen() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var raf = 0, target = null, px = 0, py = 0;
    doc.addEventListener('pointermove', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('.lg') : null;
      if (!el) return;
      target = el; px = e.clientX; py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = target.getBoundingClientRect();
        if (!r.width || !r.height) return;
        target.style.setProperty('--lg-x', ((px - r.left) / r.width * 100).toFixed(1) + '%');
        target.style.setProperty('--lg-y', ((py - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }

  function boot() {
    if (chromium() && !quiet() && !html.classList.contains('lg-no-refract') && window.ResizeObserver) refraction();
    sheen();
  }

  window.xtGlass = { refracts: function () { return html.classList.contains('lg-refract'); } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
