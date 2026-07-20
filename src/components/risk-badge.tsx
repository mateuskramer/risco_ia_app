import { RiskTier } from "@/lib/types";
import { RISK_TIER_LABEL, RISK_TIER_TEXT_CLASS, RISK_TIER_BG_CLASS } from "@/lib/risk";
import { cn } from "@/lib/utils";

export function RiskBadge({ tier, score, className }: { tier: RiskTier; score?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold font-data",
        RISK_TIER_BG_CLASS[tier],
        RISK_TIER_TEXT_CLASS[tier],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {typeof score === "number" ? `${score} · ` : ""}
      {RISK_TIER_LABEL[tier]}
    </span>
  );
}
