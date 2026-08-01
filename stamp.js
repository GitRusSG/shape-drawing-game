/**
 * StampMode — Press-and-hold circle stamp mode.
 *
 * When active, pressing and holding on the canvas draws a fixed-size circle (~50px radius)
 * whose color shifts through the hue spectrum based on hold duration.
 * The color radiates outward from the mouse position (radial gradient from cursor).
 * Overlapping stamps blend additively (using 'lighter' composite or opacity layering).
 */

var STAMP_RADIUS = 50;
var STAMP_HUE_SPEED = 120; // degrees per second of hold

class StampMode {
  /**
   * @param {HTMLCanvasElement} stampCanvas - The overlay canvas for stamps
   */
  constructor(stampCanvas) {
    this._canvas = stampCanvas;
    this._ctx = stampCanvas.getContext('2d');
    this._active = false;
    this._pressing = false;
    this._pressStart = 0;
    this._pressX = 0;
    this._pressY = 0;
    this._animFrame = null;
    this._stamps = []; // stored stamps for redraw: {x, y, hue, radius}
    this._radius = STAMP_RADIUS;

    // Bind handlers
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseLeave = this._handleMouseLeave.bind(this);
    this._animate = this._animateLoop.bind(this);

    this._canvas.addEventListener('mousedown', this._onMouseDown);
    this._canvas.addEventListener('mouseup', this._onMouseUp);
    this._canvas.addEventListener('mousemove', this._onMouseMove);
    this._canvas.addEventListener('mouseleave', this._onMouseLeave);

    // Touch support
    this._canvas.addEventListener('touchstart', this._handleTouchStart.bind(this), { passive: false });
    this._canvas.addEventListener('touchend', this._handleTouchEnd.bind(this), { passive: false });
    this._canvas.addEventListener('touchmove', this._handleTouchMove.bind(this), { passive: false });
  }

  /**
   * Activate stamp mode.
   */
  activate() {
    this._active = true;
    this._canvas.classList.add('active');
    this._setupCanvas();
    this._redrawAll();
  }

  /**
   * Deactivate stamp mode.
   */
  deactivate() {
    this._active = false;
    this._canvas.classList.remove('active');
    this._pressing = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  /**
   * Set the stamp radius.
   * @param {number} r - Radius in pixels
   */
  setRadius(r) {
    this._radius = r;
  }

  /**
   * Check if stamp mode is active.
   */
  isActive() {
    return this._active;
  }

  /**
   * Clear all stamps.
   */
  clear() {
    this._stamps = [];
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * Undo the last stamp.
   */
  undo() {
    if (this._stamps.length > 0) {
      this._stamps.pop();
      this._redrawAll();
    }
  }

  /**
   * Set up canvas dimensions to match CSS size.
   */
  _setupCanvas() {
    var rect = this._canvas.getBoundingClientRect();
    this._canvas.width = rect.width;
    this._canvas.height = rect.height;
  }

  _getCoords(e) {
    var rect = this._canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _handleMouseDown(e) {
    if (!this._active) return;
    var coords = this._getCoords(e);
    this._startPress(coords.x, coords.y);
  }

  _handleMouseUp(e) {
    if (!this._active || !this._pressing) return;
    this._endPress();
  }

  _handleMouseMove(e) {
    if (!this._active || !this._pressing) return;
    var coords = this._getCoords(e);
    this._pressX = coords.x;
    this._pressY = coords.y;
  }

  _handleMouseLeave(e) {
    if (this._pressing) {
      this._endPress();
    }
  }

  _handleTouchStart(e) {
    if (!this._active) return;
    e.preventDefault();
    var touch = e.touches[0];
    var coords = this._getCoords(touch);
    this._startPress(coords.x, coords.y);
  }

  _handleTouchEnd(e) {
    if (!this._active || !this._pressing) return;
    e.preventDefault();
    this._endPress();
  }

  _handleTouchMove(e) {
    if (!this._active || !this._pressing) return;
    e.preventDefault();
    var touch = e.touches[0];
    var coords = this._getCoords(touch);
    this._pressX = coords.x;
    this._pressY = coords.y;
  }

  _startPress(x, y) {
    this._pressing = true;
    this._pressStart = Date.now();
    this._pressX = x;
    this._pressY = y;
    this._animFrame = requestAnimationFrame(this._animate);
  }

  _endPress() {
    this._pressing = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    // Commit the final stamp
    var elapsed = (Date.now() - this._pressStart) / 1000;
    var hue = Math.round((elapsed * STAMP_HUE_SPEED) % 360);
    this._stamps.push({ x: this._pressX, y: this._pressY, hue: hue, radius: this._radius });
    this._redrawAll();
  }

  /**
   * Animation loop while pressing — shows live preview of the stamp color.
   */
  _animateLoop() {
    if (!this._pressing) return;

    this._redrawAll();

    // Draw live preview stamp
    var elapsed = (Date.now() - this._pressStart) / 1000;
    var hue = Math.round((elapsed * STAMP_HUE_SPEED) % 360);
    this._drawStamp(this._pressX, this._pressY, hue, 0.6);

    this._animFrame = requestAnimationFrame(this._animate);
  }

  /**
   * Redraws all committed stamps with blending.
   */
  _redrawAll() {
    var ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    // Use 'screen' blending for overlapping stamps to create additive color mixing
    ctx.globalCompositeOperation = 'screen';

    for (var i = 0; i < this._stamps.length; i++) {
      var s = this._stamps[i];
      this._drawStamp(s.x, s.y, s.hue, 0.7, s.radius);
    }

    // Reset composite for the live preview
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Draws a single stamp — radial gradient circle emanating from the center.
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} hue - Hue value (0-360)
   * @param {number} alpha - Opacity (0-1)
   * @param {number} [radius] - Radius (defaults to current _radius)
   */
  _drawStamp(x, y, hue, alpha, radius) {
    var r = radius || this._radius;
    var ctx = this._ctx;
    var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'hsla(' + hue + ', 100%, 60%, ' + alpha + ')');
    grad.addColorStop(0.5, 'hsla(' + hue + ', 90%, 50%, ' + (alpha * 0.7) + ')');
    grad.addColorStop(1, 'hsla(' + hue + ', 80%, 40%, 0)');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

// Export for Node.js testing (no-op in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StampMode, STAMP_RADIUS, STAMP_HUE_SPEED };
}
