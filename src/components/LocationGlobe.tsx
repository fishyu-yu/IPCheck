import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LocateFixed, MapPin } from 'lucide-react';
import { localize } from '../config/i18n';
import land from '../data/globe-land.json';
import { globeView, projectPoint, validCoordinates } from '../lib/globe-geography';
import type { GlobeController } from '../lib/createGlobe';

interface Props {
  ip?: string | null;
  latitude?: number;
  longitude?: number;
  location: string;
}

export function LocationGlobe({ ip, latitude, longitude, location }: Props) {
  const coordinates = useMemo(() => ip ? validCoordinates(latitude, longitude) : null, [ip, latitude, longitude]);
  const host = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const controller = useRef<GlobeController | null>(null);
  const [mode, setMode] = useState<'loading' | 'interactive' | 'static'>('loading');
  const gradient = useId().replace(/:/g, '');
  const view = globeView(coordinates);
  const fallbackDots = useMemo(() => land.flatMap(([latitude, longitude]) => {
    const [x, y, depth] = projectPoint({ latitude, longitude }, globeView(coordinates));
    return depth > 0 ? [{ x: 160 + x * 132, y: 160 - y * 132, depth }] : [];
  }), [coordinates]);
  const fallbackMarker = coordinates ? projectPoint(coordinates, view) : null;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || controller.current || cancelled) return;
      observer.disconnect();
      try {
        const { createGlobe } = await import('../lib/createGlobe');
        if (cancelled) return;
        controller.current = createGlobe(element, coordinates, (x, y, visible) => {
          if (!marker.current) return;
          marker.current.style.transform = `translate(${x}px, ${y}px)`;
          marker.current.style.visibility = visible ? 'visible' : 'hidden';
        }, () => {
          controller.current?.dispose();
          controller.current = null;
          setMode('static');
        });
        setMode('interactive');
      } catch {
        if (!cancelled) setMode('static');
      }
    }, { rootMargin: '100px' });
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      controller.current?.dispose();
      controller.current = null;
    };
  }, [coordinates]);

  return (
    <section className="location-globe card" aria-label={localize('Your location on the globe')} data-renderer={mode}>
      <div className="globe-heading">
        <span><MapPin size={13} />{localize('IP location')}</span>
        <div className="globe-controls">
          <button className="icon-button" disabled={mode !== 'interactive'} aria-label={localize('Rotate globe left')} onClick={() => controller.current?.turn(-1)}><ChevronLeft size={15} /></button>
          <button className="icon-button" disabled={mode !== 'interactive'} aria-label={localize('Recenter globe')} onClick={() => controller.current?.recenter()}><LocateFixed size={15} /></button>
          <button className="icon-button" disabled={mode !== 'interactive'} aria-label={localize('Rotate globe right')} onClick={() => controller.current?.turn(1)}><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="globe-stage" role="img" aria-label={localize(coordinates ? 'IP location marker on a globe' : 'Globe without a location marker')}>
        <div className="globe-canvas" ref={host} />
        <svg className="globe-fallback" viewBox="0 0 320 320" aria-hidden="true" style={{ visibility: mode === 'interactive' ? 'hidden' : 'visible' }}>
          <defs><radialGradient id={gradient} cx="35%" cy="25%"><stop offset="0" stopColor="var(--card-hover)" /><stop offset="1" stopColor="var(--bg)" /></radialGradient></defs>
          <circle cx="160" cy="160" r="132" fill={`url(#${gradient})`} stroke="var(--border)" />
          {fallbackDots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r="1.4" fill="var(--accent)" opacity={0.3 + 0.6 * dot.depth} />)}
          {fallbackMarker && <g transform={`translate(${160 + fallbackMarker[0] * 132},${160 - fallbackMarker[1] * 132})`}><circle r="9" fill="var(--accent)" opacity="0.18" /><circle r="4" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" /><text x="12" y="4" fill="var(--accent)" fontSize="10" fontFamily="monospace">IP</text></g>}
        </svg>
        {coordinates && <div className="globe-marker" ref={marker} aria-hidden="true" style={{ display: mode === 'interactive' ? 'block' : 'none' }}><span />IP</div>}
      </div>
      <div className="globe-caption">
        <strong>{localize(location || 'Location unknown')}</strong>
        <p>{localize(coordinates ? 'Approximate location from IP data' : 'Location coordinates unavailable')}</p>
        {mode === 'static' && <span>{localize('Static globe view')}</span>}
      </div>
    </section>
  );
}
