# Team: get ready in ten minutes

The public app is already hosted: **https://godmode-troylabs.vercel.app**. Only the presenter needs to create a room. Everyone else uses its QR/controller link. Phones need no code, account, API key, or local server.

## Assign the room

- Presenter: narrate and watch the three-minute clock.
- Pilot: WASD/arrows and Space; or enable Guided run if the presenter is alone.
- Chaos teammate: use a phone to demonstrate DUCKZILLA, lava, and reverse controls when invited. Say openly that this is a teammate demonstrating a power.
- Rescue teammate: show a shield, bridge, or +15 seconds when the pilot needs help.
- Operator: keep the QR visible, help people join, and handle Pause/Clear chaos/Lock audience clock/Launch finale.

## The actual stage sequence

0:00: “This is Nova. Nova wants to go home. Unfortunately, we gave you all godmode. Scan this.”

0:25: Start. Ask someone to tap lava. “That person has immediately chosen violence.”

0:50: Ask for DUCKZILLA. Pause your explanation and let the enormous duck land. “We did not budget for a duck of this size.”

1:10: “The helpful half of the room: give us 15 seconds. The other half: please discover empathy.” Point to the two audience clock buttons.

1:35: “You can combine powers. Try moon gravity and rain ducks.” Ask for a shield or bridge to rescue Nova.

2:15: Lock audience clock if the room is extending the round. Keep the real presentation within its allotted time. Clear chaos if it is obscuring the action.

2:40: Earn the rocket win if close; otherwise announce “Let's end this universe properly” and press Launch finale. Finish: “One screen. Every phone. The audience is the game.”

## Teammates who want to edit

```sh
git clone https://github.com/jdlunder/troylabs-build-group-6.git
cd troylabs-build-group-6
npm ci
npm run dev
```

Use a separate branch per teammate (`git switch -c codex/your-change`) and keep edits narrow. Phone/stage UI lives in `src/main.jsx` and `src/style.css`; graphics/physics in `src/game/Universe.js`; parsing in `server/compiler.js`. One person should own `shared/catalog.js` during the sprint to avoid conflicting effect definitions. GitHub write access is granted by the repository owner; public use of the app needs no collaborator access.

The hosting maintainer is the teammate with access to the `godmode-troylabs` Vercel project. **Pushing code alone does not update the running game process.** After reviewed code reaches main, that maintainer runs `npm run deploy:game`. It pulls main, installs/builds, restarts the game, and clears in-memory rooms. Refresh and create a new room after deployment. Keep credentials local; `.env.local` is ignored.

For the maintainer's first setup: `vercel link --project godmode-troylabs --scope managementmos-projects` then `vercel env pull .env.local`. Others can develop locally without that hosting credential.

Each hosted runtime session is capped at 45 minutes. If it expires, revisit the stable entry to resume and create a fresh universe. Use the persistent Node/Docker deployment for longer continuous sessions. With ten minutes left, prioritize one full rehearsal and phone/projector checks before merging more features.
