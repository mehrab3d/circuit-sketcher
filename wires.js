// Circuit Sketcher: routed wires, editable nodes, and branch junctions.
// Loaded after app.js.

const SNAP_RADIUS = 12;
const START_CLICK = 10;
const AXIS_SNAP_PIXELS = 10;
const DEFAULT_WIRE_COLOR = '#2f6fb0';
const wires = []; // endpoints are pin nodes or {kind:'junction', wireId, nodeId}
let draft = null;
let hoverWire = null, pinnedWire = null, hideTimer = null;
let nextWireId = 0;
const wireColorInput = document.getElementById('wire-color-input');

// Kept for compatibility with saved circuit files; new wire colors always come from their pins.
function getWireColorPreference() { return null; }
function setWireColorPreference() { syncWireColorPicker(); }
function syncWireColorPicker() {
  if (!wireColorInput) return;
  wireColorInput.value = pinnedWire?.color || DEFAULT_WIRE_COLOR;
  wireColorInput.disabled = !pinnedWire;
  wireColorInput.title = pinnedWire ? 'Change the selected wire color' : 'Select a wire to change its color; new wires use their pin color';
  wireColorInput.setAttribute('aria-label', pinnedWire ? 'Selected wire color' : 'Select a wire to change its color');
}
function recolorWire(wire, color) {
  wire.color = color;
  wire.line.stroke(color);
  wire.handles.getChildren().forEach((handle) => handle.stroke(color));
  wire.nodes.forEach((node) => { if (node.dot) node.dot.fill(color); });
  wireLayer.batchDraw();
  overlay.batchDraw();
}
wireColorInput?.addEventListener('input', () => {
  if (!pinnedWire) return;
  recolorWire(pinnedWire, wireColorInput.value);
  queueSave();
});

const pinPos = (pin) => pin.getAbsolutePosition(layer);
const pointer = () => layer.getRelativePointerPosition();
const isDrawing = () => draft !== null;

function newWireId() {
  nextWireId += 1;
  return window.crypto?.randomUUID?.() || `wire-${Date.now()}-${nextWireId}`;
}

function isJunctionEndpoint(endpoint) { return endpoint?.kind === 'junction'; }
function getWire(id) { return wires.find((wire) => wire.id === id); }
function getJunctionNode(endpoint) {
  const parent = getWire(endpoint.wireId);
  return parent?.nodes.find((node) => node.junctionId === endpoint.nodeId) || null;
}
function endpointPos(endpoint) {
  if (!isJunctionEndpoint(endpoint)) return pinPos(endpoint);
  const node = getJunctionNode(endpoint);
  return node ? { x: node.x, y: node.y } : null;
}
function serializeEndpoint(endpoint) {
  if (isJunctionEndpoint(endpoint)) {
    return { kind: 'junction', wireId: endpoint.wireId, nodeId: endpoint.nodeId };
  }
  return {
    kind: 'pin',
    instanceId: endpoint.getParent().getAttr('instanceId'),
    pinId: endpoint.getAttr('pinId'),
  };
}
function endpointKey(endpoint) {
  if (isJunctionEndpoint(endpoint)) return `junction:${endpoint.wireId}:${endpoint.nodeId}`;
  return `pin:${endpoint.getParent().getAttr('instanceId')}:${endpoint.getAttr('pinId')}`;
}

function wirePoints(wire) {
  const a = endpointPos(wire.from), b = endpointPos(wire.to);
  if (!a || !b) return [];
  return [a.x, a.y, ...wire.nodes.flatMap((node) => [node.x, node.y]), b.x, b.y];
}
function updateWire(wire) { wire.line.points(wirePoints(wire)); }

// Recalculate every line when a component moves; branches may depend on another wire's node.
function updateWiresFor() {
  wires.forEach(updateWire);
  wireLayer.batchDraw();
  overlay.batchDraw();
}

function nearestSegment(points, p) {
  let best = { i: 0, d: Infinity, x: 0, y: 0 };
  for (let k = 0; k + 3 < points.length; k += 2) {
    const ax = points[k], ay = points[k + 1], bx = points[k + 2], by = points[k + 3];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2)) : 0;
    const x = ax + t * dx, y = ay + t * dy, d = Math.hypot(p.x - x, p.y - y);
    if (d < best.d) best = { i: k / 2, d, x, y };
  }
  return best;
}

