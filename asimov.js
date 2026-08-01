/**
 * AsimovMode — Generative abstract art inspired by Gladia's light-sculpting.
 *
 * Creates flowing luminous curves, intersecting arcs, and bold color fields
 * that respond to mouse movement. Like painting with light — each gesture
 * leaves trails of glowing curves that fade and evolve.
 *
 * Move the mouse to paint. The longer you stay in one area, the denser
 * and more complex the patterns become. Curves flow from the cursor,
 * intersect with previous strokes, and create interference patterns.
 */

class AsimovMode {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._active = false;
    this._animFrame = null;
    this._mouseX = 0;
    this._mouseY = 0;
    this._prevX = 0;
    this._prevY = 0;
    this._time = 0;
    this._particles = [];
    this._curves = [];
    this._hueBase = 0;
    this._isDrawing = false;
    this._dwellTime = 0;     // how long mouse has been still while pressed
    this._lastMoveTime = 0;  // timestamp of last mouse movement
    this._permanentMarks = []; // spots that have been held long enough to be permanent
    this._fillMode = false;  // when true, clicks flood-fill instead of drawing

    // Bind
    this._onMove = this._handleMove.bind(this);
    this._onDown = this._handleDown.bind(this);
    this._onUp = this._handleUp.bind(this);
    this._onLeave = this._handleLeave.bind(this);
    this._loop = this._animLoop.bind(this);

