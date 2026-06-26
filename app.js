const HAMBURG_CENTER = { lat: 53.5511, lng: 9.9937 };
const STORAGE_KEY = "local-meetup-events-v1";
const PROFILE_KEY = "local-meetup-profile-v1";
const RADAR_KEY = "local-meetup-radar-v1";
const SHEET_MIN = 118;
const SHEET_COLLAPSED = 238;
const SHEET_EXPANDED_RATIO = 0.74;

const categoryLabels = { sport: "Sport", food: "Food", culture: "Kultur", study: "Lernen" };
const categoryIcons = { sport: "B", food: "F", culture: "K", study: "L" };
const fallbackIcons = { "user-round": "U", "locate-fixed": "L", "map-pin-plus": "+", "refresh-cw": "R", x: "X", crosshair: "+", sparkles: "*", search: "S", "arrow-right": ">" };

const people = [
  { id: "you", name: "Du", initials: "DU", bg: "#f97316", fg: "#fff7ed", shirt: "#1f2937" },
  { id: "guest", name: "Gast", initials: "GA", bg: "#14b8a6", fg: "#ecfeff", shirt: "#0f172a" },
  { id: "lina", name: "Lina", initials: "LI", bg: "#ec4899", fg: "#fdf2f8", shirt: "#3b0764" },
  { id: "mats", name: "Mats", initials: "MA", bg: "#3b82f6", fg: "#eff6ff", shirt: "#172554" },
  { id: "noah", name: "Noah", initials: "NO", bg: "#22c55e", fg: "#f0fdf4", shirt: "#14532d" },
  { id: "sara", name: "Sara", initials: "SA", bg: "#a855f7", fg: "#faf5ff", shirt: "#3b0764" },
  { id: "jule", name: "Jule", initials: "JU", bg: "#f59e0b", fg: "#fffbeb", shirt: "#78350f" },
  { id: "amir", name: "Amir", initials: "AM", bg: "#06b6d4", fg: "#ecfeff", shirt: "#164e63" },
  { id: "emmi", name: "Emmi", initials: "EM", bg: "#ef4444", fg: "#fef2f2", shirt: "#7f1d1d" },
  { id: "timo", name: "Timo", initials: "TI", bg: "#64748b", fg: "#f8fafc", shirt: "#0f172a" },
];

const demoEvents = [
  { id: "demo-basketball", title: "Basketball am Hafen", category: "sport", time: "18:30", capacity: 8, attendeeIds: ["lina", "mats", "noah", "amir"], description: "Lockere Runde, Teams werden vor Ort gemischt.", lat: 53.5439, lng: 9.9745 },
  { id: "demo-food", title: "Streetfood Runde", category: "food", time: "19:00", capacity: 6, attendeeIds: ["you", "sara", "jule"], description: "Kleine Gruppe, wir probieren uns durch die Staende.", lat: 53.5567, lng: 10.0078 },
  { id: "demo-study", title: "Co-Working im Cafe", category: "study", time: "16:00", capacity: 5, attendeeIds: ["emmi", "timo"], description: "Fokusblock mit Kaffee, danach kurzer Austausch.", lat: 53.5642, lng: 9.9821 },
];

const searchPlaces = [
  { name: "Hamburg", aliases: ["zentrum", "innenstadt", "city"], lat: 53.5511, lng: 9.9937, zoom: 13 },
  { name: "Hamburg Hauptbahnhof", aliases: ["hbf", "bahnhof", "hauptbahnhof"], lat: 53.5527, lng: 10.0069, zoom: 16 },
  { name: "Jungfernstieg", aliases: ["alster", "binnenalster"], lat: 53.5535, lng: 9.9924, zoom: 16 },
  { name: "Reeperbahn", aliases: ["kiez", "st pauli", "st. pauli"], lat: 53.5496, lng: 9.9602, zoom: 16 },
  { name: "Schanze", aliases: ["sternschanze", "schanzenviertel"], lat: 53.5623, lng: 9.9646, zoom: 16 },
  { name: "HafenCity", aliases: ["hafen", "speicherstadt"], lat: 53.5413, lng: 9.9957, zoom: 15 },
];

