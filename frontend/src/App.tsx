'use client'

import React from 'react';
import { Layout } from './components/Layout';
import { DiagnosisWizard } from './components/DiagnosisWizard';
import { motion } from 'framer-motion';
import { ArrowRight, Microscope } from 'lucide-react';

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="glass-card rounded-[2rem] overflow-hidden transition-all duration-500">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-6 flex items-center justify-between text-left"
      >
        <span className="text-base font-bold tracking-tight text-[#1C2E26]/85">{question}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="text-[#C9A227] flex-shrink-0 ml-4">
          <ArrowRight size={18} />
        </motion.div>
      </button>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="px-8 pb-6 text-[#1C2E26]/50 leading-relaxed text-sm"
        >
          {answer}
        </motion.div>
      )}
    </div>
  );
};

function App() {
  return (
    <Layout>
      <DiagnosisWizard />

      <section id="faq" className="py-32 bg-[#F1EADA] container mx-auto px-4 max-w-4xl space-y-16">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full glass-card text-[9px] uppercase tracking-[0.5em] text-[#1C2E26]/60 font-black">
            <Microscope className="w-3.5 h-3.5 text-[#C9A227]" /> Clinical Biometric Integrity
          </div>
          <h2 className="font-serif text-5xl md:text-7xl font-black tracking-tight text-[#1C2E26] uppercase italic">
            Technical <span className="opacity-20 not-italic">Intel</span>
          </h2>
        </div>
        <div className="space-y-4">
          <FAQItem
            question="Can AICanScanO-Plus replace a professional examination?"
            answer="No. It is a clinical screening aid, not a diagnostic device. It flags high-probability abnormalities and the region they're located in for evaluation by oral specialists. Definitive histopathological confirmation (biopsy) remains the gold standard."
          />
          <FAQItem
            question="What does the shape drawn on the photo mean?"
            answer="It traces a region the model flagged as suspicious, labeled with its likely class (OPMD / OSMF / OSCC) and a confidence percentage. No shape means no suspicious region was visually identified."
          />
          <FAQItem
            question="What's the optional clinical intake for?"
            answer="A few extra answers (habits, lesion duration, colour, ulceration, prior OPMD) let the model fuse clinical risk factors with the image finding into one estimate. It's optional, so you can get a diagnosis from the photo alone."
          />
          <FAQItem
            question="What model powers the analysis?"
            answer="Anthropic's Claude (claude-haiku-4-5), a vision-capable model, called with a forced structured tool output, so every response is a validated clinical read-out plus the shape of any flagged region, not free text parsed after the fact."
          />
          <FAQItem
            question="Is any data stored?"
            answer="No. Images and intake answers are processed in memory for the single request and are not persisted or logged beyond the server console."
          />
        </div>
      </section>
    </Layout>
  );
}

export default App;
