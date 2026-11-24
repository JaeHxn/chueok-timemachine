import json
import re
from pathlib import Path
from collections import Counter

HERE = Path(__file__).resolve().parent

def read_text_any(path):
    raw = path.read_bytes()
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

# 1. Load profiles
p_file = HERE / "profiles.json"
profile_data = json.loads(read_text_any(p_file))
profiles = {p['id']: p for p in profile_data.get('profiles', profile_data)}

# 2. Extract answers from 4 batch files
all_answers = []
for i in range(1, 5):
    p = HERE / f'agy_batch_{i}.txt'
    text = read_text_any(p)
    blocks = re.findall(r'\[\s*\{.*?\}\s*\]', text, re.DOTALL)
    if not blocks:
        raise ValueError(f"No json array found in batch {i}")
    arr = json.loads(blocks[0])
    print(f"Batch {i}: loaded {len(arr)} answers")
    all_answers.extend(arr)

print(f"\nTotal answers loaded: {len(all_answers)}")

# 3. Validation
errors = []
id_counts = Counter()
valid_answers = []
for idx, a in enumerate(all_answers):
    pid = a.get('id')
    if not pid:
        errors.append(f"Item {idx}: missing id")
        continue
    id_counts[pid] += 1
    if pid not in profiles:
        errors.append(f"Item {idx}: unknown profile id {pid}")
    for f in ('use', 'share', 'revisit'):
        if a.get(f) not in ('yes', 'no', 'unsure'):
            errors.append(f"Item {pid}: invalid {f} = {a.get(f)}")
    for f in ('reason', 'risk', 'improvement'):
        val = a.get(f)
        if not isinstance(val, str) or len(val.strip()) < 2:
            errors.append(f"Item {pid}: empty or short {f}")

duplicates = [pid for pid, cnt in id_counts.items() if cnt > 1]
missing_ids = [pid for pid in profiles if id_counts[pid] == 0]

print(f"Validation finished. Errors count: {len(errors)}")
print(f"Duplicates: {len(duplicates)}")
print(f"Missing profiles: {len(missing_ids)}")

if errors:
    print("Sample errors:", errors[:10])

# 4. Save merged response file
merged_file = HERE / "responses_1000.json"
merged_file.write_text(json.dumps(all_answers, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nSaved {len(all_answers)} items to {merged_file}")

# 5. Summary Statistics
print("\n=== 1,000인 가상 패널 설문조사 통계 요약 ===")
use_counts = Counter(a['use'] for a in all_answers)
share_counts = Counter(a['share'] for a in all_answers)
revisit_counts = Counter(a['revisit'] for a in all_answers)

print(f"이용 의향 (use): yes={use_counts['yes']} ({use_counts['yes']/10}%), unsure={use_counts['unsure']} ({use_counts['unsure']/10}%), no={use_counts['no']} ({use_counts['no']/10}%)")
print(f"공유 의향 (share): yes={share_counts['yes']} ({share_counts['yes']/10}%), unsure={share_counts['unsure']} ({share_counts['unsure']/10}%), no={share_counts['no']} ({share_counts['no']/10}%)")
print(f"재방문 의향 (revisit): yes={revisit_counts['yes']} ({revisit_counts['yes']/10}%), unsure={revisit_counts['unsure']} ({revisit_counts['unsure']/10}%), no={revisit_counts['no']} ({revisit_counts['no']/10}%)")

# Group by age_group
age_stats = {}
for a in all_answers:
    prof = profiles[a['id']]
    ag = prof['age_group']
    if ag not in age_stats:
        age_stats[ag] = {'total': 0, 'use_yes': 0, 'share_yes': 0, 'revisit_yes': 0}
    age_stats[ag]['total'] += 1
    if a['use'] == 'yes': age_stats[ag]['use_yes'] += 1
    if a['share'] == 'yes': age_stats[ag]['share_yes'] += 1
    if a['revisit'] == 'yes': age_stats[ag]['revisit_yes'] += 1

print("\n--- 연령대별 긍정(Yes) 비율 ---")
for ag, stat in sorted(age_stats.items()):
    tot = stat['total']
    print(f"[{ag}] 총 {tot}명 | 이용={stat['use_yes']} ({stat['use_yes']/tot*100:.1f}%) | 공유={stat['share_yes']} ({stat['share_yes']/tot*100:.1f}%) | 재방문={stat['revisit_yes']} ({stat['revisit_yes']/tot*100:.1f}%)")

# Group by device
dev_stats = {}
for a in all_answers:
    prof = profiles[a['id']]
    dev = prof['device']
    if dev not in dev_stats:
        dev_stats[dev] = {'total': 0, 'use_yes': 0, 'share_yes': 0, 'revisit_yes': 0}
    dev_stats[dev]['total'] += 1
    if a['use'] == 'yes': dev_stats[dev]['use_yes'] += 1
    if a['share'] == 'yes': dev_stats[dev]['share_yes'] += 1
    if a['revisit'] == 'yes': dev_stats[dev]['revisit_yes'] += 1

print("\n--- 기기별 긍정(Yes) 비율 ---")
for dev, stat in sorted(dev_stats.items()):
    tot = stat['total']
    print(f"[{dev}] 총 {tot}명 | 이용={stat['use_yes']} ({stat['use_yes']/tot*100:.1f}%) | 공유={stat['share_yes']} ({stat['share_yes']/tot*100:.1f}%) | 재방문={stat['revisit_yes']} ({stat['revisit_yes']/tot*100:.1f}%)")
