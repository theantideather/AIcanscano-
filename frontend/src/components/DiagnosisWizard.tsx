'use client'

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Sparkles, AlertCircle, Shield, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMPTY_INTAKE, type AnalysisResult, type ClinicalIntake } from '@/lib/types';
import { ClinicalIntakeForm } from './ClinicalIntakeForm';
import { ScanOverlay } from './ScanOverlay';
import { ResultsReport } from './ResultsReport';

type Step = 'upload' | 'analyzing' | 'results';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const SCAN_PHASES = [
  'Calibrating image exposure and focus',
  'Mapping mucosal surface texture',
  'Tracing lesion boundary and margins',
  'Comparing against OPMD, OSMF, and OSCC patterns',
  'Cross-referencing clinical risk factors',
  'Computing fused diagnostic probability',
];

/**
 * Live-feeling status sequence shown while the request is in flight. Cycles
 * through the real stages of what the backend is actually doing (region
 * detection, classification, clinical fusion), looping if the API call runs
 * long, so the wait reads as an active scan rather than a generic spinner.
 */
const AnalyzingSequence: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SCAN_PHASES.length), 1300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-md">
      {SCAN_PHASES.map((phase, i) => {
        const state = i < index ? 'done' : i === index ? 'active' : 'pending';
        return (
          <div key={phase} className="flex items-center gap-4 w-full">
            <div
              className={cn(
                'w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors duration-300',
                state === 'done' && 'bg-[#1C2E26] border-[#1C2E26]',
                state === 'active' && 'border-[#C9A227] bg-[#C9A227]/10',
                state === 'pending' && 'border-[#1C2E26]/15'
              )}
            >
              {state === 'done' && <Check size={12} className="text-white" />}
              {state === 'active' && <span className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />}
            </div>
            <span
              className={cn(
                'text-xs md:text-sm font-bold uppercase tracking-wide transition-colors duration-300',
                state === 'done' && 'text-[#1C2E26]/55 line-through',
                state === 'active' && 'text-[#1C2E26]',
                state === 'pending' && 'text-[#1C2E26]/50'
              )}
            >
              {phase}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const DiagnosisWizard: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [intake, setIntake] = useState<ClinicalIntake>(EMPTY_INTAKE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Invalid input format. Provide a clear JPEG, PNG, or WebP intra-oral photograph.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError('Image exceeds the 6MB limit.');
      return;
    }
    setSelectedFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || step !== 'upload') return; // guard against double-submit
    setStep('analyzing');
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('clinicalData', JSON.stringify(intake));

    try {
      const response = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Analysis gateway error. Check connectivity and try again.');
      }
      const data: AnalysisResult = await response.json();
      setResult(data);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'System fault during analysis.');
      setStep('upload');
    }
  };

  const removeImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const reset = () => {
    setStep('upload');
    setIntake(EMPTY_INTAKE);
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  return (
    <section id="upload" className="pt-40 pb-32 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto space-y-16"
        >
          {step === 'upload' && (
            <>
              <div className="text-center space-y-8">
                <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full glass-card text-[10px] uppercase tracking-[0.4em] text-[#1C2E26]/60 font-black">
                  <Shield className="w-3.5 h-3.5 text-[#C9A227]" />
                  <span>Guided Diagnosis Gateway</span>
                </div>
                <h1 className="font-serif text-6xl md:text-8xl font-black tracking-tight text-[#1C2E26] uppercase italic leading-[0.95]">
                  AICanScanO <span className="opacity-30 not-italic">Plus</span>
                </h1>
                <p className="text-[#1C2E26]/55 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
                  A short patient intake, then a photo, for an OPMD, OSMF, and OSCC screening with the affected area marked. A research prototype, not a medical device.
                </p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1C2E26]/60 mb-6 text-center">Step 01 &middot; Patient Details (Optional)</p>
                <ClinicalIntakeForm value={intake} onChange={setIntake} />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1C2E26]/60 mb-6 text-center">Step 02 &middot; Photo</p>
                <motion.div
                  layout
                  id="dropzone"
                  className={cn('relative rounded-[3rem] transition-all duration-700 overflow-hidden glass-card', selectedFile ? 'p-4' : 'p-24 md:p-32')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                >
                  <AnimatePresence mode="wait">
                    {!previewUrl ? (
                      <motion.div
                        key="upload-prompt"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center text-center space-y-10 cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="relative group/icon">
                          <div className="w-28 h-28 rounded-full bg-[#1C2E26]/[0.03] border border-[#1C2E26]/10 flex items-center justify-center group-hover/icon:bg-[#C9A227]/[0.08] group-hover/icon:border-[#C9A227]/30 transition-all duration-700">
                            <Upload className="w-10 h-10 text-[#1C2E26]/55 group-hover/icon:text-[#C9A227] transition-all duration-700" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-3xl font-black text-[#1C2E26] uppercase tracking-tighter italic">Drag a Photo Here</p>
                          <p className="text-[10px] text-[#1C2E26]/50 font-black tracking-[0.5em] uppercase">Or click to browse &middot; JPEG / PNG / WEBP &middot; MAX 6MB</p>
                        </div>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                      </motion.div>
                    ) : (
                      <motion.div key="preview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative">
                        <div className="relative rounded-[2.5rem] overflow-hidden max-w-2xl mx-auto border border-[#1C2E26]/[0.06] shadow-lg">
                          <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[480px] object-contain bg-[#F6F3EC]" />
                        </div>
                        <motion.button
                          whileHover={{ rotate: 90, scale: 1.1 }}
                          onClick={removeImage}
                          className="absolute top-10 right-10 p-4 bg-[#F8F3E7] border border-[#1C2E26]/10 rounded-full text-[#1C2E26]/60 hover:text-[#1C2E26] transition-all z-20 shadow-md"
                        >
                          <X size={22} />
                        </motion.button>

                        <div className="p-20 flex justify-center">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAnalyze}
                            className="px-20 py-8 rounded-full bg-[#1C2E26] text-white font-black text-xs uppercase tracking-[0.4em] transition-all shadow-[0_40px_80px_rgba(22,35,58,0.18)] hover:bg-[#C9A227] hover:text-[#1C2E26]"
                          >
                            Diagnose
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 rounded-[2.5rem] glass-card flex flex-col md:flex-row items-center gap-10 max-w-3xl mx-auto">
                  <AlertCircle className="w-12 h-12 text-[#AE2B22]/60" />
                  <div className="space-y-2 text-center md:text-left">
                    <p className="font-black text-xl uppercase tracking-widest italic text-[#1C2E26]">Analysis Failed</p>
                    <p className="text-sm text-[#1C2E26]/50 leading-relaxed font-bold tracking-wide">{error}</p>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {step === 'analyzing' && previewUrl && (
            <div className="space-y-14">
              <ScanOverlay imageUrl={previewUrl} regions={[]} scanning />
              <div className="flex flex-col items-center justify-center space-y-10">
                <div className="flex items-center gap-4">
                  <Sparkles className="w-6 h-6 text-[#C9A227] animate-pulse" />
                  <h3 className="font-serif text-4xl md:text-5xl font-black uppercase tracking-tight text-[#1C2E26] italic">Diagnosing</h3>
                </div>
                <AnalyzingSequence />
              </div>
            </div>
          )}

          <AnimatePresence>
            {step === 'results' && result && previewUrl && (
              <ResultsReport result={result} imageUrl={previewUrl} onReset={reset} />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};
