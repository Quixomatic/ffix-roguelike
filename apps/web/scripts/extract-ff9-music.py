"""Extract FF9's music from the Steam install into .docs/assets/FF9/music (git-ignored).

FF9 PC keeps its soundtrack as AKB files (a header + an Ogg Vorbis stream) in StreamingAssets/p0data601.bin;
this writes each track's .akb (for its loop points) and .ogg, plus names.json — the track names Memoria's audio
exporter carries in Assembly-CSharp.dll ("music000" -> "Victory Fanfare"). Moguri's remastered tracks
(MoguriSoundtrack/...) replace the originals where present.

Requires: pip install UnityPy.  Usage: python scripts/extract-ff9-music.py   (then pnpm -F web audio:music)
"""
import json, os, re, UnityPy

GAME = r"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY IX"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".docs", "assets", "FF9", "music")
os.makedirs(OUT, exist_ok=True)

def write(name, raw):
    open(os.path.join(OUT, name + ".akb"), "wb").write(raw)
    i = raw.find(b"OggS")
    if i >= 0:
        open(os.path.join(OUT, name + ".ogg"), "wb").write(raw[i:])

env = UnityPy.load(os.path.join(GAME, "StreamingAssets", "p0data601.bin"))
n = 0
for path, obj in env.container.items():
    if "/bgm_/" not in path:
        continue
    raw = obj.read().m_Script
    if isinstance(raw, str):
        raw = raw.encode("utf-8", "surrogateescape")
    write(os.path.basename(path).replace(".akb.bytes", ""), raw)
    n += 1

moguri = os.path.join(GAME, "MoguriSoundtrack", "StreamingAssets", "Assets", "Resources", "Sounds", "sounds01", "bgm_")
m = 0
if os.path.isdir(moguri):
    for f in os.listdir(moguri):
        if f.endswith(".akb.bytes"):
            write(f.replace(".akb.bytes", ""), open(os.path.join(moguri, f), "rb").read())
            m += 1

# Track names: .NET user-string heap entries (compressed length + UTF-16) following "music000".
dll = open(os.path.join(GAME, "x64", "FF9_Data", "Managed", "Assembly-CSharp.dll"), "rb").read()
def read_us(pos):
    b = dll[pos]
    if b & 0x80 == 0: size, head = b, 1
    elif b & 0xC0 == 0x80: size, head = ((b & 0x3F) << 8) | dll[pos + 1], 2
    else: size, head = ((b & 0x1F) << 24) | (dll[pos + 1] << 16) | (dll[pos + 2] << 8) | dll[pos + 3], 4
    return (dll[pos + head:pos + head + size - 1].decode("utf-16-le", "replace") if size else ""), pos + head + size
pos, names, key = dll.find("music000".encode("utf-16-le")) - 1, {}, None
for _ in range(400):
    s, pos = read_us(pos)
    if re.fullmatch(r"music\d{3}", s): key = s
    elif key: names[key], key = s, None
    elif names: break
json.dump(names, open(os.path.join(OUT, "names.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"extracted {n} tracks ({m} Moguri remasters), {len(names)} names -> {OUT}")