const $ = (selector) => document.querySelector(selector);
const state = {
  map: null,
  markers: null,
  searchMarker: null,
  userMarker: null,
  userCircle: null,
  selectedFilter: "all",
  activePopupId: null,
  pendingPin: null,
  profileId: localStorage.getItem(PROFILE_KEY) || "you",
  events: loadEvents(),
  sheetHeight: SHEET_COLLAPSED,
  sheetDragging: false,
  radar: loadRadar(),
};

const els = {
  phone: $(".phone"), map: $("#map"), sheet: $(".sheet"), sheetHandle: $("#sheetHandle"), eventList: $("#eventList"), statusLine: $("#statusLine"),
  profileButton: $("#profileButton"), resetButton: $("#resetButton"), locateButton: $("#locateButton"), createButton: $("#createButton"), mapSearchForm: $("#mapSearchForm"),
  mapSearchInput: $("#mapSearchInput"), mapSearchButton: $("#mapSearchButton"), radarInput: $("#radarInput"), radarValue: $("#radarValue"), cardTemplate: $("#eventCardTemplate"),
  eventDialog: $("#eventDialog"), eventForm: $("#eventForm"), closeDialogButton: $("#closeDialogButton"), titleInput: $("#titleInput"), categoryInput: $("#categoryInput"),
  timeInput: $("#timeInput"), capacityInput: $("#capacityInput"), capacityValue: $("#capacityValue"), descriptionInput: $("#descriptionInput"), pickPinButton: $("#pickPinButton"),
};

init();

function init() {
  if (!people.some((person) => person.id === state.profileId)) state.profileId = "you";
  seedTimeInput();
  initIcons();
  updateProfileButton();
  initMap();
  bindControls();
  setSheetHeight(SHEET_MIN);
  render();
}

function initIcons() {
  if (window.lucide) return window.lucide.createIcons();
  document.querySelectorAll("[data-lucide]").forEach((node) => { node.textContent = fallbackIcons[node.dataset.lucide] || ""; });
}

function initMap() {
  if (!window.L) return;
  state.map = L.map(els.map, { attributionControl: false, zoomControl: false, zoomSnap: 0.5 }).setView([HAMBURG_CENTER.lat, HAMBURG_CENTER.lng], 15);
  L.control.zoom({ position: "bottomleft" }).addTo(state.map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, crossOrigin: true }).addTo(state.map);
  state.markers = L.layerGroup().addTo(state.map);
  state.map.on("click", (event) => {
    if (event.originalEvent?.target?.closest(".map-action, .leaflet-control")) return;
    openCreateDialog(event.latlng);
  });
  setTimeout(() => state.map.invalidateSize(), 250);
}

function bindControls() {
  els.createButton.addEventListener("click", () => openCreateDialog());
  els.closeDialogButton.addEventListener("click", () => els.eventDialog.close());
  els.locateButton.addEventListener("click", locateUser);
  els.resetButton.addEventListener("click", resetDemo);
  els.profileButton.addEventListener("click", switchProfile);
  els.capacityInput.addEventListener("input", () => { els.capacityValue.textContent = els.capacityInput.value; });
  els.eventForm.addEventListener("submit", (event) => { event.preventDefault(); createEvent(); });
  els.mapSearchForm.addEventListener("submit", handleSearch);
  els.mapSearchButton.addEventListener("click", (event) => { event.preventDefault(); runSearch(); });
  els.mapSearchInput.addEventListener("keyup", (event) => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } });
  els.radarInput.value = String(state.radar.radiusKm);
  els.radarInput.addEventListener("input", () => { state.radar.radiusKm = Number(els.radarInput.value); saveRadar(); state.activePopupId = null; render(); });
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    state.selectedFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.activePopupId = null;
    render();
  }));
  bindSheetDrag();
}

