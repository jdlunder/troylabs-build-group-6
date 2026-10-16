import dotenv from 'dotenv';
import { Sandbox } from '@vercel/sandbox';
dotenv.config({path:'.env.local',quiet:true});
const sandbox=await Sandbox.get({name:'godmode-live-demo'});
const cwd='/vercel/godmode-app';
const build=await sandbox.runCommand({cmd:'bash',args:['-lc','git pull --ff-only && npm ci && npm run build && git rev-parse HEAD'],cwd});
process.stdout.write(await build.stdout());
if(build.exitCode!==0){process.stderr.write(await build.stderr());process.exit(1);}
await sandbox.runCommand({cmd:'bash',args:['-lc',"pkill -f '^node server/index.js$' || true"],cwd});
await sandbox.runCommand({cmd:'node',args:['server/index.js'],cwd,detached:true});
for(let i=0;i<20;i++){
  const check=await sandbox.runCommand({cmd:'curl',args:['-fsS','http://localhost:3000/api/health']});
  if(check.exitCode===0){console.log('LIVE: https://godmode-troylabs.vercel.app — refresh and create a new room.');process.exit(0);}
  await new Promise(resolve=>setTimeout(resolve,500));
}
throw new Error('Server did not become healthy. Check the Vercel Sandbox logs.');
