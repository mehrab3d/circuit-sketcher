// Circuit Sketcher: parts (render, drag, select, rotate)

const PIN_COLORS = {
  power: '#d64545',
  ground: '#2d3b45',
  signal: '#e0a21b',
  data: '#2f9e6b',
  other: '#7b8b95',
};
const OUT = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

const wrap = document.getElementById('stage-wrap');
const statusEl = document.getElementById('status');
const circuitTitle = document.getElementById('circuit-title');
const saveButton = document.getElementById('save-btn');
const undoButton = document.getElementById('undo-btn');
const redoButton = document.getElementById('redo-btn');
const openButton = document.getElementById('open-btn');
const openFileInput = document.getElementById('open-file');
const exportJsonButton = document.getElementById('export-json-btn');
const exportBomButton = document.getElementById('export-bom-btn');
const exportPngButton = document.getElementById('export-png-btn');
const clearButton = document.getElementById('clear-btn');
const clearDialog = document.getElementById('clear-workspace-dialog');
const wiringChecksButton = document.getElementById('wiring-checks-btn');
const wiringCheckCount = document.getElementById('wire-check-count');
const wiringChecksDialog = document.getElementById('wiring-checks-dialog');
const wiringChecksSummary = document.getElementById('wiring-checks-summary');
const wiringChecksList = document.getElementById('wiring-checks-list');
const addNoteButton = document.getElementById('add-note-btn');
const customPartJson = document.getElementById('custom-part-json');
const customPartName = document.getElementById('custom-part-name');
const customPartCategory = document.getElementById('custom-part-category');
const customPartShape = document.getElementById('custom-part-shape');
const customPartWidth = document.getElementById('custom-part-width');
const customPartHeight = document.getElementById('custom-part-height');
const customPartColor = document.getElementById('custom-part-color');
const customPartPinLabels = document.getElementById('custom-part-pin-labels');
const customPartPinSide = document.getElementById('custom-part-pin-side');
const customPartPinType = document.getElementById('custom-part-pin-type');
const customPartPreview = document.getElementById('custom-part-preview');
const customPartPreviewBody = document.getElementById('custom-part-preview-body');
const customPartPreviewPins = document.getElementById('custom-part-preview-pins');
const createCustomPartButton = document.getElementById('custom-part-create');
const addCustomPartButton = document.getElementById('add-custom-part-btn');
const customPartStatus = document.getElementById('custom-part-status');
const customPartDrawer = document.getElementById('custom-part-drawer');
const customPartToggle = document.getElementById('custom-part-toggle');
const customPartClose = document.getElementById('custom-part-close');
const zoomOutButton = document.getElementById('zoom-out-btn');
const zoomInButton = document.getElementById('zoom-in-btn');
const resetViewButton = document.getElementById('reset-view-btn');
const zoomLevel = document.getElementById('zoom-level');
const noteDialog = document.getElementById('note-dialog');
const noteForm = document.getElementById('note-form');
const noteInput = document.getElementById('note-content');
const noteDialogTitle = document.getElementById('note-dialog-title');
const noteSubmitButton = document.getElementById('note-submit-btn');
const removePartDialog = document.getElementById('remove-part-dialog');
const removePartMessage = document.getElementById('remove-part-message');
const removePartConfirmButton = document.getElementById('remove-part-confirm');
const removePartCancelButton = document.getElementById('remove-part-cancel');
const STORAGE_KEY = 'circuit-sketcher.v1';
const N20_VISIBILITY_MIGRATION_KEY = 'circuit-sketcher.n20-visible.v1';
const HISTORY_LIMIT = 60;
const RESISTOR_ID = 'resistor-variable';
const RESISTOR_COLORS = ['#222222', '#8b572a', '#d64545', '#e8872d', '#e8c94a', '#3d9a61', '#397fc0', '#7956a5', '#8e969b', '#f4f4ef'];
const RESISTOR_MULTIPLIER_COLORS = { '-2': '#c4c8ca', '-1': '#c79a32', '0': '#222222', '1': '#8b572a', '2': '#d64545', '3': '#e8872d', '4': '#e8c94a', '5': '#3d9a61', '6': '#397fc0', '7': '#7956a5', '8': '#8e969b', '9': '#f4f4ef' };
const resistorDialog = document.getElementById('resistor-dialog');
const resistorForm = document.getElementById('resistor-form');
const resistorValueInput = document.getElementById('resistor-value');
const resistorBandPreview = document.getElementById('resistor-band-preview');
const resistorSummary = document.getElementById('resistor-summary');
let editingResistor = null;

function resistorBandColors(value) {
  const safeValue = Math.max(0.01, Number(value) || 220);
  let exponent = Math.floor(Math.log10(safeValue)) - 1;
  let digits = Math.round(safeValue / (10 ** exponent));
  if (digits >= 100) { digits = 10; exponent += 1; }
  if (digits < 10) { digits = Math.round(safeValue / (10 ** (exponent - 1))); exponent -= 1; }
  exponent = Math.max(-2, Math.min(9, exponent));
  const first = Math.max(0, Math.min(9, Math.floor(digits / 10)));
  const second = Math.max(0, Math.min(9, digits % 10));
  return [RESISTOR_COLORS[first], RESISTOR_COLORS[second], RESISTOR_MULTIPLIER_COLORS[String(exponent)] || '#f4f4ef', '#c79a32'];
}

function formatResistance(value, compact = false) {
  if (value >= 1e6) return `${Number((value / 1e6).toPrecision(3))}${compact ? 'M' : ' MΩ'}`;
  if (value >= 1e3) return `${Number((value / 1e3).toPrecision(3))}${compact ? 'k' : ' kΩ'}`;
  return `${Number(value.toPrecision(3))}${compact ? '' : ' Ω'}`;
}

function parseResistance(value) {
  const normalized = String(value).trim().replace(/\s+/g, '').replace(/ohms?/i, '').replace(/Ω/g, '');
  const match = normalized.match(/^(\d*\.?\d+)([kKmM]?)$/);
  if (!match) return null;
  const multiplier = match[2].toLowerCase() === 'k' ? 1e3 : match[2].toLowerCase() === 'm' ? 1e6 : 1;
  const parsed = Number(match[1]) * multiplier;
  return Number.isFinite(parsed) && parsed >= 0.01 && parsed <= 1e9 ? parsed : null;
}

function paintResistorBandPreview(value) {
  const colors = resistorBandColors(value);
  resistorBandPreview.replaceChildren();
  colors.forEach((color, index) => {
    const band = document.createElement('span');
    band.className = `resistor-band-swatch${index === 3 ? ' tolerance' : ''}`;
    band.style.backgroundColor = color;
    band.title = ['First digit', 'Second digit', 'Multiplier', '±5% tolerance'][index];
    resistorBandPreview.append(band);
  });
  resistorSummary.textContent = `Color code for ${formatResistance(value)} · gold tolerance band ±5%`;
}

function updateResistorArtwork(group, value) {
  group._resistorBandNodes?.forEach((node) => node.destroy());
  const colors = resistorBandColors(value);
  const xs = [57, 69, 81, 101];
  group._resistorBandNodes = colors.map((color, index) => {
    const band = new Konva.Rect({ x: xs[index], y: 15, width: index === 3 ? 6 : 7, height: 30, fill: color, listening: false });
    group.add(band);
    return band;
  });
  group.resistanceOhms = value;
  if (group.getLayer()) group.moveToTop();
  group.selBox.moveToTop();
  layer.batchDraw();
}

function openResistorEditor(group) {
  editingResistor = group;
  resistorValueInput.value = formatResistance(group.resistanceOhms || 220, true);
  resistorValueInput.setCustomValidity('');
  paintResistorBandPreview(group.resistanceOhms || 220);
  resistorDialog.showModal();
  resistorValueInput.focus();
  resistorValueInput.select();
}