function loadEvents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || cloneDemoEvents(); } catch { return cloneDemoEvents(); }
}
function saveEvents() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events)); }
function cloneDemoEvents() { return demoEvents.map((event) => ({ ...event, attendeeIds: [...event.attendeeIds] })); }
function loadRadar() {
  try {
    const stored = JSON.parse(localStorage.getItem(RADAR_KEY) || "{}");
    return { center: stored.center || HAMBURG_CENTER, label: stored.label || "Hamburg", radiusKm: Math.max(2, Math.min(200, Number(stored.radiusKm) || 20)) };
  } catch { return { center: HAMBURG_CENTER, label: "Hamburg", radiusKm: 20 }; }
}
function saveRadar() { localStorage.setItem(RADAR_KEY, JSON.stringify(state.radar)); }

function render() {
  renderCards();
  renderMarkers();
  updateStatus();
  els.radarValue.textContent = `${state.radar.radiusKm} km`;
  state.map?.invalidateSize?.();
}

function getFilteredEvents() {
  return state.events.filter((event) => (state.selectedFilter === "all" || event.category === state.selectedFilter) && distanceKm(state.radar.center, event) <= state.radar.radiusKm);
}

function renderCards() {
  els.eventList.innerHTML = "";
  const events = getFilteredEvents().sort((a, b) => a.time.localeCompare(b.time));
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "event-meta";
    empty.textContent = `Keine Meetups bis ${state.radar.radiusKm} km um ${shortPlaceLabel(state.radar.label)}.`;
    els.eventList.append(empty);
    return;
  }
  events.forEach((meetup) => {
    const card = els.cardTemplate.content.firstElementChild.cloneNode(true);
    const attendees = getAttendees(meetup);
    const joined = isJoinedByMe(meetup);
    card.querySelector(".category-dot").classList.add(meetup.category);
    card.querySelector(".event-title").textContent = meetup.title;
    card.querySelector(".event-meta").textContent = `${meetup.time} · ${categoryLabels[meetup.category]} · ${attendees.length}/${meetup.capacity} dabei`;
    renderAvatarStack(card.querySelector(".attendee-strip"), attendees, meetup.capacity);
    const join = card.querySelector(".join-button");
    join.textContent = joined ? "Dabei" : "Join";
    join.classList.toggle("joined", joined);
    join.disabled = !joined && attendees.length >= meetup.capacity;
    card.querySelector(".event-main").addEventListener("click", () => focusEvent(meetup.id));
    join.addEventListener("click", () => toggleJoin(meetup.id));
    els.eventList.append(card);
  });
}

