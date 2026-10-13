import { campRecipes, campSynthTier, type Profile } from "@ffix-roguelike/game-core";
import { findItem } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ItemCard } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

/** Camp workshop: synthesize permanent stash gear from stash gear and banked gil. */
export function Workshop({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const synth = useMutation(
    trpc.profile.synthesize.mutationOptions({
      onSuccess: () => {
        toast.success("Synthesized!");
        qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const recipes = campRecipes(profile);
  const have = (id: number) => profile.stash[id] ?? 0;
  const canMake = (r: (typeof recipes)[number]) => {
    if (profile.gil < r.price) return false;
    const need = new Map<number, number>();
    for (const id of r.ingredients) need.set(id, (need.get(id) ?? 0) + 1);
    return [...need].every(([id, n]) => have(id) >= n);
  };
  const makeable = recipes.filter(canMake);
  const shown = showAll ? recipes : makeable;
  const tier = campSynthTier(profile);

  return (
    <div className="ff-window flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between">
        <div className="ff-title">Workshop — {profile.gil} gil banked</div>
        <button className="text-sm opacity-80 hover:opacity-100" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show what I can make" : `Show all ${recipes.length} recipes`}
        </button>
      </div>
      <div className="text-xs opacity-70">
        Synthesize permanent gear from your stash. Reach further worlds to unlock more recipes{tier < 39 ? "; win a run to open Hades Workshop" : ""}.
      </div>
      {!shown.length && <div className="text-sm opacity-70">Nothing you can make yet — buy or win more gear.</div>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => {
          const ok = canMake(r);
          return (
            <ItemCard
              key={r.id}
              itemId={r.result}
              onClick={ok && !synth.isPending ? () => synth.mutate({ recipeId: r.id }) : undefined}
              footer={
                <div className="flex justify-between text-sm">
                  <span>
                    {r.ingredients.map((id, i) => (
                      <span key={i} className={have(id) > 0 ? "" : "text-red-300"}>
                        {i > 0 && " + "}
                        {findItem(id)?.name ?? id}
                      </span>
                    ))}
                  </span>
                  <span className={profile.gil >= r.price ? "" : "text-red-300"}>{r.price}g</span>
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
