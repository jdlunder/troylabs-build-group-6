# Verification evidence

Recorded 2026-10-16. These are observed checks, not estimates of venue Wi-Fi performance.

## Local application

- Production Vite build succeeded.
- 16 focused tests passed: local language interpretation, combinations, negation, typo handling, bounded counts/plans, unknown-input behavior, host-token privacy, rule replacement/expiry, pause duration, reset, and bounded history.
- A presenter plus **40 simulated audience WebSocket clients** connected to the local server. All 40 commands reached the presenter's event stream. The test also verified duplicate protection, guest reset/mission-progress rejection, pause/resume, reconnect state, malformed-message handling, and clean reset.
- One measured local run after broadcast coalescing reported acknowledgement latency of **59.4 ms median, 63.5 ms p95**. This is a single-machine synthetic burst, not measured phone-to-projector latency.
- A real Chromium browser rendered the landing page and 3D presenter stage with no console errors. Screenshots were inspected.

## External access

- An HTTPS tunnel served the real application and health endpoint. A real Chromium browser created a room and joined its presenter view through that public origin.
- A one-client external WebSocket connection and room join succeeded.
- The free tunnel had acknowledgement timeouts under a 40-client burst and was replaced for the deployed demo.
- The San Francisco Vercel Sandbox runtime passed the complete **40-client public WebSocket test**. All 40 commands reached the stage. Measured acknowledgement round trips: **143.3 ms median, 222.7 ms p95, 423.6 ms maximum** in that run. This remains a synthetic client test from one computer, not a real audience/venue measurement.
- An unauthenticated request to `https://godmode-troylabs.vercel.app/` followed the launch Function to the running public game and returned HTTP 200 with the correct application title. Chromium also followed this entry successfully.
- The cloud runtime was deliberately stopped through its authenticated SDK; the stop reported that a filesystem snapshot was saved. A fresh unauthenticated visit to the stable entry resumed the runtime, restarted the Node server, and returned the game with HTTP 200. The previous room state was intentionally ephemeral.
- At a 390×844 phone viewport, a nickname was entered and a real rule button was pressed. The phone received an acknowledgement, the stage displayed that participant's name and rule, and the lava state appeared on the shared stage. The mobile screenshot was visually inspected.
- The same browser flow was repeated through the public cloud runtime: a separate phone-sized page joined the presenter's new room, sent lava, typed “moon gravity and rain 6 ducks,” and sent boulders. The stage displayed the real nickname, rule feed, active lava/moon effects, rendered ducks/boulders, and a count of one audience member. Both stage and phone screenshots were captured and the stage image inspected. Browser console reported no errors.
- The public stage's Guided run then collected all three cells and reached the rocket. The browser displayed the earned **“Against all odds.”** victory heading, and a victory screenshot was captured. The presenter-triggered Launch finale was not used for this check.

## Audience chaos upgrade

- Added clock mercy/theft, clock locking, DUCKZILLA, reverse controls, earthquakes, and an expanded phone powers menu.
- Focused tests cover authoritative timer adjustment, reset, lower/upper bounds, near-expiry theft, and giant-duck interpretation.
- The upgraded public runtime passed the 40-client WebSocket delivery test plus timer mutation and locked-clock rejection. That run measured **88.7 ms median / 132.4 ms p95** acknowledgement time.
- A public Chromium flow used two phone pages to spawn DUCKZILLA, add 15 seconds, remove 10 seconds, lock the audience clock, and activate reverse controls. The public room's authoritative total round duration changed to 195000 ms and then 185000 ms. The stage rendered the giant duck and reverse effect with no console errors.
- `docs/TEAM.md` contains the team roles, editable code paths, collaboration setup, hosting maintainer command, and a timed comedy demo sequence.

## Phone multiplayer verification

- Added explicit Play/Godmode roles, authoritative multiplayer simulation, named astronauts, individual fuel collection, a shared race winner, 3D phone rendering, following camera/objective compass, touch D-pad/jump, and role switching.
- All 25 unit/integration checks passed, including two independent players, stale input, bounded input, pause, individual fuel/winner semantics, shared hazards/healing/reset, real socket role enforcement and reconnect recovery.
- The dedicated multiplayer load test passed with 40 simultaneous simulated racers plus a Godmode controller: shared hazards, movement, live snapshots, denied cross-role actions, freeze on pause, and reset keeping all 40 players. The original 40-controller rule-delivery test also passed.
- A local Chromium browser flow opened a projector and three phone-sized pages: two players and one Godmode user. Both phones rendered the same live 3D arena; held movement and jump controls were exercised; a four-power command appeared on phone and stage; pause disabled touch; switching roles and reset succeeded. No page errors were reported. Phone and stage screenshots were visually inspected.
- The same flow passed on the public deployment, including two simultaneous emulated touch contacts holding direction and jump. The public 40-racer simulation also passed; input acknowledgement measured 33.5 ms median / 45.0 ms p95 in that run, which is not input-to-photon latency or a venue benchmark.
- A separate public race completed using movement input messages only: all three cells were collected, the rocket was reached, and the server declared the correct named winner. The automated clear-arena route took 6.2 seconds; human play with audience chaos differs. Use Reset for successive short rounds without having phones rescan.

## Remaining evidence boundaries

- The crowd upgrade adds shared geometry coordinates for a 50%-wider/deeper arena, 48 distinct starts, persistent round-win trophies, a per-round fall award, and six validated four-power roulette combinations. Focused tests verify spawn bounds/uniqueness, fall counting, trophy persistence and roulette plans. Local browser QA exercised the larger phone/projector arena and the Gravity's favourite result panel.

- No real 40-person audience or venue Wi-Fi test has been performed.
- Optional model-provider interpretation has not been exercised with live credentials.
- Commands become validated effect data. This build does not execute generated JavaScript or invent new mechanics on demand.
- Multiplayer physics runs on the server. The optional solo astronaut still simulates in the main stage browser. Room state is in one server process's memory and is cleared by a server restart.
- Container and Render/Railway configurations are included; configuration files alone are not deployment evidence.
