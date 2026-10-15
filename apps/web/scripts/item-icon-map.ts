/**
 * FF9 item id → icon on the Time Fantasy icon sheet (finalbossblues "1000+ Fantasy RPG Icons", 16×16, 16 per
 * row), as [row, column]. Read by scripts/build-item-icons.ts, which packs just these icons into the game's atlas.
 *
 * Sheet rows used: 16–17 bags/potions · 19 produce · 24–25 papers/instruments · 27 swords · 28 daggers/axes ·
 * 29 spears/tridents · 30–31 staves/rods/wands · 32 claws · 34 thrown · 37 shields · 38 shirts · 39 vests ·
 * 40 armour · 41 robes · 43 cloaks · 44 helmets · 45 hats · 46 gloves/armguards · 47–48 shoes/boots ·
 * 49 belts/necklaces · 50 rings/earrings · 51 ribbons/jewellery · 53 stones · 54 feathers · 57 orbs ·
 * 60 ore · 61–62 gemstones.
 */
export const ITEM_ICONS: Record<number, [number, number]> = {
  // ── Weapons ────────────────────────────────────────────────────────────────
  0: [58, 0], // Hammer (Cinna)
  // Zidane: daggers, then thief swords
  1: [28, 0], // Dagger
  2: [28, 1], // Mage Masher
  3: [28, 2], // Mythril Dagger
  4: [27, 0], // Gladius
  5: [28, 3], // Zorlin Shape
  6: [27, 3], // Orichalcon
  7: [27, 6], // Butterfly Sword
  8: [27, 12], // The Ogre
  9: [27, 13], // Exploda
  10: [27, 15], // Rune Tooth
  11: [27, 14], // Angel Bless
  12: [27, 4], // Sargatanas
  13: [27, 10], // Masamune
  14: [27, 9], // The Tower
  15: [27, 11], // Ultima Weapon
  // Steiner / Beatrix: swords
  16: [27, 5], // Broadsword
  17: [27, 1], // Iron Sword
  18: [27, 2], // Mythril Sword
  19: [27, 4], // Blood Sword
  20: [27, 14], // Ice Brand
  21: [27, 8], // Coral Sword
  22: [27, 3], // Diamond Sword
  23: [27, 13], // Flame Saber
  24: [27, 15], // Rune Blade
  25: [27, 6], // Defender
  26: [27, 7], // Save the Queen
  27: [27, 11], // Ultima Sword
  28: [27, 9], // Excalibur
  29: [27, 12], // Ragnarok
  30: [27, 10], // Excalibur II
  // Freya: spears
  31: [29, 0], // Javelin
  32: [29, 1], // Mythril Spear
  33: [29, 4], // Partisan
  34: [29, 10], // Ice Lance
  35: [29, 6], // Trident
  36: [29, 2], // Heavy Lance
  37: [29, 8], // Obelisk
  38: [29, 5], // Holy Lance
  39: [29, 11], // Kain's Lance
  40: [29, 9], // Dragon's Hair
  // Amarant: claws
  41: [32, 0], // Cat's Claws
  42: [32, 5], // Poison Knuckles
  43: [32, 1], // Mythril Claws
  44: [32, 2], // Scissor Fangs
  45: [32, 4], // Dragon's Claws
  46: [32, 3], // Tiger Fangs
  47: [32, 3], // Avenger
  48: [32, 1], // Kaiser Knuckles
  49: [32, 4], // Duel Claws
  50: [32, 5], // Rune Claws
  // Garnet: rackets (the pack has no racket; its framed harp reads closest), then rods
  51: [25, 2], // Air Racket
  52: [25, 2], // Multina Racket
  53: [25, 2], // Magic Racket
  54: [25, 2], // Mythril Racket
  55: [25, 2], // Priest's Racket
  56: [25, 2], // Tiger Racket
  57: [31, 3], // Rod
  58: [31, 6], // Mythril Rod
  59: [31, 2], // Stardust Rod
  60: [31, 1], // Healing Rod
  61: [31, 7], // Asura's Rod
  62: [30, 11], // Wizard Rod
  63: [30, 12], // Whale Whisker
  // Eiko: flutes
  64: [25, 7], // Golem's Flute
  65: [25, 6], // Lamia's Flute
  66: [25, 6], // Fairy Flute
  67: [25, 1], // Hamelin
  68: [25, 10], // Siren's Flute
  69: [25, 1], // Angel Flute
  // Vivi: staves
  70: [30, 4], // Mage Staff
  71: [30, 14], // Flame Staff
  72: [30, 15], // Ice Staff
  73: [30, 12], // Lightning Staff
  74: [30, 1], // Oak Staff
  75: [30, 0], // Cypress Pile
  76: [30, 11], // Octagon Rod
  77: [30, 8], // High Mage Staff
  78: [30, 13], // Mace of Zeus
  // Quina: forks (tridents)
  79: [29, 12], // Fork
  80: [29, 6], // Needle Fork
  81: [29, 14], // Mythril Fork
  82: [29, 12], // Silver Fork
  83: [29, 13], // Bistro Fork
  84: [29, 15], // Gastro Fork
  // Thrown
  85: [34, 5], // Pinwheel
  86: [34, 5], // Rising Sun
  87: [34, 4], // Wing Edge

  // ── Arms (armlets, gloves) ────────────────────────────────────────────────
  88: [46, 9], // Wrist
  89: [46, 9], // Leather Wrist
  90: [46, 12], // Glass Armlet
  91: [46, 6], // Bone Wrist
  92: [46, 12], // Mythril Armlet
  93: [46, 13], // Magic Armlet
  94: [46, 11], // Chimera Armlet
  95: [46, 10], // Egoist's Armlet
  96: [46, 8], // N-Kai Armlet
  97: [46, 10], // Jade Armlet
  98: [46, 0], // Thief Gloves
  99: [46, 15], // Dragon Wrist
  100: [46, 4], // Power Wrist
  101: [46, 5], // Bracer
  102: [46, 4], // Bronze Gloves
  103: [46, 1], // Silver Gloves
  104: [46, 6], // Mythril Gloves
  105: [46, 7], // Thunder Gloves
  106: [46, 2], // Diamond Gloves
  107: [37, 6], // Venetia Shield
  108: [46, 3], // Defense Gloves
  109: [46, 14], // Genji Gloves
  110: [46, 15], // Aegis Gloves
  111: [46, 3], // Gauntlets
  217: [46, 1], // Pearl Armlet

  // ── Heads (hats, helmets) ─────────────────────────────────────────────────
  112: [44, 0], // Leather Hat
  113: [45, 0], // Straw Hat
  114: [45, 9], // Feather Hat
  115: [45, 10], // Steepled Hat
  116: [45, 3], // Headgear
  117: [45, 11], // Magus Hat
  118: [45, 5], // Bandana
  119: [45, 10], // Mage's Hat
  120: [45, 12], // Lamia's Tiara
  121: [45, 1], // Ritual Hat
  122: [45, 4], // Twist Headband
  123: [45, 3], // Mantra Band
  124: [45, 1], // Dark Hat
  125: [45, 6], // Green Beret
  126: [45, 15], // Black Hood
  127: [45, 4], // Red Hat
  128: [45, 13], // Golden Hairpin
  129: [45, 13], // Coronet
  130: [45, 9], // Flash Hat
  131: [45, 2], // Adaman Hat
  132: [45, 7], // Thief Hat
  133: [45, 12], // Holy Miter
  134: [44, 7], // Golden Skullcap
  135: [45, 12], // Circlet
  136: [44, 1], // Rubber Helm
  137: [44, 2], // Bronze Helm
  138: [44, 3], // Iron Helm
  139: [44, 6], // Barbut
  140: [44, 4], // Mythril Helm
  141: [44, 7], // Gold Helm
  142: [44, 10], // Cross Helm
  143: [44, 8], // Diamond Helm
  144: [44, 9], // Platinum Helm
  145: [44, 11], // Kaiser Helm
  146: [44, 12], // Genji Helmet
  147: [44, 13], // Grand Helm

  // ── Bodies (shirts, vests, robes, armour) ─────────────────────────────────
  148: [38, 12], // Aloha T-shirt
  149: [38, 0], // Leather Shirt
  150: [38, 5], // Silk Shirt
  151: [39, 3], // Leather Plate
  152: [39, 2], // Bronze Vest
  153: [39, 0], // Chain Plate
  154: [39, 12], // Mythril Vest
  155: [39, 8], // Adaman Vest
  156: [43, 10], // Magician Cloak
  157: [38, 10], // Survival Vest
  158: [39, 4], // Brigandine
  159: [38, 2], // Judo Uniform
  160: [39, 14], // Power Vest
  161: [40, 9], // Gaia Gear
  162: [39, 15], // Demon's Vest
  163: [39, 1], // Minerva's Plate
  164: [43, 12], // Ninja Gear
  165: [43, 11], // Dark Gear
  166: [38, 11], // Rubber Suit
  167: [38, 15], // Brave Suit
  168: [41, 0], // Cotton Robe
  169: [41, 6], // Silk Robe
  170: [41, 5], // Magician Robe
  171: [41, 4], // Glutton's Robe
  172: [41, 9], // White Robe
  173: [41, 8], // Black Robe
  174: [41, 11], // Light Robe
  175: [41, 7], // Robe of Lords
  176: [40, 3], // Tin Armor
  177: [40, 0], // Bronze Armor
  178: [40, 1], // Linen Cuirass
  179: [40, 4], // Chain Mail
  180: [40, 10], // Mythril Armor
  181: [40, 6], // Plate Mail
  182: [40, 5], // Gold Armor
  183: [40, 7], // Shield Armor
  184: [40, 15], // Demon's Mail
  185: [40, 14], // Diamond Armor
  186: [40, 8], // Platina Armor
  187: [40, 11], // Carabini Mail
  188: [40, 9], // Dragon Mail
  189: [40, 12], // Genji Armor
  190: [40, 13], // Maximillian
  191: [40, 2], // Grand Armor

  // ── Accessories ───────────────────────────────────────────────────────────
  192: [47, 1], // Desert Boots
  193: [47, 8], // Magician Shoes
  194: [48, 2], // Germinas Boots
  195: [47, 11], // Sandals
  196: [47, 13], // Feather Boots
  197: [47, 4], // Battle Boots
  198: [47, 10], // Running Shoes
  199: [49, 10], // Anklet
  200: [49, 1], // Power Belt
  201: [49, 2], // Black Belt
  202: [49, 6], // Glass Buckle
  203: [50, 1], // Madain's Ring
  204: [50, 3], // Rosetta Ring
  205: [50, 2], // Reflect Ring
  206: [50, 7], // Coral Ring
  207: [50, 6], // Promist Ring
  208: [50, 7], // Rebirth Ring
  209: [50, 0], // Protect Ring
  210: [53, 9], // Pumice Piece
  211: [53, 0], // Pumice
  212: [51, 3], // Yellow Scarf
  213: [49, 13], // Gold Choker
  214: [50, 4], // Fairy Earrings
  215: [50, 5], // Angel Earrings
  216: [51, 6], // Pearl Rouge
  218: [51, 1], // Cachusha
  219: [51, 0], // Barette
  220: [51, 3], // Extension
  221: [51, 2], // Ribbon
  222: [49, 12], // Maiden Prayer
  223: [17, 12], // Ancient Aroma
  224: [61, 2], // Garnet
  225: [61, 14], // Amethyst
  226: [62, 6], // Aquamarine
  227: [57, 6], // Diamond
  228: [62, 2], // Emerald
  229: [57, 14], // Moonstone
  230: [61, 3], // Ruby
  231: [62, 1], // Peridot
  232: [61, 6], // Sapphire
  233: [62, 14], // Opal
  234: [61, 10], // Topaz
  235: [61, 7], // Lapis Lazuli
  249: [54, 12], // Phoenix Pinion
  250: [57, 15], // Dark Matter

  // ── Items ─────────────────────────────────────────────────────────────────
  236: [17, 1], // Potion
  237: [17, 3], // Hi-Potion
  238: [17, 2], // Ether
  239: [17, 10], // Elixir
  240: [54, 15], // Phoenix Down
  241: [17, 7], // Echo Screen
  242: [17, 4], // Soft
  243: [17, 6], // Antidote
  244: [17, 8], // Eye Drops
  245: [24, 0], // Magic Tag
  246: [17, 5], // Vaccine
  247: [17, 15], // Remedy
  248: [17, 14], // Annoyntment
  251: [19, 9], // Gysahl Greens
  252: [19, 4], // Dead Pepper
  253: [16, 0], // Tent
  254: [60, 0], // Ore
};
