// Central frontend configuration.
// When the frontend is opened with VS Code Live Server (port 5500), the API
// runs separately on port 5000. In every other case (including production,
// where the backend serves this folder) the API is on the same origin.
const LIVE_SERVER_PORTS = ['5500', '5501'];

export const API_BASE = LIVE_SERVER_PORTS.includes(location.port)
  ? 'http://localhost:5000'
  : location.origin;

export const SOCKET_URL = API_BASE;

// Editable fare estimates in Rs per km (used only for the fare-split estimate).
export const FARE_PER_KM = {
  CAR: 18,
  BIKE: 8,
  AUTO: 18,
  SHARED_CAB: 10,
};