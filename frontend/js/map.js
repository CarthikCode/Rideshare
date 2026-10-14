import { api } from './api.js';
import { haversineKm } from './fare.js';
import { el, toast } from './ui.js';

// Place search runs ONLY on button click or Enter — never as-you-type.
export function wirePlaceSearch({ input, button, resultsEl, onPick }) {
  async function run() {
    const q = input.value.trim();
    if (q.length < 2) {
      toast('Type a place name first', 'error');
      return;
    }
    button.disabled = true;
    try {
      const data = await api(`/api/geo/search?q=${encodeURIComponent(q)}`);
      resultsEl.innerHTML = '';
      if (!data.results.length) {
        resultsEl.classList.remove('visible');
        toast('No places found for that search', 'error');
        return;
      }
      for (const r of data.results) {
        const li = el('li', '', r.label);
        li.addEventListener('click', () => {
          resultsEl.classList.remove('visible');
          onPick(r);
        });
        resultsEl.appendChild(li);
      }
      resultsEl.classList.add('visible');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  }
  button.addEventListener('click', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });
}

export const DEFAULT_CENTER = [12.9716, 77.5946]; // Bengaluru

function pinIcon(kind) {
  return L.divIcon({
    className: `pin pin-${kind}`,
    html: kind === 'start' ? 'A' : 'B',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function resultIcon() {
  return L.divIcon({ className: 'pin pin-result', html: '●', iconSize: [26, 26], iconAnchor: [13, 13] });
}

export function createPinMap(elId, { onPinsChanged, interactive = true } = {}) {
  const map = L.map(elId).setView(DEFAULT_CENTER, 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const state = {
    start: null,
    end: null,
    mode: 'start',
    markers: {},
    route: null,
    distanceKm: null,
    resultMarkers: [],
  };

  function snapshot() {
    return { start: state.start, end: state.end, distanceKm: state.distanceKm };
  }
  function notify() {
    onPinsChanged && onPinsChanged(snapshot());
  }
  function clearRoute() {
    if (state.route) {
      map.removeLayer(state.route);
      state.route = null;
    }
  }

  async function reverseLabel(lat, lng) {
    try {
      const data = await api(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
      return data.label;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  function drawStraightLine() {
    clearRoute();
    const pts = [
      [state.start.lat, state.start.lng],
      [state.end.lat, state.end.lng],
    ];
    state.route = L.polyline(pts, { color: '#2563eb', weight: 4, dashArray: '6 8' }).addTo(map);
    state.distanceKm = haversineKm(state.start.lat, state.start.lng, state.end.lat, state.end.lng);
    map.fitBounds(state.route.getBounds(), { padding: [40, 40] });
  }

  async function drawRoute() {
    if (!state.start || !state.end) return;
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${state.start.lng},${state.start.lat};${state.end.lng},${state.end.lat}` +
        `?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('routing failed');
      const data = await res.json();
      const route = data.routes && data.routes[0];
      if (!route) throw new Error('routing failed');
      clearRoute();
      state.route = L.geoJSON(route.geometry, {
        style: { color: '#2563eb', weight: 5, opacity: 0.85 },
      }).addTo(map);
      state.distanceKm = route.distance / 1000;
      map.fitBounds(state.route.getBounds(), { padding: [40, 40] });
    } catch {
      drawStraightLine();
    }
    notify();
  }

  async function setPin(kind, lat, lng, label) {
    const resolved = label || (await reverseLabel(lat, lng));
    state[kind] = { lat, lng, label: resolved };
    if (state.markers[kind]) map.removeLayer(state.markers[kind]);
    const marker = L.marker([lat, lng], {
      draggable: interactive,
      icon: pinIcon(kind),
      autoPan: true,
    }).addTo(map);
    marker.bindTooltip(resolved, { direction: 'top', offset: [0, -28] });
    if (interactive) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setPin(kind, pos.lat, pos.lng);
      });
    }
    state.markers[kind] = marker;
    if (state.start && state.end) {
      drawRoute();
    } else {
      map.setView([lat, lng], Math.max(map.getZoom(), 13));
      notify();
    }
  }

  if (interactive) {
    map.on('click', (e) => setPin(state.mode, e.latlng.lat, e.latlng.lng));
  }

  return {
    setMode(mode) {
      state.mode = mode;
    },
    setPin,
    getPins: snapshot,
    redrawRoute: drawRoute,
    async useMyLocation() {
      if (!navigator.geolocation) throw new Error('Geolocation is not supported by this browser');
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await setPin('start', pos.coords.latitude, pos.coords.longitude);
            resolve();
          },
          () => reject(new Error('Location permission denied')),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    },
    clearResults() {
      for (const m of state.resultMarkers) map.removeLayer(m);
      state.resultMarkers = [];
    },
    addResultMarker(lat, lng, text) {
      const m = L.marker([lat, lng], { icon: resultIcon() }).addTo(map);
      if (text) m.bindTooltip(text, { direction: 'top' });
      state.resultMarkers.push(m);
    },
    fitAll() {
      const layers = [...Object.values(state.markers), ...state.resultMarkers];
      if (state.route) layers.push(state.route);
      if (!layers.length) return;
      const group = L.featureGroup(layers);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    },
    invalidateSize() {
      map.invalidateSize();
    },
  };
}
