"use client";

import { RiskTier, tierFromScore } from "@/lib/types";
import { RISK_TIER_LABEL, RISK_TIER_TEXT_CLASS } from "@/lib/risk";
import { cn } from "@/lib/utils";

const CX = 100;
const CY = 96;
const R = 78;

function pointFor(score: number, radius: number) {
  const angle = 180 - (score / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function arcPath(from: number, to: number, radius: number) {
  const p1 = pointFor(from, radius);
  const p2 = pointFor(to, radius);
  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y}`;
}

const BANDS: { from: number; to: number; varName: string }[] = [
  { from: 0, to: 40, varName: "var(--risk-low)" },
  { from: 40, to: 70, varName: "var(--risk-medium)" },
  { from: 70, to: 100, varName: "var(--risk-high)" },
];

interface RiskGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function RiskGauge({ score, size = "md", showLabel = true, className }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const tier: RiskTier = tierFromScore(clamped);
  const needle = pointFor(clamped, R - 14);
  const dims = size === "sm" ? 64 : size === "lg" ? 220 : 140;
  const strokeW = size === "sm" ? 10 : 14;

  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <svg
        viewBox="0 0 200 116"
        width={dims}
        height={(dims * 116) / 200}
        role="img"
        aria-label={`Score de risco ${clamped} de 100, classificado como ${RISK_TIER_LABEL[tier]}`}
      >
        {BANDS.map((b) => (
          <path
            key={b.varName}
            d={arcPath(b.from + 0.6, b.to - 0.6, R)}
            fill="none"
            stroke={b.varName}
            strokeWidth={strokeW}
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
        {size !== "sm" &&
          [0, 40, 70, 100].map((tick) => {
            const outer = pointFor(tick, R + strokeW / 2 + 6);
            return (
              <text
                key={tick}
                x={outer.x}
                y={outer.y + 4}
                textAnchor="middle"
                className="font-data"
                style={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              >
                {tick}
              </text>
            );
          })}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          stroke="var(--foreground)"
          strokeWidth={size === "sm" ? 2 : 3}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={size === "sm" ? 4 : 6} fill="var(--foreground)" />
      </svg>
      {showLabel && (
        <div className="-mt-1 flex flex-col items-center">
          <span className={cn("font-data font-semibold leading-none", RISK_TIER_TEXT_CLASS[tier], size === "lg" ? "text-3xl" : "text-lg")}>
            {clamped}
          </span>
          <span className={cn("mt-1 text-xs font-medium uppercase tracking-wide", RISK_TIER_TEXT_CLASS[tier])}>
            {RISK_TIER_LABEL[tier]}
          </span>
        </div>
      )}
    </div>
  );
}