    this._canvas.addEventListener('mousemove', this._onMove);
    this._canvas.addEventListener('mousedown', this._onDown);
    this._canvas.addEventListener('mouseup', this._onUp);
    this._canvas.addEventListener('mouseleave', this._onLeave);
    this._canvas.addEventListener('touchmove', this._handleTouch.bind(this), { passive: false });
    this._canvas.addEventListener('touchstart', this._handleTouchStart.bind(this), { passive: false });
    this._canvas.addEventListener('touchend', this._onUp);
  }

  activate() {
    this._active = true;
    this._canvas.classList.add('active');
    // Force layout so getBoundingClientRect returns real dimensions
    this._canvas.offsetHeight;
    this._setupCanvas();
    // Fill with dark background
    this._ctx.fillStyle = '#0a0a1a';
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    this._time = 0;
    this._particles = [];
    this._curves = [];
    this._animFrame = requestAnimationFrame(this._loop);
  }

  deactivate() {
    this._active = false;
    this._canvas.classList.remove('active');
    this._isDrawing = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  isActive() {
    return this._active;
  }

  clear() {
    this._particles = [];
    this._curves = [];
    this._permanentMarks = [];
    this._ctx.fillStyle = '#0a0a1a';
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
  }

  setFillMode(on) {
    this._fillMode = on;
    if (on) {
      this._canvas.style.cursor = 'crosshair';
    } else {
      this._canvas.style.cursor = 'none';
    }
  }

  isFillMode() {
    return this._fillMode;
  }

  /**
   * Flood fill from (startX, startY) with the current hue colour.
   * Fills any pixel that's "dark" (close to the background colour).
   */
  _floodFill(startX, startY) {
    var ctx = this._ctx;
    var w = this._canvas.width;
    var h = this._canvas.height;
    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;

    // Get the colour at the click point
    var idx = (startY * w + startX) * 4;
    var targetR = data[idx];
    var targetG = data[idx + 1];
    var targetB = data[idx + 2];

    // Fill colour from current hue
    var hue = this._hueBase;
    // Convert HSL to RGB (s=90, l=55)
    var fillRGB = this._hslToRgb(hue / 360, 0.9, 0.55);

    // Don't fill if clicking on an already-coloured pixel (not dark)
    var brightness = (targetR + targetG + targetB) / 3;
    if (brightness > 80) return; // already has colour, skip

    // BFS flood fill
    var tolerance = 50;
    var stack = [[startX, startY]];
    var visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      var point = stack.pop();
      var px = point[0];
      var py = point[1];

      if (px < 0 || px >= w || py < 0 || py >= h) continue;

      var pIdx = py * w + px;
      if (visited[pIdx]) continue;
      visited[pIdx] = 1;

      var i = pIdx * 4;
      var r = data[i];
      var g = data[i + 1];
      var b = data[i + 2];

      // Check if this pixel is similar to the target (dark background)
      var diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
      if (diff > tolerance) continue;

      // Fill this pixel
      data[i] = fillRGB[0];
      data[i + 1] = fillRGB[1];
      data[i + 2] = fillRGB[2];
      data[i + 3] = 200; // slightly transparent

      // Add neighbors
      stack.push([px + 1, py]);
      stack.push([px - 1, py]);
      stack.push([px, py + 1]);
      stack.push([px, py - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    // Shift hue for next fill
    this._hueBase = (this._hueBase + 45) % 360;
  }

  _hslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = this._hue2rgb(p, q, h + 1/3);
      g = this._hue2rgb(p, q, h);
      b = this._hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  _hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  _setupCanvas() {
    var rect = this._canvas.getBoundingClientRect();
    this._canvas.width = rect.width;
    this._canvas.height = rect.height;
  }

  _handleMove(e) {
    if (!this._active) return;
    var rect = this._canvas.getBoundingClientRect();
    this._prevX = this._mouseX;
    this._prevY = this._mouseY;
    this._mouseX = e.clientX - rect.left;
    this._mouseY = e.clientY - rect.top;
    this._lastMoveTime = Date.now();
    this._dwellTime = 0;

    if (this._isDrawing) {
      this._emitParticles();
      this._addCurvePoint();
    }
  }

  _handleDown(e) {
    if (!this._active) return;
    var rect = this._canvas.getBoundingClientRect();
    this._mouseX = e.clientX - rect.left;
    this._mouseY = e.clientY - rect.top;
    this._prevX = this._mouseX;
    this._prevY = this._mouseY;

    if (this._fillMode) {
      this._floodFill(Math.round(this._mouseX), Math.round(this._mouseY));
      return;
    }

    this._isDrawing = true;
    this._lastMoveTime = Date.now();
    this._curves.push([]);
    this._hueBase = (this._hueBase + 60 + Math.random() * 40) % 360;
  }

  _handleUp() {
    this._isDrawing = false;
  }

  _handleLeave() {
    this._isDrawing = false;
  }

  _handleTouchStart(e) {
    if (!this._active) return;
    e.preventDefault();
    var touch = e.touches[0];
    var rect = this._canvas.getBoundingClientRect();
    this._mouseX = touch.clientX - rect.left;
    this._mouseY = touch.clientY - rect.top;
    this._prevX = this._mouseX;
    this._prevY = this._mouseY;
    this._isDrawing = true;
    this._curves.push([]);
    this._hueBase = (this._hueBase + 60 + Math.random() * 40) % 360;
  }

  _handleTouch(e) {
    if (!this._active) return;
    e.preventDefault();
    var touch = e.touches[0];
    var rect = this._canvas.getBoundingClientRect();
    this._prevX = this._mouseX;
    this._prevY = this._mouseY;
    this._mouseX = touch.clientX - rect.left;
    this._mouseY = touch.clientY - rect.top;
    if (this._isDrawing) {
      this._emitParticles();
      this._addCurvePoint();
    }
  }

  _emitParticles() {
    var speed = Math.sqrt(
      Math.pow(this._mouseX - this._prevX, 2) +
      Math.pow(this._mouseY - this._prevY, 2)
    );
    var count = Math.min(Math.floor(speed / 3) + 1, 8);

    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var vel = 0.5 + Math.random() * 2;
      this._particles.push({
        x: this._mouseX,
        y: this._mouseY,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: 1.0,
        decay: 0.005 + Math.random() * 0.01,
        hue: this._hueBase + Math.random() * 30 - 15,
        size: 1 + Math.random() * 3
      });
    }
  }

  _addCurvePoint() {
    if (this._curves.length === 0) return;
    var current = this._curves[this._curves.length - 1];
    current.push({
      x: this._mouseX,
      y: this._mouseY,
      hue: this._hueBase + Math.sin(this._time * 2) * 20,
      width: 1 + Math.random() * 3
    });
  }

  _animLoop() {
    if (!this._active) return;

    this._time += 0.016;
    var ctx = this._ctx;

    // Track dwell time — if mouse is held still while drawing
    if (this._isDrawing) {
      var timeSinceMove = Date.now() - this._lastMoveTime;
      if (timeSinceMove > 300) {
        this._dwellTime += 0.016;
        // After holding ~0.5s, start creating a permanent mark
        if (this._dwellTime > 0.5) {
          var hue = (this._hueBase + this._time * 40) % 360;
          // Add to permanent marks (these won't fade)
          this._permanentMarks.push({
            x: this._mouseX,
            y: this._mouseY,
            hue: hue,
            alpha: Math.min(this._dwellTime * 0.3, 0.9),
            radius: 15 + this._dwellTime * 5
          });
          // Cap marks
          if (this._permanentMarks.length > 2000) {
            this._permanentMarks.splice(0, 100);
          }
        }
      }
    }

    // Fade the canvas slightly for trail effect — but draw permanent marks on top
    ctx.fillStyle = 'rgba(10, 10, 26, 0.03)';
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // Redraw permanent marks (these resist the fade)
    this._drawPermanentMarks();

    // Draw flowing curves
    this._drawCurves();

    // Update and draw particles
    this._updateParticles();

    // Draw ambient interference patterns (subtle background animation)
    this._drawAmbient();

    // Draw cursor indicator
    this._drawCursor();

    this._animFrame = requestAnimationFrame(this._loop);
  }

  _drawCurves() {
    var ctx = this._ctx;

    for (var c = 0; c < this._curves.length; c++) {
      var pts = this._curves[c];
      if (pts.length < 2) continue;

      // Only draw the latest segment for performance
      var start = Math.max(0, pts.length - 3);

      for (var i = start; i < pts.length - 1; i++) {
        var p0 = pts[i];
        var p1 = pts[i + 1];

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);

        // Use quadratic curve for smoothness
        if (i + 2 < pts.length) {
          var p2 = pts[i + 2];
          var cpx = p1.x;
          var cpy = p1.y;
          ctx.quadraticCurveTo(cpx, cpy, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        } else {
          ctx.lineTo(p1.x, p1.y);
        }

        ctx.strokeStyle = 'hsla(' + p0.hue + ', 80%, 65%, 0.8)';
        ctx.lineWidth = p0.width;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'hsl(' + p0.hue + ', 100%, 60%)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  _drawPermanentMarks() {
    var ctx = this._ctx;
    for (var i = 0; i < this._permanentMarks.length; i++) {
      var m = this._permanentMarks[i];
      var grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
      grad.addColorStop(0, 'hsla(' + m.hue + ', 90%, 60%, ' + m.alpha + ')');
      grad.addColorStop(1, 'hsla(' + m.hue + ', 80%, 40%, 0)');
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  _updateParticles() {
    var ctx = this._ctx;

    for (var i = this._particles.length - 1; i >= 0; i--) {
      var p = this._particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= p.decay;

      if (p.life <= 0) {
        this._particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + p.hue + ', 90%, 70%, ' + (p.life * 0.6) + ')';
      ctx.fill();
    }

    // Cap particles to prevent memory issues
    if (this._particles.length > 500) {
      this._particles.splice(0, this._particles.length - 500);
    }
  }

  _drawAmbient() {
    // Subtle pulsing geometric shapes in the background
    var ctx = this._ctx;
    var t = this._time;

    // Only draw every ~60 frames to keep it subtle
    if (Math.random() > 0.02) return;

    var cx = Math.random() * this._canvas.width;
    var cy = Math.random() * this._canvas.height;
    var radius = 20 + Math.random() * 60;
    var hue = (t * 30 + Math.random() * 120) % 360;
    var sides = 3 + Math.floor(Math.random() * 5);

    ctx.beginPath();
    for (var i = 0; i <= sides; i++) {
      var angle = (i / sides) * Math.PI * 2 + t;
      var px = cx + Math.cos(angle) * radius;
      var py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = 'hsla(' + hue + ', 70%, 50%, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  _drawCursor() {
    var ctx = this._ctx;
    var x = this._mouseX;
    var y = this._mouseY;
    if (x === 0 && y === 0) return;

    // Small glowing crosshair/ring
    var pulse = 0.5 + 0.5 * Math.sin(this._time * 6);
    var alpha = 0.4 + pulse * 0.4;
    var size = 5 + pulse * 2;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha + ')';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha + 0.2) + ')';
    ctx.fill();
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AsimovMode };
}
