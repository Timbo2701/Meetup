let mobileSheetLockReleased = false;

(function installMobileInteractionFixes() {
  document.documentElement.dataset.mobileFixVersion = "22";
  console.info("Local Meetup mobile fixes v22 active");

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

  installInitialSheetLock();
  installEventButtonFallback();
  installRadarHitTarget();
  installMapLongPressFallback();
  stabilizeMobileViewport();
  forceInitialSheetLayout();
  hardenExistingMapImages();
  render();
})();

function installInitialSheetLock() {
  const lockClass = "mobile-sheet-lock";
  document.documentElement.classList.add(lockClass);

  if (!document.querySelector("#mobileSheetLockStyles")) {
    const style = document.createElement("style");
    style.id = "mobileSheetLockStyles";
    style.textContent = `
      html.mobile-sheet-lock .phone {
        --sheet-height: ${SHEET_MIN}px !important;
      }

      html.mobile-sheet-lock .sheet {
        height: ${SHEET_MIN}px !important;
        min-height: ${SHEET_MIN}px !important;
        max-height: ${SHEET_MIN}px !important;
        grid-template-rows: auto auto !important;
        overflow: hidden !important;
        transition: none !important;
      }

      html.mobile-sheet-lock .sheet .event-list {
        display: none !important;
      }

      html.mobile-sheet-lock .sheet .sheet-header {
        margin-bottom: 0 !important;
      }

      html.mobile-sheet-lock .create-fab {
        bottom: calc(${SHEET_MIN}px + max(20px, env(safe-area-inset-bottom, 0px))) !important;
      }

      #map,
      #map *,
      .leaflet-container,
      .leaflet-container *,
      .offline-map,
      .offline-map * {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }

      #map img,
      .leaflet-tile,
      .osm-dark-tile {
        pointer-events: none !important;
        -webkit-user-drag: none !important;
      }
    `;
    document.head.append(style);
  }

  const unlock = () => {
    mobileSheetLockReleased = true;
    document.documentElement.classList.remove(lockClass);
  };

  [sheetHandle, sheet.querySelector(".sheet-header")].filter(Boolean).forEach((surface) => {
    ["pointerdown", "touchstart", "mousedown", "click"].forEach((eventName) => {
      surface.addEventListener(eventName, unlock, { capture: true, passive: true });
    });
  });
}

function forceInitialSheetLayout() {
  const apply = () => {
    if (mobileSheetLockReleased) return;

    state.sheetHeight = SHEET_MIN;
    sheet.style.setProperty("--sheet-height", `${SHEET_MIN}px`);
    phone.style.setProperty("--sheet-height", `${SHEET_MIN}px`);
    sheet.classList.add("compact");
    sheet.classList.remove("expanded", "dragging");
    state.map?.invalidate?.();
    state.map?.invalidateSize?.({ animate: false, pan: false });
  };

  [0, 50, 160, 360, 800, 1400].forEach((delay) => window.setTimeout(apply, delay));
  apply();
}

function installEventButtonFallback() {
  if (!createButton) return;

  let lastOpen = 0;

  const openFromMapCenter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const now = Date.now();
    if (eventDialog.open || now - lastOpen < 650) return;
    lastOpen = now;

    state.pickMode = false;
    pickPinButton.classList.remove("active");

    const center = state.map?.getCenter?.() || state.pendingPin || HAMBURG_CENTER;
    state.pendingPin = center;
    openCreateDialog(center);
  };

  createButton.addEventListener("touchend", openFromMapCenter, { capture: true, passive: false });
  createButton.addEventListener("click", openFromMapCenter, true);
}

