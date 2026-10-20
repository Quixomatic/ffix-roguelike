"""List FF9's sound effects (every entry in SoundEffectMetaData.txt), and optionally extract them all to listen to.

`SoundEffectMetaData.txt` (a TextAsset in x64/FF9_Data/resources.assets) maps FF9's sound index -> file
("103" -> "Sounds02/SE00/se000001"). The files are AKB (a header + an Ogg Vorbis stream) in the StreamingAssets SE
bundles (see extract-ff9-sfx.py). The metadata has no descriptive names; the menu ones we know come from Memoria's UI
code (FF9Sfx.FF9SFX_Play), the rest have to be found by ear.

Prints: how many sounds there are, the metadata's fields, and the count per folder. --list prints every entry.
--dump extracts every sound to .docs/assets/FF9/se/all/<group>/<SExx>/<index>_<file>.ogg (git-ignored) to audition,
grouped by what FF9's folders probably hold: 1-menu-and-system (SE00–01), 2-field (SE02–15), 3-events (SE20–21),
4-battle (SE50–56).

Requires: pip install UnityPy.  Usage: python scripts/list-ff9-sfx.py [--list] [--dump]
"""
import collections, json, os, sys, UnityPy

GAME = r"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY IX"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".docs", "assets", "FF9", "se", "all")

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

entries = meta["data"]


def group_of(path: str) -> str:
    """What a sound probably is, by FF9's folder: "Sounds02/SE01/se010003" -> "1-menu-and-system/SE01"."""
    se = path.split("/")[1]
    n = int(se[2:])
    group = "1-menu-and-system" if n <= 1 else "2-field" if n <= 15 else "3-events" if n <= 21 else "4-battle"
    return os.path.join(group, se)
print(f"{len(entries)} sound effects")
print(f"fields: {sorted(entries[0].keys())}")
folders = collections.Counter("/".join(e["name"].split("/")[:-1]) for e in entries)
for folder, n in sorted(folders.items()):
    print(f"  {folder:24} {n}")

if "--list" in sys.argv:
    for e in sorted(entries, key=lambda e: int(e["soundIndex"])):
        print(f"{int(e['soundIndex']):6}  {e['name']}")

if "--dump" in sys.argv:
    os.makedirs(OUT, exist_ok=True)
    # "Sounds02/SE00/se000001" -> "assets/resources/sounds/sounds02/se00/se000001.akb.bytes"
    by_path = {f"assets/resources/{('sounds/' + e['name']).lower()}.akb.bytes": e for e in entries}
    done = set()
    for bundle in sorted(f for f in os.listdir(os.path.join(GAME, "StreamingAssets")) if f.startswith("p0data6")):
        env = UnityPy.load(os.path.join(GAME, "StreamingAssets", bundle))
        for path, obj in env.container.items():
            e = by_path.get(path)
            # Some sounds are in more than one bundle: the first copy is enough.
            if not e or path in done:
                continue
            raw = obj.read().m_Script
            if isinstance(raw, str):
                raw = raw.encode("utf-8", "surrogateescape")
            i = raw.find(b"OggS")
            if i < 0:
                continue
            folder = os.path.join(OUT, group_of(e["name"]))
            os.makedirs(folder, exist_ok=True)
            name = f"{int(e['soundIndex']):05}_{e['name'].split('/')[-1]}.ogg"
            open(os.path.join(folder, name), "wb").write(raw[i:])
            done.add(path)
    print(f"extracted {len(done)}/{len(entries)} -> {os.path.abspath(OUT)}")