resistorValueInput.addEventListener('input', () => {
  const value = parseResistance(resistorValueInput.value);
  resistorValueInput.setCustomValidity(value ? '' : 'Enter a resistance such as 220, 4.7k, or 1M.');
  if (value) paintResistorBandPreview(value);
});
resistorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = parseResistance(resistorValueInput.value);
  if (!value) { resistorValueInput.reportValidity(); return; }
  if (editingResistor) {
    updateResistorArtwork(editingResistor, value);
    queueSave();
  }
  editingResistor = null;
  resistorDialog.close();
});
[document.getElementById('resistor-cancel'), document.getElementById('resistor-cancel-bottom')].forEach((button) => button.addEventListener('click', () => resistorDialog.close()));
resistorForm.addEventListener('reset', () => { editingResistor = null; });
resistorDialog.addEventListener('click', (event) => { if (event.target === resistorDialog) resistorDialog.close(); });
resistorDialog.addEventListener('close', () => { editingResistor = null; });
const TRAY_COLLAPSED_KEY = 'circuit-sketcher.parts-collapsed';
const tray = document.getElementById('tray');
const trayToggle = document.getElementById('tray-toggle');
function setCustomPartDrawer(open) {
  customPartDrawer.classList.toggle('is-open', open);
  customPartDrawer.setAttribute('aria-hidden', String(!open));
  customPartToggle.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => customPartName.focus());
}
customPartToggle.addEventListener('click', () => setCustomPartDrawer(!customPartDrawer.classList.contains('is-open')));
customPartClose.addEventListener('click', () => setCustomPartDrawer(false));
customPartDrawer.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setCustomPartDrawer(false);
    customPartToggle.focus();
  }
});
const savedTrayState = localStorage.getItem(TRAY_COLLAPSED_KEY) === 'true';
if (savedTrayState) tray.classList.add('is-collapsed');
trayToggle.setAttribute('aria-expanded', String(!savedTrayState));
trayToggle.setAttribute('aria-label', savedTrayState ? 'Expand parts panel' : 'Collapse parts panel');
trayToggle.title = savedTrayState ? 'Expand parts panel' : 'Collapse parts panel';
trayToggle.textContent = savedTrayState ? '›' : '‹';
trayToggle.addEventListener('click', () => {
  const collapsed = tray.classList.toggle('is-collapsed');
  localStorage.setItem(TRAY_COLLAPSED_KEY, String(collapsed));
  trayToggle.setAttribute('aria-expanded', String(!collapsed));
  trayToggle.setAttribute('aria-label', collapsed ? 'Expand parts panel' : 'Collapse parts panel');
  trayToggle.title = collapsed ? 'Expand parts panel' : 'Collapse parts panel';
  trayToggle.textContent = collapsed ? '›' : '‹';
  window.dispatchEvent(new Event('resize'));
});
let saveTimer = null;
let instanceSequence = 0;
let undoHistory = [];
let redoHistory = [];
let replayingHistory = false;

const stage = new Konva.Stage({
  container: 'stage',
  width: wrap.clientWidth,
  height: wrap.clientHeight,
});
const wireLayer = new Konva.Layer(); // wires sit under the parts
const layer = new Konva.Layer();     // parts
const overlay = new Konva.Layer();   // wire being drawn + node handles
stage.add(wireLayer, layer, overlay);
const selectionMarquee = new Konva.Rect({
  visible: false,
  listening: false,
  fill: 'rgba(47, 111, 176, 0.12)',
  stroke: '#2f6fb0',
  strokeWidth: 1,
  dash: [5, 4],
});
overlay.add(selectionMarquee);

window.addEventListener('resize', () => {
  stage.size({ width: wrap.clientWidth, height: wrap.clientHeight });
});

const library = new Map(); // component id -> definition
const builtInPartIds = new Set();
const customPartIds = new Set();
const notes = [];
let selectedNote = null;
let editingNote = null;
let selected = null;
const selectedComponents = new Set();

const isTyping = (e) => e.target.matches && e.target.matches('input, textarea, [contenteditable]');

// Side a pin's label sits on: explicit `side`, else the nearest edge.
function resolveSide(pin, size) {
  if (pin.side) return pin.side;
  const dist = {
    left: pin.x,
    right: size.width - pin.x,
    top: pin.y,
    bottom: size.height - pin.y,
  };
  return Object.keys(dist).reduce((a, b) => (dist[a] <= dist[b] ? a : b));
}

// Keep labels clear of the part and prevent long pin names from colliding.
function layoutLabels(group) {
  const rotation = ((group.rotation() % 360) + 360) % 360;
  const turned = rotation === 90 || rotation === 270;
  const crowdedSides = new Set();

  if (turned) {
    const bySide = new Map();
    group.labels.forEach((entry) => {
      const entries = bySide.get(entry.side) || [];
      entries.push(entry);
      bySide.set(entry.side, entries);
    });
    bySide.forEach((entries, side) => {
      const horizontalRow = (side === 'top' || side === 'bottom') !== turned;
      const coordinate = (entry) => side === 'left' || side === 'right' ? entry.pin.y : entry.pin.x;
      entries.sort((a, b) => coordinate(a) - coordinate(b));
      for (let i = 1; i < entries.length; i += 1) {
        const previous = entries[i - 1];
        const current = entries[i];
        const previousExtent = horizontalRow ? previous.node.width() : previous.node.height();
        const currentExtent = horizontalRow ? current.node.width() : current.node.height();
        if (coordinate(current) - coordinate(previous) < (previousExtent + currentExtent) / 2 + 3) {
          crowdedSides.add(side);
          break;
        }
      }
    });
  }

  group.labels.forEach(({ node, pin, side }) => {
    // When upright labels would overlap on a rotated pin row, let those labels
    // turn with the board. Their narrow height then fits between adjacent pins.
    const followRotation = turned && crowdedSides.has(side);
    const horizontal = (side === 'left' || side === 'right') !== turned;
    const outwardExtent = followRotation
      ? (side === 'left' || side === 'right' ? node.width() : node.height())
      : (horizontal ? node.width() : node.height());
    const dist = 9 + outwardExtent / 2;
    node.position({ x: pin.x + OUT[side].x * dist, y: pin.y + OUT[side].y * dist });
    node.rotation(followRotation ? 0 : -rotation);
  });
}

function select(group) {
  selectedComponents.forEach((item) => item.selBox.visible(false));
  if (selectedNote) selectedNote.noteRect.stroke('#e6dfc6');
  selectedNote = null;
  selectedComponents.clear();
  selected = group;
  if (group) {
    selectedComponents.add(group);
    group.selBox.visible(true);
  }
  layer.batchDraw();
  overlay.batchDraw();
}

function setSelectedComponents(groups, additive = false) {
  if (!additive) select(null);
  if (selectedNote) selectedNote.noteRect.stroke('#e6dfc6');
  selectedNote = null;
  groups.forEach((group) => {
    selectedComponents.add(group);
    group.selBox.visible(true);
    selected = group;
  });
  if (!selectedComponents.size) selected = null;
  layer.batchDraw();
  overlay.batchDraw();
}

function createNote(text, x, y) {
  const cardWidth = 240;
  const group = new Konva.Group({ x, y, draggable: true, name: 'note' });
  const textNode = new Konva.Text({
    x: 16, y: 39, text, width: cardWidth - 32,
    fontSize: 14, lineHeight: 1.45, fontFamily: 'system-ui, sans-serif',
    fill: '#35444b', listening: false,
  });
  const cardHeight = Math.max(102, textNode.height() + 56);
  const rect = new Konva.Rect({
    x: 0, y: 0, width: cardWidth, height: cardHeight,
    fill: '#fffdf5', stroke: '#e6dfc6', strokeWidth: 1,
    cornerRadius: 12, shadowColor: '#34434a', shadowBlur: 14,
    shadowOffset: { x: 0, y: 5 }, shadowOpacity: 0.14,
  });
  const accent = new Konva.Rect({
    x: 0, y: 0, width: cardWidth, height: 5,
    fill: '#e7b94b', cornerRadius: [12, 12, 0, 0], listening: false,
  });
  const divider = new Konva.Line({
    points: [16, 31, cardWidth - 16, 31],
    stroke: '#eee7d4', strokeWidth: 1, listening: false,
  });
  const heading = new Konva.Text({
    x: 16, y: 12, text: 'NOTE',
    fontSize: 9, fontStyle: 'bold', letterSpacing: 1.2,
    fontFamily: 'system-ui, sans-serif', fill: '#9a7831', listening: false,
  });
  const marker = new Konva.Circle({
    x: cardWidth - 17, y: 17, radius: 4, fill: '#e7b94b', listening: false,
  });
  group.add(rect, accent, divider, heading, marker, textNode);
  group.noteText = textNode;
  group.noteRect = rect;
  group.on('mousedown touchstart', () => {
    if (isDrawing()) return;
    select(null);
    selectedNote = group;
    rect.stroke('#327bb5');
    rect.strokeWidth(2);
    overlay.batchDraw();
  });
  group.on('dragmove', queueSave);
  group.on('dblclick dbltap', (e) => {
    e.cancelBubble = true;
    openNoteDialog(group);
  });
  overlay.add(group);
  notes.push(group);
  overlay.batchDraw();
  queueSave();
  return group;
}
function rotateSelected() {
  if (!selectedComponents.size) return;
  selectedComponents.forEach((group) => {
    group.rotation((group.rotation() + 90) % 360);
    layoutLabels(group);
  });
  updateWiresFor(); // wires re-read the pins' new canvas positions
  layer.batchDraw();
  queueSave();
}