function installRadarHitTarget() {
  const radar = document.querySelector(".radar-control");
  const input = document.querySelector("#radarInput");
  if (!radar || !input || radar.querySelector(".radar-hit-target")) return;

  const hit = document.createElement("div");
  hit.className = "radar-hit-target";
  Object.assign(hit.style, {
    position: "absolute",
    inset: "0",
    zIndex: "8",
    borderRadius: "999px",
    touchAction: "none",
    WebkitTapHighlightColor: "transparent",
    background: "rgba(0,0,0,0)",
  });
  radar.style.position = "absolute";
  radar.append(hit);

  let active = false;

  const pointX = (event) => {
    if (event.touches?.length) return event.touches[0].clientX;
    if (event.changedTouches?.length) return event.changedTouches[0].clientX;
    return event.clientX;
  };

  const setFromX = (clientX) => {
    const rect = input.getBoundingClientRect();
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Number(input.step) || 1;
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const next = Math.max(min, Math.min(max, Math.round((min + percent * (max - min)) / step) * step));
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const start = (event) => {
    active = true;
    state.map?.suspendGestures?.();
    stop(event);
    setFromX(pointX(event));
  };

  const move = (event) => {
    if (!active) return;
    stop(event);
    setFromX(pointX(event));
  };

  const end = () => {
    active = false;
    state.map?.resumeGestures?.();
  };

  hit.addEventListener("pointerdown", start, true);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", end, true);
  document.addEventListener("pointercancel", end, true);
  hit.addEventListener("touchstart", start, { capture: true, passive: false });
  document.addEventListener("touchmove", move, { capture: true, passive: false });
  document.addEventListener("touchend", end, true);
  document.addEventListener("touchcancel", end, true);
}

function installMapLongPressFallback() {
  const mapNode = document.querySelector("#map");
  if (!mapNode) return;

  let timer = null;
  let start = null;
  let armed = false;

  const isControl = (target) =>
    target.closest(".map-action, .leaflet-control, .leaflet-marker-icon, .meetup-marker, .meetup-popup");

  const clear = () => {
    window.clearTimeout(timer);
    timer = null;
    start = null;
    armed = false;
  };

  const openAt = (clientX, clientY) => {
    state.pickMode = false;
    pickPinButton.classList.remove("active");
    openCreateDialog(screenPointToLatLng(clientX, clientY, 15));
  };

  const arm = (clientX, clientY) => {
    armed = false;
    start = { x: clientX, y: clientY, at: Date.now() };
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      armed = true;
    }, 520);
  };

  document.addEventListener(
    "contextmenu",
    (event) => {
      if (!mapNode.contains(event.target) || isControl(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openAt(event.clientX, event.clientY);
    },
    true,
  );

  mapNode.addEventListener(
    "touchstart",
    (event) => {
      if (!event.touches.length || isControl(event.target)) return;
      const touch = event.touches[0];
      arm(touch.clientX, touch.clientY);
    },
    { capture: true, passive: true },
  );

  mapNode.addEventListener(
    "touchmove",
    (event) => {
      if (!start || !event.touches.length) return;
      const touch = event.touches[0];
      if (Math.abs(touch.clientX - start.x) + Math.abs(touch.clientY - start.y) > 28) {
        clear();
      }
    },
    { capture: true, passive: true },
  );

  ["touchend", "touchcancel", "pointercancel"].forEach((eventName) => {
    mapNode.addEventListener(
      eventName,
      (event) => {
        if (eventName === "touchend" && start && (armed || Date.now() - start.at > 520)) {
          const point = event.changedTouches?.[0] || start;
          openAt(point.clientX ?? start.x, point.clientY ?? start.y);
        }
        clear();
      },
      true,
    );
  });
}

function hardenExistingMapImages() {
  const harden = (node) => {
    if (!(node instanceof HTMLImageElement)) return;
    node.draggable = false;
    node.setAttribute("draggable", "false");
    node.setAttribute("alt", "");
    node.style.webkitTouchCallout = "none";
    node.style.webkitUserSelect = "none";
    node.style.userSelect = "none";
    node.style.pointerEvents = "none";
  };

  document.querySelectorAll("#map img").forEach(harden);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        harden(node);
        node.querySelectorAll?.("img").forEach(harden);
      });
    });
  }).observe(document.querySelector("#map"), { childList: true, subtree: true });
}

function stabilizeMobileViewport() {
  const refresh = () => {
    state.map?.invalidateSize?.({ animate: false, pan: false });
  };

  [80, 250, 700, 1400].forEach((delay) => window.setTimeout(refresh, delay));
  window.visualViewport?.addEventListener("resize", () => window.setTimeout(refresh, 80));
  window.visualViewport?.addEventListener("scroll", () => window.setTimeout(refresh, 80));
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
