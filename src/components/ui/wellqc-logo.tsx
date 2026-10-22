"use client";

import React from "react";

interface WellQCIconProps {
  className?: string;
  size?: number;
}

/**
 * WellQC Droplet Vector Icon
 * Teardrop oil droplet with petrophysical log curve and horizontal track ticks.
 * Navy left side, vibrant teal/emerald right wing.
 */
export function WellQCIcon({ className = "", size = 28 }: WellQCIconProps) {
  return (
    <svg
      width={size}
      height={(size * 12) / 10}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="wellqcLeftGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#071b34" />
          <stop offset="50%" stopColor="#0b2c58" />
          <stop offset="100%" stopColor="#0c3f7c" />
        </linearGradient>

        <linearGradient id="wellqcRightGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00a887" />
          <stop offset="50%" stopColor="#00c896" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Left Droplet Half (Navy) */}
      <path
        d="M 50 8 
           C 48 11, 26 38, 16 60
           C 8 78, 14 100, 32 110
           C 40 114, 48 115, 50 115
           L 50 8 Z"
        fill="url(#wellqcLeftGradIcon)"
      />

      {/* Horizontal log track lines on left */}
      <g stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
        <line x1="28" y1="46" x2="41" y2="46" />
        <line x1="24" y1="56" x2="39" y2="56" />
        <line x1="22" y1="66" x2="38" y2="66" />
        <line x1="22" y1="76" x2="40" y2="76" />
        <line x1="25" y1="86" x2="42" y2="86" />
        <line x1="31" y1="96" x2="44" y2="96" />
      </g>

      {/* Center Petrophysical Log Curve */}
      <path
        d="M 50 16
           C 43 28, 43 38, 48 48
           C 53 58, 41 68, 45 78
           C 49 88, 45 98, 49 108"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.8"
        strokeLinecap="round"
      />

      {/* Right Droplet Half (Teal / Emerald Wing) */}
      <path
        d="M 50 8
           C 52 11, 74 38, 84 60
           C 92 78, 86 100, 68 110
           C 60 114, 52 115, 50 115
           C 54 100, 56 75, 52 50
           C 50 35, 50 20, 50 8 Z"
        fill="url(#wellqcRightGradIcon)"
      />
    </svg>
  );
}

interface WellQCLogoProps {
  className?: string;
  iconSize?: number;
  showTagline?: boolean;
}

/**
 * WellQC Horizontal Brand Lockup
 * Combines the droplet mark with high-contrast typography ("WellQC") and tagline.
 */
export function WellQCLogo({
  className = "",
  iconSize = 28,
  showTagline = false,
}: WellQCLogoProps) {
  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      <WellQCIcon size={iconSize} />
      <div className="flex flex-col">
        <div className="flex items-baseline space-x-0.5 leading-none">
          <span className="wellqc-wordmark font-extrabold tracking-tight text-base sm:text-lg text-[#0b2c58] dark:text-white">
            Well
          </span>
          <span className="font-extrabold tracking-tight text-base sm:text-lg text-sky-600 dark:text-sky-400">
            QC
          </span>
        </div>
        {showTagline && (
          <span className="text-[9px] tracking-widest uppercase font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            Validate · Visualize · Trust
          </span>
        )}
      </div>
    </div>
  );
}