// Build one draggable instance of a component definition with its top-left at (x, y).
function createComponent(def, x, y, instanceId = newInstanceId(), savedProperties = {}) {
  const { width: w, height: h } = def.size;
  // The group's position and pivot are the part's centre, so 90° turns happen in place.
  const group = new Konva.Group({
    x: x + w / 2,
    y: y + h / 2,
    offsetX: w / 2,
    offsetY: h / 2,
    draggable: true,
    name: 'component',
  });
  group.setAttrs({ defId: def.id, instanceId });
  group.labels = [];
  group.selBox = new Konva.Rect({
    x: -8, y: -8, width: w + 16, height: h + 16,
    stroke: '#2f6fb0', strokeWidth: 1.5, dash: [5, 4],
    visible: false, listening: false,
  });
  group.add(group.selBox);

  // Body
  const v = def.visual;
  if (v.type === 'path') {
    group.add(new Konva.Path({
      data: v.d,
      fill: v.fill || '#cfd8dc',
      stroke: v.stroke || '#37474f',
      strokeWidth: v.strokeWidth ?? 2,
    }));
  } else if (v.type === 'image') {
    const body = new Konva.Image({ width: w, height: h });
    group.add(body);
    const img = new Image();
    img.onload = () => { body.image(img); layer.batchDraw(); };
    img.src = v.src;
  }

  if (def.id === RESISTOR_ID) {
    updateResistorArtwork(group, Number.isFinite(savedProperties.resistanceOhms) ? savedProperties.resistanceOhms : (def.defaultResistanceOhms || 220));
  }

  // Pins: positions are relative to the group, so they follow every drag and rotation.
  def.pins.forEach((pin) => {
    const dot = new Konva.Circle({
      x: pin.x,
      y: pin.y,
      radius: 4,
      fill: PIN_COLORS[pin.type] || PIN_COLORS.other,
      stroke: '#ffffff',
      strokeWidth: 1.5,
      hitStrokeWidth: pin.hitStrokeWidth ?? 14,
      name: 'pin',
      pinId: pin.id,
    });
    // Cancelling the bubble stops the part from dragging; the pin works with wires instead.
    dot.on('mousedown touchstart', (e) => { e.cancelBubble = true; startWire(dot); });
    dot.on('mouseenter', () => { stage.container().style.cursor = 'crosshair'; });
    dot.on('mouseleave', () => { stage.container().style.cursor = 'move'; });
    group.add(dot);

    if (pin.label !== false) {
      const label = new Konva.Text({
        text: pin.label ?? pin.id,
        fontSize: 11,
        fontStyle: 'bold',
        fontFamily: 'system-ui, sans-serif',
        fill: '#10212b',
        shadowColor: '#ffffff',
        shadowBlur: 2,
        shadowOpacity: 0.95,
        listening: false,
      });
      label.offset({ x: label.width() / 2, y: label.height() / 2 });
      group.add(label);
      group.labels.push({ node: label, pin, side: resolveSide(pin, def.size) });
    }
  });
  layoutLabels(group);

  group.on('mousedown touchstart', (event) => {
    if (isDrawing()) return;
    if (event.evt?.shiftKey) setSelectedComponents([group], true);
    else if (!selectedComponents.has(group)) select(group);
    pinWire(null);
  });
  group.on('dragstart', () => group.moveToTop());
  group.on('dragstart', () => {
    group._multiDragOrigin = { x: group.x(), y: group.y() };
    group._multiDragMembers = [...selectedComponents]
      .filter((item) => item !== group)
      .map((item) => ({ item, x: item.x(), y: item.y() }));
  });
  group.on('dragmove', () => {
    const origin = group._multiDragOrigin;
    if (origin) {
      const dx = group.x() - origin.x;
      const dy = group.y() - origin.y;
      group._multiDragMembers?.forEach(({ item, x, y }) => item.position({ x: x + dx, y: y + dy }));
    }
    updateWiresFor();
    queueSave();
  });
  group.on('dragend', () => { group._multiDragOrigin = null; group._multiDragMembers = null; });
  group.on('mouseenter', () => { stage.container().style.cursor = 'move'; });
  group.on('mouseleave', () => { stage.container().style.cursor = 'default'; });
  if (def.id === RESISTOR_ID) group.on('dblclick dbltap', (event) => { event.cancelBubble = true; openResistorEditor(group); });

  layer.add(group);
  layer.batchDraw();
  return group;
}

let panState = null;
let selectionDrag = null;
let spaceHeld = false;
function pointerInContainer(evt) {
  const point = evt.touches?.[0] || evt.changedTouches?.[0] || evt;
  const bounds = stage.container().getBoundingClientRect();
  return { x: point.clientX - bounds.left, y: point.clientY - bounds.top };
}
function stopPan() {
  if (!panState) return;
  panState = null;
  stage.container().style.cursor = 'grab';
  queueSave();
}
function finishSelectionDrag() {
  if (!selectionDrag) return;
  const drag = selectionDrag;
  selectionDrag = null;
  selectionMarquee.visible(false);
  stage.container().style.cursor = 'grab';
  const distance = Math.hypot(drag.lastScreen.x - drag.startScreen.x, drag.lastScreen.y - drag.startScreen.y);
  if (distance < 4) {
    if (!drag.additive) select(null);
    overlay.batchDraw();
    return;
  }
  const box = {
    left: Math.min(drag.start.x, drag.current.x),
    top: Math.min(drag.start.y, drag.current.y),
    right: Math.max(drag.start.x, drag.current.x),
    bottom: Math.max(drag.start.y, drag.current.y),
  };
  const matches = layer.find('.component').filter((group) => {
    const bounds = group.getClientRect({ relativeTo: layer });
    return bounds.x <= box.right && bounds.x + bounds.width >= box.left &&
      bounds.y <= box.bottom && bounds.y + bounds.height >= box.top;
  });
  setSelectedComponents(matches, drag.additive);
  overlay.batchDraw();
}

