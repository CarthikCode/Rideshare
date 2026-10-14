export const qs = (id) => document.getElementById(id);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export function toast(message, type = 'info') {
  let host = qs('toasts');
  if (!host) {
    host = el('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const item = el('div', `toast toast-${type}`, message);
  host.appendChild(item);
  setTimeout(() => item.remove(), 4200);
}

export function showLoading(host, text = 'Loading…') {
  host.innerHTML = '';
  const wrap = el('div', 'loading-wrap');
  const spin = el('div', 'spinner');
  wrap.appendChild(spin);
  wrap.appendChild(el('div', '', text));
  host.appendChild(wrap);
}

export function emptyState(text, icon = '🛣️') {
  const box = el('div', 'empty-state');
  box.appendChild(el('span', 'empty-icon', icon));
  box.appendChild(el('div', '', text));
  return box;
}

export function setButtonLoading(btn, loading, label) {
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = label || 'Please wait…';
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
  }
}

export function formatIST(value) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTimeIST(value) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const VEHICLE_LABELS = {
  CAR: 'Car',
  BIKE: 'Bike',
  AUTO: 'Auto',
  SHARED_CAB: 'Shared cab',
};

export const VEHICLE_ICONS = {
  CAR: '🚗',
  BIKE: '🏍️',
  AUTO: '🛺',
  SHARED_CAB: '🚕',
};

export function statusPill(status) {
  return el('span', `status-pill status-${status}`, status);
}

export function rideRouteText(host, ride) {
  const route = el('div', 'ride-route');
  route.appendChild(document.createTextNode(ride.startLabel.split(',')[0]));
  route.appendChild(el('span', 'arrow', '→'));
  route.appendChild(document.createTextNode(ride.endLabel.split(',')[0]));
  host.appendChild(route);
}