function renderMarkers() {
  if (!state.map || !state.markers) return;
  state.markers.clearLayers();
  getFilteredEvents().forEach((meetup) => {
    const marker = L.marker([meetup.lat, meetup.lng], { icon: L.divIcon({ className: "leaflet-meetup-icon", html: `<span class="meetup-marker ${meetup.category}"><span>${categoryIcons[meetup.category]}</span></span>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -42] }) }).addTo(state.markers);
    marker.bindPopup(buildPopupContent(meetup), { closeButton: false, className: "meetup-leaflet-popup", minWidth: 272, maxWidth: 292 });
    marker.on("click", () => { state.activePopupId = meetup.id; });
    if (state.activePopupId === meetup.id) marker.openPopup();
  });
}

function buildPopupContent(meetup) {
  const popup = document.createElement("div");
  const attendees = getAttendees(meetup);
  const joined = isJoinedByMe(meetup);
  popup.className = "map-action meetup-popup";
  popup.innerHTML = `<strong>${escapeHtml(meetup.title)}</strong><p class="popup-meta"><span>${meetup.time}</span><span>${categoryLabels[meetup.category]}</span><span>${attendees.length}/${meetup.capacity} dabei</span></p><p class="popup-description">${escapeHtml(meetup.description || "Treffpunkt ist direkt am Pin.")}</p><div class="popup-people"></div><button type="button">${joined ? "Nicht mehr dabei" : "Join"}</button>`;
  const peopleWrap = popup.querySelector(".popup-people");
  attendees.slice(0, 6).forEach((person) => {
    const item = document.createElement("span");
    item.className = "popup-person";
    item.append(createAvatar(person, "tiny"));
    const name = document.createElement("span");
    name.textContent = person.name;
    item.append(name);
    peopleWrap.append(item);
  });
  popup.querySelector("button").addEventListener("click", () => toggleJoin(meetup.id));
  return popup;
}

function updateStatus() {
  const count = getFilteredEvents().length;
  const category = state.selectedFilter === "all" ? "" : ` ${categoryLabels[state.selectedFilter]}`;
  els.statusLine.textContent = `${count} ${count === 1 ? "Event" : "Events"}${category} bis ${state.radar.radiusKm} km um ${shortPlaceLabel(state.radar.label)}`;
}

function openCreateDialog(latlng) {
  state.pendingPin = latlng || state.map?.getCenter?.() || HAMBURG_CENTER;
  els.titleInput.value = "";
  els.categoryInput.value = "sport";
  els.capacityInput.value = "6";
  els.capacityValue.textContent = "6";
  els.descriptionInput.value = "";
  seedTimeInput();
  els.eventDialog.showModal();
  els.titleInput.focus();
}

function createEvent() {
  const title = els.titleInput.value.trim();
  if (!title) return els.titleInput.focus();
  const pin = state.pendingPin || HAMBURG_CENTER;
  const created = { id: `event-${Date.now()}`, title, category: els.categoryInput.value, time: els.timeInput.value, capacity: Number(els.capacityInput.value), attendeeIds: [state.profileId], description: els.descriptionInput.value.trim(), lat: Number(pin.lat), lng: Number(pin.lng) };
  state.events.push(created);
  state.activePopupId = created.id;
  saveEvents();
  els.eventDialog.close();
  setRadarCenter(created, created.title);
  focusEvent(created.id);
}

function focusEvent(id) {
  const meetup = state.events.find((event) => event.id === id);
  if (!meetup) return;
  state.activePopupId = id;
  state.map?.flyTo([meetup.lat, meetup.lng], 15, { duration: 0.45 });
  render();
}

function toggleJoin(id) {
  const meetup = state.events.find((event) => event.id === id);
  if (!meetup) return;
  meetup.attendeeIds = Array.isArray(meetup.attendeeIds) ? meetup.attendeeIds : [];
  if (isJoinedByMe(meetup)) meetup.attendeeIds = meetup.attendeeIds.filter((id) => id !== state.profileId);
  else if (meetup.attendeeIds.length < meetup.capacity) meetup.attendeeIds.push(state.profileId);
  saveEvents();
  render();
}

function locateUser() {
  if (!navigator.geolocation) return state.map?.flyTo([HAMBURG_CENTER.lat, HAMBURG_CENTER.lng], 14);
  els.locateButton.classList.add("loading");
  navigator.geolocation.getCurrentPosition((position) => {
    const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
    setRadarCenter(latlng, "deinem Standort");
    state.map?.flyTo([latlng.lat, latlng.lng], 16, { duration: 0.45 });
    if (state.userMarker) state.userMarker.setLatLng([latlng.lat, latlng.lng]);
    else state.userMarker = L.marker([latlng.lat, latlng.lng], { icon: L.divIcon({ className: "user-location-icon", html: '<span class="user-location"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false }).addTo(state.map);
    if (state.userCircle) state.userCircle.setLatLng([latlng.lat, latlng.lng]).setRadius(position.coords.accuracy || 45);
    else state.userCircle = L.circle([latlng.lat, latlng.lng], { radius: position.coords.accuracy || 45, color: "#8fbda9", weight: 1, fillColor: "#8fbda9", fillOpacity: 0.13, interactive: false }).addTo(state.map);
    els.locateButton.classList.remove("loading");
  }, () => { els.locateButton.classList.remove("loading"); state.map?.flyTo([HAMBURG_CENTER.lat, HAMBURG_CENTER.lng], 14); }, { timeout: 6000, enableHighAccuracy: true });
}

function handleSearch(event) { event.preventDefault(); runSearch(); }
async function runSearch() {
  const raw = els.mapSearchInput.value.trim();
  const query = normalizeSearch(raw);
  if (!query) return;
  const eventMatch = state.events.find((meetup) => [meetup.title, meetup.description, categoryLabels[meetup.category]].filter(Boolean).some((value) => normalizeSearch(value).includes(query)));
  if (eventMatch) { setRadarCenter(eventMatch, eventMatch.title); focusEvent(eventMatch.id); setSheetHeight(SHEET_COLLAPSED); return; }
  const local = searchPlaces.find((place) => [place.name, ...(place.aliases || [])].map(normalizeSearch).some((term) => term.includes(query) || query.includes(term)));
  if (local) return useSearchResult(local);
  els.mapSearchForm.classList.add("searching");
  const online = await geocode(raw);
  els.mapSearchForm.classList.remove("searching");
  if (online) return useSearchResult(online);
  els.mapSearchForm.classList.add("not-found");
  setTimeout(() => els.mapSearchForm.classList.remove("not-found"), 700);
}

function useSearchResult(result) {
  setRadarCenter(result, result.name);
  els.mapSearchInput.value = result.name;
  els.mapSearchInput.blur();
  state.map?.flyTo([result.lat, result.lng], result.zoom || 16, { duration: 0.45 });
  if (state.searchMarker) state.searchMarker.setLatLng([result.lat, result.lng]);
  else state.searchMarker = L.marker([result.lat, result.lng], { icon: L.divIcon({ className: "search-result-icon", html: '<span class="search-result-marker"></span>', iconSize: [28, 28], iconAnchor: [14, 28] }) }).addTo(state.map);
  render();
}

async function geocode(query) {
  const nominatim = await geocodeWithNominatim(query, true) || await geocodeWithNominatim(query, false);
  if (nominatim) return nominatim;
  return geocodeWithPhoton(query);
}
async function geocodeWithNominatim(query, germanyOnly) {
  try {
    const params = new URLSearchParams({ format: "jsonv2", limit: "1", "accept-language": "de", q: query });
    if (germanyOnly) params.set("countrycodes", "de");
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!response.ok) return null;
    const first = (await response.json())[0];
    return first ? { name: first.display_name.split(",").slice(0, 2).join(","), lat: Number(first.lat), lng: Number(first.lon), zoom: 16 } : null;
  } catch { return null; }
}
async function geocodeWithPhoton(query) {
  try {
    const response = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q: query, lang: "de", limit: "1" })}`);
    if (!response.ok) return null;
    const first = (await response.json())?.features?.[0];
    const coords = first?.geometry?.coordinates;
    if (!coords) return null;
    const props = first.properties || {};
    const name = [props.name, props.city, props.state, props.country].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 3).join(", ");
    return { name: name || query, lat: Number(coords[1]), lng: Number(coords[0]), zoom: 15 };
  } catch { return null; }
}

function bindSheetDrag() {
  let startY = 0; let startHeight = 0; let moved = false;
  els.sheetHandle.addEventListener("click", () => { if (moved) return moved = false; const max = getSheetMaxHeight(); setSheetHeight(state.sheetHeight > (SHEET_COLLAPSED + max) / 2 ? SHEET_MIN : max); });
  els.sheetHandle.addEventListener("pointerdown", (event) => { state.sheetDragging = true; moved = false; startY = event.clientY; startHeight = state.sheetHeight; els.sheet.classList.add("dragging"); els.sheetHandle.setPointerCapture(event.pointerId); });
  els.sheetHandle.addEventListener("pointermove", (event) => { if (!state.sheetDragging) return; if (Math.abs(event.clientY - startY) > 4) moved = true; setSheetHeight(startHeight + startY - event.clientY, false); });
  els.sheetHandle.addEventListener("pointerup", (event) => { state.sheetDragging = false; els.sheet.classList.remove("dragging"); els.sheetHandle.releasePointerCapture(event.pointerId); snapSheet(); });
}
function snapSheet() { const max = getSheetMaxHeight(); const mid = Math.min(SHEET_COLLAPSED, max - 90); setSheetHeight([SHEET_MIN, mid, max].reduce((best, point) => Math.abs(point - state.sheetHeight) < Math.abs(best - state.sheetHeight) ? point : best)); }
function setSheetHeight(height, animate = true) { const max = getSheetMaxHeight(); state.sheetHeight = Math.max(SHEET_MIN, Math.min(max, height)); els.sheet.style.setProperty("--sheet-height", `${state.sheetHeight}px`); els.phone.style.setProperty("--sheet-height", `${state.sheetHeight}px`); els.sheet.classList.toggle("dragging", !animate); els.sheet.classList.toggle("compact", state.sheetHeight <= SHEET_MIN + 18); }
function getSheetMaxHeight() { const phoneHeight = els.phone.getBoundingClientRect().height || window.innerHeight; return Math.round(Math.min(phoneHeight * SHEET_EXPANDED_RATIO, phoneHeight - 176)); }

function resetDemo() { state.events = cloneDemoEvents(); state.activePopupId = null; saveEvents(); render(); }
function switchProfile() { state.profileId = state.profileId === "you" ? "guest" : "you"; localStorage.setItem(PROFILE_KEY, state.profileId); updateProfileButton(); render(); }
function seedTimeInput() { const date = new Date(); date.setHours(date.getHours() + 1, 0, 0, 0); els.timeInput.value = date.toTimeString().slice(0, 5); }
function setRadarCenter(latlng, label) { state.radar.center = { lat: Number(latlng.lat), lng: Number(latlng.lng) }; state.radar.label = label || "aktueller Karte"; saveRadar(); state.activePopupId = null; render(); }
function updateProfileButton() { els.profileButton.innerHTML = ""; els.profileButton.append(createAvatar(getPerson(state.profileId), "profile")); }
function getPerson(id) { return people.find((person) => person.id === id) || people[0]; }
function getAttendees(meetup) { return (meetup.attendeeIds || []).map(getPerson); }
function isJoinedByMe(meetup) { return Array.isArray(meetup.attendeeIds) && meetup.attendeeIds.includes(state.profileId); }
function renderAvatarStack(container, attendees, capacity) {
  container.innerHTML = "";
  attendees.slice(0, 5).forEach((person) => container.append(createAvatar(person, "small")));
  if (attendees.length > 5) { const more = document.createElement("span"); more.className = "avatar-more"; more.textContent = `+${attendees.length - 5}`; container.append(more); }
  const names = document.createElement("span"); names.className = "attendee-names"; names.textContent = (attendees.length ? attendees.slice(0, 3).map((person) => person.name).join(", ") : "Noch niemand dabei") + (attendees.length > 3 ? ` +${attendees.length - 3}` : "") + ` · ${capacity - attendees.length} frei`; container.append(names);
}
function createAvatar(person, size = "small") { const img = document.createElement("img"); img.className = `avatar avatar-${size}`; img.src = avatarSvg(person); img.alt = person.name; return img; }
function avatarSvg(person) { const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${person.bg}"/><stop offset="1" stop-color="${person.shirt}"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#bg)"/><circle cx="48" cy="38" r="18" fill="${person.fg}"/><path d="M20 90c5-21 18-32 28-32s23 11 28 32" fill="${person.fg}" opacity=".92"/><text x="48" y="45" text-anchor="middle" font-size="20" font-family="Arial" font-weight="800" fill="${person.shirt}">${person.initials}</text></svg>`; return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
function distanceKm(from, to) { const earth = 6371; const dLat = rad(Number(to.lat) - Number(from.lat)); const dLng = rad(Number(to.lng) - Number(from.lng)); const lat1 = rad(Number(from.lat)); const lat2 = rad(Number(to.lat)); const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2; return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
function rad(value) { return value * Math.PI / 180; }
function normalizeSearch(value) { return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss"); }
function shortPlaceLabel(label) { return String(label || "Hamburg").split(",")[0].trim(); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
