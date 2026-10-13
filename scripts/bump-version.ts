#!/usr/bin/env bun
/**
 * bump-version — set every ffix-roguelike version file in lockstep, safely.
 *
 *   pnpm version:bump <patch|minor|major|X.Y.Z> [--dry-run]
 *
 * Writes ONLY version files (never the changelog, never git). The `/version-bump` flow still owns the
 * CHANGELOG entry + commit — this just does the mechanical file edits so nobody hand-seds them.
 *
 * Every edit is TARGETED: the first JSON `"version"` key of each shippable app. Refuses to run if the
 * version files are out of sync (surfaces the mismatch rather than silently normalizing). Three segments
 * only — never a fourth.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run") || process.argv.includes("--check");
const ARG = process.argv.slice(2).find((a) => !a.startsWith("-"));

// ── ANSI (no dep) ────────────────────────────────────────────────────────────
const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};
const die = (msg: string): never => {
  console.error(`\n${c.red("✖")} ${msg}\n`);
  process.exit(1);
};

// ── target discovery ─────────────────────────────────────────────────────────
function appPackageJsons(): string[] {
  // Discover apps/* (don't hardcode — apps are added over time). A shippable app is a direct child of
  // apps/ with a package.json.
  const appsDir = join(ROOT, "apps");
  const out: string[] = [];
  for (const name of readdirSync(appsDir)) {
    const pkg = join(appsDir, name, "package.json");
    try {
      if (statSync(pkg).isFile()) out.push(pkg);
    } catch {
      /* no package.json here */
    }
  }
  return out.sort();
}

const TARGETS = appPackageJsons();

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** First `"version": "X.Y.Z"` value in a JSON file. */
function jsonRead(text: string): string | null {
  return text.match(/"version"\s*:\s*"(\d+\.\d+\.\d+)"/)?.[1] ?? null;
}
function jsonWrite(text: string, next: string): string {
  return text.replace(/("version"\s*:\s*")(\d+\.\d+\.\d+)(")/, `$1${next}$3`); // first occurrence only
}

const rel = (p: string) => p.slice(ROOT.length + 1).replace(/\\/g, "/");

// ── load + validate current state ────────────────────────────────────────────
type Loaded = { path: string; text: string; current: string };
const loaded: Loaded[] = [];
for (const path of TARGETS) {
  const text = readFileSync(path, "utf8");
  const current = jsonRead(text);
  if (!current) die(`Could not find a version in ${rel(path)} — add "version": "X.Y.Z" to it.`);
  loaded.push({ path, text, current: current! });
}
if (!loaded.length) die("No apps/*/package.json found — run from the repo root.");

// Canonical = apps/server/package.json; everything must match it.
const canonical = loaded.find((l) => rel(l.path) === "apps/server/package.json") ?? loaded[0]!;
const current = canonical.current;
const mismatched = loaded.filter((l) => l.current !== current);
if (mismatched.length) {
  console.error(`\n${c.red("✖ Version files are OUT OF SYNC")} (canonical ${c.bold(current)} from ${rel(canonical.path)}):`);
  for (const l of mismatched) console.error(`  ${c.yellow(l.current.padEnd(10))} ${rel(l.path)}`);
  console.error(`\nResolve the mismatch by hand first (it may be intentional or a botched prior bump).\n`);
  process.exit(1);
}

// ── compute next version ─────────────────────────────────────────────────────
if (!ARG) die("Usage: pnpm version:bump <patch|minor|major|X.Y.Z> [--dry-run]");
const [maj, min, pat] = current.split(".").map(Number) as [number, number, number];
let next = "";
if (ARG === "patch") next = `${maj}.${min}.${pat + 1}`;
else if (ARG === "minor") next = `${maj}.${min + 1}.0`;
else if (ARG === "major") next = `${maj + 1}.0.0`;
else if (SEMVER.test(ARG!)) next = ARG!;
else die(`Invalid argument "${ARG}". Use patch | minor | major | X.Y.Z (three segments, never four).`);

if (next === current) die(`New version equals current (${current}); nothing to do.`);

// ── apply ────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold("ffix-roguelike version bump")}  ${c.dim(current)} ${c.dim("→")} ${c.cyan(c.bold(next))}${DRY ? c.yellow("   (dry run — no files written)") : ""}\n`);
for (const l of loaded) {
  const updated = jsonWrite(l.text, next);
  if (updated === l.text) die(`No change applied to ${rel(l.path)} — targeted replace matched nothing. Aborting so the set stays consistent.`);
  if (!DRY) writeFileSync(l.path, updated);
  console.log(`  ${c.green("✓")} ${rel(l.path)}`);
}
console.log(
  `\n${c.green("Done.")} ${loaded.length} files ${DRY ? "would be" : ""} set to ${c.bold(next)}.` +
    `\n${c.dim("Next: write the CHANGELOG entry, then commit (see /version-bump).")}\n`,
);
