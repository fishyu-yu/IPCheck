export type Coordinates = { latitude: number; longitude: number };

export function validCoordinates(latitude?: number, longitude?: number): Coordinates | null {
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}

export function spherePoint({ latitude, longitude }: Coordinates, radius = 1): [number, number, number] {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}

export function globeView(coordinates: Coordinates | null): Coordinates {
  return coordinates
    ? { latitude: Math.max(-65, Math.min(65, coordinates.latitude - 12)), longitude: coordinates.longitude + 22 }
    : { latitude: 18, longitude: 12 };
}

// Orthographic fallback uses the same geographic orientation as the WebGL scene.
export function projectPoint(point: Coordinates, view: Coordinates): [number, number, number] {
  const [x, y, z] = spherePoint(point);
  const lat = view.latitude * Math.PI / 180, lon = view.longitude * Math.PI / 180;
  const east = x * Math.cos(lon) - z * Math.sin(lon);
  const north = y * Math.cos(lat) - (x * Math.sin(lon) + z * Math.cos(lon)) * Math.sin(lat);
  const depth = y * Math.sin(lat) + (x * Math.sin(lon) + z * Math.cos(lon)) * Math.cos(lat);
  return [east, north, depth];
}
