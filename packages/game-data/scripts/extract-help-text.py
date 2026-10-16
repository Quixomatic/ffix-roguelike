"""Extract FF9's English help text (items, abilities, support abilities, commands) from the Steam install.

FF9 PC keeps its menu help lines as .mes text tables in x64/FF9_Data/resources.assets (itm_help, aa_help, sa_help,
com_help — one per language). This finds the English ones by content, splits entries ([ENDN]), strips FF9's markup
(colour codes, highlight tags; highlighted words become {Word}) and writes packages/db/seed/ff9/help-text.json:
{ items: [...by item id], actions: [...by action id], supports: [...by support id], commands: [...by command id] }.
Then: bun scripts/apply-help-text.ts (merges it into the seed tables).

Requires: pip install UnityPy.  Usage: python scripts/extract-help-text.py
"""
import json, os, re, UnityPy

GAME = r"C:\Program Files (x86)\Steam\steamapps\common\FINAL FANTASY IX"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "db", "seed", "ff9", "help-text.json")

# Character name tags FF9 substitutes at runtime.
NAMES = {"ZDNE": "Zidane", "VIVI": "Vivi", "DGGR": "Dagger", "STNR": "Steiner", "FRYA": "Freya", "QUIN": "Quina", "EIKO": "Eiko", "AMRT": "Amarant",
         "PTY1": "", "PTY2": "", "PTY3": "", "PTY4": ""}

def clean(entry):
    s = re.sub(r"\[A85038\]\[HSHD\](.*?)\[383838\]\[HSHD\]", r"{\1}", entry, flags=re.S)  # highlighted words
    s = re.sub(r"\[([A-Z0-9]{4})\]", lambda m: NAMES.get(m.group(1), ""), s)
    s = re.sub(r"\[[^\]]*\]", "", s)  # any other tag
    return re.sub(r"\s+", " ", s).strip()

env = UnityPy.load(os.path.join(GAME, "x64", "FF9_Data", "resources.assets"))
tables = {}
for obj in env.objects:
    if obj.type.name != "TextAsset":
        continue
    data = obj.read()
    if not data.m_Name.endswith("_help.mes"):
        continue
    raw = data.m_Script
    text = raw if isinstance(raw, str) else raw.decode("utf-8", "replace")
    kind = {"itm_help.mes": "items", "aa_help.mes": "actions", "sa_help.mes": "supports", "com_help.mes": "commands"}.get(data.m_Name)
    # English: the table whose text is ASCII-ish and contains these known lines.
    marks = {"items": "Weapon used by thieves", "actions": "Restores HP of", "supports": "Automatically casts", "commands": "Attack with equipped weapon"}
    if kind and marks[kind] in text and kind not in tables:
        tables[kind] = [clean(e) for e in text.split("[ENDN]")]

json.dump(tables, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print({k: len(v) for k, v in tables.items()}, "->", OUT)
