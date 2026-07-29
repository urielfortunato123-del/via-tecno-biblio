import { useEffect, useState } from "react";
import { smrBootstrap, type SmrBootstrapState } from "@/lib/biblioteca/smr-bootstrap";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export function SmrBootstrap() {
  const [state, setState] = useState<SmrBootstrapState>(smrBootstrap.getState());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = smrBootstrap.subscribe(setState);
    void smrBootstrap.ensure();
    return () => {
      unsub();
    };
  }, []);

  // Auto-dismiss when ready after 3s
  useEffect(() => {
    if (state.phase === "ready") {
      const t = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(t);
    }
  }, [state.phase]);

  if (dismissed && state.phase === "ready") return null;
  if (state.phase === "ready" && !state.message) return null;

  const pct =
    state.total && state.current !== undefined
      ? Math.round((state.current / state.total) * 100)
      : undefined;

  const isError = state.phase === "error";
  const isReady = state.phase === "ready";

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2">
      <div
        className={`pointer-events-auto rounded-lg border bg-card p-3 shadow-lg ${
          isError ? "border-destructive/60" : ""
        }`}
      >
        <div className="flex items-start gap-2">
          {isError ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : isReady ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Manual SMR (DER-SP)</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {state.error ??
                state.message ??
                "Preparando o Manual SMR para consulta offline."}
            </div>
            {pct !== undefined && !isReady && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {pct !== undefined && !isReady && (
              <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                {state.current} / {state.total} páginas
              </div>
            )}
          </div>
          {(isReady || isError) && (
            <button
              onClick={() => setDismissed(true)}
              className="rounded p-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
