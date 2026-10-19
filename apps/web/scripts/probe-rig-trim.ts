/**
 * Inspector: how FFRK boss rigs size their atlas pieces against the atlas's trimmed crops — the question behind the
 * summon fix (v0.2.3) and the boss sprites built by `sprites:enemies` (scripts/lib/render-rig.ts draws each piece's
 * crop stretched over the node's w×h). A permanent tool.
 *
 * For each rig (every `<id>.anim.json` under FFRK-data/_raw/bosses, or the ids given) and each image node it compares the
 * node's w×h with its atlas frame:
 *   - crop    : node = the trimmed crop (w×h of `frame`) — what the renderer assumes; drawn right
 *   - source  : node = the untrimmed source box (`sourceSize`) — the crop must sit at its `spriteSourceSize` offset
 *               inside the box; stretching it over the whole box distorts and shifts the piece
 *   - other   : neither (scaled pieces)
 * Rigs with "source" nodes are listed (✗).
 *
 * READ-ONLY. Run: bun apps/web/scripts/probe-rig-trim.ts [bossId …] [--all]   (--all lists every rig, not just problems)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAW = join(import.meta.dir, "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw", "bosses");

type Frame = { frame: { x: number; y: number; w: number; h: number }; trimmed?: boolean; spriteSourceSize?: { x: number; y: number; w: number; h: number }; sourceSize?: { w: number; h: number } };
type Node = { name: string; type: string; attrs?: { image?: { packerid?: string }; frame?: number[] }; children?: Node[] };

const args = process.argv.slice(2);
const all = args.includes("--all");
const ids = args.filter((a) => !a.startsWith("--"));
const rigs = ids.length ? ids : readdirSync(RAW).filter((f) => f.endsWith(".anim.json")).map((f) => f.replace(".anim.json", ""));

const near = (a: number, b: number) => Math.abs(a - b) <= 1;
let bad = 0;
for (const id of rigs) {
  const rigPath = join(RAW, `${id}.anim.json`);
  const atlasPath = join(RAW, `${id}.json`);
  if (!existsSync(rigPath) || !existsSync(atlasPath)) {
    if (ids.length) console.log(`✗ ${id}: missing rig or atlas`);
    continue;
  }
  const rig = JSON.parse(readFileSync(rigPath, "utf8")) as { tree: Node[] };
  const atlasJson = JSON.parse(readFileSync(atlasPath, "utf8")) as { frames: Record<string, Frame> | (Frame & { filename: string })[] };
  const frames: Record<string, Frame> = Array.isArray(atlasJson.frames) ? Object.fromEntries(atlasJson.frames.map((f) => [f.filename, f])) : atlasJson.frames;
  const counts = { crop: 0, source: 0, other: 0 };
  const sourceNodes: string[] = [];
  const visit = (n: Node) => {
    const pid = n.attrs?.image?.packerid;
    const fr = pid ? frames[pid] : undefined;
    const [, , w = 0, h = 0] = n.attrs?.frame ?? [];
    if (n.type === "image" && fr && w > 0 && h > 0) {
      const src = fr.sourceSize;
      if (near(w, fr.frame.w) && near(h, fr.frame.h)) counts.crop++;
      else if (src && near(w, src.w) && near(h, src.h) && (src.w !== fr.frame.w || src.h !== fr.frame.h)) {
        counts.source++;
        sourceNodes.push(`${n.name} (${pid}: node ${w}×${h}, crop ${fr.frame.w}×${fr.frame.h} at +${fr.spriteSourceSize?.x},${fr.spriteSourceSize?.y})`);
      } else counts.other++;
    }
    for (const c of n.children ?? []) visit(c);
  };
  for (const n of rig.tree) visit(n);
  const problem = counts.source > 0;
  if (problem) bad++;
  if (problem || all) {
    console.log(`${problem ? "✗" : "✓"} ${id}: crop ${counts.crop}, source box ${counts.source}, other ${counts.other}`);
    for (const s of sourceNodes.slice(0, 8)) console.log(`    ${s}`);
    if (sourceNodes.length > 8) console.log(`    … ${sourceNodes.length - 8} more`);
  }
}
console.log(`\n${bad ? `✗ ${bad} rig(s) size pieces by the untrimmed source box` : "✓ every rig sizes pieces by their trimmed crop"} (${rigs.length} checked)`);
process.exit(bad ? 1 : 0);
