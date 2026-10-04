'use client'

import React, { useState } from 'react';
import { MapPin, Navigation, Search, Loader2, ExternalLink, Video, CheckCircle2 } from 'lucide-react';
import { getBrowserLocation, geocodeAddress, findNearbyDentists, type GeoPoint, type DentistResult } from '@/lib/location';
import { DentistMap } from './DentistMap';

interface Props {
  precautionaryMeasures: string[];
  clinicalNextSteps: string[];
  specialistType: string;
  referralWindow: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export const CareRecommendations: React.FC<Props> = ({ precautionaryMeasures, clinicalNextSteps, specialistType, referralWindow }) => {
  const [locating, setLocating] = useState(false);
  const [center, setCenter] = useState<GeoPoint | null>(null);
  const [dentists, setDentists] = useState<DentistResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState('');

  const [teleName, setTeleName] = useState('');
  const [teleContact, setTeleContact] = useState('');
  const [telePreferredTime, setTelePreferredTime] = useState('');
  const [teleSubmitting, setTeleSubmitting] = useState(false);
  const [teleSubmitted, setTeleSubmitted] = useState(false);
  const [teleError, setTeleError] = useState<string | null>(null);

  const runSearch = async (point: GeoPoint) => {
    setCenter(point);
    const results = await findNearbyDentists(point);
    setDentists(results);
    if (results.length === 0) setError('No dentists found nearby. Try a different location.');
  };

  const useMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const point = await getBrowserLocation();
      await runSearch(point);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const searchAddress = async () => {
    if (!addressInput.trim()) return;
    setLocating(true);
    setError(null);
    try {
      const point = await geocodeAddress(addressInput.trim());
      await runSearch(point);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Location not found.');
    } finally {
      setLocating(false);
    }
  };

  const requestTeleconsult = async () => {
    if (!teleName.trim() || !teleContact.trim()) {
      setTeleError('Please provide your name and a way to reach you.');
      return;
    }
    setTeleSubmitting(true);
    setTeleError(null);
    try {
      const res = await fetch(`${API_BASE}/teleconsult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teleName, contact: teleContact, preferredTime: telePreferredTime, specialistType }),
      });
      if (!res.ok) throw new Error('Request failed. Please try again.');
      setTeleSubmitted(true);
    } catch (e) {
      setTeleError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setTeleSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Next Steps */}
      <div className="p-8 md:p-10 rounded-[3rem] glass-card space-y-8">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/60">Care Recommendations</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <span className="text-[10px] uppercase font-black tracking-[0.3em] text-[#1C2E26]/60">Precautionary Measures</span>
            <ul className="space-y-2 text-sm text-[#1C2E26]/75 font-medium list-disc list-inside">
              {precautionaryMeasures.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
          <div className="space-y-4">
            <span className="text-[10px] uppercase font-black tracking-[0.3em] text-[#1C2E26]/60">What To Do Next</span>
            <ul className="space-y-2 text-sm font-medium list-none">
              {clinicalNextSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[#B8860B]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B8860B] mt-1.5 flex-shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-6 pt-4 border-t border-[#1C2E26]/[0.06]">
              <div>
                <p className="text-[8px] uppercase font-black text-[#1C2E26]/60 tracking-[0.2em]">Referral window</p>
                <p className="text-sm font-black text-[#1C2E26]">{referralWindow}</p>
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-[#1C2E26]/60 tracking-[0.2em]">Specialist</p>
                <p className="text-sm font-black text-[#1C2E26]">{specialistType}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clinics near you */}
      <div className="p-8 md:p-10 rounded-[3rem] glass-card space-y-6">
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-[#0F8B8B]" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/60">Clinics Near You</span>
        </div>
        <p className="text-sm text-[#1C2E26]/60 font-medium leading-relaxed">
          Share your location or enter a city or zip code to find dentists and oral specialists near you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 no-print">
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="px-6 py-3 rounded-full bg-[#2C4A7C] text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-[#1E3861] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Navigation size={14} />
            Use My Location
          </button>
          <div className="flex-1 flex gap-3">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
              placeholder="City or zip code"
              className="flex-1 bg-[#1C2E26]/[0.03] border border-[#1C2E26]/10 rounded-full px-5 py-3 text-sm font-bold text-[#1C2E26] placeholder:text-[#1C2E26]/50 focus:outline-none focus:border-[#2C4A7C]/40"
            />
            <button
              onClick={searchAddress}
              disabled={locating}
              className="px-5 py-3 rounded-full bg-[#1C2E26]/[0.05] border border-[#1C2E26]/10 text-[#1C2E26]/60 hover:text-[#1C2E26] transition-colors disabled:opacity-50"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {locating && (
          <div className="flex items-center justify-center gap-3 py-8 text-[#1C2E26]/60">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Searching nearby</span>
          </div>
        )}

        {error && !locating && (
          <p className="text-sm text-[#9B2C2C] font-medium bg-[#9B2C2C]/5 border border-[#9B2C2C]/15 rounded-2xl px-5 py-3">{error}</p>
        )}

        {center && !locating && dentists.length > 0 && (
          <div className="space-y-6">
            <DentistMap center={center} dentists={dentists} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dentists.map((d) => (
                <a
                  key={d.id}
                  href={`https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lon}#map=17/${d.lat}/${d.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 p-4 rounded-2xl bg-[#1C2E26]/[0.02] border border-[#1C2E26]/[0.06] hover:border-[#2C4A7C]/30 transition-colors"
                >
                  <MapPin size={16} className="text-[#0F8B8B] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#1C2E26] truncate">{d.name}</p>
                    <p className="text-xs text-[#1C2E26]/60 font-medium truncate">{d.address || 'Address unavailable'}</p>
                    <p className="text-[10px] font-black text-[#2C4A7C] uppercase tracking-wide mt-1">{d.distanceKm.toFixed(1)} km away</p>
                  </div>
                  <ExternalLink size={13} className="text-[#1C2E26]/35 flex-shrink-0 mt-1" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Teleconsultation */}
      <div className="p-8 md:p-10 rounded-[3rem] glass-card space-y-6 no-print">
        <div className="flex items-center gap-3">
          <Video className="w-4 h-4 text-[#2C4A7C]" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/60">Teleconsultation</span>
        </div>

        {teleSubmitted ? (
          <div className="flex items-center gap-3 text-[#1F5C4A] bg-[#1F5C4A]/[0.06] border border-[#1F5C4A]/20 rounded-2xl px-5 py-4">
            <CheckCircle2 size={20} className="flex-shrink-0" />
            <p className="text-sm font-bold">Request received. In a production deployment, a specialist ({specialistType.toLowerCase()}) would reach out to confirm your call.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#1C2E26]/60 font-medium leading-relaxed">
              Request a video consultation with a specialist to review this screening. This is a demo request flow for the research prototype.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                value={teleName}
                onChange={(e) => setTeleName(e.target.value)}
                placeholder="Full name"
                className="bg-[#1C2E26]/[0.03] border border-[#1C2E26]/10 rounded-2xl px-5 py-3 text-sm font-bold text-[#1C2E26] placeholder:text-[#1C2E26]/50 focus:outline-none focus:border-[#2C4A7C]/40"
              />
              <input
                type="text"
                value={teleContact}
                onChange={(e) => setTeleContact(e.target.value)}
                placeholder="Phone or email"
                className="bg-[#1C2E26]/[0.03] border border-[#1C2E26]/10 rounded-2xl px-5 py-3 text-sm font-bold text-[#1C2E26] placeholder:text-[#1C2E26]/50 focus:outline-none focus:border-[#2C4A7C]/40"
              />
              <input
                type="text"
                value={telePreferredTime}
                onChange={(e) => setTelePreferredTime(e.target.value)}
                placeholder="Preferred time (optional)"
                className="bg-[#1C2E26]/[0.03] border border-[#1C2E26]/10 rounded-2xl px-5 py-3 text-sm font-bold text-[#1C2E26] placeholder:text-[#1C2E26]/50 focus:outline-none focus:border-[#2C4A7C]/40"
              />
            </div>
            {teleError && <p className="text-sm text-[#9B2C2C] font-medium">{teleError}</p>}
            <button
              onClick={requestTeleconsult}
              disabled={teleSubmitting}
              className="px-8 py-3 rounded-full bg-[#1C2E26] text-white text-xs font-black uppercase tracking-[0.25em] hover:bg-[#2C4A7C] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {teleSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
              Request Teleconsultation
            </button>
          </>
        )}
      </div>
    </div>
  );
};
