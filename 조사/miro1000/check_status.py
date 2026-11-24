import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent

def read_text_any(path):
    raw = path.read_bytes()
    # Try BOM checks first
    if raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff'):
        return raw.decode('utf-16', errors='ignore')
    if raw.startswith(b'\xef\xbb\xbf'):
        return raw.decode('utf-8-sig', errors='ignore')
    for enc in ('utf-8', 'utf-16', 'cp949', 'latin1'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode('utf-8', errors='ignore')

def check_file(name):
    p = HERE / name
    if not p.exists():
        print(f"{name}: NOT FOUND")
        return []
    text = read_text_any(p)
    ids = re.findall(r'"id":\s*"(P\d{4})"', text)
    print(f"{name}: size={p.stat().st_size}, found {len(ids)} id occurrences, unique={len(set(ids))}")
    if ids:
        print(f"  Range: min={min(ids)}, max={max(ids)}")
    return ids

all_ids = []
for i in range(1, 5):
    all_ids.extend(check_file(f"agy_batch_{i}.txt"))

print(f"\nTotal ids collected: {len(all_ids)}, Unique total: {len(set(all_ids))}")

# Check profiles.json
p_file = HERE / "profiles.json"
if p_file.exists():
    text = read_text_any(p_file)
    data = json.loads(text)
    profiles = data.get('profiles', data)
    print(f"profiles.json: {len(profiles)} profiles (min={profiles[0]['id']}, max={profiles[-1]['id']})")
    all_id_set = set(all_ids)
    missing = [p['id'] for p in profiles if p['id'] not in all_id_set]
    print(f"Missing from agy_batches: {len(missing)}")
    if missing:
        print(f"Sample missing ({len(missing)}): {missing[:20]}")
