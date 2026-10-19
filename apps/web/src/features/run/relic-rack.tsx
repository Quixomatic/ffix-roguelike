import { partySynergies, type RunState } from "@ffix-roguelike/game-core";
import { BASE_RELIC_SLOTS, relicById } from "@ffix-roguelike/game-data";

import { Badge } from "@/features/hub/badge";
import { RelicPopover, SynergyChip } from "@/features/hub/relic-popover";

/**
 * The run's relic rack (held relics, then empty slots) and the party's active synergies. Hover one (or reach it with
 * the cursor) for its full card, the items' popover. `.plans/relics-and-synergies.md`.
 */
export function RelicRack({ run, compact = false }: { run: RunState; compact?: boolean }) {
  const held = (run.relics ?? []).flatMap((id) => {
    const r = relicById(id);
    return r ? [r] : [];
  });
  const slots = run.relicSlots ?? BASE_RELIC_SLOTS;
  const party = run.party.map((m) => m.build.key);
  // Only the active synergies during a run (the embark page also shows the ones the party is short of).
  const synergies = partySynergies(party).filter((s) => s.tier);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {held.map((r) => (
          <RelicPopover key={r.id} relicId={r.id} side="left">
            <button type="button" data-sound="none" className="inline-flex cursor-help">
              <Badge id={r.badge ?? 1} scale={1} view={compact ? 28 : 36} />
            </button>
          </RelicPopover>
        ))}
        {Array.from({ length: Math.max(0, slots - held.length) }, (_, i) => (
          <span key={`empty-${i}`} title="Empty relic slot" className={`rounded-full border border-dashed border-white/25 ${compact ? "h-7 w-7" : "h-9 w-9"}`} />
        ))}
      </div>
      {synergies.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {synergies.map(({ synergy, count }) => (
            <SynergyChip key={synergy.id} synergy={synergy} count={count} party={party} side="left" />
          ))}
        </div>
      )}
    </div>
  );
}
