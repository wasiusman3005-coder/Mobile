import React from "react";

interface WormholeTransitionProps {
  active: boolean;
  label?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export const WormholeTransition: React.FC<WormholeTransitionProps> = ({
  active,
  label = "Crossing Quantum Singularity...",
  primaryColor = "#00f0ff",
  secondaryColor = "#8b5cf6",
}) => {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[140] pointer-events-none flex items-center justify-center animate-fadeIn"
      style={{
        background: "radial-gradient(circle at center, rgba(4, 7, 15, 0.35) 0%, #02040a 85%)",
      }}
    >
      <div
        className="absolute w-[240px] h-[240px] rounded-full border-[1.5px] wormhole-ring-1"
        style={{
          borderColor: primaryColor,
          boxShadow: `0 0 28px ${primaryColor}55, inset 0 0 18px ${primaryColor}45`,
        }}
      />
      <div
        className="absolute w-[480px] h-[480px] rounded-full border-[1.5px] wormhole-ring-2"
        style={{
          borderColor: secondaryColor,
          boxShadow: `0 0 32px ${secondaryColor}55, inset 0 0 18px ${secondaryColor}45`,
        }}
      />
      <div
        className="absolute w-[820px] h-[820px] rounded-full border-[1.5px] wormhole-ring-3"
        style={{
          borderColor: primaryColor,
          boxShadow: `0 0 36px ${primaryColor}44, inset 0 0 22px ${primaryColor}33`,
        }}
      />
      <div
        className="absolute w-[22px] h-[22px] rounded-full wormhole-flash-core"
        style={{
          background: `radial-gradient(circle, #ffffff 0%, ${primaryColor} 45%, transparent 72%)`,
        }}
      />
      <div
        className="relative z-10 font-orbitron font-bold text-xs sm:text-base tracking-[0.28em] uppercase text-slate-100 text-center px-6"
        style={{ textShadow: `0 0 18px ${primaryColor}` }}
      >
        {label}
      </div>
    </div>
  );
};
