export const site = {
  name: 'NetProbe',
  tagline: 'IP & Network Intelligence',
  url:
    import.meta.env?.VITE_SITE_URL ||
    (import.meta.env?.PROD ? 'https://your-domain.example' : 'http://localhost:5173'),
  description: 'Understand your connection. Measure your network. Know what your browser reveals.',
};
export const statusColors = {
  normal: '#b9e97a',
  warning: '#e7b765',
  danger: '#f47c7c',
  unknown: '#92999f',
  information: '#85bafa',
};
export const navigation = [
  {
    label: 'Workspace',
    items: [
      ['/', 'Overview', 'overview'],
      ['/tools', 'All tools', 'tools'],
    ],
  },
  {
    label: 'IP intelligence',
    items: [
      ['/ip', 'IP Lookup', 'ip'],
      ['/asn', 'ASN Lookup', 'asn'],
      ['/risk', 'Risk Analysis', 'risk'],
    ],
  },
  {
    label: 'Network',
    items: [
      ['/ping', 'Ping', 'ping'],
      ['/tcping', 'TCP Ping', 'tcp'],
      ['/global', 'Global Ping', 'global'],
      ['/trace', 'Traceroute', 'trace'],
      ['/dns-lookup', 'DNS Lookup', 'dns'],
      ['/reverse', 'Reverse DNS', 'reverse'],
      ['/latency', 'Latency Test', 'latency'],
    ],
  },
  {
    label: 'Privacy',
    items: [
      ['/environment', 'Environment', 'environment'],
      ['/fingerprint', 'Fingerprint', 'fingerprint'],
      ['/webrtc', 'WebRTC Leak', 'webrtc'],
      ['/dns', 'DNS Leak', 'dnsleak'],
    ],
  },
  {
    label: 'Developer',
    items: [
      ['/developers', 'API Reference', 'api'],
      ['/status', 'System Status', 'status'],
    ],
  },
];
