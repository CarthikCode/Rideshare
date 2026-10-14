import { api } from './api.js';
import { requireAuth, renderNav } from './auth.js';
import { createPinMap } from './map.js';
import { renderRideApps } from './rideApps.js';
import { estimateFare } from './fare.js';
import {
  qs, el, toast, showLoading, emptyState, formatIST,
  VEHICLE_LABELS, VEHICLE_ICONS, statusPill,
} from './ui.js';

const user = await requireAuth();
if (!user) throw new Error('redirecting to login');
renderNav();

const rideId = new URLSearchParams(location.search).get('id');
const host = qs('detail');

if (!rideId) {
  host.appendChild(emptyState('No ride selected.', '⚠️'));
} else {
  loadRide();
}

async function loadRide() {
  showLoading(host, 'Loading ride…');
  try {
    const data = await api(`/api/rides/${rideId}`);
    render(data);
  } catch (err) {
    host.innerHTML = '';
    host.appendChild(emptyState(err.message, '⚠️'));
  }
}

function render({ ride, isOwner, myRequest, requests }) {
  host.innerHTML = '';

  const card = el('div', 'card');
  const top = el('div', 'ride-card-top');
  const title = el('h1', '', `${ride.startLabel.split(',')[0]} → ${ride.endLabel.split(',')[0]}`);
  title.style.fontSize = '1.35rem';
  top.appendChild(title);
  top.appendChild(statusPill(ride.status));
  card.appendChild(top);

  const meta = el('div', 'ride-meta');
  meta.appendChild(el('span', '', `${VEHICLE_ICONS[ride.vehicleType]} ${VEHICLE_LABELS[ride.vehicleType]}`));
  meta.appendChild(el('span', '', `🕒 ${formatIST(ride.departureAt)} IST`));
  meta.appendChild(el('span', '', `💺 ${ride.seatsAvailable}/${ride.seatsTotal} seats free`));
  meta.appendChild(el('span', '', `👤 ${isOwner ? 'You' : ride.owner.displayName}`));
  card.appendChild(meta);

  const routeLines = el('div', 'small muted mt-16');
  routeLines.appendChild(el('div', '', `From: ${ride.startLabel}`));
  routeLines.appendChild(el('div', '', `To: ${ride.endLabel}`));
  card.appendChild(routeLines);

  if (ride.note) {
    const note = el('p', 'mt-16');
    note.appendChild(el('strong', '', 'Note: '));
    note.appendChild(document.createTextNode(ride.note));
    card.appendChild(note);
  }

  const mapBox = el('div');
  mapBox.id = 'detailMap';
  mapBox.className = 'map mt-16';
  card.appendChild(mapBox);
  host.appendChild(card);

  const pinMap = createPinMap('detailMap', { interactive: false });
  pinMap.setPin('start', ride.startLat, ride.startLng, ride.startLabel);
  pinMap.setPin('end', ride.endLat, ride.endLng, ride.endLabel);

  const riders = ride.seatsTotal - ride.seatsAvailable + 1;
  const actions = el('div', 'card');
  actions.id = 'actionsCard';
  host.appendChild(actions);

  if (isOwner) {
    renderOwnerActions(actions, ride, requests);
  } else {
    renderGuestActions(actions, ride, myRequest);
  }

  if (myRequest?.status === 'ACCEPTED' && !isOwner) {
    const appsCard = el('div', 'card');
    appsCard.appendChild(el('h2', '', 'Ready to ride?'));
    appsCard.lastChild.style.fontSize = '1.1rem';
    const chat = el('a', 'btn mb-16', 'Open chat with the owner');
    chat.href = `chat.html?request=${myRequest.id}`;
    appsCard.appendChild(chat);
    renderRideApps(appsCard, ride);
    host.appendChild(appsCard);
  }

}

