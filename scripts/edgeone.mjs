import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
// Separate static output keeps the Cloudflare worker bundle out of EdgeOne's public files.
const output = resolve('dist-edgeone');
if (output !== resolve(process.cwd(), 'dist-edgeone')) throw new Error('Unsafe build output');
await mkdir(output, { recursive: true });
await cp('dist', output, { recursive: true });
for (const name of ['_worker.js', '_routes.json', '.assetsignore', '_headers'])
  await rm(resolve(output, name), { force: true });
console.log('EdgeOne static output: dist-edgeone; API entry: edge-functions/api/[[path]].js');
