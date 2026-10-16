# GODMODE

**You play. They rule.** One astronaut on the projector. An entire audience rewrites the universe from their phones.

A complete live multiplayer experiment built for TroyLabs Builders Night: a procedural 3D world, real QR joining, a phone controller, natural-language rule composition, presenter controls, and a three-minute mission. Collect three energy cells and reach the rocket while the room makes questionable decisions.

**Live entry:** https://godmode-troylabs.vercel.app

The entry starts/resumes the public game runtime and redirects you to it. Create your universe there so the QR points to the actual live server.

## Run it

Node.js 22.12+ or 24+.

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000`, select **Create a universe**, and keep that browser open on the projector. The room creator's browser holds the private presenter capability. Audience members scan the QR code or enter the four-character code on the home page. Names are optional and shown publicly in the rule feed.

For development, use `npm run dev`. It runs Vite and Socket.IO through the same Node server and port.

For phones, open the presenter page through a publicly reachable HTTPS origin or the computer's LAN address. A QR generated from `localhost` only works on the same computer. Everyone uses the same origin; the QR is generated from that origin automatically.

## The experience

- **23 composable powers:** lava, ice, moon/heavy gravity, bouncing boulders, ducks, meteors, black hole, wind, disco, giant/tiny astronaut, shield, trampoline, bridge, confetti, healing, slow motion, audience timer increases/decreases, DUCKZILLA, reverse controls, and earthquakes.
- **Text or one tap:** “moon gravity and rain 6 ducks,” “make the boulders bounce,” “stop lava and give Nova a shield.”
- **Real live delivery:** a WebSocket event applies the command; a separate authoritative snapshot keeps participants, timers, active rules, and history consistent.
- **Presenter control:** start, pause/resume, clear chaos, reset the room, guided run, sound, fullscreen, cinema view, and a clearly separate launch finale.
- **Playable mission:** WASD or arrow keys move; Space jumps. Collect the three glowing cells, then reach the rocket. Lava and objects affect health. Zero health respawns Nova so the presentation can continue.

Guided run steers Nova automatically and pauses at fuel stops so the presenter has time to explain and invite audience input. Manual movement takes over immediately when a movement key is pressed. The normal win comes from completing the mission. **Launch finale** is an explicit presenter-triggered ending for a timed presentation.

## Why interaction stays fast

Recognized language and quick controls compile directly into bounded effect data. No model call, code rebuild, or redeployment is needed for those actions. Multiple effects compose, incompatible floor/gravity/size effects replace one another, and temporary rules expire. The rendered physics world applies those rules in its animation loop.

The phone displays the actual **command acknowledgement round trip**, not a claimed input-to-photon measurement. Server processing, network acknowledgement, browser rendering, projector delay, and venue Wi-Fi are separate contributors. See [verification evidence](docs/EVIDENCE.md).

Heavy state broadcasts are coalesced over 35 ms during bursts. Individual command events remain immediate. Each participant can submit about one command per 1.1 seconds. A command can contain up to four effects; spawn counts are bounded and the renderer caps dynamic objects at 30.

## Optional AI interpretation

The complete instant-rule experience needs **no API key**. Unknown input produces a clear suggestion rather than silently triggering a random action.

To expand unfamiliar phrasing into supported mechanics, copy `.env.example` to `.env`, set `LLM_API_KEY`, and optionally change `LLM_BASE_URL` and `LLM_MODEL` for an OpenAI-compatible endpoint. Keys remain on the server. The fallback has a 2.2-second timeout; returned effect IDs, counts, and durations are validated before use.

AI interpretation composes the existing mechanics. Arbitrary new physics, assets, and executable live code are outside this build. No audience input is executed as code. Provider integration is optional and must be tested with your own configured provider before presenting it as active.

## Present it

Read the [three-minute demo script](docs/DEMO.md). Short version: create a universe on the public URL, fullscreen it, invite the room, start, ask someone for lava, ask someone else to save Nova, and build to a combination such as moon gravity plus ducks. Use **Reset** between rehearsals. Keep the creator's tab and browser storage intact so you retain presenter controls.

The audience can buy 15 seconds or steal 10 seconds during a live round. Theft preserves at least 15 seconds of runway; remaining time is capped at five minutes. Clock changes have a 1.5-second room cooldown and an eight-second individual cooldown. The presenter can **Lock audience clock** to keep the stage presentation on schedule. More wild powers are under the controller's expandable powers menu. See [team setup and the comedy demo sequence](docs/TEAM.md).

Keyboard shortcuts: **F** fullscreen, **H** cinema controls, **P** pause/resume. These shortcuts do not fire while typing a rule.

## Tests

```sh
npm test
npm run test:load
# Test a running public instance, including WebSocket delivery:
node test/load.mjs https://your-public-origin.example
```

The Vercel hosting maintainer can publish pushed main-branch changes with `npm run deploy:game` after linking the project and pulling a local OIDC credential. This restarts the game and clears its in-memory rooms. See [team instructions](docs/TEAM.md); pushing alone does not change the running game process.

The load check creates a separate temporary room and connects a presenter plus 40 simulated audience clients. It verifies delivery, bounded history, idempotent command retries, presenter authorization, guest progress rejection, pause/resume, reconnect state, malformed-message handling, and a clean reset. It reports measured acknowledgement latency.

## Deploy

The deployed Vercel entry uses `api/launch.js` and `@vercel/sandbox` to start/resume a named persistent Sandbox in San Francisco. The Node server runs inside that runtime; the Vercel Function only boots it and redirects. It does not carry WebSockets through a serverless Function. The project-scoped Vercel OIDC credential remains on the server.

Each demo runtime session is configured for **45 minutes**. When it stops, the filesystem is snapshotted and the next visit to the stable entry can resume a new session. Running processes and in-memory rooms do not survive that stop: create a fresh room after a resume. This is a demo hosting arrangement, not an always-on room store. For longer uninterrupted sessions, run the same app on the persistent Node service below.

This app needs **one persistent Node process with WebSocket support**. Use the included Dockerfile, Render blueprint, or Railway configuration. Keep it to one process/replica; room state is currently held in memory. A process restart clears the rooms. A multi-instance service would need a shared room store and Socket.IO adapter.

```sh
docker build -t godmode .
docker run --rm -p 3000:3000 godmode
```

The server binds to `0.0.0.0` and honors `PORT`. Health endpoint: `/api/health`. The frontend and backend share an origin. Render's free instance may sleep; wake it and rehearse before the demo. The Render/Railway files are deployment configuration, not a claim that either service is provisioned.

Static/serverless-only hosting does not provide the persistent Socket.IO room server. For a quick live rehearsal, tunnel port 3000 through a WebSocket-capable HTTPS tunnel and leave the computer awake. A tunnel URL is temporary and depends on the running server and tunnel process.

## Code map

- `server/index.js`: HTTP, Socket.IO, room access, validation, rate limiting, and production serving.
- `server/compiler.js`: instant language matching and optional validated model fallback.
- `server/rooms.js`: private/public room state, rule expiry, pause, reset, and receipts.
- `shared/catalog.js`: shared effect definitions and quick controls.
- `src/main.jsx`: landing, presenter stage, phone controller, and reconnect behavior.
- `src/game/Universe.js`: Three.js scene, player, physics objects, effects, fuel, and rocket.
- `src/style.css`: responsive UI and motion preferences.
- `api/launch.js`: Vercel entry that starts/resumes the public game runtime.

The main presenter browser simulates the physics and reports mission progress. Phones send rules and receive room state; they do not run the 3D engine. A second stage browser receives room rules but does not mirror the main player's exact pose. There are no external 3D assets, screen recordings, or fabricated audience members.
