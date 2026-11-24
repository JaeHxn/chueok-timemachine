import json
import re
from pathlib import Path

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

def extract_json_objects(text):
    # Find all json arrays or json objects
    # First try parsing code blocks or JSON arrays
    results = []
    # Try regex matching json objects: {"id": "P...", ...}
    pattern = re.compile(r'\{\s*"id"\s*:\s*"(P\d{4})"[^{}]*\}', re.DOTALL)
    for m in pattern.finditer(text):
        raw_obj = m.group(0)
        try:
            obj = json.loads(raw_obj)
            results.append(obj)
        except json.JSONDecodeError:
            pass
    return results

# Let's inspect each batch file structure
for i in range(1, 5):
    p = HERE / f'agy_batch_{i}.txt'
    text = read_text_any(p)
    # Check if there is a JSON array
    json_blocks = re.findall(r'\[\s*\{.*?\}\s*\]', text, re.DOTALL)
    print(f"Batch {i}: length of text = {len(text)}, found {len(json_blocks)} array blocks")
    parsed_items = []
    for block in json_blocks:
        try:
            arr = json.loads(block)
            if isinstance(arr, list):
                parsed_items.extend(arr)
        except json.JSONDecodeError:
            pass
    print(f"  Direct array parsed items: {len(parsed_items)}")
    if len(parsed_items) < 250:
        objs = extract_json_objects(text)
        print(f"  Object regex parsed items: {len(objs)}")
