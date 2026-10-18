import {
  EQUIP_SLOTS,
  nextSlotCost,
  slotUnlocked,
  starterBlockText,
  starterTierPicked,
  starterUpgradeState,
  type CharacterBuild,
  type Profile,
  type StarterTierBlock,
} from "@ffix-roguelike/game-core";
import { getCharacter, items, type EquipSlot } from "@ffix-roguelike/game-data";
import { useMemo, type ReactNode } from "react";

import { PixelIcon } from "@/components/pixel-icon";
import { FocusItem } from "@/features/input/focus";
import { ItemIcon } from "@/features/items/item-icon";
import { ItemPopover } from "@/features/items/item-popover";
import { itemStatuses, type ItemStatus } from "@/features/items/item-status";
import { SLOT_META } from "@/features/gear/paperdoll";

const ROMAN = ["", "I", "II", "III", "IV", "V"];

/** How to unlock a tier's item for good, from the Items page's line for it (map-pool gear: win a run with one). */
function unlockHint(status: ItemStatus | undefined): string {
  if (!status) return "";
  if (status.kind === "pool" || status.kind === "journey") return `win a run with one (${status.label.charAt(0).toLowerCase()}${status.label.slice(1)})`;
  return status.label;
}

const blockLine = (block: StarterTierBlock, statuses: Map<number, ItemStatus>) =>
  block.kind === "item" ? `${starterBlockText(block)}: ${unlockHint(statuses.get(block.itemId))}` : starterBlockText(block);

/**
 * The character page's starting-gear upgrades (`.plans/starter-upgrades.md`): a row of item tiles per slot — the FF9
 * piece, then each tier. Everything else is in the tile's item popover. Clicking an owned tile starts runs with it (to
 * keep learning its abilities), the next tier's tile buys it (banked gil + CP), and a locked slot's first tile unlocks
 * the slot (CP), like the paperdoll's.
 */
