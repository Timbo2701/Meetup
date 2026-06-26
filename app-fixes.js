(function installMobileInteractionFixes() {
  const labels = {
    sport: "🏀 Sport",
    food: "🍜 Food",
    culture: "🎭 Kultur",
    study: "📚 Lernen",
  };
  const icons = {
    sport: "🏀",
    food: "🍜",
    culture: "🎭",
    study: "📚",
  };

  Object.assign(categoryLabels, labels);
  Object.assign(categoryIcons, icons);

  Object.entries(labels).forEach(([key, label]) => {
    const filter = document.querySelector(`[data-filter="${key}"]`);
    const option = document.querySelector(`#categoryInput option[value="${key}"]`);
    if (filter) filter.textContent = label;
    if (option) option.textContent = label;
  });

  makeRadarTouchSafe();
  makeSheetHeaderDraggable();
  installLongPressCreate();
  render();
})();

function makeRadarTouchSafe() {
  const radar = document.querySelector(".radar-control");
  const input = document.querySelector("#radarInput");
  [radar, input].filter(Boolean).forEach((node) => {
    ["pointerdown", "pointermove", "mousedown", "touchstart", "touchmove", "click"].forEach((eventName) => {
      node.addEventListener(eventName, (event) => event.stopPropagation(), { passive: eventName.startsWith("touch") });
    });
  });
}

function makeSheetHeaderDraggable() {
  const header = document.querySelector(".sheet-header");
  if (!header) return;

  let startY = 0;
  let startHeight = 0;

  header.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    state.sheetDragging = true;
    startY = event.clientY;
    startHeight = state.sheetHeight;
    sheet.classList.add("dragging");
    header.setPointerCapture(event.pointerId);
  });

  header.addEventListener("pointermove", (event) => {
    if (!state.sheetDragging) return;
    setSheetHeight(startHeight + startY - event.clientY, false);
  });

  const finish = (event) => {
    if (!state.sheetDragging) return;
    state.sheetDragging = false;
    sheet.classList.remove("dragging");
    header.releasePointerCapture(event.pointerId);
    snapSheet();
  };

  header.addEventListener("pointerup", finish);
  header.addEventListener("pointercancel", finish);
}

function installLongPressCreate() {
  const mapNode = document.querySelector("#map");
  if (!mapNode) return;

  let timer = null;
  let start = null;
  let currentZoom = 15;
  const originalFlyTo = state.map?.flyTo?.bind(state.map);

  if (originalFlyTo) {
    state.map.flyTo = (center, zoom) => {
      if (Number.isFinite(Number(zoom))) currentZoom = Number(zoom);
      return originalFlyTo(center, zoom);
    };
  }

  const isControlTarget = (target) =>
    target.closest(".map-action, .leaflet-control, .leaflet-marker-icon, .meetup-marker, .meetup-popup");

  const clear = () => {
    window.clearTimeout(timer);
    timer = null;
    start = null;
  };

  mapNode.addEventListener(
    "click",
    (event) => {
      if (!isControlTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  mapNode.addEventListener(
    "pointerdown",
    (event) => {
      if (isControlTarget(event.target)) return;
      start = { x: event.clientX, y: event.clientY };
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const latlng = screenPointToLatLng(start.x, start.y, currentZoom);
        clear();
        openCreateDialog(latlng);
      }, 650);
    },
    true,
  );

  mapNode.addEventListener(
    "pointermove",
    (event) => {
      if (!start) return;
      if (Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 10) {
        clear();
      }
    },
    true,
  );

  ["pointerup", "pointercancel", "mouseleave"].forEach((eventName) => {
    mapNode.addEventListener(eventName, clear, true);
  });
}

function screenPointToLatLng(clientX, clientY, zoom) {
  const bounds = mapEl.getBoundingClientRect();
  const center = state.map.getCenter();
  const centerPoint = mobileLatLngToPoint(center.lat, center.lng, zoom);
  const point = {
    x: centerPoint.x + clientX - bounds.left - bounds.width / 2,
    y: centerPoint.y + clientY - bounds.top - bounds.height / 2,
  };
  return mobilePointToLatLng(point.x, point.y, zoom);
}

function mobileLatLngToPoint(lat, lng, zoom) {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function mobilePointToLatLng(x, y, zoom) {
  const scale = 256 * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}
