// JavaScript that runs inside the WebView. Kept as a string because Hermes does
// not preserve function source. Do NOT use backticks or "${" inside.
export const WEB_APP_JS = String.raw`
(function () {
  'use strict';
  var RN = window.ReactNativeWebView;
  function post(m) { if (RN) RN.postMessage(JSON.stringify(m)); }
  var pdfjs = null;
  var MODE = window.__MODE || 'viewer';

  /* ------------------------------------------------------------------ */
  /* Shared                                                              */
  /* ------------------------------------------------------------------ */
  function b64ToBytes(b64) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function openPdf(b64) {
    return pdfjs.getDocument({ data: b64ToBytes(b64), isEvalSupported: false, disableFontFace: false }).promise;
  }
  async function boot() {
    try {
      var lib = URL.createObjectURL(new Blob([window.__LIB], { type: 'text/javascript' }));
      pdfjs = await import(lib);
      pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([window.__WORKER], { type: 'text/javascript' }));
      window.__LIB = null; window.__WORKER = null;
      post({ type: 'ready' });
    } catch (e) {
      post({ type: 'error', message: 'Failed to start PDF engine: ' + (e && e.message) });
    }
  }
  function onMessage(ev) {
    var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (MODE === 'engine') handleEngine(m); else handleViewer(m);
  }
  document.addEventListener('message', onMessage);
  window.addEventListener('message', onMessage);

  /* ------------------------------------------------------------------ */
  /* Engine (hidden): page count, thumbnails, page images, text          */
  /* ------------------------------------------------------------------ */
  var docs = {};
  async function handleEngine(m) {
    var reply = function (ok, result) { post({ type: 'res', reqId: m.reqId, ok: ok, result: result }); };
    try {
      if (m.cmd === 'load') {
        if (docs[m.key]) { try { docs[m.key].destroy(); } catch (e) {} }
        var pdf = await openPdf(m.data);
        docs[m.key] = pdf;
        var p1 = await pdf.getPage(1); var v = p1.getViewport({ scale: 1 });
        return reply(true, { pages: pdf.numPages, width: v.width, height: v.height });
      }
      var doc = docs[m.key];
      if (!doc) return reply(false, 'not-loaded');
      if (m.cmd === 'renderPage') {
        var page = await doc.getPage(m.page);
        var vp1 = page.getViewport({ scale: 1 });
        var vp = page.getViewport({ scale: m.width / vp1.width });
        var cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, canvas: cv, viewport: vp }).promise;
        var url = cv.toDataURL(m.format || 'image/jpeg', m.quality || 0.82);
        cv.width = 0; cv.height = 0; page.cleanup();
        return reply(true, url);
      }
      if (m.cmd === 'text') {
        var out = [];
        for (var i = 1; i <= doc.numPages; i++) {
          var pg = await doc.getPage(i); var tc = await pg.getTextContent(); var line = '';
          for (var j = 0; j < tc.items.length; j++) { var it = tc.items[j]; line += it.str || ''; if (it.hasEOL) line += '\n'; }
          out.push(line.trim());
        }
        return reply(true, out.join('\n\n'));
      }
      if (m.cmd === 'unload') { try { doc.destroy(); } catch (e) {} delete docs[m.key]; return reply(true, null); }
      reply(false, 'unknown-cmd');
    } catch (e) {
      reply(false, (e && e.message) || String(e));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Viewer / editor                                                     */
  /* ------------------------------------------------------------------ */
  var S = {
    pdf: null, pages: [], scale: 1, fit: 1, current: 1, night: false,
    mode: 'viewer', tool: null, color: '#17171F', width: 3, hlColor: '#FFE066', shape: 'rect',
    fontSize: 14, bold: false, italic: false,
    ann: [], undo: [], redo: [], search: { q: '', hits: [], i: -1, total: 0 },
    padTop: 12, padBottom: 200, bg: '#F8F8FF'
  };
  var root, pagesEl;
  var SVGNS = 'http://www.w3.org/2000/svg';
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  async function handleViewer(m) {
    try {
      switch (m.cmd) {
        case 'open': return await openViewer(m);
        case 'setTool':
          ['mode', 'tool', 'color', 'width', 'hlColor', 'shape', 'fontSize', 'bold', 'italic'].forEach(function (k) { if (m[k] !== undefined) S[k] = m[k]; });
          return applyInteraction();
        case 'zoom': return setScale(S.scale * (m.dir > 0 ? 1.25 : 0.8));
        case 'fitWidth': return setScale(S.fit);
        case 'goTo': return goTo(m.page);
        case 'night': S.night = !!m.on; document.body.classList.toggle('night', S.night); return;
        case 'undo': return undo();
        case 'redo': return redo();
        case 'clearAll': if (S.ann.length) commit([], S.ann.map(function (a) { return a.id; })); return;
        case 'addText': return commit([textAnn(m.page, m.x, m.y, m.text)], []);
        case 'applyEdit': return applyEdit(m);
        case 'search': return search(m.q);
        case 'searchNext': return searchStep(m.dir);
        case 'setAnnotations': S.ann = m.annotations || []; S.undo = []; S.redo = []; redrawAll(); return emit();
      }
    } catch (e) { post({ type: 'error', message: (e && e.message) || String(e) }); }
  }

  async function openViewer(m) {
    S.mode = m.mode || 'viewer'; S.night = !!m.night; S.bg = m.bg || S.bg;
    S.padTop = m.padTop || 12; S.padBottom = m.padBottom || 200;
    // Paint the whole canvas, not just <body>: when zoomed out the pages are
    // shorter than the screen and <html> would show through below them.
    document.documentElement.style.background = S.bg;
    document.body.style.background = S.bg;
    document.body.classList.toggle('night', S.night);
    S.pdf = await openPdf(m.data);
    S.ann = m.annotations || []; S.undo = []; S.redo = [];
    root = document.getElementById('root'); root.innerHTML = '';
    pagesEl = document.createElement('div'); pagesEl.id = 'pages';
    pagesEl.style.paddingTop = S.padTop + 'px'; pagesEl.style.paddingBottom = S.padBottom + 'px';
    root.appendChild(pagesEl);
    S.pages = [];
    var maxW = 0;
    for (var i = 1; i <= S.pdf.numPages; i++) {
      var pg = await S.pdf.getPage(i);
      var vp = pg.getViewport({ scale: 1 });
      maxW = Math.max(maxW, vp.width);
      var el = document.createElement('div'); el.className = 'page'; el.dataset.n = i;
      var svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'ann');
      svg.setAttribute('viewBox', '0 0 ' + vp.width + ' ' + vp.height); svg.setAttribute('preserveAspectRatio', 'none');
      el.appendChild(svg);
      pagesEl.appendChild(el);
      S.pages.push({ n: i, w: vp.width, h: vp.height, page: pg, el: el, svg: svg, canvas: null, rendered: 0, task: null, text: null, textEl: null, textScale: 0 });
      bindPage(S.pages[i - 1]);
    }
    S.fit = Math.max(0.2, (window.innerWidth - 24) / maxW);
    S.scale = S.fit;
    layout();
    redrawAll();
    applyInteraction();
    post({ type: 'loaded', pages: S.pdf.numPages, zoom: 1 });
    if (m.page && m.page > 1) setTimeout(function () { goTo(m.page); }, 60);
    else update();
    emit(true);
  }

  function layout() {
    for (var i = 0; i < S.pages.length; i++) {
      var p = S.pages[i];
      p.el.style.width = Math.floor(p.w * S.scale) + 'px';
      p.el.style.height = Math.floor(p.h * S.scale) + 'px';
      p.el.style.setProperty('--total-scale-factor', S.scale);
    }
  }

  function inView(p, margin) {
    var r = p.el.getBoundingClientRect();
    return r.bottom > -margin && r.top < window.innerHeight + margin;
  }

  var ticking = false;
  function update() {
    if (!S.pages.length) return;
    var vh = window.innerHeight;
    for (var i = 0; i < S.pages.length; i++) {
      var p = S.pages[i];
      if (inView(p, vh)) { if (p.rendered !== S.scale) renderPage(p); }
      else if (p.canvas && !inView(p, vh * 4)) { p.canvas.width = 0; p.canvas.height = 0; p.canvas.remove(); p.canvas = null; p.rendered = 0; }
    }
    var cur = 1, line = vh * 0.4;
    for (var j = 0; j < S.pages.length; j++) { if (S.pages[j].el.getBoundingClientRect().top <= line) cur = j + 1; }
    if (cur !== S.current) { S.current = cur; post({ type: 'page', page: cur }); }
  }
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', function () { if (S.pages.length) { layout(); update(); } });

  async function renderPage(p) {
    var scale = S.scale;
    if (p.task) { try { p.task.cancel(); } catch (e) {} }
    var vp = p.page.getViewport({ scale: scale });
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var maxPx = 14e6;
    var out = Math.min(dpr, Math.sqrt(maxPx / (vp.width * vp.height)));
    var cv = document.createElement('canvas');
    cv.width = Math.floor(vp.width * out); cv.height = Math.floor(vp.height * out);
    var ctx = cv.getContext('2d');
    var task = p.page.render({ canvasContext: ctx, canvas: cv, viewport: vp, transform: out !== 1 ? [out, 0, 0, out, 0, 0] : null });
    p.task = task; p.rendered = scale;
    try { await task.promise; } catch (e) { return; }
    if (S.scale !== scale) return;
    if (p.canvas) { p.canvas.width = 0; p.canvas.height = 0; p.canvas.remove(); }
    p.el.insertBefore(cv, p.el.firstChild); p.canvas = cv; p.task = null;
    renderText(p);
  }

  async function getText(p) { if (!p.text) p.text = await p.page.getTextContent(); return p.text; }
  async function renderText(p) {
    if (p.textEl && p.textScale === S.scale) return;
    var tc = await getText(p);
    if (p.textEl) p.textEl.remove();
    var div = document.createElement('div'); div.className = 'textLayer';
    p.el.insertBefore(div, p.svg);
    p.textEl = div; p.textScale = S.scale;
    try {
      var tl = new pdfjs.TextLayer({ textContentSource: tc, container: div, viewport: p.page.getViewport({ scale: S.scale }) });
      await tl.render();
    } catch (e) {}
    markHits(p);
  }

  function setScale(ns, anchor) {
    ns = Math.max(S.fit * 0.5, Math.min(S.fit * 5, ns));
    if (!S.pages.length || Math.abs(ns - S.scale) < 0.001) return;
    var ax = anchor ? anchor.x : window.innerWidth / 2, ay = anchor ? anchor.y : window.innerHeight / 2;
    var de = document.scrollingElement;
    var fx = (de.scrollLeft + ax) / de.scrollWidth, fy = (de.scrollTop + ay) / de.scrollHeight;
    S.scale = ns;
    layout();
    window.scrollTo(fx * de.scrollWidth - ax, fy * de.scrollHeight - ay);
    for (var i = 0; i < S.pages.length; i++) { S.pages[i].rendered = -1; }
    update();
    post({ type: 'zoom', zoom: S.scale / S.fit });
  }

  function goTo(n) {
    var p = S.pages[Math.max(1, Math.min(S.pages.length, n)) - 1];
    if (!p) return;
    window.scrollTo(window.scrollX, p.el.offsetTop - S.padTop);
    setTimeout(update, 30);
  }

  /* ---------- Pinch zoom + two-finger pan ---------- */
  var pinch = null;
  function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
  function mid(t) { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }; }
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2 && pagesEl) {
      cancelStroke();
      var c = mid(e.touches);
      pinch = { d0: dist(e.touches), c0: c, last: c, f: 1, s0: S.scale };
      var de = document.scrollingElement;
      pagesEl.style.transformOrigin = (de.scrollLeft + c.x) + 'px ' + (de.scrollTop + c.y) + 'px';
    }
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    var c = mid(e.touches);
    pinch.f = dist(e.touches) / pinch.d0;
    window.scrollBy(pinch.last.x - c.x, pinch.last.y - c.y);
    pinch.last = c;
    if (Math.abs(pinch.f - 1) > 0.03) pagesEl.style.transform = 'scale(' + pinch.f + ')';
  }, { passive: false });
  document.addEventListener('touchend', function (e) {
    if (pinch && e.touches.length < 2) {
      var f = pinch.f, c = pinch.last, s0 = pinch.s0; pinch = null;
      pagesEl.style.transform = '';
      if (Math.abs(f - 1) > 0.03) setScale(s0 * f, c);
    }
  }, { passive: true });

  /* ---------- Annotations ---------- */
  function hexToRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function inkPath(pts) {
    if (!pts.length) return '';
    if (pts.length < 3) return 'M' + pts[0][0] + ' ' + pts[0][1] + ' L' + pts[pts.length - 1][0] + ' ' + pts[pts.length - 1][1];
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    var l = pts[pts.length - 1];
    return d + ' L' + l[0].toFixed(1) + ' ' + l[1].toFixed(1);
  }
  function el(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function drawAnn(svg, a) {
    var g;
    if (a.type === 'ink') g = el('path', { d: inkPath(a.points), fill: 'none', stroke: a.color, 'stroke-width': a.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    else if (a.type === 'highlight') { g = el('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: a.color, 'fill-opacity': 0.45, rx: 1 }); g.style.mixBlendMode = 'multiply'; }
    else if (a.type === 'whiteout') g = el('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: '#ffffff' });
    else if (a.type === 'rect') g = el('rect', { x: a.x, y: a.y, width: a.w, height: a.h, fill: 'none', stroke: a.color, 'stroke-width': a.width });
    else if (a.type === 'ellipse') g = el('ellipse', { cx: a.x + a.w / 2, cy: a.y + a.h / 2, rx: Math.abs(a.w / 2), ry: Math.abs(a.h / 2), fill: 'none', stroke: a.color, 'stroke-width': a.width });
    else if (a.type === 'line' || a.type === 'arrow') {
      g = el('g', {});
      g.appendChild(el('line', { x1: a.x, y1: a.y, x2: a.x2, y2: a.y2, stroke: a.color, 'stroke-width': a.width, 'stroke-linecap': 'round' }));
      if (a.type === 'arrow') {
        var ang = Math.atan2(a.y2 - a.y, a.x2 - a.x), L = Math.max(8, a.width * 4);
        [ang + 2.6, ang - 2.6].forEach(function (t) {
          g.appendChild(el('line', { x1: a.x2, y1: a.y2, x2: a.x2 + Math.cos(t) * L, y2: a.y2 + Math.sin(t) * L, stroke: a.color, 'stroke-width': a.width, 'stroke-linecap': 'round' }));
        });
      }
    } else if (a.type === 'text') {
      g = el('text', { x: a.x, y: a.y + a.fontSize, fill: a.color, 'font-size': a.fontSize, 'font-family': 'Helvetica, Arial, sans-serif', 'font-weight': a.bold ? 700 : 400, 'font-style': a.italic ? 'italic' : 'normal' });
      String(a.text).split('\n').forEach(function (ln, i) { var ts = el('tspan', { x: a.x, dy: i === 0 ? 0 : a.fontSize * 1.2 }); ts.textContent = ln; g.appendChild(ts); });
    }
    if (g) { g.setAttribute('data-id', a.id); svg.appendChild(g); }
    return g;
  }
  function redrawPage(p) { while (p.svg.firstChild) p.svg.removeChild(p.svg.firstChild); S.ann.forEach(function (a) { if (a.page === p.n) drawAnn(p.svg, a); }); }
  function redrawAll() { S.pages.forEach(redrawPage); }
  function emit(initial) {
    post({ type: 'annotations', annotations: S.ann, canUndo: S.undo.length > 0, canRedo: S.redo.length > 0, initial: !!initial });
  }
  function commit(add, removeIds) {
    S.undo.push(JSON.stringify(S.ann)); if (S.undo.length > 60) S.undo.shift(); S.redo = [];
    if (removeIds && removeIds.length) S.ann = S.ann.filter(function (a) { return removeIds.indexOf(a.id) < 0; });
    S.ann = S.ann.concat(add);
    redrawAll(); emit();
  }
  function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify(S.ann)); S.ann = JSON.parse(S.undo.pop()); redrawAll(); emit(); }
  function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify(S.ann)); S.ann = JSON.parse(S.redo.pop()); redrawAll(); emit(); }
  function textAnn(page, x, y, text) {
    return { id: uid(), page: page, type: 'text', x: x, y: y, text: text, color: S.color, fontSize: S.fontSize, bold: S.bold, italic: S.italic };
  }
  function applyEdit(m) {
    var r = m.rect;
    commit([
      { id: uid(), page: m.page, type: 'whiteout', x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 },
      { id: uid(), page: m.page, type: 'text', x: r.x, y: r.y + Math.max(0, (r.h - m.fontSize) / 2) - m.fontSize * 0.1, text: m.text, color: '#17171F', fontSize: m.fontSize, bold: false, italic: false }
    ], []);
  }

  /* ---------- Interaction ---------- */
  function pageOf(target) { var e = target && target.closest ? target.closest('.page') : null; return e ? S.pages[+e.dataset.n - 1] : null; }
  function toPage(p, cx, cy) { var r = p.el.getBoundingClientRect(); return [(cx - r.left) / r.width * p.w, (cy - r.top) / r.height * p.h]; }
  function applyInteraction() {
    var drawing = S.mode === 'editor' && (S.tool === 'draw' || S.tool === 'shapes');
    var tapping = S.mode === 'highlight' || (S.mode === 'editor' && (S.tool === 'text' || S.tool === 'edit' || S.tool === 'erase'));
    document.body.classList.toggle('drawing', drawing);
    document.body.classList.toggle('tapping', tapping);
  }
  function spanAt(p, cx, cy) {
    if (!p.textEl) return null;
    var spans = p.textEl.querySelectorAll('span'), best = null;
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i]; if (!s.textContent || !s.textContent.trim()) continue;
      var r = s.getBoundingClientRect();
      if (cx >= r.left - 4 && cx <= r.right + 4 && cy >= r.top - 6 && cy <= r.bottom + 6) {
        if (!best || r.width * r.height < best.r.width * best.r.height) best = { s: s, r: r };
      }
    }
    return best;
  }
  function rectToPage(p, r) {
    var a = toPage(p, r.left, r.top), b = toPage(p, r.right, r.bottom);
    return { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] };
  }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t)); var x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y);
  }
  function hitTest(p, pt) {
    var tol = 14 / S.scale;
    for (var i = S.ann.length - 1; i >= 0; i--) {
      var a = S.ann[i]; if (a.page !== p.n) continue;
      if (a.type === 'ink') { for (var k = 1; k < a.points.length; k++) if (segDist(pt[0], pt[1], a.points[k - 1][0], a.points[k - 1][1], a.points[k][0], a.points[k][1]) < tol + a.width / 2) return a; if (a.points.length === 1 && segDist(pt[0], pt[1], a.points[0][0], a.points[0][1], a.points[0][0], a.points[0][1]) < tol) return a; }
      else if (a.type === 'line' || a.type === 'arrow') { if (segDist(pt[0], pt[1], a.x, a.y, a.x2, a.y2) < tol + a.width / 2) return a; }
      else {
        var w = a.w, h = a.h;
        if (a.type === 'text') { var lines = String(a.text).split('\n'); w = Math.max.apply(null, lines.map(function (l) { return l.length; })) * a.fontSize * 0.55; h = lines.length * a.fontSize * 1.2; }
        var x0 = Math.min(a.x, a.x + w), y0 = Math.min(a.y, a.y + h);
        if (pt[0] >= x0 - tol && pt[0] <= x0 + Math.abs(w) + tol && pt[1] >= y0 - tol && pt[1] <= y0 + Math.abs(h) + tol) return a;
      }
    }
    return null;
  }

  document.addEventListener('click', function (e) {
    var p = pageOf(e.target); if (!p) return;
    var pt = toPage(p, e.clientX, e.clientY);
    if (S.mode === 'highlight') {
      var sp = spanAt(p, e.clientX, e.clientY); if (!sp) return;
      var r = rectToPage(p, sp.r);
      var existing = S.ann.filter(function (a) { return a.type === 'highlight' && a.page === p.n && !(a.x + a.w < r.x || r.x + r.w < a.x || a.y + a.h < r.y || r.y + r.h < a.y); });
      if (existing.length) commit([], existing.map(function (a) { return a.id; }));
      else commit([{ id: uid(), page: p.n, type: 'highlight', x: r.x - 1, y: r.y, w: r.w + 2, h: r.h, color: S.hlColor }], []);
      return;
    }
    if (S.mode !== 'editor') return;
    if (S.tool === 'text') post({ type: 'requestText', page: p.n, x: pt[0], y: pt[1] - S.fontSize / 2 });
    else if (S.tool === 'edit') {
      var s2 = spanAt(p, e.clientX, e.clientY);
      if (!s2) { post({ type: 'toast', message: 'Tap directly on a line of text' }); return; }
      var rr = rectToPage(p, s2.r);
      post({ type: 'requestEdit', page: p.n, rect: rr, text: s2.s.textContent, fontSize: Math.max(6, Math.round(rr.h * 0.82 * 10) / 10) });
    } else if (S.tool === 'erase') {
      var hit = hitTest(p, pt); if (hit) commit([], [hit.id]);
    }
  });

  var stroke = null;
  function cancelStroke() { if (stroke) { if (stroke.live) stroke.live.remove(); stroke = null; } }
  document.addEventListener('pointerdown', function (e) {
    if (!(S.mode === 'editor' && (S.tool === 'draw' || S.tool === 'shapes')) || !e.isPrimary || pinch) return;
    var p = pageOf(e.target); if (!p) return;
    var pt = toPage(p, e.clientX, e.clientY);
    stroke = { p: p, start: pt, pts: [pt], live: null };
  });
  document.addEventListener('pointermove', function (e) {
    if (!stroke || !e.isPrimary) return;
    if (pinch) { cancelStroke(); return; }
    var p = stroke.p, pt = toPage(p, e.clientX, e.clientY);
    if (stroke.live) stroke.live.remove();
    if (S.tool === 'draw') {
      var last = stroke.pts[stroke.pts.length - 1];
      if (Math.abs(last[0] - pt[0]) + Math.abs(last[1] - pt[1]) > 1.2 / S.scale) stroke.pts.push(pt);
      stroke.live = drawAnn(p.svg, { id: 'live', type: 'ink', points: stroke.pts, color: S.color, width: S.width });
    } else {
      stroke.end = pt;
      stroke.live = drawAnn(p.svg, shapeAnn(p, stroke.start, pt));
    }
  });
  function shapeAnn(p, a, b) {
    var base = { id: uid(), page: p.n, color: S.color, width: S.width };
    if (S.shape === 'line' || S.shape === 'arrow') return Object.assign(base, { type: S.shape, x: a[0], y: a[1], x2: b[0], y2: b[1] });
    return Object.assign(base, { type: S.shape === 'circle' ? 'ellipse' : 'rect', x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) });
  }
  function endStroke() {
    if (!stroke) return;
    var s = stroke; stroke = null; if (s.live) s.live.remove();
    if (S.tool === 'draw') { if (s.pts.length) commit([{ id: uid(), page: s.p.n, type: 'ink', points: s.pts.map(function (q) { return [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]; }), color: S.color, width: S.width }], []); }
    else if (s.end) {
      var sh = shapeAnn(s.p, s.start, s.end);
      var big = sh.type === 'line' || sh.type === 'arrow' ? Math.abs(sh.x2 - sh.x) + Math.abs(sh.y2 - sh.y) > 6 : sh.w > 4 && sh.h > 4;
      if (big) commit([sh], []);
    }
  }
  document.addEventListener('pointerup', endStroke);
  document.addEventListener('pointercancel', cancelStroke);

  /* ---------- Search ---------- */
  async function search(q) {
    q = (q || '').trim().toLowerCase();
    S.search = { q: q, hits: [], i: -1, total: 0 };
    if (q) {
      for (var i = 0; i < S.pages.length; i++) {
        var tc = await getText(S.pages[i]);
        var str = tc.items.map(function (it) { return it.str; }).join(' ').toLowerCase();
        var c = 0, k = str.indexOf(q); while (k >= 0) { c++; k = str.indexOf(q, k + q.length); }
        if (c) { S.search.hits.push(i + 1); S.search.total += c; }
      }
    }
    S.pages.forEach(markHits);
    if (S.search.hits.length) { S.search.i = 0; goTo(S.search.hits[0]); }
    reportSearch();
  }
  function searchStep(dir) {
    var s = S.search; if (!s.hits.length) return;
    s.i = (s.i + dir + s.hits.length) % s.hits.length; goTo(s.hits[s.i]); reportSearch();
  }
  function reportSearch() { post({ type: 'search', total: S.search.total, pages: S.search.hits.length, index: S.search.i, page: S.search.hits[S.search.i] || 0 }); }
  function markHits(p) {
    if (!p.textEl) return;
    var q = S.search.q, spans = p.textEl.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) spans[i].classList.toggle('hit', !!q && spans[i].textContent.toLowerCase().indexOf(q) >= 0);
  }

  function bindPage(p) { /* hook for future per-page listeners */ }

  boot();
})();
`;