stage.on('mousedown touchstart', (event) => {
  if (event.target !== stage || isDrawing()) return;
  const evt = event.evt;
  const isTouch = evt.type?.startsWith('touch');
  const usePan = isTouch || spaceHeld || evt.button === 1;
  const point = stage.getPointerPosition();
  if (!point) return;
  if (usePan) {
    panState = { pointer: point, x: stage.x(), y: stage.y() };
    stage.container().style.cursor = 'grabbing';
    return;
  }
  if (evt.button !== undefined && evt.button !== 0) return;
  const additive = Boolean(evt.shiftKey);
  if (!additive) select(null);
  const screen = pointerInContainer(evt);
  selectionDrag = { start: layer.getRelativePointerPosition(), current: layer.getRelativePointerPosition(), startScreen: screen, lastScreen: screen, additive };
  selectionMarquee.position(selectionDrag.start);
  selectionMarquee.size({ width: 0, height: 0 });
  selectionMarquee.visible(true);
  stage.container().style.cursor = 'crosshair';
  overlay.batchDraw();
});
stage.on('mousemove touchmove', (event) => {
  if (panState) {
    const point = stage.getPointerPosition();
    if (!point) return;
    stage.position({
      x: panState.x + point.x - panState.pointer.x,
      y: panState.y + point.y - panState.pointer.y,
    });
    stage.batchDraw();
    return;
  }
  if (!selectionDrag) return;
  const point = layer.getRelativePointerPosition();
  if (!point) return;
  selectionDrag.current = point;
  selectionDrag.lastScreen = pointerInContainer(event.evt);
  selectionMarquee.position({
    x: Math.min(selectionDrag.start.x, point.x),
    y: Math.min(selectionDrag.start.y, point.y),
  });
  selectionMarquee.size({
    width: Math.abs(point.x - selectionDrag.start.x),
    height: Math.abs(point.y - selectionDrag.start.y),
  });
  overlay.batchDraw();
});
stage.on('mouseup touchend touchcancel', () => { stopPan(); finishSelectionDrag(); });
window.addEventListener('mouseup', () => { stopPan(); finishSelectionDrag(); });
window.addEventListener('touchend', () => { stopPan(); finishSelectionDrag(); });
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !isTyping(event)) {
    spaceHeld = true;
    event.preventDefault();
  }
});
window.addEventListener('keyup', (event) => { if (event.code === 'Space') spaceHeld = false; });
window.addEventListener('blur', () => { spaceHeld = false; stopPan(); finishSelectionDrag(); });
stage.container().style.cursor = 'grab';
function updateZoomLabel() {
  zoomLevel.value = `${Math.round(stage.scaleX() * 100)}%`;
  zoomLevel.textContent = zoomLevel.value;
}
function zoomAt(factor, pointer = { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 }) {
  const oldScale = stage.scaleX();
  const newScale = Math.max(0.3, Math.min(3.5, oldScale * factor));
  const local = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
  stage.scale({ x: newScale, y: newScale });
  stage.position({ x: pointer.x - local.x * newScale, y: pointer.y - local.y * newScale });
  updateZoomLabel();
  stage.batchDraw();
  queueSave();
}
stage.container().addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, pointerInContainer(e));
}, { passive: false });
zoomOutButton.addEventListener('click', () => zoomAt(1 / 1.2));
zoomInButton.addEventListener('click', () => zoomAt(1.2));
resetViewButton.addEventListener('click', () => {
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  updateZoomLabel();
  stage.batchDraw();
  queueSave();
});

window.addEventListener('keydown', (e) => {
  const typing = isTyping(e);
  if (!typing && (e.ctrlKey || e.metaKey) && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (key === 'y') {
      e.preventDefault();
      redo();
      return;
    }
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.toLowerCase() === 'r') rotateSelected();
  else if ((e.key === 'Delete' || e.key === 'Backspace') && !isDrawing()) deleteSelected();
});

function deleteSelected() {
  if (selectedNote) {
    const note = selectedNote;
    selectedNote = null;
    notes.splice(notes.indexOf(note), 1);
    note.destroy();
    overlay.batchDraw();
    queueSave();
    return;
  }
  if (!selectedComponents.size) return;
  const removed = [...selectedComponents];
  removed.forEach(removeWiresFor);
  removed.forEach((group) => group.destroy());
  selectedComponents.clear();
  selected = null;
  layer.batchDraw();
  queueSave();
}

// ---- parts library (tray) ---------------------------------------------------

const trayList = document.getElementById('tray-list');
const searchInput = document.getElementById('part-search');
const categoryFilters = document.getElementById('category-filters');
const partDetails = document.getElementById('part-details');
const SVG_NS = 'http://www.w3.org/2000/svg';
let spawnCount = 0;
let activeCategory = 'all';
let hiddenPartIds = new Set();
let pendingPartRemoval = null;
let resistorPointerDrag = null;

document.addEventListener('pointermove', (event) => {
  const drag = resistorPointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8;
  if (!drag.active && (!moved || event.clientX < tray.getBoundingClientRect().right)) return;
  if (!drag.active) {
    drag.active = true;
    const preview = document.createElement('div');
    preview.className = 'part-drag-preview';
    const image = drag.thumb.cloneNode(true);
    const label = document.createElement('span');
    label.textContent = drag.def.name;
    preview.append(image, label);
    document.body.append(preview);
    drag.preview = preview;
  }
  event.preventDefault();
  drag.preview.style.left = `${event.clientX + 12}px`;
  drag.preview.style.top = `${event.clientY + 12}px`;
}, { passive: false });

document.addEventListener('pointerup', (event) => {
  const drag = resistorPointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (drag.active) {
    const bounds = wrap.getBoundingClientRect();
    if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
      addPart(drag.def, event.clientX - bounds.left - drag.def.size.width / 2, event.clientY - bounds.top - drag.def.size.height / 2);
    }
    drag.suppressClick();
    event.preventDefault();
  }
  drag.preview?.remove();
  resistorPointerDrag = null;
});

document.addEventListener('pointercancel', (event) => {
  if (resistorPointerDrag?.pointerId !== event.pointerId) return;
  resistorPointerDrag.preview?.remove();
  resistorPointerDrag = null;
});

removePartConfirmButton.addEventListener('click', () => {
  if (!pendingPartRemoval) return;
  hiddenPartIds.add(pendingPartRemoval.id);
  partDetails.hidden = true;
  renderTray();
  saveCircuit(false);
  removePartDialog.close();
});
removePartCancelButton.addEventListener('click', () => removePartDialog.close());
removePartDialog.addEventListener('click', (event) => {
  if (event.target === removePartDialog) removePartDialog.close();
});
removePartDialog.addEventListener('close', () => { pendingPartRemoval = null; });

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// Small preview of a part. Built with DOM calls, since part data may later come from pasted JSON.
function makeThumb(def) {
  const { width: w, height: h } = def.size;
  const svg = svgEl('svg', { viewBox: `-8 -8 ${w + 16} ${h + 16}` });
  const v = def.visual;
  if (v.type === 'path') {
    svg.append(svgEl('path', {
      d: v.d, fill: v.fill || '#cfd8dc', stroke: v.stroke || '#37474f', 'stroke-width': v.strokeWidth ?? 2,
    }));
  } else if (v.type === 'image') {
    svg.append(svgEl('image', { href: v.src, width: w, height: h }));
  }
  if (def.id === RESISTOR_ID) {
    const xs = [57, 69, 81, 101];
    resistorBandColors(def.defaultResistanceOhms || 220).forEach((color, index) => {
      svg.append(svgEl('rect', { x: xs[index], y: 15, width: index === 3 ? 6 : 7, height: 30, fill: color }));
    });
  }  def.pins.forEach((p) => svg.append(svgEl('circle', {
    cx: p.x, cy: p.y, r: 4, fill: PIN_COLORS[p.type] || PIN_COLORS.other, stroke: '#fff', 'stroke-width': 1.5,
  })));
  return svg;
}

function addPart(def, x, y) {
  const group = createComponent(def, x, y);
  select(group);
  pinWire(null);
  queueSave();
}