export function StarterUpgrades({
  build,
  profile,
  selected,
  busy,
  onBuy,
  onPick,
  onUnlockSlot,
}: {
  build: CharacterBuild;
  profile: Profile | null;
  selected: EquipSlot | null;
  busy: boolean;
  onBuy(slot: EquipSlot): void;
  onPick(slot: EquipSlot, tier: number): void;
  onUnlockSlot(slot: EquipSlot): void;
}) {
  const statuses = useMemo(() => itemStatuses(items, profile), [profile]);
  const ff9 = getCharacter(build.key).defaultEquipment;
  const slotCost = nextSlotCost(build);
  const points = build.points ?? 0;

  return (
    <div className="flex flex-col gap-1">
      {EQUIP_SLOTS.map((slot) => {
        const tiers = profile ? starterUpgradeState(profile, build.key, slot) : [];
        const open = slotUnlocked(build, slot);
        const picked = starterTierPicked(build, slot);
        const next = tiers.find((t) => !t.owned);
        const steps = [{ tier: 0, itemId: ff9[slot] }, ...tiers.map((t) => ({ tier: t.upgrade.tier, itemId: t.upgrade.itemId as number | null }))];
        return (
          <div key={slot} className={`flex items-center gap-2 rounded p-1.5 ${selected === slot ? "bg-white/10" : ""}`}>
            <span className="ff-title w-20 shrink-0">{SLOT_META[slot].label}</span>
            {steps.map((s, i) => {
              const state = s.tier ? tiers[s.tier - 1]! : null;
              const owned = !state || state.owned;
              const isPicked = open && s.tier === picked;
              const isNext = open && next?.upgrade.tier === s.tier;
              // The slot's own lock is said once, on its first tile.
              const blocks = (state?.blocks ?? []).filter((b) => b.kind !== "slot");
              const unlockTile = !open && s.tier === 0;
              const canUnlock = slotCost != null && points >= slotCost;

              let action: (() => void) | null = null;
              let lines: ReactNode;
              if (unlockTile) {
                action = canUnlock ? () => onUnlockSlot(slot) : null;
                lines = (
                  <>
                    <Line tone="warn">The {SLOT_META[slot].label} slot is locked{slotCost != null ? ` · unlock it for ${slotCost} CP` : ""}</Line>
                    <Line tone={canUnlock ? "good" : "bad"}>{canUnlock ? "Click to unlock it" : `Needs ${slotCost} CP`}</Line>
                  </>
                );
              } else if (!open) {
                lines = <Line tone="warn">Tier {ROMAN[s.tier]} · unlock the {SLOT_META[slot].label} slot first</Line>;
              } else if (isPicked) {
                lines = <Line tone="highlight">{s.tier ? `Tier ${ROMAN[s.tier]}` : "FF9 starting piece"} · every run starts with this</Line>;
              } else if (owned) {
                action = () => onPick(slot, s.tier);
                lines = <Line tone="good">{s.tier ? `Tier ${ROMAN[s.tier]} · owned` : "FF9 starting piece"} · click to start with it instead</Line>;
              } else {
                if (isNext && !blocks.length) action = () => onBuy(slot);
                lines = (
                  <>
                    <Line tone="highlight">
                      Tier {ROMAN[s.tier]} · {state!.upgrade.gil.toLocaleString()} gil · {state!.upgrade.cp} CP · start Lv {state!.upgrade.minStartLevel}
                    </Line>
                    {isNext && !blocks.length && <Line tone="good">Click to upgrade</Line>}
                    {blocks.map((b) => (
                      <Line key={b.kind} tone="bad">
                        {blockLine(b, statuses)}
                      </Line>
                    ))}
                  </>
                );
              }

              const tile = (
                <button
                  type="button"
                  data-sound={!open && !unlockTile ? "none" : isPicked ? "none" : action ? (owned || unlockTile ? undefined : "purchase") : "buzzer"}
                  disabled={busy}
                  onClick={() => action?.()}
                  className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded border-2 bg-[#0c1238] ${
                    unlockTile
                      ? "border-orange-300/70"
                      : isPicked
                        ? "border-yellow-200"
                        : !open
                          ? "border-white/10 opacity-40"
                          : owned
                            ? "border-emerald-300/50"
                            : isNext
                              ? "border-dashed border-white/50"
                              : "border-dashed border-white/15"
                  } ${action ? "hover:brightness-125" : "cursor-default"}`}
                >
                  <span className={owned && open ? "" : "[filter:brightness(0.4)]"}>
                    {s.itemId != null ? <ItemIcon itemId={s.itemId} size={32} /> : <span className="opacity-40">—</span>}
                  </span>
                  {(unlockTile || (!owned && open && !isNext)) && <PixelIcon name="lock" size={16} className="absolute -right-1.5 -top-1.5" />}
                </button>
              );
              return (
                <span key={s.tier} className="flex items-center gap-2">
                  {i > 0 && <span className="text-xl opacity-50">→</span>}
                  {s.itemId != null ? (
                    <ItemPopover itemId={s.itemId} party={[build]} side="bottom" extra={<div className="flex flex-col gap-0.5 border-b border-white/15 pb-1.5">{lines}</div>}>
                      {tile}
                    </ItemPopover>
                  ) : (
                    // No FF9 piece for this slot: a plain tile (its title says the same as a popover would).
                    <FocusItem>
                      <span title={unlockTile ? `Unlock the ${SLOT_META[slot].label} slot · ${slotCost} CP` : isPicked ? "Starts empty" : "Start with nothing here"}>{tile}</span>
                    </FocusItem>
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Line({ tone, children }: { tone: "good" | "bad" | "warn" | "highlight"; children: ReactNode }) {
  const color = { good: "text-emerald-200", bad: "text-orange-200", warn: "text-orange-200", highlight: "text-yellow-200" }[tone];
  return <div className={`text-xs ${color}`}>{children}</div>;
}