function renderOwnerActions(host, ride, requests) {
  host.appendChild(el('h2', '', 'Requests on this ride')).style.fontSize = '1.1rem';
  if (!requests?.length) {
    host.appendChild(el('p', 'muted', 'No active requests yet.'));
  } else {
    for (const rq of requests) {
      const row = el('div', 'card-row mb-16');
      const info = el('div');
      info.appendChild(el('strong', '', rq.requester.displayName));
      info.appendChild(document.createTextNode(' '));
      info.appendChild(statusPill(rq.status));
      row.appendChild(info);
      const actions = el('div', 'card-row-actions');
      if (rq.status === 'PENDING') {
        const accept = el('button', 'btn btn-sm btn-success', 'Accept');
        accept.addEventListener('click', () => respond(rq.id, 'accept'));
        const reject = el('button', 'btn btn-sm btn-danger', 'Reject');
        reject.addEventListener('click', () => respond(rq.id, 'reject'));
        actions.appendChild(accept);
        actions.appendChild(reject);
      }
      if (rq.status === 'ACCEPTED') {
        const chat = el('a', 'btn btn-sm', 'Open chat');
        chat.href = `chat.html?request=${rq.id}`;
        actions.appendChild(chat);
        safetyButtons(actions, rq.requester.id);
      }
      row.appendChild(actions);
      host.appendChild(row);
    }
  }
  if (ride.status === 'ACTIVE' || ride.status === 'FULL') {
    const cancel = el('button', 'btn btn-danger', 'Cancel this ride');
    cancel.addEventListener('click', async () => {
      if (!confirm('Cancel this ride? All its requests will be cancelled.')) return;
      try {
        await api(`/api/rides/${ride.id}/cancel`, { method: 'POST' });
        toast('Ride cancelled', 'success');
        loadRide();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    host.appendChild(cancel);
  }
}

function renderGuestActions(host, ride, myRequest) {
  const riders = ride.seatsTotal - ride.seatsAvailable + 1;
  const join = el('button', 'btn btn-block', 'Request to join this ride');
  join.addEventListener('click', async () => {
    join.disabled = true;
    try {
      await api('/api/requests', { method: 'POST', body: { rideId: ride.id } });
      toast('Request sent to the ride owner', 'success');
      loadRide();
    } catch (err) {
      toast(err.message, 'error');
      join.disabled = false;
    }
  });

  if (!myRequest) {
    if (ride.status === 'ACTIVE' && ride.seatsAvailable > 0 && new Date(ride.departureAt) > new Date()) {
      host.appendChild(join);
    } else {
      host.appendChild(el('p', 'muted', 'This ride is not accepting requests.'));
    }
  } else if (myRequest.status === 'PENDING') {
    host.appendChild(el('p', '', 'Your request is waiting for the owner.'));
    const cancel = el('button', 'btn btn-danger btn-block', 'Cancel my request');
    cancel.addEventListener('click', () => cancelRequest(myRequest.id));
    host.appendChild(cancel);
  } else if (myRequest.status === 'ACCEPTED') {
    host.appendChild(el('p', '', '✅ Your request was accepted. Coordinate in the chat below.'));
    const cancel = el('button', 'btn btn-ghost btn-block mt-16', 'Cancel my seat');
    cancel.addEventListener('click', () => cancelRequest(myRequest.id));
    host.appendChild(cancel);
  }

  const safety = el('div', 'card-row-actions mt-16');
  safetyButtons(safety, ride.owner.id);
  host.appendChild(safety);
}

function safetyButtons(host, otherUserId) {
  const report = el('button', 'btn btn-sm btn-ghost', 'Report user');
  report.addEventListener('click', async () => {
    const reason = prompt('Why are you reporting this user?');
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/api/users/${otherUserId}/report`, { method: 'POST', body: { reason: reason.trim() } });
      toast('Report submitted. Thank you.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  const block = el('button', 'btn btn-sm btn-ghost', 'Block user');
  block.addEventListener('click', async () => {
    if (!confirm('Block this user? They will no longer see your rides, requests or chats.')) return;
    try {
      await api(`/api/users/${otherUserId}/block`, { method: 'POST' });
      toast('User blocked', 'success');
      location.href = 'dashboard.html';
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  host.appendChild(report);
  host.appendChild(block);
}

async function respond(id, action) {
  try {
    await api(`/api/requests/${id}/${action}`, { method: 'POST' });
    toast(action === 'accept' ? 'Request accepted' : 'Request rejected', 'success');
    loadRide();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function cancelRequest(id) {
  try {
    await api(`/api/requests/${id}/cancel`, { method: 'POST' });
    toast('Request cancelled', 'success');
    loadRide();
  } catch (err) {
    toast(err.message, 'error');
  }
}
