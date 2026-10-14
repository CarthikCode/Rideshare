import { api } from './api.js';
import { requireAuth, renderNav, refreshPendingBadge } from './auth.js';
import { connectSocket } from './socket.js';
import {
  qs, el, toast, showLoading, emptyState, formatIST,
  VEHICLE_LABELS, VEHICLE_ICONS, statusPill, rideRouteText,
} from './ui.js';

const user = await requireAuth();
if (!user) throw new Error('redirecting to login');
await renderNav('dashboard');
qs('welcome').textContent = `Hi, ${user.name.split(' ')[0]} 👋`;

const socket = connectSocket();
socket?.on('request:update', (payload) => {
  const messages = {
    created: 'New join request on your ride',
    accepted: 'Your join request was accepted — chat is open',
    rejected: 'Your join request was declined',
    cancelled: 'A request was cancelled',
    'ride-cancelled': 'A ride you requested was cancelled',
  };
  toast(messages[payload?.type] || 'Something updated', 'info');
  loadAll();
  refreshPendingBadge();
});

function seatText(ride) {
  return `💺 ${ride.seatsAvailable}/${ride.seatsTotal} seats free`;
}

function renderMyRides(rides) {
  const host = qs('myRides');
  host.innerHTML = '';
  qs('myRidesCount').textContent = rides.length;
  if (!rides.length) {
    host.appendChild(emptyState('You have not posted any rides yet.', '🚗'));
    return;
  }
  for (const ride of rides) {
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
    meta.appendChild(el('span', '', seatText(ride)));
    if (ride.pendingRequests > 0) {
      meta.appendChild(el('span', 'ride-distances', `🔔 ${ride.pendingRequests} pending request(s)`));
    }
    card.appendChild(meta);
    const actions = el('div', 'card-row-actions');
    const view = el('a', 'btn btn-sm btn-outline', 'View');
    view.href = `ride-details.html?id=${ride.id}`;
    actions.appendChild(view);
    if (ride.status === 'ACTIVE' || ride.status === 'FULL') {
      const cancel = el('button', 'btn btn-sm btn-danger', 'Cancel ride');
      cancel.addEventListener('click', async () => {
        if (!confirm('Cancel this ride? All its requests will be cancelled.')) return;
        try {
          await api(`/api/rides/${ride.id}/cancel`, { method: 'POST' });
          toast('Ride cancelled', 'success');
          loadAll();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      actions.appendChild(cancel);
    }
    card.appendChild(actions);
    host.appendChild(card);
  }
}

function renderIncoming(requests) {
  const host = qs('incoming');
  host.innerHTML = '';
  qs('incomingCount').textContent = requests.filter((r) => r.status === 'PENDING').length;
  if (!requests.length) {
    host.appendChild(emptyState('No incoming requests right now.', '📭'));
    return;
  }
  for (const rq of requests) {
    const card = el('div', 'ride-card');
    const top = el('div', 'ride-card-top');
    top.appendChild(el('strong', '', `${rq.requester.displayName} wants to join`));
    top.appendChild(statusPill(rq.status));
    card.appendChild(top);
    const meta = el('div', 'ride-meta');
    rideRouteText(meta, rq.ride);
    meta.appendChild(el('span', '', `🕒 ${formatIST(rq.ride.departureAt)} IST`));
    card.appendChild(meta);
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
    }
    card.appendChild(actions);
    host.appendChild(card);
  }
}

async function respond(id, action) {
  try {
    await api(`/api/requests/${id}/${action}`, { method: 'POST' });
    toast(action === 'accept' ? 'Request accepted — chat is open' : 'Request rejected', 'success');
    loadAll();
    refreshPendingBadge();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderSent(requests) {
  const host = qs('sent');
  host.innerHTML = '';
  qs('sentCount').textContent = requests.length;
  if (!requests.length) {
    host.appendChild(emptyState('You have not requested to join any rides yet.', '✋'));
    return;
  }
  for (const rq of requests) {
    const card = el('div', 'ride-card');
    const top = el('div', 'ride-card-top');
    const left = el('div');
    rideRouteText(left, rq.ride);
    top.appendChild(left);
    top.appendChild(statusPill(rq.status));
    card.appendChild(top);
    const meta = el('div', 'ride-meta');
    meta.appendChild(el('span', '', `👤 ${rq.ride.owner.displayName}`));
    meta.appendChild(el('span', '', `🕒 ${formatIST(rq.ride.departureAt)} IST`));
    meta.appendChild(el('span', `status-pill status-${rq.ride.status}`, rq.ride.status));
    card.appendChild(meta);
    const actions = el('div', 'card-row-actions');
    const view = el('a', 'btn btn-sm btn-outline', 'View ride');
    view.href = `ride-details.html?id=${rq.rideId}`;
    actions.appendChild(view);
    if (rq.status === 'ACCEPTED') {
      const chat = el('a', 'btn btn-sm', 'Open chat');
      chat.href = `chat.html?request=${rq.id}`;
      actions.appendChild(chat);
    }
    if (rq.status === 'PENDING' || rq.status === 'ACCEPTED') {
      const cancel = el('button', 'btn btn-sm btn-danger', 'Cancel request');
      cancel.addEventListener('click', async () => {
        try {
          await api(`/api/requests/${rq.id}/cancel`, { method: 'POST' });
          toast('Request cancelled', 'success');
          loadAll();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      actions.appendChild(cancel);
    }
    card.appendChild(actions);
    host.appendChild(card);
  }
}

function renderChats(chats) {
  const host = qs('chats');
  host.innerHTML = '';
  qs('chatsCount').textContent = chats.length;
  if (!chats.length) {
    host.appendChild(emptyState('No active chats. Chats open when a join request is accepted.', '💬'));
    return;
  }
  for (const chat of chats) {
    const card = el('div', 'ride-card');
    const top = el('div', 'ride-card-top');
    top.appendChild(el('strong', '', `Chat with ${chat.otherParty.displayName}`));
    top.appendChild(statusPill(chat.ride.status));
    card.appendChild(top);
    const meta = el('div', 'ride-meta');
    rideRouteText(meta, chat.ride);
    meta.appendChild(el('span', '', `🕒 ${formatIST(chat.ride.departureAt)} IST`));
    card.appendChild(meta);
    const open = el('a', 'btn btn-sm', 'Open chat');
    open.href = `chat.html?request=${chat.id}`;
    card.appendChild(open);
    host.appendChild(card);
  }
}

async function loadAll() {
  const hosts = [qs('myRides'), qs('incoming'), qs('sent'), qs('chats')];
  hosts.forEach((h) => showLoading(h));
  try {
    const [rides, incoming, sent, chats] = await Promise.all([
      api('/api/rides/mine'),
      api('/api/requests/incoming'),
      api('/api/requests/sent'),
      api('/api/requests/active-chats'),
    ]);
    renderMyRides(rides.rides);
    renderIncoming(incoming.requests);
    renderSent(sent.requests);
    renderChats(chats.chats);
  } catch (err) {
    hosts.forEach((h) => {
      h.innerHTML = '';
      h.appendChild(emptyState(err.message, '⚠️'));
    });
  }
}

qs('clearCancelledBtn').addEventListener('click', async () => {
  if (!confirm('Remove all your cancelled and expired rides and requests? This cannot be undone.')) return;
  try {
    const data = await api('/api/rides/clear-cancelled', { method: 'POST' });
    toast(`Cleared ${data.deletedRides} ride(s) and ${data.deletedRequests} request(s)`, 'success');
    loadAll();
    refreshPendingBadge();
  } catch (err) {
    toast(err.message, 'error');
  }
});

loadAll();