function renderCategoryFilters() {
  categoryFilters.replaceChildren();
  const categories = new Map();
  library.forEach((def) => {
    if (hiddenPartIds.has(def.id)) return;
    const label = String(def.category || 'Other').trim() || 'Other';
    const key = label.toLocaleLowerCase();
    if (!categories.has(key)) categories.set(key, label);
  });
  const options = [['all', 'All'], ...[...categories.entries()].sort((a, b) => a[1].localeCompare(b[1]))];
  options.forEach(([key, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-chip';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(activeCategory === key));
    button.addEventListener('click', () => {
      activeCategory = key;
      partDetails.hidden = true;
      renderTray();
    });
    categoryFilters.append(button);
  });
}

function showPartDetails(def) {
  partDetails.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'part-details-heading';
  const titleBlock = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = def.name;
  const category = document.createElement('span');
  category.textContent = def.category || 'Other';
  titleBlock.append(title, category);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'part-details-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close part details');
  close.addEventListener('click', () => { partDetails.hidden = true; });
  heading.append(titleBlock, close);

  const infoHeading = document.createElement('h4');
  infoHeading.textContent = 'Useful information';
  const infoList = document.createElement('ul');
  infoList.className = 'part-info-list';
  const infoItems = Array.isArray(def.info) ? def.info : [];
  if (!infoItems.length) {
    const empty = document.createElement('p');
    empty.className = 'part-info-empty';
    empty.textContent = 'No usage notes have been added for this part yet.';
    partDetails.append(heading, infoHeading, empty);
  } else {
    infoItems.forEach((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      infoList.append(item);
    });
    partDetails.append(heading, infoHeading, infoList);
  }
  partDetails.hidden = false;
}
function renderTray() {
  trayList.replaceChildren();
  renderCategoryFilters();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const matches = [...library.values()].filter((def) => !hiddenPartIds.has(def.id)).filter((def) => {
    const category = String(def.category || 'Other').trim().toLocaleLowerCase();
    const categoryMatches = activeCategory === 'all' || category === activeCategory;
    const queryMatches = [def.name, def.category, def.id]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(query));
    return categoryMatches && queryMatches;
  });

  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = query ? `No parts match “${searchInput.value.trim()}” in this category.` : 'No parts in this category yet.';
    trayList.append(empty);
    return;
  }

  matches.forEach((def) => {
    const item = document.createElement('div');
    item.className = 'part';
    item.dataset.partId = def.id;
    item.draggable = true;

    const thumb = makeThumb(def);
    const name = document.createElement('b');
    name.textContent = def.name;
    item.append(thumb, name);
    const category = document.createElement('small');
    category.textContent = def.id === RESISTOR_ID ? '220 Ω · double-click to edit' : (def.category || 'Other');
    item.append(category);
    const detailsButton = document.createElement('button');
    detailsButton.type = 'button';
    detailsButton.className = 'part-details-btn';
    detailsButton.textContent = 'View pins & details';
    detailsButton.addEventListener('click', (event) => {
      event.stopPropagation();
      showPartDetails(def);
    });
    const actions = document.createElement('div');
    actions.className = 'part-card-actions';
    actions.append(detailsButton);
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'part-remove-btn';
    removeButton.textContent = 'Remove';
    removeButton.title = 'Remove from the parts list (undo to restore)';
    removeButton.setAttribute('aria-label', `Remove ${def.name} from the parts list`);
    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      pendingPartRemoval = def;
      removePartMessage.textContent = `Remove “${def.name}” from the parts list? Copies already on the board will stay there.`;
      removePartDialog.showModal();
    });
    actions.append(removeButton);
    item.append(actions);

    item.addEventListener('dragstart', (e) => {
      if (e.target.closest('button')) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', def.id);
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setDragImage(thumb, thumb.clientWidth / 2, thumb.clientHeight / 2);
    });
    // Click adds near the middle of the canvas (also the way to add parts on touch screens).
    let suppressClickUntil = 0;
    item.addEventListener('click', () => {
      if (Date.now() < suppressClickUntil) return;
      const step = (spawnCount++ % 8) * 24;
      addPart(def,
        (wrap.clientWidth - def.size.width) / 2 + step,
        (wrap.clientHeight - def.size.height) / 2 + step);
    });
    if (def.id === RESISTOR_ID) {
      item.draggable = false;
      item.style.touchAction = 'pan-y';
      item.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button') || event.button > 0) return;
        resistorPointerDrag = {
          def, item, thumb, pointerId: event.pointerId,
          startX: event.clientX, startY: event.clientY, active: false, preview: null,
          suppressClick: () => { suppressClickUntil = Date.now() + 500; },
        };
      });
    }
    trayList.append(item);
  });
}
searchInput.addEventListener('input', () => {
  partDetails.hidden = true;
  renderTray();
});

wrap.addEventListener('dragover', (e) => e.preventDefault());
wrap.addEventListener('drop', (e) => {
  e.preventDefault();
  const def = library.get(e.dataTransfer.getData('text/plain'));
  if (!def) return;
  const r = wrap.getBoundingClientRect();
  addPart(def, e.clientX - r.left - def.size.width / 2, e.clientY - r.top - def.size.height / 2);
});

function newInstanceId() {
  instanceSequence += 1;
  return window.crypto?.randomUUID?.() || `part-${Date.now()}-${instanceSequence}`;
}

function currentCircuit() {
  const components = layer.find('.component').map((group) => {
    const def = library.get(group.getAttr('defId'));
    return {
      instanceId: group.getAttr('instanceId'),
      id: def.id,
      x: group.x() - def.size.width / 2,
      y: group.y() - def.size.height / 2,
      rotation: group.rotation(),
      ...(def.id === RESISTOR_ID ? { resistanceOhms: group.resistanceOhms } : {}),
    };
  });
  return {
    format: 'circuit-sketcher',
    version: 4,
    title: circuitTitle.value.trim() || 'Untitled circuit',
    customParts: [...customPartIds].map((id) => library.get(id)),
    hiddenParts: [...hiddenPartIds],
    components,
    notes: notes.map((note) => ({ text: note.noteText.text(), x: note.x(), y: note.y() })),
    viewport: { scale: stage.scaleX(), x: stage.x(), y: stage.y() },
    wireColor: getWireColorPreference(),
    wires: wires.map((wire) => ({
      id: wire.id,
      color: wire.color,
      from: serializeEndpoint(wire.from),
      to: serializeEndpoint(wire.to),
      nodes: wire.nodes.map((node) => ({ x: node.x, y: node.y, ...(node.junctionId ? { junctionId: node.junctionId } : {}) })),
    })),
  };
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', error);
}

function queueSave() {
  clearTimeout(saveTimer);
  if (!replayingHistory) undoButton.disabled = false;
  updateWiringCheckIndicator();
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveCircuit(false);
  }, 350);
}

function saveCircuit(showMessage = true) {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const snapshot = JSON.stringify(currentCircuit());
    if (!replayingHistory) recordHistorySnapshot(snapshot);
    localStorage.setItem(STORAGE_KEY, snapshot);
    setStatus(showMessage ? 'Saved in this browser' : 'Autosaved');
  } catch (err) {
    setStatus(`Could not save locally: ${err.message}`, true);
  }
}

function updateHistoryButtons() {
  undoButton.disabled = undoHistory.length < 2;
  redoButton.disabled = redoHistory.length === 0;
}

function resetUndoHistory() {
  undoHistory = [JSON.stringify(currentCircuit())];
  redoHistory = [];
  updateHistoryButtons();
}

function recordHistorySnapshot(snapshot) {
  if (undoHistory[undoHistory.length - 1] === snapshot) {
    updateHistoryButtons();
    return;
  }
  undoHistory.push(snapshot);
  if (undoHistory.length > HISTORY_LIMIT) undoHistory.shift();
  redoHistory = [];
  updateHistoryButtons();
}

function applyHistorySnapshot(snapshot, message) {
  replayingHistory = true;
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    restoreCircuit(JSON.parse(snapshot));
    localStorage.setItem(STORAGE_KEY, snapshot);
    setStatus(message);
  } catch (err) {
    setStatus(`Could not restore history: ${err.message}`, true);
  } finally {
    clearTimeout(saveTimer);
    saveTimer = null;
    replayingHistory = false;
    updateHistoryButtons();
  }
}

function undo() {
  if (saveTimer !== null) saveCircuit(false);
  if (undoHistory.length < 2) return;
  redoHistory.push(undoHistory.pop());
  applyHistorySnapshot(undoHistory[undoHistory.length - 1], 'Undid last change');
}

function redo() {
  if (saveTimer !== null) saveCircuit(false);
  if (!redoHistory.length) return;
  const snapshot = redoHistory.pop();
  undoHistory.push(snapshot);
  applyHistorySnapshot(snapshot, 'Redid change');
}

undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value) {
  return (value.trim() || 'circuit').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 80);
}