function snapToAxes(point, anchors) {
  const tolerance = AXIS_SNAP_PIXELS / stage.scaleX();
  let x = point.x, y = point.y;
  let nearestX = tolerance, nearestY = tolerance;
  anchors.filter(Boolean).forEach((anchor) => {
    const dx = Math.abs(point.x - anchor.x), dy = Math.abs(point.y - anchor.y);
    if (dx < nearestX) { nearestX = dx; x = anchor.x; }
    if (dy < nearestY) { nearestY = dy; y = anchor.y; }
  });
  return { x, y };
}
function alignmentBend(start, end) {
  const tolerance = AXIS_SNAP_PIXELS / stage.scaleX();
  const dx = Math.abs(end.x - start.x), dy = Math.abs(end.y - start.y);
  if (dx <= tolerance && dx > 0.5 && (dx <= dy || dy > tolerance)) return { x: end.x, y: start.y };
  if (dy <= tolerance && dy > 0.5) return { x: start.x, y: end.y };
  return null;
}
function highlight(pin, on) {
  if (!pin || isJunctionEndpoint(pin)) return;
  pin.radius(on ? 6.5 : 4);
  layer.batchDraw();
}
function nearestPin(pos, exclude) {
  let best = null, bestDist = SNAP_RADIUS;
  layer.find('.pin').forEach((pin) => {
    if (pin === exclude) return;
    const p = pinPos(pin), d = Math.hypot(p.x - pos.x, p.y - pos.y);
    if (d <= bestDist) { best = pin; bestDist = d; }
  });
  return best;
}
function nearestWirePoint(pos) {
  let best = null;
  wires.forEach((wire) => {
    const hit = nearestSegment(wirePoints(wire), pos);
    if (hit.d <= SNAP_RADIUS && (!best || hit.d < best.d)) best = { wire, ...hit };
  });
  return best;
}

function refreshHandles() {
  wires.forEach((wire) => {
    const on = wire === hoverWire || wire === pinnedWire;
    wire.handles.visible(on);
    wire.line.strokeWidth(wire === pinnedWire ? 4 : 2.5);
  });
  overlay.batchDraw();
  wireLayer.batchDraw();
}
function hovering(wire) { clearTimeout(hideTimer); hoverWire = wire; refreshHandles(); }
function unhover(wire) {
  hideTimer = setTimeout(() => { if (hoverWire === wire) { hoverWire = null; refreshHandles(); } }, 250);
}
function pinWire(wire) { pinnedWire = wire; refreshHandles(); syncWireColorPicker(); }

function junctionDot(node, wire) {
  if (!node.junctionId) return;
  if (!node.dot) {
    node.dot = new Konva.Circle({
      radius: 4.5, fill: wire.line.stroke(), stroke: '#ffffff', strokeWidth: 1.5,
      listening: false, name: 'junction-dot',
    });
    overlay.add(node.dot);
  }
  node.dot.fill(wire.color || wire.line.stroke());
  node.dot.position({ x: node.x, y: node.y });
  node.dot.moveToTop();
}

function updateConnectedBranches(wire, node) {
  wires.forEach((candidate) => {
    if ((isJunctionEndpoint(candidate.from) && candidate.from.wireId === wire.id && candidate.from.nodeId === node.junctionId) ||
        (isJunctionEndpoint(candidate.to) && candidate.to.wireId === wire.id && candidate.to.nodeId === node.junctionId)) {
      updateWire(candidate);
    }
  });
  wireLayer.batchDraw();
}

function removeBranchesAt(wireId, nodeId) {
  wires.slice().forEach((wire) => {
    const uses = [wire.from, wire.to].some((endpoint) =>
      isJunctionEndpoint(endpoint) && endpoint.wireId === wireId && endpoint.nodeId === nodeId);
    if (uses) removeWire(wire);
  });
}

