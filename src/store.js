// In-memory conversation state. Enough for one small/medium page;
// it resets when the server restarts.

const conversations = new Map(); // key -> { history: [{role, content}], pausedUntil }
const seenMessageIds = new Set();

function key(platform, userId) {
  return `${platform}:${userId}`;
}

function get(platform, userId) {
  const k = key(platform, userId);
  if (!conversations.has(k)) conversations.set(k, { history: [], pausedUntil: 0 });
  return conversations.get(k);
}

export function getHistory(platform, userId) {
  return get(platform, userId).history;
}

export function addTurn(platform, userId, role, content, limit) {
  const c = get(platform, userId);
  const last = c.history[c.history.length - 1];
  // The Messages API needs alternating roles: merge consecutive same-role turns.
  if (last && last.role === role) last.content += `\n${content}`;
  else c.history.push({ role, content });
  while (c.history.length > limit) c.history.shift();
  // History must start with a user turn.
  while (c.history.length && c.history[0].role !== "user") c.history.shift();
}

export function pause(platform, userId, hours) {
  get(platform, userId).pausedUntil = Date.now() + hours * 3600 * 1000;
}

export function isPaused(platform, userId) {
  return get(platform, userId).pausedUntil > Date.now();
}

// Meta sometimes delivers the same webhook twice.
export function alreadySeen(messageId) {
  if (!messageId) return false;
  if (seenMessageIds.has(messageId)) return true;
  seenMessageIds.add(messageId);
  if (seenMessageIds.size > 5000) seenMessageIds.delete(seenMessageIds.values().next().value);
  return false;
}

export function _resetForTests() {
  conversations.clear();
  seenMessageIds.clear();
}
