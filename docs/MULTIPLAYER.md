# Phone multiplayer: stage setup

Open **https://godmode-troylabs.vercel.app/** on the projector. Create one universe. Keep its original tab open for presenter controls. Everyone scans that room's QR code.

Each person chooses a role:

- **Play:** enter a name and tap Join the race. The phone shows the live 3D arena with a camera following that person's astronaut, a YOU marker, health, fuel, race standings, and a compass to the next fuel cell or rocket. Hold the arrows to move; hold Jump to bounce. Direction and jump work together with two fingers. No keyboard is required.
- **Godmode:** use the existing rule buttons, compound text commands, and timer powers. Every phone player races in the same changing arena. Use the header button to switch sides between Play and Godmode; switching back to Play starts a fresh astronaut.

Start the experiment on the projector. Every racer collects their own three yellow fuel cells; the first to reach the rocket wins. All racers are visible on the board with their names. Shared server physics handles positions, jump, fuel, health, falling/respawn, lava, gravity, reverse controls, wind, ice, black holes, bridges, trampolines, slow motion, and shared ducks/boulders/meteors. Godmode giant/tiny and disco also change the rendered world.

The room accepts up to 48 player seats and additional Godmode users within the existing 180-participant limit. A synthetic test covers 40 simultaneous players; this is not a venue Wi-Fi or 40-device rendering benchmark. A disconnected racer stops moving automatically. Rejoining with the same browser session and role restores progress. Pause freezes everyone; Reset clears progress and keeps joined players. Guided run applies only when no phone racers are present.

## Three-minute presentation

1. “Half of you choose Play. The other half choose Godmode. Players want to get home. Gods have other ideas.” Show the QR for 20 seconds.
2. Start. Have a teammate visibly demonstrate moving and jumping on their phone. “That astronaut is being controlled by a phone, right now.”
3. Invite lava, then DUCKZILLA. “We did not budget for a duck of this size.”
4. Ask a Godmode participant to type `moon gravity and duckzilla and disco and confetti`. All racers see the same effects on their own screens.
5. Demonstrate +15 / −10 seconds, then Lock audience clock to preserve the real stage slot. Ask the helpful people for `shield and bridge`.
6. Celebrate the named winner. If the slot ends first, announce a grand finale and use Launch finale. “One room. Two sides. Everyone is in the game.”

## Deployment and development

The update requires a backend restart. After deployment, refresh the projector, create a fresh universe, and have phones scan its new QR. Pushes alone do not update the running game; the authorized hosting maintainer runs `npm run deploy:game`. Runtime and collaborator setup remain in TEAM.md.

`server/multiplayer.js` owns authoritative arena physics. `player:input` accepts only that joined player's bounded controls; `arena:state` broadcasts positions at 10 Hz while physics steps at 20 Hz. The phone interpolates motion and predicts its own movement for immediate touch feedback. Client progress cannot declare a multiplayer winner. Godmode and player actions are checked on the server.

Run `npm test`, `npm run test:load`, and `npm run test:multiplayer`. The last script accepts a public origin argument for a real remote WebSocket check.
