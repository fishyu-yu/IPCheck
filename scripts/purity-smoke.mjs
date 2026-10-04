import { mkdir, writeFile } from 'node:fs/promises';
import { onRequest } from '../edge-functions/api/[[path]].js';

// Built EdgeOne handler, real default data sources, no paid credentials.
const targets = ['8.8.8.8', '2606:4700:4700::1111', '35.190.0.1', '2.56.16.1'];
const rows = [];
for (const ip of targets) {
  const started = Date.now();
  const response = await onRequest({
    request: new Request('https://smoke.example/api/purity/' + encodeURIComponent(ip)),
    env: {},
    clientIp: '9.9.9.9',
  });
  const body = await response.json();
  const result = body.data;
  if (
    response.status !== 200 ||
    !body.success ||
    !Number.isFinite(result?.score) ||
    result.model !== 'local-purity-v2' ||
    result.dimensions.length !== 5
  )
    throw new Error('Invalid production assessment for ' + ip);
  const row = {
    ...result,
    http: response.status,
    ms: Date.now() - started,
  };
  rows.push(row);
  console.log(
    JSON.stringify({
      ip,
      http: row.http,
      ms: row.ms,
      score: row.score,
      coverage: row.coverage,
      level: row.level,
      sources: row.feeds.map((feed) => ({ source: feed.source, status: feed.status })),
    }),
  );
}
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/purity-v2-live-smoke.jsonl',
  rows.map((row) => JSON.stringify(row)).join('\n') + '\n',
);
