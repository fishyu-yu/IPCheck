import { localize, locale } from '../config/i18n';
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  ChevronDown,
  Fingerprint,
  Globe2,
  Monitor,
  Moon,
  Network,
  Radar,
  Sun,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { navigation, site } from '../config/site';
import { useVisibleNavigation } from '../hooks/useVisibleNavigation';
import { Skeleton } from '../components/ui';
const icons: Record<string, LucideIcon> = {
  asn: Network,
  ping: Activity,
  tcp: ArrowDownUp,
  environment: Monitor,
  fingerprint: Fingerprint,
  webrtc: Radar,
};
export function Shell() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuRoot = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const primaryRoot = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, top: 0, width: 0, height: 0, visible: false });
  const visibleNavigation = useVisibleNavigation();
  const primaryItems = visibleNavigation
    .flatMap((section) => section.items)
    .filter((item) => ['/', '/ip', '/risk', '/dns-lookup', '/latency'].includes(item[0]));
  const moreSections = visibleNavigation
    .filter((section) => !['Workspace', 'Developer'].includes(section.label))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !primaryItems.some((primary) => primary[0] === item[0])),
    }))
    .filter((section) => section.items.length);
  const moreActive = moreSections.some((section) =>
    section.items.some((item) => item[0] === location.pathname),
  );
  const primaryRoutes = primaryItems.map((item) => item[0]).join(',');
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  useLayoutEffect(() => {
    const root = primaryRoot.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      setIndicator((previous) =>
        active
          ? {
              left: active.offsetLeft,
              top: active.offsetTop,
              width: active.offsetWidth,
              height: active.offsetHeight,
              visible: true,
            }
          : { ...previous, visible: false },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('a').forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [location.pathname, primaryRoutes]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRoot.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const [theme, setTheme] = useState(() => {
    try {
      return (
        localStorage.getItem('theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      );
    } catch {
      return 'light';
    }
  });
  const title = navigation.flatMap((s) => s.items).find((i) => i[0] === location.pathname)?.[1] || 'Tool';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Storage may be blocked in private browsing. */
    }
  }, [theme]);
  useEffect(() => {
    document.title = `${localize(title)} · ${site.name}`;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = new URL(location.pathname, site.url).href;
    const description = `${localize(title)} — ${localize('Network diagnostics with clear sources and privacy-first browser tools.')}`;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
    for (const [property, content] of Object.entries({
      'og:title': `${localize(title)} · ${site.name}`,
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
      <a className="skip-link" href="#main-content">
        {localize('Skip to content')}
      </a>
      <div className="main-shell">
        <header className="site-header">
          <div className="header-identity">
            <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
              <span className="brand-mark">
                <Terminal size={22} />
              </span>
              {site.name}
            </NavLink>
            <div className="top-actions">
              <span className="locale-label" title={localize('Language follows your browser')}>
                {locale === 'zh' ? '简体中文' : 'English'}
              </span>
              <button
                className="icon-button"
                aria-label={localize('Toggle color theme')}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </div>
          <nav className="horizontal-nav" aria-label={localize('Main navigation')} ref={menuRoot}>
            <div className="primary-links" ref={primaryRoot}>
              <span
                className="nav-indicator"
                aria-hidden="true"
                style={{
                  transform: `translate(${indicator.left}px, ${indicator.top}px)`,
                  width: indicator.width,
                  height: indicator.height,
                  opacity: indicator.visible ? 1 : 0,
                }}
              />
              {primaryItems.map(([url, label]) => (
                <NavLink
                  end
                  to={url}
                  key={url}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => 'nav-pill ' + (isActive ? 'active' : '')}
                >
                  {localize(label)}
                </NavLink>
              ))}
            </div>
            <button
              ref={menuButton}
              className={'nav-pill more-toggle ' + (open || moreActive ? 'active' : '')}
              aria-expanded={open}
              aria-controls="more-tools"
              onClick={() => setOpen(!open)}
            >
              {localize('More tools')} <ChevronDown size={15} />
            </button>
            <div className="more-panel" id="more-tools" data-open={open} aria-hidden={!open} inert={!open}>
              <div className="more-groups">
                {moreSections.map((section) => (
                  <div className="more-section" key={section.label}>
                    <p>{localize(section.label)}</p>
                    {section.items.map(([url, label, key]) => {
                      const Icon = icons[key] || Globe2;
                      return (
                        <NavLink
                          end
                          to={url}
                          key={url}
                          onClick={() => setOpen(false)}
                          className={({ isActive }) => 'more-link ' + (isActive ? 'active' : '')}
                        >
                          <Icon size={17} />
                          <span>{localize(label)}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                ))}
              </div>
              <NavLink to="/tools" className="more-all" onClick={() => setOpen(false)}>
                {localize('All tools')} <ArrowUpRight size={14} />
              </NavLink>
            </div>
          </nav>
        </header>
        <main id="main-content">
          <div className="route-view" key={location.pathname}>
            <Suspense fallback={<Skeleton lines={4} />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <footer className="site-footer">
          <div className="footer-identity">
            <span>
              © {localize(new Date().getFullYear())} {localize(site.name)}{' '}
              <span className="footer-separator">/</span>
              {localize(' ')}
              {localize(site.tagline)}
            </span>
            <p className="design-credit">
              {localize('UI design reference:')}{' '}
              <a href="https://whois.f1shyu.com" target="_blank" rel="noopener noreferrer">
                whois.f1shyu.com
              </a>
              {localize('. Referenced brands and works belong to their respective copyright holders.')}
            </p>
          </div>
          <div className="footer-links">
            <NavLink to="/developers">{localize('API Reference')}</NavLink>
            <NavLink to="/status">{localize('System Status')}</NavLink>
            <a href="https://github.com/fishyu-yu/IPCheck" target="_blank" rel="noopener noreferrer">
              <Terminal size={13} />
              {localize('Source code')} · AGPL v3
              <ArrowUpRight size={13} />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
