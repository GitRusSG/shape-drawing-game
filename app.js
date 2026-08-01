/**
 * App Bootstrap — Wires all modules together and starts the Shape Drawing Game.
 *
 * Bootstrap sequence:
 * 1. Create EventBus
 * 2. Create ShapeStore (pass eventBus)
 * 3. Get canvas element
 * 4. Create CanvasRenderer (subscribes to 'change' internally, calls setupDPR)
 * 5. Create InputRouter (attaches canvas click/touch listeners)
 * 6. Create KeyboardHandler (attaches keydown listeners to buttons)
 * 7. Create LocalStorageAdapter (pass store)
 * 8. Attempt to load from localStorage
 * 9. Get reference length from renderer (canvas diagonal)
 * 10. Create UIPanel (pass store, eventBus, referenceLength)
 * 11. Create AriaLiveRegion (pass store, eventBus)
 * 12. Subscribe localStorage adapter save to 'change' event
 * 13. Wire failure detection for addVertex/closeShape to show messages
 *
 * Requirements: 1.1, 7.5, 7.6, 7.7, 7.10, 8.2, 8.3
 */

// Global error handler — surfaces JS errors in the UI for debugging
window.onerror = function (msg, url, line, col, error) {
  var messagesEl = document.getElementById('messages');
  if (messagesEl) {
    messagesEl.textContent = 'JS Error: ' + msg;
  }
};

(function () {
  'use strict';

  // 1. Create EventBus
  var eventBus = new EventBus();

  // 2. Create ShapeStore
  var store = new ShapeStore(eventBus);

  // 3. Get canvas element
  var canvas = document.getElementById('drawing-canvas');

  // 4. Create CanvasRenderer (subscribes to 'change' internally, sets up DPR)
  var renderer = new CanvasRenderer(canvas, store, eventBus);

  // 5. Create InputRouter (attaches click/touch listeners)
  var inputRouter = new InputRouter(canvas, store);

  // 6. Create KeyboardHandler (attaches keydown listeners to buttons)
  var keyboardHandler = new KeyboardHandler(store, eventBus);

  // 7. Create LocalStorageAdapter
  var storage = new LocalStorageAdapter(store);

  // 8. Attempt to load from localStorage
  var loadResult = storage.load();

  if (loadResult.ok) {
    if (loadResult.data !== null) {
      // Valid data found — restore and trigger redraw (Req 7.6)
      store.fromJSON(loadResult.data);
      eventBus.emit('change');
    }
    // If data is null (no key in localStorage), start empty, no error msg (Req 7.10)
  } else {
    // Invalid data — start empty and show error message (Req 7.7)
    var messagesEl = document.getElementById('messages');
    if (messagesEl) {
      messagesEl.textContent = 'Saved drawing could not be loaded';
    }
  }

  // 9. Get reference length from renderer (canvas diagonal)
  var referenceLength = renderer._referenceLength;

  // 10. Create UIPanel (subscribes to 'change' internally)
  var uiPanel = new UIPanel(store, eventBus, referenceLength);

  // 11. Create AriaLiveRegion (subscribes to 'change' internally)
  var ariaRegion = new AriaLiveRegion(store, eventBus);

  // 12. Subscribe localStorage adapter save to 'change' event (Req 7.5)
  eventBus.on('change', function () {
    storage.save();
  });

  // 13. Wire failure detection for vertex limit and close-shape failures
  // Override handleCanvasClick on InputRouter to detect failures and show messages
  var originalHandleCanvasClick = inputRouter.handleCanvasClick.bind(inputRouter);
  inputRouter.handleCanvasClick = function (x, y) {
    var openShape = store.getOpenShape();

    // Check if this would be a close-shape attempt that will fail (< 3 vertices)
    if (openShape !== null && openShape.getVertexCount() < 3 && openShape.getVertexCount() >= 1) {
      var firstVertex = openShape.vertices[0];
      var dist = segmentLength({ x: x, y: y }, firstVertex);

      if (dist <= ANCHOR_RADIUS) {
        // Close attempt with < 3 vertices — show message (Req 4.5)
        uiPanel.showMessage('A shape requires at least 3 vertices before it can be closed.');
        return;
      }
    }

    // Check if vertex limit is reached before attempting to add
    if (openShape !== null && openShape.getVertexCount() >= VERTEX_LIMIT) {
      // Check if this is NOT a close-shape click
      if (openShape.getVertexCount() >= 3) {
        var firstV = openShape.vertices[0];
        var d = segmentLength({ x: x, y: y }, firstV);
        if (d <= ANCHOR_RADIUS) {
          // This is a close-shape click, let it proceed
          originalHandleCanvasClick(x, y);
          return;
        }
      }
      // Vertex limit reached — show message (Req 1.7)
      uiPanel.showMessage('Maximum number of vertices per shape has been reached.');
      return;
    }

    // Proceed normally
    originalHandleCanvasClick(x, y);
  };

})();
