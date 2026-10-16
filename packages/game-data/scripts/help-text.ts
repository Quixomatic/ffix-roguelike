/// <reference types="node" />
/**
 * FF9's own help lines (extracted by `extract-help-text.py` into `db/seed/ff9/help-text.json`), attached to the
 * seed tables as a `help` field — items by item id, abilities by action id, support abilities by id. Words FF9
 * highlights are kept as `{Word}`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface HelpText {
  items?: string[];
  actions?: string[];
  supports?: string[];
}

export function attachHelp(seedDir: string, tables: { items: { id: number }[]; actions: { id: number }[]; supports: { id: number }[] }) {
  const file = join(seedDir, "help-text.json");
  if (!existsSync(file)) return false;
  const help = JSON.parse(readFileSync(file, "utf8")) as HelpText;
  const put = (rows: { id: number; help?: string }[], lines: string[] = []) => {
    for (const r of rows) {
      const h = lines[r.id];
      if (h) r.help = h;
    }
  };
  put(tables.items, help.items);
  put(tables.actions, help.actions);
  put(tables.supports, help.supports);
  return true;
}