function exportBom() {
  const counts = new Map();
  layer.find('.component').forEach((group) => {
    const def = library.get(group.getAttr('defId'));
    if (def) counts.set(def.id, (counts.get(def.id) || 0) + 1);
  });
  const rows = [['Part', 'Part ID', 'Category', 'Quantity']];
  [...counts.entries()]
    .map(([id, quantity]) => ({ def: library.get(id), quantity }))
    .sort((a, b) => a.def.name.localeCompare(b.def.name))
    .forEach(({ def, quantity }) => rows.push([def.name, def.id, def.category || '', quantity]));
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeFilename(circuitTitle.value)}-bom.csv`);
  setStatus(`Exported BOM (${counts.size} part ${counts.size === 1 ? 'type' : 'types'})`);
}

function wiringWarnings() {
  const parent = new Map();
  const pinEndpoints = new Map();
  const find = (key) => {
    if (!parent.has(key)) parent.set(key, key);
    if (parent.get(key) !== key) parent.set(key, find(parent.get(key)));
    return parent.get(key);
  };
  const union = (a, b) => {
    const rootA = find(a), rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  wires.forEach((wire) => {
    const endpoints = [wire.from, wire.to];
    wire.nodes.forEach((node) => {
      if (node.junctionId) endpoints.push({ kind: 'junction', wireId: wire.id, nodeId: node.junctionId });
    });
    const keys = endpoints.map(endpointKey);
    keys.forEach((key) => find(key));
    for (let i = 1; i < keys.length; i += 1) union(keys[0], keys[i]);
    endpoints.forEach((endpoint, i) => {
      if (!isJunctionEndpoint(endpoint)) pinEndpoints.set(keys[i], endpoint);
    });
  });

  const nets = new Map();
  pinEndpoints.forEach((endpoint, key) => {
    const root = find(key);
    if (!nets.has(root)) nets.set(root, []);
    nets.get(root).push(endpoint);
  });
  const warnings = new Map();
  nets.forEach((endpoints) => {
    const pins = endpoints.map((endpoint) => {
      const group = endpoint.getParent();
      const def = library.get(group.getAttr('defId'));
      const pin = def?.pins?.find((candidate) => candidate.id === endpoint.getAttr('pinId'));
      return { endpoint, group, def, pin };
    }).filter((item) => item.def && item.pin);
    const sources = pins.filter((item) => Number.isFinite(item.pin.maxOutputVoltage));
    const targets = pins.filter((item) => ['signal', 'data'].includes(item.pin.type) && Number.isFinite(item.def.gpioMaxInputVoltage));
    sources.forEach((source) => targets.forEach((target) => {
      if (source.endpoint === target.endpoint || source.group === target.group || source.pin.maxOutputVoltage <= target.def.gpioMaxInputVoltage) return;
      const key = `${source.group.getAttr('instanceId')}:${source.pin.id}:${target.group.getAttr('instanceId')}:${target.pin.id}`;
      warnings.set(key, `${source.def.name} ${source.pin.label} may output ${source.pin.maxOutputVoltage} V, while ${target.def.name} ${target.pin.label} uses ${target.def.gpioMaxInputVoltage} V logic. Add a voltage divider or level shifter.`);
    }));
  });
  return [...warnings.values()];
}

function updateWiringCheckIndicator() {
  if (!wiringChecksButton) return;
  const warnings = wiringWarnings();
  wiringCheckCount.textContent = String(warnings.length);
  wiringChecksButton.classList.toggle('has-warnings', warnings.length > 0);
  wiringChecksButton.setAttribute('aria-label', warnings.length
    ? `Wiring checks: ${warnings.length} possible voltage ${warnings.length === 1 ? 'mismatch' : 'mismatches'}`
    : 'Wiring checks: no known voltage conflicts');
  wiringChecksDialog.classList.toggle('has-warnings', warnings.length > 0);
  wiringChecksSummary.textContent = warnings.length
    ? `${warnings.length} possible voltage ${warnings.length === 1 ? 'mismatch needs' : 'mismatches need'} a closer look.`
    : 'No known voltage conflicts found.';
  wiringChecksList.replaceChildren(...warnings.map((warning) => {
    const item = document.createElement('li');
    item.textContent = warning;
    return item;
  }));
  wiringChecksList.hidden = warnings.length === 0;
}

function validateCircuit(data) {
  if (!data || data.format !== 'circuit-sketcher' || ![1, 2, 3, 4].includes(data.version) ||
      !Array.isArray(data.components) || !Array.isArray(data.wires) ||
      (data.version >= 2 && data.customParts !== undefined && !Array.isArray(data.customParts)) ||
      (data.version >= 3 && (!Array.isArray(data.customParts) || !Array.isArray(data.notes))) ||
      (data.wireColor !== undefined && data.wireColor !== null && !/^#[0-9a-f]{6}$/i.test(data.wireColor)) ||
      (data.hiddenParts !== undefined && (!Array.isArray(data.hiddenParts) || data.hiddenParts.some((id) => typeof id !== 'string'))) ||
      (data.viewport !== undefined && (!Number.isFinite(data.viewport.scale) || data.viewport.scale < 0.3 || data.viewport.scale > 3.5 ||
        !Number.isFinite(data.viewport.x) || !Number.isFinite(data.viewport.y)))) {
    throw new Error('This is not a supported Circuit Sketcher file.');
  }
  const definitions = new Map(library);
  const customDefs = (data.customParts || []).map(validatePartDefinition);
  const seenCustomIds = new Set();
  customDefs.forEach((def) => {
    if (builtInPartIds.has(def.id) || seenCustomIds.has(def.id)) {
      throw new Error(`Custom part ID “${def.id}” conflicts with an existing part.`);
    }
    seenCustomIds.add(def.id);
    definitions.set(def.id, def);
  });

  const savedNotes = data.notes || [];
  if (!Array.isArray(savedNotes) || savedNotes.length > 200 || savedNotes.some((note) =>
      !note || typeof note.text !== 'string' || !note.text.trim() || note.text.length > 2000 ||
      !Number.isFinite(note.x) || !Number.isFinite(note.y))) {
    throw new Error('The file contains invalid notes.');
  }

  const instances = new Map();
  data.components.forEach((component) => {
    const def = definitions.get(component.id);
    if (!def || typeof component.instanceId !== 'string' || !component.instanceId ||
        instances.has(component.instanceId) || !Number.isFinite(component.x) ||
        !Number.isFinite(component.y) || !Number.isFinite(component.rotation ?? 0)) {
      throw new Error('The file contains an unknown or invalid part.');
    }
    if (def.id === RESISTOR_ID && component.resistanceOhms !== undefined &&
        (!Number.isFinite(component.resistanceOhms) || component.resistanceOhms < 0.01 || component.resistanceOhms > 1e9)) {
      throw new Error('The file contains an invalid resistor value.');
    }
    instances.set(component.instanceId, def);
  });
  const savedWires = new Map();
  data.wires.forEach((wire, index) => {
    const id = wire.id || `legacy-wire-${index}`;
    if (typeof id !== 'string' || savedWires.has(id) || (data.version >= 4 && !wire.id)) {
      throw new Error('The file contains an invalid or duplicate wire ID.');
    }
    if (!Array.isArray(wire.nodes) || wire.nodes.length > 1000 || wire.nodes.some((node) =>
      !node || !Number.isFinite(node.x) || !Number.isFinite(node.y) ||
      (node.junctionId !== undefined && typeof node.junctionId !== 'string'))) {
      throw new Error('The file contains invalid wire nodes.');
    }
    if (wire.color !== undefined && (typeof wire.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(wire.color))) {
      throw new Error('The file contains an invalid wire color.');
    }
    savedWires.set(id, wire);
  });
  data.wires.forEach((wire) => {
    for (const endpoint of [wire.from, wire.to]) {
      if (endpoint?.kind === 'junction') {
        if (data.version < 4 || !savedWires.has(endpoint.wireId) || endpoint.wireId === wire.id ||
            !savedWires.get(endpoint.wireId).nodes.some((node) => node.junctionId === endpoint.nodeId)) {
          throw new Error('The file contains a wire with an invalid junction.');
        }
      } else {
        const def = instances.get(endpoint?.instanceId);
        if (!def || (endpoint.kind !== undefined && endpoint.kind !== 'pin') ||
            !def.pins.some((pin) => pin.id === endpoint.pinId)) {
          throw new Error('The file contains a wire with an invalid pin.');
        }
      }
    }
  });
  return customDefs;
}

function findPin(group, pinId) {
  let result = null;
  group.find('.pin').forEach((pin) => {
    if (pin.getAttr('pinId') === pinId) result = pin;
  });
  return result;
}

function restoreCircuit(data) {
  const customDefs = validateCircuit(data);
  customDefs.forEach((def) => {
    library.set(def.id, def);
    customPartIds.add(def.id);
  });
  renderTray();
  if (isDrawing()) finishWire(null);
  wires.slice().forEach(removeWire);
  notes.splice(0).forEach((note) => note.destroy());
  selectedNote = null;
  select(null);
  layer.find('.component').forEach((group) => group.destroy());

  const savedNotes = data.notes || [];
  if (!Array.isArray(savedNotes) || savedNotes.length > 200 || savedNotes.some((note) =>
      !note || typeof note.text !== 'string' || !note.text.trim() || note.text.length > 2000 ||
      !Number.isFinite(note.x) || !Number.isFinite(note.y))) {
    throw new Error('The file contains invalid notes.');
  }
  setWireColorPreference(data.wireColor ?? null);

  const instances = new Map();
  data.components.forEach((component) => {
    const def = library.get(component.id);
    const group = createComponent(def, component.x, component.y, component.instanceId, { resistanceOhms: component.resistanceOhms });
    group.rotation(component.rotation || 0);
    layoutLabels(group);
    instances.set(component.instanceId, group);
  });
  const pendingWires = data.wires.map((wire, index) => ({
    wire,
    id: wire.id || `legacy-wire-${index}`,
  }));
  while (pendingWires.length) {
    let restoredAny = false;
    for (let i = pendingWires.length - 1; i >= 0; i -= 1) {
      const { wire, id } = pendingWires[i];
      const resolve = (endpoint) => endpoint?.kind === 'junction'
        ? (wires.some((parent) => parent.id === endpoint.wireId && parent.nodes.some((node) => node.junctionId === endpoint.nodeId))
          ? { kind: 'junction', wireId: endpoint.wireId, nodeId: endpoint.nodeId } : null)
        : findPin(instances.get(endpoint.instanceId), endpoint.pinId);
      const from = resolve(wire.from), to = resolve(wire.to);
      if (!from || !to) continue;
      addWire(from, to, wire.nodes.map((node) => ({ x: node.x, y: node.y, ...(node.junctionId ? { junctionId: node.junctionId } : {}) })), id, false, wire.color);
      pendingWires.splice(i, 1);
      restoredAny = true;
    }
    if (!restoredAny) throw new Error('Could not restore a wire junction.');
  }
  (data.notes || []).forEach((note) => createNote(note.text, note.x, note.y));
  if (data.viewport) {
    stage.scale({ x: data.viewport.scale, y: data.viewport.scale });
    stage.position({ x: data.viewport.x, y: data.viewport.y });
    updateZoomLabel();
  } else {
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    updateZoomLabel();
  }
  hiddenPartIds = new Set(data.hiddenParts || []);
  renderTray();
  circuitTitle.value = data.title || 'Untitled circuit';
  layer.batchDraw();
  wireLayer.batchDraw();
  overlay.batchDraw();
  updateWiringCheckIndicator();
}

function exportPng() {
  const source = stage.toCanvas({ pixelRatio: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#eef2f4';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#d3dde2';
  context.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 40) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 40) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.drawImage(source, 0, 0);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${safeFilename(circuitTitle.value)}.png`);
    else setStatus('Could not export PNG', true);
  }, 'image/png');
}

