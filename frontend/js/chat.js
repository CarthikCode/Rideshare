import { api } from './api.js';
import { requireAuth, renderNav } from './auth.js';
import { connectSocket } from './socket.js';
import { renderRideApps } from './rideApps.js';
import { qs, el, toast, formatTimeIST, formatIST } from './ui.js';

const user = await requireAuth();
if (!user) throw new Error('redirecting to login');
renderNav();

const requestId = new URLSearchParams(location.search).get('request');
const messagesEl = qs('chatMessages');
const input = qs('chatInput');
const sendBtn = qs('sendBtn');

let socket = null;
let chatOpen = false;

if (!requestId) {
  showNotice('No chat selected.');
  disableInput();
} else {
  init();
}

function showNotice(text) {
  const n = el('div', 'chat-notice', text);
  qs('chatShell').insertBefore(n, messagesEl);
}

function disableInput() {
  input.disabled = true;
  sendBtn.disabled = true;
}

async function init() {
  let data;
  try {
    data = await api(`/api/requests/${requestId}/messages`);
  } catch (err) {
    showNotice(err.message);
    disableInput();
    return;
  }

  qs('chatTitle').textContent = `Chat with ${data.otherParty.displayName}`;
  qs('chatRide').textContent =
    `${data.request.ride.startLabel.split(',')[0]} → ${data.request.ride.endLabel.split(',')[0]} · ${formatIST(data.request.ride.departureAt)} IST`;
  qs('chatTools').classList.remove('hidden');
  qs('chatAppsWrap').classList.remove('hidden');
  renderRideApps(qs('chatApps'), data.request.ride);

  if (data.request.status !== 'ACCEPTED' || data.blocked) {
    showNotice('This chat is closed. Chats are only open while a request is accepted.');
    disableInput();
  }

  for (const m of data.messages) appendMessage(m, data.meId);
  scrollToBottom();

  socket = connectSocket();
  if (!socket) {
    showNotice('Live chat is unavailable. You can read history but not send.');
    disableInput();
    return;
  }
  socket.on('connect', () => {
    socket.emit('chat:join', { requestId }, (res) => {
      if (!res?.ok) {
        showNotice(res?.error || 'Chat is not available.');
        disableInput();
        return;
      }
      chatOpen = true;
    });
  });
  socket.on('chat:message', (msg) => {
    if (msg.requestId !== requestId) return;
    appendMessage(msg, data.meId);
    scrollToBottom();
  });

  const blockBtn = qs('blockBtn');
  blockBtn.addEventListener('click', async () => {
    if (!confirm('Block this user? The chat will close and your rides will be hidden from each other.')) return;
    try {
      await api(`/api/users/${data.otherParty.id}/block`, { method: 'POST' });
      toast('User blocked', 'success');
      location.href = 'dashboard.html';
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  qs('reportBtn').addEventListener('click', async () => {
    const reason = prompt('Why are you reporting this user?');
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/api/users/${data.otherParty.id}/report`, { method: 'POST', body: { reason: reason.trim() } });
      toast('Report submitted. Thank you.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function appendMessage(msg, meId) {
  const mine = msg.sender.id === meId;
  const bubble = el('div', `chat-bubble ${mine ? 'mine' : 'theirs'}`);
  bubble.appendChild(el('span', '', msg.body));
  bubble.appendChild(el('span', 'chat-time', formatTimeIST(msg.createdAt)));
  messagesEl.appendChild(bubble);
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function send() {
  const body = input.value.trim();
  if (!body) return;
  if (!chatOpen) {
    toast('Chat is not open yet', 'error');
    return;
  }
  sendBtn.disabled = true;
  socket.emit('chat:send', { requestId, body }, (res) => {
    sendBtn.disabled = false;
    if (!res?.ok) {
      toast(res?.error || 'Could not send', 'error');
      return;
    }
    input.value = '';
    input.focus();
  });
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    send();
  }
});
