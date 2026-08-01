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
    this._ctx.fillStyle = '#0a0a1a';
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
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

    if (this._isDrawing) {
      this._emitParticles();
      this._addCurvePoint();
    }
  }

  _handleDown(e) {
    if (!this._active) return;
    this._isDrawing = true;
    var rect = this._canvas.getBoundingClientRect();
    this._mouseX = e.clientX - rect.left;
    this._mouseY = e.clientY - rect.top;
    this._prevX = this._mouseX;
    this._prevY = this._mouseY;
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

    // Fade the canvas slightly for trail effect
    ctx.fillStyle = 'rgba(10, 10, 26, 0.03)';
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // Draw flowing curves
    this._drawCurves();

    // Update and draw particles
    this._updateParticles();

    // Draw ambient interference patterns (subtle background animation)
    this._drawAmbient();

    // Draw cursor indicator — small glowing ring at mouse position
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
