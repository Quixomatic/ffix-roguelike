import { useEffect, useState } from "react";

import { assetUrl, BOOT_PACKS, loadPacks, prunePackCache, REMOTE, type PackProgress } from "@/lib/assets";

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

/**
 * Holds the app until the boot asset packs (sprites, effects) are ready — a progress bar on the first visit, a
 * moment's read from Cache Storage after that. Without R2 (dev) it renders straight away.
 */
export function AssetGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!REMOTE);
  const [progress, setProgress] = useState<PackProgress>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!REMOTE) return;
    let live = true;
    setError(null);
    loadPacks(BOOT_PACKS, (p) => live && setProgress(p))
      .then(() => {
        if (!live) return;
        // CSS can't call assetUrl: the menu glove's image goes in through a custom property.
        document.documentElement.style.setProperty("--glove-right", `url("${assetUrl("sprites/ui/hand-right.png")}")`);
        setReady(true);
        void prunePackCache().catch(() => undefined);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [attempt]);

  if (ready) return <>{children}</>;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="ff-window flex w-full max-w-md flex-col gap-3 p-4">
        <span className="ff-display text-xl">{error ? "Couldn't load the game's assets" : "Loading…"}</span>
        {error ? (
          <>
            <span className="text-sm opacity-70">{error}</span>
            <button className="self-start rounded border border-white/20 bg-black/25 px-3 py-1 hover:brightness-125" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="h-3 overflow-hidden rounded bg-black/40">
              <div className="h-full bg-yellow-300 transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm tabular-nums opacity-70">
              {progress.total ? `${mb(progress.done)} / ${mb(progress.total)} MB` : "Checking for updates…"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
