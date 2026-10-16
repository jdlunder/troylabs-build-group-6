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
- The first free-tunnel 40-client burst test connected all participants but had command acknowledgement timeouts. It does **not** establish reliable public crowd performance. External transport is being verified separately from the local application.

## Boundaries

- No real 40-person audience or venue Wi-Fi test has been performed.
- Optional model-provider interpretation has not been exercised with live credentials.
- Commands become validated effect data. This build does not execute generated JavaScript or invent new mechanics on demand.
- The main stage is the physics simulator. Room state is in one server process's memory and is cleared by a server restart.
- Container and Render/Railway configurations are included; configuration files alone are not deployment evidence.
