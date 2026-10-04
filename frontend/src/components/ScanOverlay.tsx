'use client'

import React from 'react';
import { motion } from 'framer-motion';
import type { SuspiciousRegion } from '@/lib/types';
import { CLASS_META } from '@/lib/types';

interface ScanOverlayProps {
  imageUrl: string;
  regions: SuspiciousRegion[];
  scanning?: boolean;
  gridDensity?: number;
}

/**
 * Renders the intra-oral photo with a targeting grid and the flagged
 * region(s). When the model returns an `outline` (points tracing the
 * lesion's visible margin), that shape is drawn directly, the actual
 * affected area, not just a box. Otherwise an ellipse inscribed in the
 * bounding box is used as a softer, more lesion-like fallback than a hard
 * rectangle. Coordinates arrive normalized on a 0-1000 scale, so an SVG
 * with viewBox="0 0 1000 1000" maps them 1:1 regardless of rendered size.
 */
export const ScanOverlay: React.FC<ScanOverlayProps> = ({ imageUrl, regions, scanning = false, gridDensity = 10 }) => {
  const step = 1000 / gridDensity;
  const gridLines = Array.from({ length: gridDensity - 1 }, (_, i) => (i + 1) * step);

  return (
    <div className="relative rounded-[2.5rem] overflow-hidden border border-[#1C2E26]/10 max-w-4xl mx-auto bg-[#F6F3EC] shadow-xl">
      <img src={imageUrl} alt="Intra-oral capture" className="w-full h-auto max-h-[640px] object-contain" />

      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        {/* targeting grid */}
        {gridLines.map((pos) => (
          <React.Fragment key={`g-${pos}`}>
            <motion.line
              x1={pos} y1={0} x2={pos} y2={1000}
              stroke="rgba(44,74,124,0.14)" strokeWidth={1} vectorEffect="non-scaling-stroke"
              animate={scanning ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
              transition={scanning ? { duration: 1.8, repeat: Infinity, delay: (pos / 1000) * 0.6 } : undefined}
            />
            <motion.line
              x1={0} y1={pos} x2={1000} y2={pos}
              stroke="rgba(44,74,124,0.14)" strokeWidth={1} vectorEffect="non-scaling-stroke"
              animate={scanning ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
              transition={scanning ? { duration: 1.8, repeat: Infinity, delay: (pos / 1000) * 0.6 } : undefined}
            />
          </React.Fragment>
        ))}

        {/* corner frame ticks */}
        {[[0, 0], [1000, 0], [0, 1000], [1000, 1000]].map(([x, y], i) => (
          <rect key={`c-${i}`} x={x - 1} y={y - 1} width={3} height={3} fill="rgba(44,74,124,0.5)" />
        ))}

        {/* hunting target box: searches across the image while analyzing */}
        {scanning && (
          <motion.rect
            fill="none"
            stroke="#2C4A7C"
            strokeWidth={3}
            strokeDasharray="14 10"
            vectorEffect="non-scaling-stroke"
            initial={false}
            animate={{
              x: [60, 480, 220, 620, 60],
              y: [80, 520, 650, 150, 80],
              width: [260, 340, 300, 260, 260],
              height: [220, 260, 220, 280, 220],
              opacity: [0.9, 0.9, 0.9, 0.9, 0.9],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.55, 0.8, 1] }}
          />
        )}

        {/* suspicious region shapes */}
        {regions.map((r, i) => {
          const [ymin, xmin, ymax, xmax] = r.box_2d;
          const w = xmax - xmin;
          const h = ymax - ymin;
          const meta = CLASS_META[r.class] ?? CLASS_META.benign;
          const hasOutline = Array.isArray(r.outline) && r.outline.length >= 5;

          if (hasOutline) {
            const points = r.outline!.map(([x, y]) => `${x},${y}`).join(' ');
            return (
              <polygon
                key={i}
                points={points}
                fill={meta.color} fillOpacity={0.1}
                stroke={meta.color} strokeOpacity={0.95} strokeWidth={3}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="dash-flow"
              />
            );
          }

          const cx = xmin + w / 2;
          const cy = ymin + h / 2;
          return (
            <ellipse
              key={i}
              cx={cx} cy={cy} rx={w / 2} ry={h / 2}
              fill={meta.color} fillOpacity={0.1}
              stroke={meta.color} strokeOpacity={0.95} strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              className="dash-flow"
            />
          );
        })}
      </svg>

      {/* HTML-layer labels (crisper text than SVG at small sizes) */}
      {regions.map((r, i) => {
        const [ymin, xmin, , xmax] = r.box_2d;
        const meta = CLASS_META[r.class] ?? CLASS_META.benign;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className="absolute -translate-y-full"
            style={{ left: `${(xmin / 1000) * 100}%`, top: `${(ymin / 1000) * 100}%`, maxWidth: `${((xmax - xmin) / 1000) * 100}%` }}
          >
            <div
              className="mb-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2 bg-[#F8F3E7]/95 backdrop-blur-sm shadow-sm"
              style={{ borderColor: `${meta.color}55`, color: meta.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              {meta.short} &middot; {(r.confidence * 100).toFixed(0)}%
            </div>
          </motion.div>
        );
      })}

      {/* scan sweep animation while actively analyzing */}
      {scanning && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="scan-sweep-line absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-[#2C4A7C]/20 to-transparent" />
        </div>
      )}

      {regions.length === 0 && !scanning && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-[#F8F3E7]/95 border border-[#1C2E26]/10 backdrop-blur-sm shadow-sm">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#1C2E26]/50">No suspicious regions flagged</span>
        </div>
      )}
    </div>
  );
};
