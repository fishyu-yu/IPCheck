import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import { Shell } from './layouts/Shell';
import { Skeleton } from './components/ui';
const Overview = lazy(() => import('./pages/Overview'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Ping = lazy(() => import('./pages/NetworkTools').then((m) => ({ default: m.PingPage })));
const Latency = lazy(() => import('./pages/NetworkTools').then((m) => ({ default: m.LatencyPage })));
const DNS = lazy(() => import('./pages/NetworkTools').then((m) => ({ default: m.DnsLookupPage })));
const Remote = lazy(() => import('./pages/NetworkTools').then((m) => ({ default: m.RemotePage })));
const Environment = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.EnvironmentPage })));
const Fingerprint = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.FingerprintPage })));
const WebRTC = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.WebRtcPage })));
const DnsLeak = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.DnsLeakPage })));
const Tools = lazy(() => import('./pages/Developer').then((m) => ({ default: m.ToolsPage })));
const Developers = lazy(() => import('./pages/Developer').then((m) => ({ default: m.DeveloperPage })));
const Status = lazy(() => import('./pages/Developer').then((m) => ({ default: m.StatusPage })));
export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="page-loading">
            <Skeleton lines={8} />
          </div>
        }
      >
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Overview />} />
            <Route path="ip" element={<Intelligence kind="ip" />} />
            <Route path="asn" element={<Intelligence kind="asn" />} />
            <Route path="risk" element={<Intelligence kind="risk" />} />
            <Route path="ping" element={<Ping />} />
            <Route path="http-ping" element={<Ping />} />
            <Route path="tcping" element={<Ping key="tcp" tcp />} />
            <Route path="latency" element={<Latency />} />
            <Route path="dns-lookup" element={<DNS />} />
            <Route path="reverse" element={<DNS key="reverse" reverse />} />
            <Route path="global" element={<Remote />} />
            <Route path="trace" element={<Remote key="trace" trace />} />
            <Route path="environment" element={<Environment />} />
            <Route path="fingerprint" element={<Fingerprint />} />
            <Route path="webrtc" element={<WebRTC />} />
            <Route path="dns" element={<DnsLeak />} />
            <Route path="tools" element={<Tools />} />
            <Route path="developers" element={<Developers />} />
            <Route path="status" element={<Status />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>Page not found</h1>
                  <Link to="/">Back to overview</Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
