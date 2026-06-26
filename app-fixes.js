(function installMobileInteractionFixes() {
  document.documentElement.dataset.mobileFixVersion = "20";
  console.info("Local Meetup mobile fixes v20 active");

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

  installRadarHitTarget();
  installMapLongPressFallback();
  stabilizeMobileViewport();
  hardenExistingMapImages();
  render();
})();

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

  const isControl = (target) =>
    target.closest(".map-action, .leaflet-control, .leaflet-marker-icon, .meetup-marker, .meetup-popup");

  const clear = () => {
    window.clearTimeout(timer);
    timer = null;
    start = null;
  };

  const openAt = (clientX, clientY) => {
    state.pickMode = false;
    pickPinButton.classList.remove("active");
    openCreateDialog(screenPointToLatLng(clientX, clientY, 15));
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
      start = { x: touch.clientX, y: touch.clientY };
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        openAt(start.x, start.y);
        clear();
      }, 850);
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
    mapNode.addEventListener(eventName, clear, true);
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
    setSheetHeight(state.sheetHeight || SHEET_MIN, false);
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