function rebuildHandles(wire) {
  wire.handles.destroyChildren();
  wire.nodes.forEach((node) => {
    junctionDot(node, wire);
    const handle = new Konva.Circle({
      x: node.x, y: node.y, radius: 5,
      fill: '#ffffff', stroke: wire.line.stroke(), strokeWidth: 2,
      hitStrokeWidth: 10, draggable: true,
    });
    handle.on('mousedown touchstart', () => { select(null); pinWire(wire); });
    handle.on('dragmove', () => {
      const index = wire.nodes.indexOf(node);
      const before = index > 0 ? wire.nodes[index - 1] : endpointPos(wire.from);
      const after = index < wire.nodes.length - 1 ? wire.nodes[index + 1] : endpointPos(wire.to);
      const point = snapToAxes({ x: handle.x(), y: handle.y() }, [before, after]);
      node.x = point.x; node.y = point.y;
      handle.position(point);
      if (node.dot) node.dot.position(point);
      wires.forEach(updateWire);
      wireLayer.batchDraw();
      overlay.batchDraw();
      if (node.junctionId) updateConnectedBranches(wire, node);
      queueSave();
    });
    handle.on('dblclick dbltap', () => {
      if (node.junctionId) {
        removeBranchesAt(wire.id, node.junctionId);
        if (node.dot) node.dot.destroy();
      }
      const nodeIndex = wire.nodes.indexOf(node);
      if (nodeIndex >= 0) wire.nodes.splice(nodeIndex, 1);
      stage.container().style.cursor = 'default';
      rebuildHandles(wire);
      updateWire(wire);
      wireLayer.batchDraw();
      queueSave();
    });
    handle.on('mouseenter', () => { stage.container().style.cursor = 'move'; hovering(wire); });
    handle.on('mouseleave', () => { stage.container().style.cursor = 'default'; unhover(wire); });
    wire.handles.add(handle);
  });
  overlay.batchDraw();
}

function addWire(from, to, nodes = [], wireId = newWireId(), shouldSave = true, colorOverride = null) {
  const key = `${endpointKey(from)}>${endpointKey(to)}`;
  const reverseKey = `${endpointKey(to)}>${endpointKey(from)}`;
  if (wires.some((wire) => wire.key === key || wire.key === reverseKey)) return null;

  const sourcePin = isJunctionEndpoint(from) ? null : from;
  const targetPin = isJunctionEndpoint(to) ? null : to;
  const colorPin = sourcePin || targetPin;
  const color = colorOverride || (colorPin ? colorPin.fill() : PIN_COLORS.signal);
  const line = new Konva.Line({
    stroke: color, strokeWidth: 2.5, lineJoin: 'round', lineCap: 'round', hitStrokeWidth: 12,
  });
  const handles = new Konva.Group({ visible: false });
  overlay.add(handles);
  const wire = { id: wireId, key, from, to, nodes, line, handles, color };

  line.on('mouseenter', () => { stage.container().style.cursor = 'pointer'; hovering(wire); });
  line.on('mouseleave', () => { stage.container().style.cursor = 'default'; unhover(wire); });
  line.on('click tap', () => { select(null); pinWire(wire); });
  line.on('dblclick dbltap', () => {
    const pos = pointer();
    if (!pos) return;
    const point = nearestSegment(wirePoints(wire), pos);
    wire.nodes.splice(point.i, 0, { x: point.x, y: point.y });
    rebuildHandles(wire);
    updateWire(wire);
    pinWire(wire);
    queueSave();
  });

  wireLayer.add(line);
  wires.push(wire);
  updateWire(wire);
  rebuildHandles(wire);
  wireLayer.batchDraw();
  if (shouldSave) queueSave();
  return wire;
}

function removeWire(wire) {
  if (!wires.includes(wire)) return;
  wires.slice().forEach((candidate) => {
    [candidate.from, candidate.to].forEach((endpoint) => {
      if (isJunctionEndpoint(endpoint) && endpoint.wireId === wire.id) removeWire(candidate);
    });
  });
  const junctionEndpoints = [wire.from, wire.to].filter(isJunctionEndpoint);
  clearTimeout(hideTimer);
  if (hoverWire === wire) hoverWire = null;
  if (pinnedWire === wire) pinnedWire = null;
  syncWireColorPicker();
  wire.nodes.forEach((node) => { if (node.dot) node.dot.destroy(); });
  wire.line.destroy();
  wire.handles.destroy();
  wires.splice(wires.indexOf(wire), 1);
  junctionEndpoints.forEach((endpoint) => {
    const stillConnected = wires.some((candidate) => [candidate.from, candidate.to].some((other) =>
      isJunctionEndpoint(other) && other.wireId === endpoint.wireId && other.nodeId === endpoint.nodeId));
    if (stillConnected) return;
    const parent = getWire(endpoint.wireId);
    if (!parent) return;
    const index = parent.nodes.findIndex((node) => node.junctionId === endpoint.nodeId);
    if (index < 0) return;
    const [node] = parent.nodes.splice(index, 1);
    if (node.dot) node.dot.destroy();
    rebuildHandles(parent);
    updateWire(parent);
  });
  stage.container().style.cursor = 'default';
  wireLayer.batchDraw();
  overlay.batchDraw();
  queueSave();
}
function removeWiresFor(group) {
  wires.slice().forEach((wire) => {
    const connected = [wire.from, wire.to].some((endpoint) =>
      !isJunctionEndpoint(endpoint) && endpoint.getParent() === group);
    if (connected) removeWire(wire);
  });
}

