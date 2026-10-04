'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen relative flex flex-col bg-[#F1EADA] text-[#1C2E26] selection:bg-[#C9A227]/25">
      {/* Full screen animated glow border, same mechanism as the original design */}
      <div className="glue-border" aria-hidden="true" />

      {/* Ambient depth layer */}
      <div className="glue-ambient" aria-hidden="true" />

      <header className="fixed top-0 left-0 right-0 z-[100] border-b border-[#1C2E26]/5 bg-[#F1EADA]/85 backdrop-blur-2xl">
        <div className="container mx-auto px-6 h-24 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-6"
          >
            <div
                className="flex items-center gap-3 group cursor-pointer"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <span className="font-serif text-2xl lg:text-3xl font-black tracking-tight text-[#1C2E26] uppercase italic whitespace-nowrap">AICanScanO</span>
              <div className="hidden xl:block h-5 w-[1px] bg-[#1C2E26]/15 rotate-[20deg]" />
              <div className="hidden xl:flex flex-col">
                <span className="text-[10px] uppercase font-black tracking-[0.4em] text-[#1C2E26]/60 leading-none mb-1">Powered by</span>
                <span className="text-[10px] uppercase font-black tracking-[0.3em] text-[#C9A227] leading-none">Orocare AI</span>
              </div>
            </div>

            <div className="hidden 2xl:flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#1C2E26]/[0.03] border border-[#1C2E26]/10">
              <div className="w-1 h-1 rounded-full bg-[#C9A227] animate-pulse" />
              <span className="text-[10px] uppercase font-black text-[#1C2E26]/60 tracking-[0.3em]">Protocol Active</span>
            </div>
          </motion.div>

          <nav className="hidden md:flex items-center gap-10">
            <a
                href="#faq"
                className="text-[10px] font-black uppercase tracking-[0.3em] lg:tracking-[0.4em] text-[#1C2E26]/60 hover:text-[#1C2E26] transition-all duration-500 hover:tracking-[0.5em] whitespace-nowrap"
            >
                FAQ
            </a>
             <button
                onClick={() => document.getElementById('dropzone')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-3 rounded-full bg-[#1C2E26] text-[10px] font-black uppercase tracking-[0.4em] text-white hover:bg-[#C9A227] hover:text-[#1C2E26] transition-all duration-500 whitespace-nowrap"
             >
                Upload
             </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="border-t border-[#1C2E26]/5 bg-[#F1EADA] py-24 pb-32">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-20">
            <div className="flex flex-col gap-8 max-w-md">
              <div className="flex items-center gap-4">
                <span className="font-serif text-4xl font-black tracking-tight text-[#1C2E26] italic">AICanScanO</span>

                <div className="relative group flex items-center justify-center isolation-auto">
                    <div className="absolute -inset-[2px] rounded-full blur-[4px] bg-[conic-gradient(from_0deg,#C9A227,transparent_30%,transparent_70%,#C9A227)] animate-[spin_4s_linear_infinite] opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative px-5 py-2 rounded-full bg-[#F8F3E7] border border-[#1C2E26]/5 flex items-center justify-center">
                        <span className="text-[10px] uppercase tracking-[0.4em] font-black text-[#C9A227]">
                            Powered by Orocare AI
                        </span>
                    </div>
                </div>
              </div>
              <p className="text-sm text-[#1C2E26]/65 leading-relaxed font-semibold tracking-wide uppercase">
                Guided oral lesion screening research prototype. Clinical intake fused with imaging for OPMD, OSMF, and OSCC risk triage.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-24 gap-y-12">
                <div className="space-y-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.6em] text-[#1C2E26]/50 block">Navigation</span>
                    <div className="flex flex-col gap-4">
                        <a href="#upload" className="text-xs font-bold text-[#1C2E26]/60 hover:text-[#1C2E26] transition-colors">Upload</a>
                        <a href="#faq" className="text-xs font-bold text-[#1C2E26]/60 hover:text-[#1C2E26] transition-colors">FAQ</a>
                    </div>
                </div>
                <div className="space-y-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.6em] text-[#1C2E26]/50 block">Disclosure</span>
                    <div className="flex flex-col gap-4">
                        <span className="text-xs font-bold text-[#1C2E26]/60 uppercase">Research Prototype</span>
                        <span className="text-xs font-bold text-[#1C2E26]/60 uppercase">Not a Medical Device</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="mt-24 pt-12 border-t border-[#1C2E26]/5 flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-[10px] text-[#1C2E26]/50 uppercase tracking-[0.5em] font-black">
              Copyright 2026 Orocare AI. Research Prototype, Not For Clinical Use
            </p>
            <div className="flex items-center gap-4 group">
               <Shield className="w-4 h-4 text-[#1C2E26]/50 group-hover:text-[#C9A227] transition-colors" />
               <span className="text-[10px] uppercase tracking-[0.4em] text-[#1C2E26]/50 group-hover:text-[#1C2E26]/50 font-black">Credential Verified</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
