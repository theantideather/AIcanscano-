'use client'

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { DentistResult, GeoPoint } from '@/lib/location';

// Leaflet's default marker icon paths break under bundlers; point them at the
// bundled assets explicitly instead.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Props {
  center: GeoPoint;
  dentists: DentistResult[];
}

export const DentistMap: React.FC<Props> = ({ center, dentists }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([center.lat, center.lon], 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const youIcon = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#2C4A7C;border:3px solid white;box-shadow:0 0 0 2px #2C4A7C;"></div>',
      iconSize: [16, 16],
    });
    L.marker([center.lat, center.lon], { icon: youIcon }).addTo(map).bindPopup('Your location');

    dentists.forEach((d) => {
      L.marker([d.lat, d.lon])
        .addTo(map)
        .bindPopup(`<strong>${d.name}</strong><br/>${d.address || 'Address unavailable'}<br/>${d.distanceKm.toFixed(1)} km away`);
    });

    if (dentists.length > 0) {
      const bounds = L.latLngBounds([[center.lat, center.lon], ...dentists.map((d) => [d.lat, d.lon] as [number, number])]);
      map.fitBounds(bounds, { padding: [32, 32] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, dentists]);

  return <div ref={containerRef} className="w-full h-80 rounded-[1.5rem] overflow-hidden border border-[#1C2E26]/10" />;
};
