import { DocumentHistoryEntry } from "@/lib/types";
import { RiskBadge } from "@/components/risk-badge";

const ACTION_LABEL: Record<DocumentHistoryEntry["action"], string> = {
  upload: "Upload inicial",
  reanalise: "Reanálise",
  edicao: "Edição manual",
  status: "Atualização de status",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PdfHistoryTimeline({ entries }: { entries: DocumentHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>;
  }

  return (
    <ol className="relative flex flex-col gap-6 border-l border-border pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[29px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card bg-primary" />
          <details className="group" open={entry === entries[0]}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2.5 [&::-webkit-details-marker]:hidden">
              <span className="font-data rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                v{entry.version}
              </span>
              <span className="text-sm font-medium">{ACTION_LABEL[entry.action]}</span>
              <RiskBadge tier={entry.tier} score={entry.overallScore} />
              <span className="ml-auto font-data text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
            </summary>
            <div className="mt-2 flex flex-col gap-2 pl-0.5">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{entry.actorName}</span> · {entry.note}
              </p>
              <ul className="mt-1 flex flex-col gap-1.5">
                {entry.findings.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-1.5 text-xs">
                    <span className="text-foreground">{f.riskName}</span>
                    <span className="flex items-center gap-2">
                      <RiskBadge tier={f.tier} score={f.score} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