function setPartsDraggable(on) {
  layer.find('.component').forEach((group) => group.draggable(on));
}
function drawDraft(pos) {
  const start = pinPos(draft.from);
  const points = draft.nodes.map((node) => ({ x: node.x, y: node.y }));
  const anchor = points.length ? points[points.length - 1] : start;
  let end = pos;
  let bend = null;
  if (draft.targetPin) end = pinPos(draft.targetPin);
  else if (draft.wireTarget) end = { x: draft.wireTarget.x, y: draft.wireTarget.y };
  if (draft.targetPin || draft.wireTarget) {
    bend = alignmentBend(anchor, end);
  } else {
    end = snapToAxes(end, [anchor]);
  }
  if (bend) points.push(bend);
  draft.line.points([start.x, start.y, ...points.flatMap((node) => [node.x, node.y]), end.x, end.y]);
  overlay.batchDraw();
}
function startWire(pin) {
  if (draft) return;
  const color = pin.fill() || DEFAULT_WIRE_COLOR;
  const line = new Konva.Line({
    stroke: color, strokeWidth: 2, dash: [6, 4], lineJoin: 'round', listening: false,
  });
  overlay.add(line);
  draft = { from: pin, nodes: [], line, color, targetPin: null, wireTarget: null };
  setPartsDraggable(false);
  highlight(pin, true);
}
function finishWire(target) {
  const { from, nodes, line, color, targetPin } = draft;
  draft = null;
  line.destroy();
  highlight(from, false);
  highlight(targetPin, false);
  setPartsDraggable(true);
  if (target) {
    const end = endpointPos(target);
    const start = nodes.length ? nodes[nodes.length - 1] : pinPos(from);
    const bend = end && alignmentBend(start, end);
    if (bend) nodes.push(bend);
    addWire(from, target, nodes, undefined, true, color);
  }
  overlay.batchDraw();
}
function junctionAt(hit) {
  const nearby = hit.wire.nodes.find((node) => node.junctionId && Math.hypot(node.x - hit.x, node.y - hit.y) <= SNAP_RADIUS);
  if (nearby) return { kind: 'junction', wireId: hit.wire.id, nodeId: nearby.junctionId };
  const nodeId = newWireId();
  const node = { x: hit.x, y: hit.y, junctionId: nodeId };
  hit.wire.nodes.splice(hit.i, 0, node);
  rebuildHandles(hit.wire);
  updateWire(hit.wire);
  wireLayer.batchDraw();
  overlay.batchDraw();
  return { kind: 'junction', wireId: hit.wire.id, nodeId };
}

stage.on('mousemove touchmove', () => {
  if (!draft) return;
  const pos = pointer();
  if (!pos) return;
  const targetPin = nearestPin(pos, draft.from);
  const wireTarget = targetPin ? null : nearestWirePoint(pos);
  if (targetPin !== draft.targetPin) {
    highlight(draft.targetPin, false);
    highlight(targetPin, true);
  }
  draft.targetPin = targetPin;
  draft.wireTarget = wireTarget;
  drawDraft(pos);
});

stage.on('mouseup touchend', () => {
  if (!draft) return;
  const pos = pointer();
  if (!pos) return;
  const start = pinPos(draft.from);
  if (Math.hypot(pos.x - start.x, pos.y - start.y) <= START_CLICK) return;
  const targetPin = nearestPin(pos, draft.from);
  if (targetPin) return finishWire(targetPin);
  const wireTarget = nearestWirePoint(pos);
  if (wireTarget) return finishWire(junctionAt(wireTarget));
  const anchor = draft.nodes.length ? draft.nodes[draft.nodes.length - 1] : pinPos(draft.from);
  draft.nodes.push(snapToAxes(pos, [anchor]));
  drawDraft(pos);
});

stage.on('mousedown touchstart', (e) => { if (e.target === stage) pinWire(null); });
window.addEventListener('keydown', (e) => {
  if (isTyping(e)) return;
  if (e.key === 'Escape' && draft) finishWire(null);
  else if ((e.key === 'Delete' || e.key === 'Backspace') && pinnedWire && !draft) removeWire(pinnedWire);
});