saveButton.addEventListener('click', () => saveCircuit(true));
openButton.addEventListener('click', () => openFileInput.click());
openFileInput.addEventListener('change', async () => {
  const file = openFileInput.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    restoreCircuit(data);
    saveCircuit(false);
    setStatus(`Opened ${file.name}`);
  } catch (err) {
    setStatus(`Could not open file: ${err.message}`, true);
  } finally {
    openFileInput.value = '';
  }
});
exportJsonButton.addEventListener('click', () => {
  const json = JSON.stringify(currentCircuit(), null, 2);
  downloadBlob(new Blob([json], { type: 'application/json' }), `${safeFilename(circuitTitle.value)}.circuit.json`);
  setStatus('Circuit JSON exported');
});
exportPngButton.addEventListener('click', exportPng);
function validatePartDefinition(def) {
  if (!def || typeof def !== 'object' || !/^[a-zA-Z0-9._-]{1,64}$/.test(def.id || '') ||
      typeof def.name !== 'string' || !def.name.trim() || def.name.length > 100 ||
      (def.category !== undefined && typeof def.category !== 'string') ||
      (def.info !== undefined && (!Array.isArray(def.info) || def.info.length > 12 || def.info.some((item) => typeof item !== 'string' || item.length > 300))) ||
      !def.size || !Number.isFinite(def.size.width) || !Number.isFinite(def.size.height) ||
      def.size.width < 16 || def.size.height < 16 || def.size.width > 1000 || def.size.height > 1000 ||
      !def.visual || def.visual.type !== 'path' || typeof def.visual.d !== 'string' ||
      !def.visual.d.trim() || def.visual.d.length > 20000 || !Array.isArray(def.pins) ||
      def.pins.length < 1 || def.pins.length > 100) {
    throw new Error('Part JSON needs an id, name, size, path visual, and 1–100 pins.');
  }
  const pinIds = new Set();
  const pins = def.pins.map((pin) => {
    if (!pin || typeof pin.id !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(pin.id) ||
        pinIds.has(pin.id) || !Number.isFinite(pin.x) || !Number.isFinite(pin.y) ||
        pin.x < -100 || pin.x > def.size.width + 100 || pin.y < -100 || pin.y > def.size.height + 100 ||
        (pin.label !== undefined && typeof pin.label !== 'string') ||
        (pin.side !== undefined && !['top', 'right', 'bottom', 'left'].includes(pin.side))) {
      throw new Error('Each pin needs a unique id and valid x/y positions.');
    }
    pinIds.add(pin.id);
    return { id: pin.id, label: pin.label || pin.id, x: pin.x, y: pin.y, side: pin.side, type: pin.type || 'other' };
  });
  if (def.visual.strokeWidth !== undefined &&
      (!Number.isFinite(def.visual.strokeWidth) || def.visual.strokeWidth < 0 || def.visual.strokeWidth > 20)) {
    throw new Error('Path strokeWidth must be between 0 and 20.');
  }
  return {
    id: def.id,
    name: def.name.trim(),
    category: def.category?.trim() || 'custom',
    info: Array.isArray(def.info) ? def.info.map((item) => item.trim()).filter(Boolean) : [],
    size: { width: def.size.width, height: def.size.height },
    visual: {
      type: 'path', d: def.visual.d,
      fill: typeof def.visual.fill === 'string' ? def.visual.fill : '#cfd8dc',
      stroke: typeof def.visual.stroke === 'string' ? def.visual.stroke : '#37474f',
      strokeWidth: def.visual.strokeWidth ?? 2,
    },
    pins,
  };
}

function customPartShapePath(shape, width, height) {
  const left = 12, top = 12, right = width - 12, bottom = height - 12;
  if (shape === 'rectangle') return `M${left} ${top}H${right}V${bottom}H${left}Z`;
  if (shape === 'circle') {
    const cx = width / 2, cy = height / 2, rx = (width - 24) / 2, ry = (height - 24) / 2;
    return `M${cx} ${top}C${cx + rx} ${top} ${right} ${cy - ry} ${right} ${cy}C${right} ${cy + ry} ${cx + rx} ${bottom} ${cx} ${bottom}C${cx - rx} ${bottom} ${left} ${cy + ry} ${left} ${cy}C${left} ${cy - ry} ${cx - rx} ${top} ${cx} ${top}Z`;
  }
  const radius = Math.min(14, (width - 24) / 4, (height - 24) / 4);
  return `M${left + radius} ${top}H${right - radius}Q${right} ${top} ${right} ${top + radius}V${bottom - radius}Q${right} ${bottom} ${right - radius} ${bottom}H${left + radius}Q${left} ${bottom} ${left} ${bottom - radius}V${top + radius}Q${left} ${top} ${left + radius} ${top}Z`;
}

