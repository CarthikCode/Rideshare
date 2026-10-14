import { api } from './api.js';
import { requireAuth, renderNav } from './auth.js';
import { createPinMap, wirePlaceSearch } from './map.js';
import { estimateFare, haversineKm } from './fare.js';
import {
  qs, el, toast, setButtonLoading, showLoading, emptyState, formatIST,
  VEHICLE_LABELS, VEHICLE_ICONS, rideRouteText, statusPill,
} from './ui.js';

const user = await requireAuth();
if (!user) throw new Error('redirecting to login');
renderNav('search');

const pinMap = createPinMap('map', {
  onPinsChanged({ start, end, distanceKm }) {
    qs('startReadout').textContent = start ? start.label : 'Not set — click the map or search a place';
    qs('endReadout').textContent = end ? end.label : 'Not set — click the map or search a place';
    const routeInfo = qs('routeInfo');
    if (start && end && distanceKm != null) {
      routeInfo.classList.add('visible');
      qs('routeDistance').textContent = `${distanceKm.toFixed(1)} km`;
    } else {
      routeInfo.classList.remove('visible');
    }
  },
});

const modeButtons = document.querySelectorAll('.pin-mode button');
modeButtons.forEach((b) =>
  b.addEventListener('click', () => {
    modeButtons.forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    pinMap.setMode(b.dataset.mode);
  })
);

wirePlaceSearch({
  input: qs('placeInput'),
  button: qs('placeBtn'),
  resultsEl: qs('placeResults'),
  onPick: (r) => {
    const mode = document.querySelector('.pin-mode button.active')?.dataset.mode || 'start';
    pinMap.setPin(mode, r.lat, r.lng, r.label);
  },
});

qs('locateBtn').addEventListener('click', async () => {
  try {
    await pinMap.useMyLocation();
    toast('Start pin set to your current location', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

const departInput = qs('departureAt');

qs('searchBtn').addEventListener('click', runSearch);
async function runSearch() {
  const { start, end } = pinMap.getPins();
  if (!start || !end) {
    toast('Set both a start pin and a destination pin first', 'error');
    return;
  }
  if (!departInput.value) {
    toast('Pick a date and time', 'error');
    return;
  }
  const btn = qs('searchBtn');
  setButtonLoading(btn, true, 'Searching…');
  const list = qs('resultsList');
  showLoading(list, 'Looking for matching rides…');
  pinMap.clearResults();
  try {
    const params = new URLSearchParams({
      startLat: start.lat,
      startLng: start.lng,
      endLat: end.lat,
      endLng: end.lng,
      departureAt: new Date(departInput.value).toISOString(),
    });
    const data = await api(`/api/rides/search?${params}`);
    renderResults(data.rides);
  } catch (err) {
    list.innerHTML = '';
    list.appendChild(emptyState(err.message, '⚠️'));
  } finally {
    setButtonLoading(btn, false);
  }
}

function renderResults(rides) {
  const list = qs('resultsList');
  list.innerHTML = '';
  qs('resultsSection').classList.remove('hidden');
  qs('resultsTitle').textContent = `Matching rides (${rides.length})`;
  if (!rides.length) {
    list.appendChild(
      emptyState('No rides match your exact route and time window yet. Try posting your ride so others can find you.', '🔍')
    );
    return;
  }
  for (const ride of rides) {
    pinMap.addResultMarker(ride.startLat, ride.startLng, `Start: ${ride.startLabel.split(',')[0]}`);
    const card = el('div', 'ride-card');
    const top = el('div', 'ride-card-top');
    const left = el('div');
    rideRouteText(left, ride);
    top.appendChild(left);
    top.appendChild(statusPill(ride.status));
    card.appendChild(top);

    const meta = el('div', 'ride-meta');
    meta.appendChild(el('span', '', `${VEHICLE_ICONS[ride.vehicleType]} ${VEHICLE_LABELS[ride.vehicleType]}`));
    meta.appendChild(el('span', '', `🕒 ${formatIST(ride.departureAt)} IST`));
    meta.appendChild(el('span', '', `💺 ${ride.seatsAvailable} seat(s) free`));
    meta.appendChild(el('span', '', `👤 ${ride.owner.displayName}`));
    card.appendChild(meta);

    card.appendChild(
      el('div', 'ride-distances', `Start ${ride.startDistanceMeters} m from yours · Destination ${ride.endDistanceMeters} m from yours`)
    );

    const straightKm = haversineKm(ride.startLat, ride.startLng, ride.endLat, ride.endLng);
    const fare = estimateFare(straightKm, ride.vehicleType, ride.seatsTotal);
    card.appendChild(
      el('div', 'small muted', `Estimated fare: ₹${fare.total} total · ~₹${fare.perPerson} per person if all ${fare.riders} seat(s) fill. Estimate only.`)
    );

    const link = el('a', 'btn btn-sm', 'View & request to join');
    link.href = `ride-details.html?id=${ride.id}`;
    card.appendChild(link);
    list.appendChild(card);
  }
  pinMap.fitAll();
}
