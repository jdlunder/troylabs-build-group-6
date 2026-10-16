import { Sandbox } from '@vercel/sandbox';

const APP = '/vercel/godmode-app';
const REPO = 'https://github.com/jdlunder/troylabs-build-group-6.git';

async function checked(sandbox, cmd, args, cwd) {
  const result = await sandbox.runCommand({ cmd, args, ...(cwd ? { cwd } : {}) });
  if (result.exitCode !== 0) throw new Error('Universe setup failed at ' + cmd);
  return result;
}

async function start(sandbox) {
  const health = await sandbox.runCommand({ cmd: 'curl', args: ['-fsS', 'http://localhost:3000/api/health'] });
  if (health.exitCode !== 0) {
    await sandbox.runCommand({ cmd: 'node', args: ['server/index.js'], cwd: APP, detached: true });
  }
  for (let attempt = 0; attempt < 16; attempt++) {
    const result = await sandbox.runCommand({ cmd: 'curl', args: ['-fsS', 'http://localhost:3000/api/health'] });
    if (result.exitCode === 0) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The universe server did not become ready.');
}

export default async function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const sandbox = await Sandbox.getOrCreate({
      name: 'godmode-live-demo',
      ports: [3000],
      region: 'sfo1',
      resources: { vcpus: 1 },
      timeout: 45 * 60 * 1000,
      persistent: true,
      resume: true,
      onCreate: async instance => {
        await checked(instance, 'git', ['clone', '--depth', '1', REPO, APP]);
        await checked(instance, 'npm', ['ci'], APP);
        await checked(instance, 'npm', ['run', 'build'], APP);
        await start(instance);
      },
      onResume: start,
    });
    // A running session can have been created by an operator before the first visit.
    await start(sandbox);
    response.writeHead(302, { Location: sandbox.domain(3000) + '/' });
    response.end();
  } catch (error) {
    console.error('GODMODE launch failed:', error.name);
    response.statusCode = 503;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>GODMODE is warming up</title><body style="background:#142039;color:#f2f3f7;font:18px system-ui;max-width:600px;margin:15vh auto;padding:30px"><h1>The universe is warming up.</h1><p>Try again in a moment. The shared world needs a running game server.</p><button onclick="location.reload()" style="background:#f5e27e;border:0;border-radius:8px;padding:15px 25px;font:inherit">Try again</button></body>');
  }
}
