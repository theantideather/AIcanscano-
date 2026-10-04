export interface GeoPoint {
  lat: number;
  lon: number;
  label?: string;
}

export interface DentistResult {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  distanceKm: number;
}

export function getBrowserLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Location permission was denied.')),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

export async function geocodeAddress(query: string): Promise<GeoPoint> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Location lookup failed. Check your connection and try again.');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('No matching location found. Try a city or zip code.');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Searches OpenStreetMap (via the public Overpass API) for dentists near a point. Free, no API key. */
export async function findNearbyDentists(center: GeoPoint, radiusMeters = 8000): Promise<DentistResult[]> {
  const query = `[out:json][timeout:20];(node["amenity"="dentist"](around:${radiusMeters},${center.lat},${center.lon});way["amenity"="dentist"](around:${radiusMeters},${center.lat},${center.lon}););out center 25;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error('Dentist search failed. Check your connection and try again.');
  const data = await res.json();
  const elements: unknown[] = Array.isArray(data?.elements) ? data.elements : [];

  const results: DentistResult[] = elements
    .map((raw) => {
      const el = raw as { id: number | string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const tags = el.tags || {};
      const addrParts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean);
      if (typeof lat !== 'number' || typeof lon !== 'number') return null;
      return {
        id: String(el.id),
        name: tags.name || 'Dental Clinic',
        lat,
        lon,
        address: addrParts.join(' ') || tags['addr:full'] || '',
        distanceKm: haversineKm(center, { lat, lon }),
      };
    })
    .filter((d): d is DentistResult => d !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 12);

  return results;
}
