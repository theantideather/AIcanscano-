'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Database, Gauge, Shield, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLASS_META, type AnalysisResult } from '@/lib/types';
import { ScanOverlay } from './ScanOverlay';
import { CareRecommendations } from './CareRecommendations';

interface Props {
  result: AnalysisResult;
  imageUrl: string;
  onReset: () => void;
}

const riskBg: Record<string, string> = {
  low: 'bg-[#1F5C4A]/[0.05] border-[#1F5C4A]/20',
  moderate: 'bg-[#C9A227]/[0.08] border-[#C9A227]/30',
  high: 'bg-[#9B2C2C]/[0.06] border-[#9B2C2C]/30',
};

export const ResultsReport: React.FC<Props> = ({ result, imageUrl, onReset }) => {
  const diagMeta = CLASS_META[result.clinical_assessment.primary_diagnosis_class];
  const fusion = result.diagnostic_fusion;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-10 report-content"
    >
      {result.is_mock_fallback && (
        <div className="flex items-center justify-center gap-3 px-6 py-3 rounded-full glass-card mx-auto w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/50">Simulated: no live model configured</span>
        </div>
      )}

      {/* THE DIAGNOSIS: image with the flagged region, and the verdict, front and center */}
      <div className={cn('p-8 md:p-14 rounded-[3.5rem] border space-y-10 shadow-[0_32px_64px_rgba(28,46,38,0.07)]', riskBg[result.clinical_assessment.risk_level])}>
        <ScanOverlay imageUrl={imageUrl} regions={result.detection.suspicious_regions} />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-8 px-2">
          <div className="text-center sm:text-left">
            <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#1C2E26]/60">Risk Level</span>
            <h2 className="font-serif text-6xl md:text-7xl font-black uppercase tracking-tight italic" style={{ color: diagMeta.color }}>
              {result.clinical_assessment.risk_level}
            </h2>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-[#F8F3E7] border border-[#1C2E26]/10 shadow-sm">
            <ShieldAlert className="w-5 h-5" style={{ color: diagMeta.color }} />
            <span className="text-sm font-black text-[#1C2E26]/85 tracking-wide">{diagMeta.label}</span>
          </div>
          <div className="text-center sm:text-right">
            <span className="text-[10px] font-black uppercase tracking-[0.35em] text-[#1C2E26]/60">Fused Probability</span>
            <p className="font-serif text-6xl md:text-7xl font-black text-[#1C2E26] tracking-tight">{(fusion.fused_ai_diagnostic_probability * 100).toFixed(0)}%</p>
          </div>
        </div>

        <p className="text-lg md:text-xl leading-relaxed text-[#1C2E26]/75 italic font-medium text-center px-2">
          "{result.clinical_assessment.primary_findings}"
        </p>
      </div>

      {/* One-line safety note, always visible */}
      <p className="text-center text-xs text-[#1C2E26]/65 font-medium max-w-2xl mx-auto px-4">
        Not a medical device. A research screening aid. Always confirm with a qualified clinician.
      </p>

      {/* Download: real "Save as PDF" via the browser's own print pipeline, so
          the report renders exactly as the screen (no canvas/screenshot
          approximation of the map, gradients, or blur). */}
      <div className="flex justify-center no-print">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#1C2E26]/15 text-[#1C2E26]/70 hover:text-[#1C2E26] hover:border-[#2C4A7C]/40 text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
        >
          <Printer size={14} />
          Download Report (PDF)
        </button>
      </div>

      <div>
        <div className="space-y-8 pt-2">
              {/* Findings + diagnosis vector */}
              <div className="p-8 md:p-10 rounded-[3rem] glass-card space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-[#1C2E26]/[0.06] pb-6">
                  <h4 className="text-xl font-black text-[#1C2E26] uppercase tracking-tight">{result.clinical_assessment.anatomical_location}</h4>
                  <div className="text-left md:text-right">
                    <p className="text-[9px] font-black text-[#1C2E26]/55 uppercase tracking-[0.3em] mb-1">Model Confidence</p>
                    <p className="text-3xl font-black text-[#1C2E26] tracking-tight">{(result.ml_confidence_metrics.overall_confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-black tracking-[0.3em] text-[#1C2E26]/55">Differential Diagnosis</span>
                  <div className="flex flex-wrap gap-2">
                    {result.clinical_assessment.differential_diagnosis.map((d, i) => (
                      <span key={i} className="px-4 py-1.5 rounded-full bg-[#1C2E26]/[0.03] border border-[#1C2E26]/10 text-[10px] font-black text-[#1C2E26]/65 tracking-wide uppercase">{d}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Probability vectors + fused score */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-8 rounded-[3rem] glass-card space-y-6">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-[#1C2E26]/55" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/50">Class Probabilities</span>
                  </div>
                  <div className="space-y-5">
                    {(['normal', 'opmd', 'osmf', 'oscc'] as const).map((key) => {
                      const value = result.ml_confidence_metrics.class_probabilities[key];
                      const meta = CLASS_META[key];
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: meta.color }}>{meta.label}</span>
                            <span className="text-sm font-black text-[#1C2E26] tracking-tight">{(value * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-[3px] w-full bg-[#1C2E26]/[0.06] relative overflow-hidden rounded-full">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${value * 100}%` }}
                              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                              className="absolute h-full rounded-full"
                              style={{ background: meta.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-8 rounded-[3rem] glass-card space-y-5">
                  <div className="flex items-center gap-3">
                    <Gauge className="w-4 h-4 text-[#1C2E26]/55" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/50">Fusion Breakdown</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black tracking-[0.2em] text-[#1C2E26]/65">Image-derived</span>
                      <span className="text-sm font-black text-[#1C2E26]/85">{(fusion.image_derived_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black tracking-[0.2em] text-[#1C2E26]/65">Clinical risk</span>
                      <span className="text-sm font-black text-[#1C2E26]/85">{(fusion.clinical_derived_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#1C2E26]/55 font-medium leading-relaxed pt-3 border-t border-[#1C2E26]/[0.06]">
                    65% image, 35% clinical. An explainable heuristic, not a clinically validated fusion model.
                  </p>
                </div>
              </div>

              {/* Care recommendations: next steps + find a dentist near you */}
              <CareRecommendations
                precautionaryMeasures={result.clinical_assessment.precautionary_measures}
                clinicalNextSteps={result.clinical_assessment.clinical_next_steps}
                specialistType={result.deployment_and_routing.specialist_type}
                referralWindow={result.deployment_and_routing.target_time_to_referral}
              />

              {/* Clinical intake echoed back */}
              <div className="p-8 rounded-[3rem] glass-card space-y-6">
                <span className="text-[10px] uppercase font-black tracking-[0.3em] text-[#1C2E26]/50">Clinical Variables Reviewed</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    ['Age', result.clinical_intake.age ?? 'N/A'],
                    ['Sex', result.clinical_intake.sex],
                    ['Tobacco', result.clinical_intake.tobacco_use ? 'Yes' : 'No'],
                    ['Alcohol', result.clinical_intake.alcohol_consumption ? 'Yes' : 'No'],
                    ['Betel quid', result.clinical_intake.betel_quid_use ? 'Yes' : 'No'],
                    ['Duration (wk)', result.clinical_intake.lesion_duration_weeks ?? 'N/A'],
                    ['Site', result.clinical_intake.anatomical_site.replace(/_/g, ' ')],
                    ['Colour', result.clinical_intake.lesion_colour ?? 'N/A'],
                    ['Ulceration', result.clinical_intake.ulceration ? 'Yes' : 'No'],
                    ['Pain', result.clinical_intake.pain ? 'Yes' : 'No'],
                    ['Prior OPMD', result.clinical_intake.previous_opmd ? 'Yes' : 'No'],
                  ].map(([label, val]) => (
                    <div key={label as string} className="p-4 rounded-xl bg-[#1C2E26]/[0.02] border border-[#1C2E26]/[0.06]">
                      <p className="text-[8px] uppercase text-[#1C2E26]/55 font-black tracking-[0.2em] mb-1">{label}</p>
                      <p className="text-sm font-black text-[#1C2E26]/85 tracking-tight capitalize">{String(val)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 rounded-[3rem] glass-card flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                <Shield className="w-9 h-9 text-[#1C2E26]/50 flex-shrink-0" />
                <p className="text-sm text-[#1C2E26]/55 leading-relaxed font-medium">
                  {result.disclaimer} AICanScanO-Plus is a research screening aid, not a diagnostic device. Histopathological
                  confirmation is the gold standard for any suspicious finding.
                </p>
              </div>
            </div>
      </div>

      <div className="flex justify-center pt-10 no-print">
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(201,162,39,0.08)', borderColor: 'rgba(201,162,39,0.4)' }}
          className="px-16 py-6 rounded-full border border-[#1C2E26]/15 text-[#1C2E26]/55 hover:text-[#1C2E26] uppercase tracking-[0.4em] font-black text-[10px] italic transition-all"
          onClick={onReset}
        >
          Run Another Screening
        </motion.button>
      </div>
    </motion.div>
  );
};
