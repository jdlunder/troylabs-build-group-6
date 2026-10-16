import { randomBytes, randomUUID } from 'node:crypto';
import { EFFECTS, MAX_HISTORY, ROUND_MS } from '../shared/catalog.js';

export const rooms = new Map();
export function createRoom(now = Date.now()) {
  let code;
  do { code = Array.from(randomBytes(4), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 31]).join(''); } while (rooms.has(code));
  const room = { code, hostToken: randomBytes(24).toString('hex'), createdAt: now, lastActivity: now, participants: new Map(), history: [], effects: {}, totalCommands: 0, revision: 0, status: 'lobby', startedAt: null, pausedAt: null, pauseDuration: 0, timeAdjustmentMs: 0, clockLocked: false, lastClockChange: 0, progress: { cells: 0, health: 100, launches: 0 }, round: 1, receipts: new Map() };
  rooms.set(code, room);
  return room;
}
export function publicRoom(room, now = Date.now()) {
  return { code: room.code, status: room.status, startedAt: room.startedAt, pausedAt: room.pausedAt, pauseDuration: room.pauseDuration, serverNow: now, roundMs: ROUND_MS + room.timeAdjustmentMs, clockLocked: room.clockLocked, round: room.round, revision: room.revision, audience: [...room.participants.values()].filter(p => p.sockets.size > 0 && !p.host).length, effects: Object.values(room.effects), history: room.history.slice(-MAX_HISTORY).reverse(), totalCommands: room.totalCommands, progress: room.progress, aiEnabled: Boolean(process.env.LLM_API_KEY) };
}
export function applyPlan(room, plan, author, text, now = Date.now()) {
  const effects = plan.effects.map(effect => ({ ...effect, duration: effect.duration || EFFECTS[effect.id].duration, count: effect.count || 4 }));
  const event = { id: randomUUID(), at: now, text, author, effects, engine: plan.engine, revision: ++room.revision };
  for (const effect of effects) {
    const config = EFFECTS[effect.id];
    if (config.kind === 'clock') {
      const remaining = ROUND_MS + room.timeAdjustmentMs - (now - room.startedAt - room.pauseDuration);
      const next = effect.id === 'timeplus' ? Math.min(300000, remaining + 15000) : Math.min(remaining, Math.max(15000, remaining - 10000));
      const delta = next - remaining;
      room.timeAdjustmentMs += delta;
      event.timerDeltaMs = (event.timerDeltaMs || 0) + delta;
      continue;
    }
    if (effect.remove) {
      delete room.effects[effect.id];
    } else if (effect.duration) {
      for (const [id, previous] of Object.entries(room.effects)) if (EFFECTS[id].kind === config.kind && id !== effect.id) delete room.effects[id];
      room.effects[effect.id] = { ...effect, expiresAt: now + effect.duration, author };
    }
  }
  room.history.push(event);
  room.history = room.history.slice(-MAX_HISTORY);
  room.totalCommands++;
  room.lastActivity = now;
  return event;
}
export function expireEffects(room, now = Date.now()) {
  if (room.status === 'paused') return false;
  let changed = false;
  for (const [id, effect] of Object.entries(room.effects)) if (effect.expiresAt <= now) { delete room.effects[id]; changed = true; }
  if (changed) room.revision++;
  return changed;
}
export function hostAction(room, action, now = Date.now()) {
  room.lastActivity = now;
  room.revision++;
  if (action === 'start') {
    if (room.status === 'lobby') { room.status = 'live'; room.startedAt = now; }
    else if (room.status === 'paused') {
      const elapsed = now - room.pausedAt;
      room.pauseDuration += elapsed;
      Object.values(room.effects).forEach(effect => { effect.expiresAt += elapsed; });
      room.pausedAt = null;
      room.status = 'live';
    }
  } else if (action === 'pause' && room.status === 'live') {
    room.status = 'paused'; room.pausedAt = now;
  } else if (action === 'reset') {
    Object.assign(room, { history: [], effects: {}, totalCommands: 0, status: 'lobby', startedAt: null, pausedAt: null, pauseDuration: 0, timeAdjustmentMs: 0, clockLocked: false, lastClockChange: 0, progress: { cells: 0, health: 100, launches: 0 }, round: room.round + 1 });
    room.receipts.clear();
  } else if (action === 'clear') {
    room.effects = {};
  } else if (action === 'finale') {
    room.status = 'finale';
  } else if (action === 'lockclock') {
    room.clockLocked = !room.clockLocked;
  }
}
