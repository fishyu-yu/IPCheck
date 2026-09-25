import ipaddr from 'ipaddr.js';
export interface Candidate {
  type: string;
  address: string;
  protocol: string;
  port: number | null;
}
export interface RtcResult {
  candidates: Candidate[];
  verdict: 'No obvious leak detected' | 'Potential leak detected' | 'Unable to determine';
  protected: boolean;
  detail: string;
}
export function rtcVerdict(
  candidates: Candidate[],
  currentIp?: string | null,
): Pick<RtcResult, 'verdict' | 'detail'> {
  const publicCandidates = candidates.filter(
    (c) => c.type !== 'relay' && ipaddr.isValid(c.address) && ipaddr.parse(c.address).range() === 'unicast',
  );
  if (!currentIp || !ipaddr.isValid(currentIp) || !publicCandidates.length)
    return {
      verdict: 'Unable to determine',
      detail:
        'No comparable public ICE address or HTTP public address is available. This does not prove there is no leak.',
    };
  const current = ipaddr.process(currentIp);
  const comparable = publicCandidates.filter((c) => ipaddr.process(c.address).kind() === current.kind());
  if (!comparable.length)
    return {
      verdict: 'Unable to determine',
      detail:
        'ICE and HTTP addresses use different IP families; a dual-stack connection cannot be judged as a mismatch.',
    };
  if (comparable.some((c) => ipaddr.process(c.address).toNormalizedString() !== current.toNormalizedString()))
    return {
      verdict: 'Potential leak detected',
      detail:
        'A public ICE address differs from the HTTP address in the same IP family. Dual egress or VPN split routing can cause this; it is not proof of compromise.',
    };
  return {
    verdict: 'No obvious leak detected',
    detail:
      'Observed public candidates match the HTTP address. This limited test cannot prove absence of all leaks.',
  };
}
export async function testWebRtc(
  currentIp: string | null | undefined,
  signal: AbortSignal,
): Promise<RtcResult> {
  if (typeof RTCPeerConnection === 'undefined')
    return {
      candidates: [],
      protected: false,
      verdict: 'Unable to determine',
      detail: 'WebRTC is unsupported by this browser.',
    };
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
  const candidates: Candidate[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let end: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    end = resolve;
    timer = setTimeout(resolve, 8000);
  });
  const stop = () => end();
  signal.addEventListener('abort', stop, { once: true });
  try {
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        end();
        return;
      }
      const c = e.candidate;
      if (c.address && !candidates.some((v) => v.address === c.address && v.type === c.type))
        candidates.push({
          type: c.type || 'unknown',
          address: c.address,
          protocol: c.protocol || 'Unknown',
          port: c.port,
        });
    };
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') end();
    };
    pc.createDataChannel('network-diagnostic');
    await pc.setLocalDescription(await pc.createOffer());
    await done;
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    return {
      candidates,
      protected: candidates.some((c) => c.address.endsWith('.local')),
      ...rtcVerdict(candidates, currentIp),
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
    pc.onicecandidate = null;
    pc.onicegatheringstatechange = null;
    pc.close();
  }
}
