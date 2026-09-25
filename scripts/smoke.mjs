const base = process.argv[2] || 'http://127.0.0.1:8787';
const cases = [
  ['/api/health'],
  ['/api/ip/8.8.8.8'],
  ['/api/asn/AS13335'],
  ['/api/dns?name=example.com&type=A'],
  ['/api/reverse?ip=8.8.8.8'],
  ['/api/tcping', { host: '1.1.1.1', port: 443 }],
  ['/api/http-ping', { host: '1.1.1.1', protocol: 'http' }],
];
for (const [path, body] of cases) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await r.json();
  if (data.data?.ipv4) {
    data.data.ipv4Count = data.data.ipv4.length;
    data.data.ipv6Count = data.data.ipv6.length;
    data.data.ipv4 = data.data.ipv4.slice(0, 2);
    data.data.ipv6 = data.data.ipv6.slice(0, 2);
  }
  console.log(JSON.stringify({ path, status: r.status, result: data }));
}
