import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { compileCommand, planSchema } from './compiler.js';
import { rooms, createRoom, publicRoom, applyPlan, expireEffects, hostAction } from './rooms.js';
import { cleanText, EFFECTS, ROUND_MS } from '../shared/catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const palette = ['#f9dc7b', '#c5b0ff', '#9de3d7', '#ffa7a1', '#a2cbff', '#f3ace0'];
export async function createApplication({ dev = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  const http = createServer(app);
  const io = new Server(http, { maxHttpBufferSize: 12000, pingTimeout: 15000, pingInterval: 10000, transports: ['websocket', 'polling'] });
  const creationLimits = new Map();
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'godmode', rooms: rooms.size }));
  app.post('/api/rooms', (req, res) => {
    const ip = req.ip;
    const now = Date.now();
    const limit = creationLimits.get(ip) || { at: now, count: 0 };
    if (now - limit.at > 3600000) { limit.at = now; limit.count = 0; }
    if (++limit.count > 30 || rooms.size >= 128) return res.status(429).json({ error: 'A lot of universes are opening. Try again in a little while.' });
    creationLimits.set(ip, limit);
    const room = createRoom();
    res.status(201).json({ code: room.code, hostToken: room.hostToken });
  });
  app.get('/api/rooms/:code', (req, res) => {
    const room = rooms.get(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({ error: 'That universe is not open. Check the four-character code on the big screen.' });
    res.json(publicRoom(room));
  });
  // Commands stay immediate. Coalesce the heavier snapshots during a crowd burst.
  const pendingBroadcasts = new Map();
  const broadcast = room => {
    if (pendingBroadcasts.has(room.code)) return;
    const timer = setTimeout(() => {
      pendingBroadcasts.delete(room.code);
      io.to(room.code).emit('room:state', publicRoom(room));
    }, 35);
    timer.unref();
    pendingBroadcasts.set(room.code, timer);
  };
  io.on('connection', socket => {
    socket.use((packet, next) => {
      if (!packet[1] || typeof packet[1] !== 'object' || Array.isArray(packet[1])) return next(new Error('Invalid message.'));
      next();
    });
    socket.on('error', () => {});
    let joined;
    let participant;
    let lastCommand = 0;
    let inFlight = false;
    const isHost = () => Boolean(joined && participant?.host);
    socket.on('room:join', (payload = {}, ack = () => {}) => {
      if (joined) return ack({ ok: true, room: publicRoom(joined), host: isHost() });
      const code = cleanText(payload.code, 4).toUpperCase();
      const room = rooms.get(code);
      if (!room) return ack({ ok: false, error: 'This universe has closed. Ask the presenter for the new code.' });
      if (room.participants.size >= 180) return ack({ ok: false, error: 'This universe is full.' });
      const host = typeof payload.hostToken === 'string' && payload.hostToken === room.hostToken;
      const id = cleanText(payload.clientId, 64) || randomUUID();
      const name = host ? 'Mission control' : (cleanText(payload.name, 22) || 'Anonymous deity');
      // A guest-supplied client ID cannot recover presenter privileges.
      const key = (host ? 'host:' : 'guest:') + id;
      participant = room.participants.get(key);
      if (!participant) {
        participant = { id: key, name, host, color: palette[room.participants.size % palette.length], sockets: new Set(), lastSeen: Date.now(), lastCommand: 0 };
        room.participants.set(key, participant);
      }
      participant.name = name;
      participant.lastSeen = Date.now();
      participant.sockets.add(socket.id);
      joined = room;
      room.lastActivity = Date.now();
      socket.join(code);
      ack({ ok: true, room: publicRoom(room), host, participant: { name, color: participant.color } });
      broadcast(room);
    });
    socket.on('world:command', async (payload = {}, ack = () => {}) => {
      if (!joined || !participant) return ack({ ok: false, error: 'Join the universe first.' });
      if (joined.status === 'paused') return ack({ ok: false, error: 'The presenter paused the universe. Hold that thought.' });
      if (['won', 'ended', 'finale'].includes(joined.status)) return ack({ ok: false, error: 'That round is complete. A new universe is coming.' });
      const requestId = cleanText(payload.requestId, 64);
      const receiptKey = participant.id + ':' + requestId;
      if (requestId && joined.receipts.has(receiptKey)) return ack(joined.receipts.get(receiptKey));
      const now = Date.now();
      if (inFlight || now - Math.max(lastCommand, participant.lastCommand) < (isHost() ? 200 : 1100)) return ack({ ok: false, error: 'Give the universe a second to catch up.', retryAfter: 1100 });
      const text = cleanText(payload.text);
      if (!text) return ack({ ok: false, error: 'Give the universe a rule first.' });
      lastCommand = now;
      participant.lastCommand = now;
      inFlight = true;
      const round = joined.round;
      try {
        let plan;
        if (payload.effectId && Object.hasOwn(EFFECTS, payload.effectId)) plan = { effects: [{ id: payload.effectId }], engine: 'instant' };
        else plan = await compileCommand(text);
        if (!plan || !planSchema.safeParse({ effects: plan.effects }).success) return ack({ ok: false, error: 'Try a world rule: lava, moon gravity, bouncy boulders, ducks, a shield, or a combination.' });
        if (joined.round !== round || ['paused','won','ended','finale'].includes(joined.status)) return ack({ ok: false, error: 'The round changed. Try your rule again.' });
        if (plan.effects.some(effect => EFFECTS[effect.id].kind === 'clock')) {
          if (joined.status !== 'live') return ack({ ok: false, error: 'Clock powers unlock when the round starts.' });
          if (joined.clockLocked) return ack({ ok: false, error: 'Mission control locked the clock. Try another power.' });
          if (Date.now() - joined.lastClockChange < 1500 || Date.now() - (participant.lastClockChange || 0) < 8000) return ack({ ok: false, error: 'The clock just changed. Pick another power for a moment.' });
          joined.lastClockChange = Date.now(); participant.lastClockChange = Date.now();
        }
        const author = { name: participant.name, color: participant.color };
        const event = applyPlan(joined, plan, author, text);
        const receipt = { ok: true, event, serverMs: Date.now() - now };
        if (requestId) {
          joined.receipts.set(receiptKey, receipt);
          if (joined.receipts.size > 1500) joined.receipts.delete(joined.receipts.keys().next().value);
        }
        io.to(joined.code).emit('world:event', event);
        broadcast(joined);
        ack(receipt);
      } catch {
        ack({ ok: false, error: 'That idea took too long. Quick rules are ready to go.' });
      } finally { inFlight = false; }
    });
    socket.on('host:action', (payload = {}, ack = () => {}) => {
      if (!isHost()) return ack({ ok: false, error: 'Presenter controls are private.' });
      if (!['start', 'pause', 'reset', 'clear', 'finale', 'lockclock'].includes(payload.action)) return ack({ ok: false, error: 'Unknown presenter control.' });
      hostAction(joined, payload.action);
      io.to(joined.code).emit('world:control', { action: payload.action, round: joined.round });
      broadcast(joined);
      ack({ ok: true });
    });
    socket.on('world:progress', (payload = {}) => {
      if (!isHost() || !['live', 'lobby'].includes(joined.status)) return;
      joined.progress = {
        cells: Math.max(0, Math.min(3, Math.floor(Number(payload.cells) || 0))),
        health: Math.max(0, Math.min(100, Math.floor(Number(payload.health) || 0))),
        launches: joined.progress.launches,
      };
      if (payload.won && joined.progress.cells === 3 && joined.status === 'live') {
        joined.status = 'won';
        joined.progress.launches++;
        io.to(joined.code).emit('world:control', { action: 'won', round: joined.round });
      }
      broadcast(joined);
    });
    socket.on('disconnect', () => {
      if (!joined || !participant) return;
      participant.sockets.delete(socket.id);
      participant.lastSeen = Date.now();
      broadcast(joined);
    });
  });
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      let changed = expireEffects(room, now);
      if (room.status === 'live' && now - room.startedAt - room.pauseDuration >= ROUND_MS + room.timeAdjustmentMs) { room.status = 'ended'; changed = true; }
      for (const [id, p] of room.participants) if (p.sockets.size === 0 && now - p.lastSeen > 60000) room.participants.delete(id);
      if (now - room.lastActivity > 7200000) { io.to(code).emit('room:closed'); rooms.delete(code); }
      else if (changed) broadcast(room);
    }
    for (const [ip, limit] of creationLimits) if (now - limit.at > 3600000) creationLimits.delete(ip);
  }, 500);
  interval.unref();
  if (dev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ root, server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(root, 'dist'), { maxAge: '1h', index: false }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  }
  app.use((error, _req, res, _next) => res.status(400).json({ error: error.type === 'entity.too.large' ? 'That request was too large.' : 'That request could not be read.' }));
  return { http, io, close: async () => { clearInterval(interval); pendingBroadcasts.forEach(clearTimeout); await new Promise(resolve => io.close(resolve)); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { http } = await createApplication({ dev: process.argv.includes('--dev') });
  const port = Number(process.env.PORT) || 3000;
  http.listen(port, '0.0.0.0', () => console.log('GODMODE listening on http://localhost:' + port));
}
