import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip) {
    return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
  }

  // TODO: Integrate real Cloudflare IP Intelligence / Radar API here.
  // Example: 
  // const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/intel/ip?ipv4=${ip}`, {
  //   headers: { Authorization: `Bearer ${API_TOKEN}` }
  // });
  
  // MOCK IMPLEMENTATION
  // Generating a deterministic pseudo-random score based on IP to keep it consistent
  const ipSum = ip.split('.').reduce((acc, octet) => acc + parseInt(octet, 10), 0);
  const score = Math.max(0, Math.min(100, (ipSum % 100) + (Math.random() * 10 - 5))); // 0-100
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return NextResponse.json({
    ip,
    score: Math.round(score),
    risk_level: score > 80 ? 'High' : score > 50 ? 'Medium' : 'Low',
    source: 'Cloudflare (Simulated)'
  });
}
