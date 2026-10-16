"""Extract FF9's menu sound effects from the Steam install into .docs/assets/FF9/se (git-ignored).

FF9's sound effects are AKB files (a header + an Ogg Vorbis stream) in the StreamingAssets SE bundles
(p0data611.bin = sounds02/SE00-09, p0data621.bin = sounds03); `SoundEffectMetaData.txt` (a TextAsset in
x64/FF9_Data/resources.assets) maps FF9's sound index -> file ("103" -> "Sounds02/SE00/se000001"). Which index the
menus play comes from Memoria's UI code (FF9Sfx.FF9SFX_Play): 103 cursor move and select, 101 cancel, 102 buzzer,
1045 shop purchase, 682 help.

Writes <name>.ogg for each sound in UI_SOUNDS (+ index.json: name -> FF9 index, source file) to .docs/assets/FF9/se,
and the .ogg files to apps/web/public/sfx/ui (what the game plays; git-ignored, packed as the "sfx" asset class).

Requires: pip install UnityPy.  Usage: python scripts/extract-ff9-sfx.py   (then pnpm -F web assets:pack sfx)
"""
import json, os, UnityPy

GAME = r"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY IX"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".docs", "assets", "FF9", "se")
# What the game ships (git-ignored, packed by assets:pack as the "sfx" class).
SHIP = os.path.join(os.path.dirname(__file__), "..", "public", "sfx", "ui")
os.makedirs(OUT, exist_ok=True)
os.makedirs(SHIP, exist_ok=True)

# Our name -> FF9 sound index (FF9Sfx.FF9SFX_Play ids in Memoria's menus).
UI_SOUNDS = {"cursor": 103, "cancel": 101, "buzzer": 102, "purchase": 1045, "help": 682}

meta_env = UnityPy.load(os.path.join(GAME, "x64", "FF9_Data", "resources.assets"))
meta = None
for obj in meta_env.objects:
    if obj.type.name == "TextAsset":
        d = obj.read()
        if getattr(d, "m_Name", "") == "SoundEffectMetaData.txt":
            raw = d.m_Script
            meta = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
            break
if meta is None:
    raise SystemExit("SoundEffectMetaData.txt not found in resources.assets")
by_index = {int(e["soundIndex"]): e["name"] for e in meta["data"]}

wanted = {name: by_index[i] for name, i in UI_SOUNDS.items() if i in by_index}
missing = [name for name in UI_SOUNDS if name not in wanted]
# "Sounds02/SE00/se000001" -> "assets/resources/sounds/sounds02/se00/se000001.akb.bytes"
paths = {f"assets/resources/{('sounds/' + p).lower()}.akb.bytes": name for name, p in wanted.items()}

found = {}
for bundle in ["p0data611.bin", "p0data621.bin"]:
    if len(found) == len(paths):
        break
    env = UnityPy.load(os.path.join(GAME, "StreamingAssets", bundle))
    for path, obj in env.container.items():
        name = paths.get(path)
        if not name or name in found:
            continue
        raw = obj.read().m_Script
        if isinstance(raw, str):
            raw = raw.encode("utf-8", "surrogateescape")
        i = raw.find(b"OggS")
        if i < 0:
            continue
        for d in (OUT, SHIP):
            open(os.path.join(d, name + ".ogg"), "wb").write(raw[i:])
        found[name] = path

index = {name: {"ff9Index": UI_SOUNDS[name], "file": wanted[name]} for name in found}
json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), indent=1)
print(f"extracted {len(found)}/{len(UI_SOUNDS)} menu sounds -> {OUT}" + (f" (no metadata: {missing})" if missing else ""))
for name, e in index.items():
    print(f"  {name:9} FF9 {e['ff9Index']:5}  {e['file']}")
