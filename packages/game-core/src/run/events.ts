/** "?" stages: short FF-flavoured events with a choice. Outcomes are applied by the run state machine. */
export type EventOutcome =
  | { type: "gil"; amount: number }
  | { type: "heal"; percent: number }
  | { type: "damage"; percent: number }
  | { type: "item"; name: string; count: number }
  | { type: "gear" }
  | { type: "exp"; amount: number }
  | { type: "battle"; enemies: string[] }
  | { type: "nothing" };

export interface EventChoice {
  label: string;
  /** Gil cost to pick this choice. */
  cost?: number;
  /** Weighted outcomes; one is rolled. */
  outcomes: { weight: number; outcome: EventOutcome; text: string }[];
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  /** Progression tiers (area.tier) this event can appear in. */
  worlds: number[];
  choices: EventChoice[];
}

export const EVENTS: EventDef[] = [
  {
    id: "chocobo-forest",
    title: "Chocobo's Forest",
    text: "A chocobo pecks at the ground, kweh-ing hopefully. Something glints in the dirt beneath it.",
    worlds: [0, 1, 2],
    choices: [
      {
        label: "Feed it Gysahl Greens (150 gil)",
        cost: 150,
        outcomes: [
          { weight: 3, outcome: { type: "gear" }, text: "Choco digs up buried treasure!" },
          { weight: 1, outcome: { type: "item", name: "Elixir", count: 1 }, text: "Choco digs up an Elixir." },
        ],
      },
      { label: "Leave it be", outcomes: [{ weight: 1, outcome: { type: "nothing" }, text: "Kweh..." }] },
    ],
  },
  {
    id: "tantalus-tent",
    title: "Tantalus Rehearsal",
    text: "Baku's troupe is rehearsing \"I Want to Be Your Canary\" by the roadside. Blank waves you over.",
    worlds: [0, 1, 2],
    choices: [
      {
        label: "Join the rehearsal",
        outcomes: [
          { weight: 2, outcome: { type: "exp", amount: 120 }, text: "You learn a thing or two about stage combat." },
          { weight: 1, outcome: { type: "damage", percent: 15 }, text: "Baku's \"stage fight\" was a real fight." },
        ],
      },
      { label: "Rest in their tent", outcomes: [{ weight: 1, outcome: { type: "heal", percent: 50 }, text: "A warm meal and a cot. You feel better." }] },
    ],
  },
  {
    id: "stiltzkin",
    title: "Stiltzkin's Bargain",
    text: "\"Kupo! I'm traveling the world, and I've got a special deal just for you!\"",
    worlds: [0, 1, 2],
    choices: [
      {
        label: "Buy the bundle (333 gil)",
        cost: 333,
        outcomes: [{ weight: 1, outcome: { type: "item", name: "Hi-Potion", count: 3 }, text: "Three Hi-Potions! What a deal, kupo!" }],
      },
      { label: "No thanks", outcomes: [{ weight: 1, outcome: { type: "nothing" }, text: "\"Maybe next time, kupo!\"" }] },
    ],
  },
  {
    id: "strange-chest",
    title: "A Suspicious Chest",
    text: "An ornate chest sits alone in a clearing. It is breathing, very slightly.",
    worlds: [0, 1, 2],
    choices: [
      {
        label: "Open it",
        outcomes: [
          { weight: 2, outcome: { type: "gear" }, text: "Just a chest after all. Treasure!" },
          { weight: 1, outcome: { type: "battle", enemies: ["bomb", "bomb"] }, text: "It was a trap!" },
        ],
      },
      { label: "Walk away", outcomes: [{ weight: 1, outcome: { type: "nothing" }, text: "It sighs as you leave." }] },
    ],
  },
  {
    id: "ruined-shrine",
    title: "Ruined Shrine",
    text: "An altar to a forgotten Eidolon. Offerings of gil glitter in the cracks.",
    worlds: [1, 2],
    choices: [
      {
        label: "Pray",
        outcomes: [
          { weight: 2, outcome: { type: "heal", percent: 100 }, text: "A gentle light restores the party." },
          { weight: 1, outcome: { type: "nothing" }, text: "Nothing happens. Maybe the Eidolon is sleeping." },
        ],
      },
      {
        label: "Take the gil",
        outcomes: [
          { weight: 2, outcome: { type: "gil", amount: 600 }, text: "You pocket the offerings." },
          { weight: 1, outcome: { type: "battle", enemies: ["zombie", "zombie"] }, text: "The guardians of the shrine rise!" },
        ],
      },
    ],
  },
];

export function eventById(id: string): EventDef {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown event ${id}`);
  return e;
}
