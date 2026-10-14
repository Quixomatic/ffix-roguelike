"""Extract FF9 battle AI scripts (EVT_BATTLE_*.eb, English) from the Steam install (p0data7.bin).

Requires: pip install UnityPy. Usage: python scripts/extract-battle-scripts.py <out-dir>
(default out: StreamingAssets/battle-eb next to the BattleMap export). Then: pnpm -F @ffix-roguelike/game-data import:battles
"""
import os, sys, UnityPy

root = r"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY IX\StreamingAssets"
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "battle-eb")
os.makedirs(out, exist_ok=True)
env = UnityPy.load(os.path.join(root, "p0data7.bin"))
n = 0
for path, obj in env.container.items():
    p = path.lower()
    if "eventbinary/battle/us/" not in p:
        continue
    data = obj.read()
    raw = getattr(data, "m_Script", None)
    if raw is None:
        continue
    if isinstance(raw, str):
        raw = raw.encode("utf-8", "surrogateescape")
    name = os.path.basename(p).replace(".eb.bytes", ".eb")
    with open(os.path.join(out, name), "wb") as f:
        f.write(raw)
    n += 1
print("extracted", n, "to", out)
