import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  Boxes,
  Braces,
  ChevronRight,
  CircleHelp,
  Fingerprint,
  Globe2,
  LayoutDashboard,
  ListTree,
  LockKeyhole,
  Menu,
  Monitor,
  Moon,
  Network,
  Radar,
  Search,
  ShieldCheck,
  Sun,
  Terminal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { navigation, site } from '../config/site';
import { useHealth } from '../hooks/queries';
const icons: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  tools: Boxes,
  ip: Search,
  asn: Network,
  risk: ShieldCheck,
  ping: Activity,
  tcp: ArrowDownUp,
  global: Globe2,
  trace: ListTree,
  dns: Network,
  reverse: ListTree,
  latency: Activity,
  environment: Monitor,
  fingerprint: Fingerprint,
  webrtc: Radar,
  dnsleak: LockKeyhole,
  api: Braces,
  status: Activity,
};
export function Shell() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 700px)');
    const resize = () => setMobile(media.matches);
    media.addEventListener('change', resize);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', escape);
    return () => {
      media.removeEventListener('change', resize);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const health = useHealth();
  const title = navigation.flatMap((s) => s.items).find((i) => i[0] === location.pathname)?.[1] || 'Tool';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => {
    document.title = `${title} · ${site.name}`;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = new URL(location.pathname, site.url).href;
    const description = `${title} — transparent network diagnostics with explicit sources and privacy-first browser tools.`;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
    for (const [property, content] of Object.entries({
      'og:title': `${title} · ${site.name}`,
      'og:description': description,
      'og:url': canonical.href,
    })) {
      let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.append(meta);
      }
      meta.content = content;
    }
  }, [title, location.pathname]);
  return (
    <div className="app-shell">
      {open && (
        <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />
      )}
      <aside className={'sidebar ' + (open ? 'open' : '')} inert={mobile && !open}>
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            <Network size={22} />
          </span>
          {site.name}
          <span className="brand-version">/ 01</span>
        </NavLink>
        <div className="workspace-selector">
          <span className="workspace-icon">
            <Globe2 size={17} />
          </span>
          <div>
            Personal workspace<small>Network diagnostics</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((section) => (
            <div className="nav-section" key={section.label}>
              <p>{section.label}</p>
              {section.items.map(([url, label, key]) => {
                const Icon = icons[key] || Globe2;
                return (
                  <NavLink
                    end
                    to={url}
                    key={url}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {key === 'overview' && <span className="nav-dot" />}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <LockKeyhole size={15} />
          <div>
            Private by design<small>Browser data stays with you.</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="edge-status">
              <i className={health.isError ? 'offline' : ''} />
              {health.data?.platform || 'Connecting'}
            </span>
            <button
              className="icon-button"
              aria-label="Toggle color theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <NavLink to="/developers" className="icon-button" aria-label="API help">
              <CircleHelp size={17} />
            </NavLink>
            <span className="avatar">{site.name.slice(0, 2).toUpperCase()}</span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer>
          <span>
            © {new Date().getFullYear()} {site.name} <span className="footer-separator">/</span>{' '}
            {site.tagline}
          </span>
          <NavLink to="/developers">
            <Terminal size={13} /> Built for transparency <ArrowUpRight size={13} />
          </NavLink>
        </footer>
      </div>
    </div>
  );
}
