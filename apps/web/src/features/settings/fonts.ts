/**
 * The fonts the player can pick for each level of text (Settings → Fonts), and how a pick becomes the CSS variables
 * index.css styles with:
 *
 *   title    --ff-title-font / --ff-title-weight   the wordmark (sidebar, header bar) and the title screen
 *   heading  --ff-display / --ff-display-weight    `.ff-display` headings, and the game screens' labels (map, battle)
 *   body     --ff-font / --ff-weight / --ff-shadow  the FF windows' text
 *   numbers  --ff-numbers-font / --ff-numbers-weight  battle damage / heal numbers, Miss, and Doom's countdown
 *
 * The variables are cached in the browser so index.html can set them before the first paint (the account's saved
 * picks sync in once settings load). The ids must match the API's FONT_IDS (packages/api/src/routers/settings.ts).
 */

export interface FontDef {
  id: string;
  label: string;
  family: string;
  /** Weight as body text, and as a heading / title. */
  weight: number;
  headingWeight: number;
  /** Pixel fonts take FF9's hard 2px drop shadow as body text; the rest a soft one. */
  pixel: boolean;
}

export const FONTS = [
  { id: "pixelify", label: "Pixelify Sans", family: '"Pixelify Sans", ui-monospace, monospace', weight: 400, headingWeight: 600, pixel: true },
  { id: "silkscreen", label: "Silkscreen", family: '"Silkscreen", ui-monospace, monospace', weight: 400, headingWeight: 400, pixel: true },
  { id: "jersey", label: "Jersey 10", family: '"Jersey 10", ui-monospace, monospace', weight: 400, headingWeight: 400, pixel: true },
  { id: "dotgothic", label: "DotGothic16", family: '"DotGothic16", ui-monospace, monospace', weight: 400, headingWeight: 400, pixel: true },
  { id: "nunito", label: "Nunito", family: '"Nunito", ui-sans-serif, system-ui, sans-serif', weight: 600, headingWeight: 800, pixel: false },
  { id: "alegreya", label: "Alegreya Sans", family: '"Alegreya Sans", ui-serif, Georgia, serif', weight: 500, headingWeight: 700, pixel: false },
  { id: "cinzel", label: "Cinzel", family: '"Cinzel", ui-serif, Georgia, serif', weight: 600, headingWeight: 700, pixel: false },
] as const satisfies readonly FontDef[];

export type FontId = (typeof FONTS)[number]["id"];
export type FontLevel = "titleFont" | "headingFont" | "bodyFont" | "numbersFont";
export type FontPicks = Record<FontLevel, FontId>;

export const DEFAULT_FONTS: FontPicks = { titleFont: "pixelify", headingFont: "pixelify", bodyFont: "nunito", numbersFont: "pixelify" };

export const FONT_LEVELS: { level: FontLevel; label: string; hint: string }[] = [
  { level: "titleFont", label: "Title", hint: "The wordmark in the sidebar and the title screen" },
  { level: "headingFont", label: "Headings", hint: "Page and window headings, names, and the stage labels on the map" },
  { level: "bodyFont", label: "Body text", hint: "Everything else in the menus" },
  { level: "numbersFont", label: "Battle numbers", hint: "Damage and healing numbers, Miss, and Doom's countdown" },
];

const fontDef = (id: string): FontDef => FONTS.find((f) => f.id === id) ?? FONTS[0];

/** The CSS variables for a set of picks. */
export function fontVars(picks: FontPicks): Record<string, string> {
  const title = fontDef(picks.titleFont);
  const heading = fontDef(picks.headingFont);
  const body = fontDef(picks.bodyFont);
  const numbers = fontDef(picks.numbersFont);
  return {
    "--ff-numbers-font": numbers.family,
    "--ff-numbers-weight": String(numbers.weight),
    "--ff-title-font": title.family,
    "--ff-title-weight": String(title.headingWeight),
    "--ff-display": heading.family,
    "--ff-display-weight": String(heading.headingWeight),
    "--ff-font": body.family,
    "--ff-weight": String(body.weight),
    "--ff-shadow": body.pixel ? "2px 2px 0 #000" : "1px 1px 0 #000, 0 0 2px rgba(0, 0, 0, 0.6)",
  };
}

const CACHE_KEY = "ff-font-vars";

/** Apply the picks now and cache their variables for the next page load's first paint. */
export function applyFonts(picks: FontPicks) {
  const vars = fontVars(picks);
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(vars));
  } catch {
    // storage blocked: the account setting still applies after load
  }
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The heading font's CSS family, for labels drawn outside CSS (the map's stage labels). */
export function gameFontFamily(): string {
  return cssVar("--ff-display") || fontDef(DEFAULT_FONTS.headingFont).family;
}

/** The battle numbers' font for Phaser text: family and weight. */
export function numbersFont(): { family: string; weight: string } {
  const def = fontDef(DEFAULT_FONTS.numbersFont);
  return { family: cssVar("--ff-numbers-font") || def.family, weight: cssVar("--ff-numbers-weight") || String(def.weight) };
}
