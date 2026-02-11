/**
 * SSE Connection Manager
 *
 * In-memory map of userId → Set<Response> for active SSE connections.
 * Supports multiple browser tabs per user.
 */

/** @type {Map<number, Set<import('express').Response>>} */
const clients = new Map();

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Register an SSE client connection.
 */
export function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);
}

/**
 * Remove an SSE client connection (called on close/error).
 */
export function removeClient(userId, res) {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
}

/**
 * Send an SSE event to a specific user (all their open connections).
 * @returns {boolean} true if user was online and message was sent
 */
export function sendToUser(userId, eventName, data) {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) {
    return false;
  }

  const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const res of userClients) {
    try {
      res.write(message);
    } catch {
      removeClient(userId, res);
    }
  }
  return true;
}

/**
 * Send heartbeat ping to all connected clients to keep connections alive.
 */
function sendHeartbeatAll() {
  const comment = `: heartbeat ${new Date().toISOString()}\n\n`;
  for (const [userId, userClients] of clients) {
    for (const res of userClients) {
      try {
        res.write(comment);
      } catch {
        removeClient(userId, res);
      }
    }
  }
}

/**
 * Start the global heartbeat interval. Call once at server startup.
 * @returns {NodeJS.Timeout}
 */
export function startHeartbeat() {
  return setInterval(sendHeartbeatAll, HEARTBEAT_INTERVAL_MS);
}
