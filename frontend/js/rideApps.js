import { el, toast } from './ui.js';

// Only official, documented links are used. Uber documents a universal link
// that pre-fills pickup and drop-off; Ola and Rapido have no documented
// prefill link, so their official sites are opened instead.
export function buildRideAppLinks(ride) {
  const uber =
    'https://m.uber.com/ul/?action=setPickup' +
    `&pickup[latitude]=${ride.startLat}&pickup[longitude]=${ride.startLng}` +
    `&dropoff[latitude]=${ride.endLat}&dropoff[longitude]=${ride.endLng}`;
  return [
    { name: 'Uber', url: uber, prefilled: true },
    { name: 'Ola', url: 'https://book.olacabs.com/', prefilled: false },
    { name: 'Rapido', url: 'https://www.rapido.bike/', prefilled: false },
  ];
}

export function renderRideApps(container, ride) {
  container.innerHTML = '';
  const label = el('div', 'section-label', 'Continue in a ride app (opens with pickup & drop pre-filled where supported)');
  container.appendChild(label);
  const wrap = el('div', 'ride-apps');
  for (const app of buildRideAppLinks(ride)) {
    const a = el('a', 'btn btn-outline btn-sm', `Open in ${app.name}${app.prefilled ? '' : ' (no prefill)'}`);
    a.href = app.url;
    a.target = '_blank';
    a.rel = 'noopener';
    wrap.appendChild(a);
  }
  const copy = el('button', 'btn btn-ghost btn-sm', 'Copy pickup & drop');
  copy.addEventListener('click', async () => {
    const text = `Pickup: ${ride.startLabel} (${ride.startLat}, ${ride.startLng})\nDrop: ${ride.endLabel} (${ride.endLat}, ${ride.endLng})`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Pickup & drop copied', 'success');
    } catch {
      toast('Copy failed — please copy the addresses manually', 'error');
    }
  });
  wrap.appendChild(copy);
  container.appendChild(wrap);
}
