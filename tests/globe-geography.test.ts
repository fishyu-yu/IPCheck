import { describe, expect, it } from 'vitest';
import { globeView, projectPoint, spherePoint, validCoordinates } from '../src/lib/globe-geography';

describe('IP globe coordinates', () => {
  it('accepts zero coordinates but refuses missing, non-finite and out-of-range coordinates', () => {
    expect(validCoordinates(0, 0)).toEqual({ latitude: 0, longitude: 0 });
    for (const [lat, lon] of [[undefined, 0], [0, undefined], [NaN, 0], [0, Infinity], [91, 0], [0, -181]])
      expect(validCoordinates(lat, lon)).toBeNull();
  });
  it('preserves the north pole, equator and east/west longitude directions', () => {
    expect(spherePoint({ latitude: 90, longitude: 0 })[1]).toBeCloseTo(1);
    expect(spherePoint({ latitude: 0, longitude: 0 })[2]).toBeCloseTo(1);
    expect(spherePoint({ latitude: 0, longitude: 90 })[0]).toBeCloseTo(1);
    expect(spherePoint({ latitude: 0, longitude: -90 })[0]).toBeCloseTo(-1);
  });
  it('keeps locations on the visible side at both sides of the date line and near the poles', () => {
    for (const coordinates of [
      { latitude: 34.05, longitude: -118.24 },
      { latitude: -33.86, longitude: 151.21 },
      { latitude: 80, longitude: 179.9 },
      { latitude: -80, longitude: -179.9 },
    ]) expect(projectPoint(coordinates, globeView(coordinates))[2]).toBeGreaterThan(0.5);
  });
});
