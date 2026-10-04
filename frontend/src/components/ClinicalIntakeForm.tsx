'use client'

import React from 'react';
import { cn } from '@/lib/utils';
import { ANATOMICAL_SITE_OPTIONS, type ClinicalIntake, type LesionColour } from '@/lib/types';

interface Props {
  value: ClinicalIntake;
  onChange: React.Dispatch<React.SetStateAction<ClinicalIntake>>;
}

const TogglePill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border transition-all',
      active ? 'bg-[#1C2E26] text-white border-[#1C2E26]' : 'bg-[#1C2E26]/[0.02] text-[#1C2E26]/60 border-[#1C2E26]/10 hover:border-[#C9A227]/40 hover:text-[#1C2E26]/70'
    )}
  >
    {children}
  </button>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block mb-3 text-[9px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/55">{children}</span>
);

export const ClinicalIntakeForm: React.FC<Props> = ({ value, onChange }) => {
  // Functional update form so rapid/batched toggles (e.g. several clicks in the
  // same React event batch) each apply against the latest state instead of a
  // stale `value` snapshot from render time.
  const set = <K extends keyof ClinicalIntake>(key: K, val: ClinicalIntake[K]) =>
    onChange((prev) => ({ ...prev, [key]: val }));

  const yesNoFields: { key: keyof ClinicalIntake; label: string }[] = [
    { key: 'tobacco_use', label: 'Tobacco' },
    { key: 'alcohol_consumption', label: 'Alcohol' },
    { key: 'betel_quid_use', label: 'Betel quid' },
    { key: 'ulceration', label: 'Ulceration' },
    { key: 'pain', label: 'Pain' },
    { key: 'previous_opmd', label: 'Prior OPMD' },
  ];

  return (
    <div className="p-10 md:p-14 rounded-[3rem] glass-card space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <FieldLabel>Age</FieldLabel>
          <input
            type="number"
            min={0}
            max={120}
            value={value.age ?? ''}
            onChange={(e) => set('age', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="54"
            className="w-full bg-[#1C2E26]/[0.02] border border-[#1C2E26]/10 rounded-2xl px-5 py-3.5 text-[#1C2E26] text-base font-bold placeholder:text-[#1C2E26]/50 focus:outline-none focus:border-[#C9A227]/50 transition-colors"
          />
        </div>
        <div>
          <FieldLabel>Sex</FieldLabel>
          <div className="flex gap-2">
            {(['male', 'female'] as const).map((s) => (
              <TogglePill key={s} active={value.sex === s} onClick={() => set('sex', s)}>{s}</TogglePill>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Duration (wk)</FieldLabel>
          <input
            type="number"
            min={0}
            value={value.lesion_duration_weeks ?? ''}
            onChange={(e) => set('lesion_duration_weeks', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="0"
            className="w-full bg-[#1C2E26]/[0.02] border border-[#1C2E26]/10 rounded-2xl px-5 py-3.5 text-[#1C2E26] text-base font-bold placeholder:text-[#1C2E26]/50 focus:outline-none focus:border-[#C9A227]/50 transition-colors"
          />
        </div>
        <div>
          <FieldLabel>Colour</FieldLabel>
          <div className="flex gap-2">
            {(['white', 'red', 'mixed'] as LesionColour[]).map((c) => (
              <TogglePill key={c} active={value.lesion_colour === c} onClick={() => set('lesion_colour', c)}>{c}</TogglePill>
            ))}
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>Anatomical site</FieldLabel>
        <select
          value={value.anatomical_site}
          onChange={(e) => set('anatomical_site', e.target.value as ClinicalIntake['anatomical_site'])}
          className="w-full md:w-80 bg-[#1C2E26]/[0.02] border border-[#1C2E26]/10 rounded-2xl px-5 py-3.5 text-[#1C2E26] text-sm font-bold focus:outline-none focus:border-[#C9A227]/50 transition-colors appearance-none"
        >
          {ANATOMICAL_SITE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="border-t border-[#1C2E26]/[0.06] pt-8">
        <FieldLabel>Risk factors and presentation</FieldLabel>
        <div className="flex flex-wrap gap-3">
          {yesNoFields.map((f) => (
            <TogglePill key={f.key} active={Boolean(value[f.key])} onClick={() => set(f.key, !value[f.key] as never)}>
              {f.label}
            </TogglePill>
          ))}
        </div>
      </div>
    </div>
  );
};
