(function installMobileInteractionFixes() {
  document.documentElement.dataset.mobileFixVersion = "18";
  console.info("Local Meetup mobile fixes v18 active");

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
  stabilizeMobileViewport();
  render();
})();

function stabilizeMobileViewport() {
  const refresh = () => {
    state.map?.invalidateSize?.({ animate: false, pan: false });
    setSheetHeight(state.sheetHeight || SHEET_MIN, false);
  };

  [80, 250, 700, 1400].forEach((delay) => window.setTimeout(refresh, delay));
  window.visualViewport?.addEventListener("resize", () => window.setTimeout(refresh, 80));
  window.visualViewport?.addEventListener("scroll", () => window.setTimeout(refresh, 80));
}

function makeRadarTouchSafe() {
  const radar = document.querySelector(".radar-control");
  const input = document.querySelector("#radarInput");
  if (!radar || !input) return;

  let isAdjusting = false;

  const releaseMap = () => {
    isAdjusting = false;
    state.map?.dragging?.enable?.();
    state.map?.touchZoom?.enable?.();
    state.map?.doubleClickZoom?.enable?.();
  };

  const holdMap = () => {
    state.map?.dragging?.disable?.();
    state.map?.touchZoom?.disable?.();
    state.map?.doubleClickZoom?.disable?.();
  };

  const clientXFromEvent = (event) => {
    if (event.touches?.length) return event.touches[0].clientX;
    if (event.changedTouches?.length) return event.changedTouches[0].clientX;
    return event.clientX;
  };

  const clientYFromEvent = (event) => {
    if (event.touches?.length) return event.touches[0].clientY;
    if (event.changedTouches?.length) return event.changedTouches[0].clientY;
    return event.clientY;
  };

  const isInsideRadar = (event) => {
    const rect = radar.getBoundingClientRect();
    const x = clientXFromEvent(event);
    const y = clientYFromEvent(event);
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const setRadarValue = (clientX) => {
    const rect = input.getBoundingClientRect();
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Number(input.step) || 1;
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const next = Math.round((min + percent * (max - min)) / step) * step;
    input.value = String(Math.max(min, Math.min(max, next)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const stop = (event) => {
    event.stopPropagation();
  };

  const handleStartOrMove = (event) => {
    if (event.type === "pointermove" && event.buttons === 0 && !isAdjusting) return;
    if (!isAdjusting && !isInsideRadar(event)) return;
    isAdjusting = true;
    event.preventDefault();
    stop(event);
    holdMap();
    setRadarValue(clientXFromEvent(event));
  };

  ["pointerdown", "pointermove", "mousedown", "click"].forEach((eventName) => {
    radar.addEventListener(eventName, stop, true);
    input.addEventListener(eventName, stop, true);
  });

  ["touchstart", "touchmove"].forEach((eventName) => {
    radar.addEventListener(eventName, handleStartOrMove, { capture: true, passive: false });
    input.addEventListener(eventName, handleStartOrMove, { capture: true, passive: false });
  });

  radar.addEventListener("pointerdown", handleStartOrMove, true);
  input.addEventListener("pointerdown", handleStartOrMove, true);

  document.addEventListener("pointerdown", handleStartOrMove, true);
  document.addEventListener("pointermove", handleStartOrMove, true);
  document.addEventListener("touchstart", handleStartOrMove, { capture: true, passive: false });
  document.addEventListener("touchmove", handleStartOrMove, { capture: true, passive: false });

  ["pointerup", "pointercancel", "touchend", "touchcancel", "mouseup"].forEach((eventName) => {
    window.addEventListener(eventName, releaseMap, { passive: true });
  });
}

function makeSheetHeaderDraggable() {
  const surfaces = [document.querySelector("#sheetHandle"), document.querySelector(".sheet-header")].filter(Boolean);
  if (!surfaces.length) return;

  let startY = 0;
  let startHeight = 0;

  const begin = (clientY, target) => {
    if (target.closest("button") && !target.closest("#sheetHandle")) return false;
    state.sheetDragging = true;
    startY = clientY;
    startHeight = state.sheetHeight;
    sheet.classList.add("dragging");
    return true;
  };

  const move = (clientY) => {
    if (!state.sheetDragging) return;
    setSheetHeight(startHeight + startY - clientY, false);
  };

  const finish = () => {
    if (!state.sheetDragging) return;
    state.sheetDragging = false;
    sheet.classList.remove("dragging");
    snapSheet();
  };

  surfaces.forEach((surface) => {
    surface.addEventListener("pointerdown", (event) => {
      if (!begin(event.clientY, event.target)) return;
      surface.setPointerCapture?.(event.pointerId);
    });

    surface.addEventListener("pointermove", (event) => move(event.clientY));

    surface.addEventListener("pointerup", (event) => {
      surface.releasePointerCapture?.(event.pointerId);
      finish();
    });

    surface.addEventListener("pointercancel", finish);

    surface.addEventListener(
      "touchstart",
      (event) => {
        if (!event.touches.length || !begin(event.touches[0].clientY, event.target)) return;
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false },
    );

    surface.addEventListener(
      "touchmove",
      (event) => {
        if (!event.touches.length || !state.sheetDragging) return;
        event.preventDefault();
        event.stopPropagation();
        move(event.touches[0].clientY);
      },
      { passive: false },
    );

    surface.addEventListener("touchend", finish);
    surface.addEventListener("touchcancel", finish);
  });
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

  const begin = (clientX, clientY, target) => {
    if (isControlTarget(target)) return;
    start = { x: clientX, y: clientY };
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const latlng = screenPointToLatLng(start.x, start.y, currentZoom);
      clear();
      openCreateDialog(latlng);
    }, 650);
  };

  const cancelIfMoved = (clientX, clientY) => {
    if (!start) return;
    if (Math.abs(clientX - start.x) + Math.abs(clientY - start.y) > 10) {
      clear();
    }
  };

  mapNode.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    },
    true,
  );

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

  mapNode.addEventListener("pointerdown", (event) => begin(event.clientX, event.clientY, event.target), true);
  mapNode.addEventListener("pointermove", (event) => cancelIfMoved(event.clientX, event.clientY), true);

  mapNode.addEventListener(
    "touchstart",
    (event) => {
      if (!event.touches.length) return;
      begin(event.touches[0].clientX, event.touches[0].clientY, event.target);
    },
    { capture: true, passive: true },
  );

  mapNode.addEventListener(
    "touchmove",
    (event) => {
      if (!event.touches.length) return;
      cancelIfMoved(event.touches[0].clientX, event.touches[0].clientY);
    },
    { capture: true, passive: true },
  );

  ["pointerup", "pointercancel", "mouseleave", "touchend", "touchcancel"].forEach((eventName) => {
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