function buildCustomPartDefinition() {
  const name = customPartName.value.trim();
  const width = Number(customPartWidth.value);
  const height = Number(customPartHeight.value);
  const labels = customPartPinLabels.value.split(',').map((label) => label.trim()).filter(Boolean);
  if (!name) throw new Error('Enter a part name.');
  if (!Number.isInteger(width) || width < 64 || width > 500 || !Number.isInteger(height) || height < 64 || height > 500) {
    throw new Error('Choose a width and height between 64 and 500.');
  }
  if (!labels.length || labels.length > 16) throw new Error('Add between 1 and 16 comma-separated pin labels.');
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!id) throw new Error('Use a name with at least one letter or number.');
  const pinSide = customPartPinSide.value;
  const pins = labels.map((label, index) => {
    const across = (index + 1) / (labels.length + 1);
    const x = pinSide === 'left' ? 12 : pinSide === 'right' ? width - 12 : 12 + (width - 24) * across;
    const y = pinSide === 'top' ? 12 : pinSide === 'bottom' ? height - 12 : 12 + (height - 24) * across;
    const pinId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `pin-${index + 1}`;
    return { id: pinId, label, x: Math.round(x), y: Math.round(y), side: pinSide, type: customPartPinType.value };
  });
  if (new Set(pins.map((pin) => pin.id)).size !== pins.length) throw new Error('Pin labels must be unique.');
  return {
    id,
    name,
    category: customPartCategory.value,
    size: { width, height },
    visual: { type: 'path', d: customPartShapePath(customPartShape.value, width, height), fill: customPartColor.value, stroke: '#34445a', strokeWidth: 2 },
    pins,
  };
}

function updateCustomPartPreview() {
  const width = Math.max(64, Math.min(500, Number(customPartWidth.value) || 160));
  const height = Math.max(64, Math.min(500, Number(customPartHeight.value) || 110));
  const labels = customPartPinLabels.value.split(',').map((label) => label.trim()).filter(Boolean).slice(0, 16);
  const side = customPartPinSide.value;
  customPartPreview.setAttribute('viewBox', `0 0 ${width} ${height}`);
  customPartPreviewBody.setAttribute('d', customPartShapePath(customPartShape.value, width, height));
  customPartPreviewBody.setAttribute('fill', customPartColor.value);
  customPartPreviewBody.setAttribute('stroke', '#34445a');
  customPartPreviewBody.setAttribute('stroke-width', '2');
  customPartPreviewPins.replaceChildren();
  labels.forEach((_, index) => {
    const across = (index + 1) / (labels.length + 1);
    const cx = side === 'left' ? 12 : side === 'right' ? width - 12 : 12 + (width - 24) * across;
    const cy = side === 'top' ? 12 : side === 'bottom' ? height - 12 : 12 + (height - 24) * across;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(cx)); circle.setAttribute('cy', String(cy)); circle.setAttribute('r', '4');
    circle.setAttribute('fill', PIN_COLORS[customPartPinType.value] || PIN_COLORS.other);
    circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '1.5');
    customPartPreviewPins.append(circle);
  });
}

[customPartName, customPartCategory, customPartShape, customPartWidth, customPartHeight, customPartColor,
  customPartPinLabels, customPartPinSide, customPartPinType].forEach((input) => {
  input.addEventListener('input', updateCustomPartPreview);
  input.addEventListener('change', updateCustomPartPreview);
});
updateCustomPartPreview();

createCustomPartButton.addEventListener('click', () => {
  try {
    const definition = buildCustomPartDefinition();
    if (library.has(definition.id)) throw new Error(`Part ID “${definition.id}” already exists.`);
    customPartJson.value = JSON.stringify(definition);
    addCustomPartButton.click();
  } catch (err) {
    customPartStatus.textContent = err.message;
  }
});
addCustomPartButton.addEventListener('click', () => {
  try {
    const parsed = JSON.parse(customPartJson.value);
    const source = Array.isArray(parsed?.components) ? parsed.components[0] : parsed;
    if (Array.isArray(parsed?.components) && parsed.components.length !== 1) {
      throw new Error('Paste exactly one part definition.');
    }
    const definition = validatePartDefinition(source);
    if (library.has(definition.id)) throw new Error(`Part ID “${definition.id}” already exists.`);
    library.set(definition.id, definition);
    customPartIds.add(definition.id);
    activeCategory = 'all';
    searchInput.value = '';
    partDetails.hidden = true;
    renderTray();
    saveCircuit(false);
    customPartStatus.textContent = `Added ${definition.name}.`;
    customPartJson.value = '';
  } catch (err) {
    customPartStatus.textContent = err.message;
  }
});

addNoteButton.addEventListener('click', () => openNoteDialog());

function openNoteDialog(note = null) {
  editingNote = note;
  const isEditing = Boolean(note);
  noteDialogTitle.textContent = isEditing ? 'Edit note' : 'Add a note';
  noteSubmitButton.textContent = isEditing ? 'Save changes' : 'Add note';
  noteInput.value = isEditing ? note.noteText.text() : '';
  noteInput.setCustomValidity('');
  noteDialog.showModal();
  requestAnimationFrame(() => noteInput.focus());
}

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = noteInput.value.trim();
  if (!text) {
    noteInput.setCustomValidity('Enter some text for your note.');
    noteInput.reportValidity();
    return;
  }
  noteInput.setCustomValidity('');
  if (editingNote) {
    editingNote.noteText.text(text);
    editingNote.noteRect.height(Math.max(102, editingNote.noteText.height() + 56));
    queueSave();
    overlay.batchDraw();
  } else {
    const offset = (notes.length % 6) * 18;
    createNote(text, Math.max(8, (wrap.clientWidth - 240) / 2 + offset), Math.max(8, (wrap.clientHeight - 80) / 2 + offset));
  }
  noteDialog.close();
});

noteInput.addEventListener('input', () => noteInput.setCustomValidity(''));
document.getElementById('note-cancel-btn').addEventListener('click', () => noteDialog.close());
document.getElementById('note-close-btn').addEventListener('click', () => noteDialog.close());
noteDialog.addEventListener('click', (event) => {
  if (event.target === noteDialog) noteDialog.close();
});
noteDialog.addEventListener('close', () => { editingNote = null; });

function clearWorkspace() {
  if (isDrawing()) finishWire(null);
  wires.slice().forEach(removeWire);
  notes.splice(0).forEach((note) => note.destroy());
  selectedNote = null;
  select(null);
  layer.find('.component').forEach((group) => group.destroy());
  circuitTitle.value = 'Untitled circuit';
  layer.batchDraw();
  wireLayer.batchDraw();
  overlay.batchDraw();
  saveCircuit(true);
}
clearButton.addEventListener('click', () => clearDialog.showModal());
document.getElementById('clear-workspace-cancel').addEventListener('click', () => clearDialog.close());
document.getElementById('clear-workspace-confirm').addEventListener('click', () => {
  clearDialog.close();
  clearWorkspace();
});
clearDialog.addEventListener('click', (event) => { if (event.target === clearDialog) clearDialog.close(); });
exportBomButton.addEventListener('click', exportBom);
wiringChecksButton.addEventListener('click', () => {
  updateWiringCheckIndicator();
  wiringChecksDialog.showModal();
});
document.getElementById('wiring-checks-close').addEventListener('click', () => wiringChecksDialog.close());
wiringChecksDialog.addEventListener('click', (event) => { if (event.target === wiringChecksDialog) wiringChecksDialog.close(); });
circuitTitle.addEventListener('input', queueSave);

async function loadLibrary() {
  const res = await fetch('components.json?rev=20261010-n20pinfix');
  if (!res.ok) throw new Error(`components.json returned HTTP ${res.status}`);
  const data = await res.json();
  data.components.forEach((def) => { library.set(def.id, def); builtInPartIds.add(def.id); });
}

loadLibrary()
  .then(() => {
    renderTray();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        restoreCircuit(JSON.parse(saved));
        setStatus('Restored saved circuit · Drag empty space to select; hold Space and drag to pan.');
      } else {
        setStatus('Drag empty space to select parts; hold Space and drag to pan. Hold Shift while dragging to add to selection.');
      }
    } catch (err) {
      setStatus(`Could not restore saved circuit: ${err.message}`, true);
    }
    if (!localStorage.getItem(N20_VISIBILITY_MIGRATION_KEY)) {
      if (hiddenPartIds.delete('n20-gear-motor-100rpm')) {
        renderTray();
        saveCircuit(false);
      }
      localStorage.setItem(N20_VISIBILITY_MIGRATION_KEY, 'done');
    }
    resetUndoHistory();
  })
  .catch((err) => {
    setStatus(`Could not load components.json (${err.message}). Serve this folder with a local web server instead of opening the file directly.`, true);
  });




















