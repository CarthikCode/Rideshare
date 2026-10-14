import { api } from './api.js';
import { requireAuth, renderNav } from './auth.js';
import { createPinMap, wirePlaceSearch } from './map.js';
import { estimateFare } from './fare.js';
import {
  qs, el, toast, setButtonLoading, formatIST,
  VEHICLE_LABELS, VEHICLE_ICONS, rideRouteText,
} from './ui.js';

const user = await requireAuth();
if (!user) throw new Error('redirecting to login');
renderNav('create');

let lastDistanceKm = null;

const pinMap = createPinMap('map', {
  onPinsChanged({ start, end, distanceKm }) {
    qs('startReadout').textContent = start ? start.label : 'Not set — click the map or search a place';
    qs('endReadout').textContent = end ? end.label : 'Not set — click the map or search a place';
    lastDistanceKm = distanceKm;
    const routeInfo = qs('routeInfo');
    if (start && end && distanceKm != null) {
      routeInfo.classList.add('visible');
      qs('routeDistance').textContent = `${distanceKm.toFixed(1)} km`;
      updateFarePreview();
    } else {
      routeInfo.classList.remove('visible');
      qs('fareBox').classList.add('hidden');
    }
  },
});

function updateFarePreview() {
  const box = qs('fareBox');
  if (lastDistanceKm == null) {
    box.classList.add('hidden');
    return;
  }
  const vehicle = qs('vehicleType').value;
  const seats = Number(qs('seatsTotal').value) || 1;
  const fare = estimateFare(lastDistanceKm, vehicle, seats);
  box.classList.remove('hidden');
  box.innerHTML = '';
  const line = el('div');
  line.appendChild(document.createTextNode('Estimated fare: '));
  line.appendChild(el('strong', '', `₹${fare.total}`));
  line.appendChild(document.createTextNode(` total · about `));
  line.appendChild(el('strong', '', `₹${fare.perPerson} per person`));
  line.appendChild(document.createTextNode(` split among ${fare.riders} passenger(s)`));
  box.appendChild(line);
  box.appendChild(el('span', 'fare-note', 'Rough estimate only (distance × per-km rate). No payments happen on RideShare.'));
}

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

qs('vehicleType').addEventListener('change', updateFarePreview);
qs('seatsTotal').addEventListener('input', updateFarePreview);

const departInput = qs('departureAt');
departInput.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 16);

qs('rideForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { start, end } = pinMap.getPins();
  if (!start || !end) {
    toast('Set both a start pin and a destination pin on the map', 'error');
    return;
  }
  if (!departInput.value) {
    toast('Pick a departure date and time', 'error');
    return;
  }
  const btn = qs('postBtn');
  setButtonLoading(btn, true, 'Posting…');
  try {
    const data = await api('/api/rides', {
      method: 'POST',
      body: {
        startLabel: start.label,
        startLat: start.lat,
        startLng: start.lng,
        endLabel: end.label,
        endLat: end.lat,
        endLng: end.lng,
        departureAt: new Date(departInput.value).toISOString(),
        vehicleType: qs('vehicleType').value,
        seatsTotal: Number(qs('seatsTotal').value),
        note: qs('note').value.trim() || undefined,
      },
    });
    toast('Ride posted! Matching rides below.', 'success');
    renderMatches(data.matches, data.ride.id);
  } catch (err) {
    toast(err.details?.[0]?.message || err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});

function renderMatches(matches, ownRideId) {
  const section = qs('matchesSection');
  const list = qs('matchesList');
  list.innerHTML = '';
  section.classList.remove('hidden');

  const ownCard = el('div', 'ride-card');
  const ownTop = el('div', 'card-row');
  ownTop.appendChild(el('strong', '', 'Your ride is live'));
  const ownLink = el('a', 'btn btn-sm btn-outline', 'View your ride');
  ownLink.href = `ride-details.html?id=${ownRideId}`;
  ownTop.appendChild(ownLink);
  ownCard.appendChild(ownTop);
  list.appendChild(ownCard);

  if (!matches.length) {
    list.appendChild(
      el('div', 'empty-state', 'No matching rides right now. Matches appear when someone posts the same route within 100 m and 15 minutes of yours.')
    );
  }
  for (const m of matches) {
    const card = el('div', 'ride-card');
    rideRouteText(card, m);
    const meta = el('div', 'ride-meta');
    meta.appendChild(el('span', '', `${VEHICLE_ICONS[m.vehicleType]} ${VEHICLE_LABELS[m.vehicleType]}`));
    meta.appendChild(el('span', '', `🕒 ${formatIST(m.departureAt)} IST`));
    meta.appendChild(el('span', '', `💺 ${m.seatsAvailable} seat(s) free`));
    meta.appendChild(el('span', '', `👤 ${m.owner.displayName}`));
    card.appendChild(meta);
    card.appendChild(
      el('div', 'ride-distances', `Start ${m.startDistanceMeters} m away · Destination ${m.endDistanceMeters} m away`)
    );
    const link = el('a', 'btn btn-sm', 'View & request to join');
    link.href = `ride-details.html?id=${m.id}`;
    card.appendChild(link);
    list.appendChild(card);
  }
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
