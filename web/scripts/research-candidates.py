import json

with open('web/src/items.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

with open('web/src/item-photos.json', 'r', encoding='utf-8') as f:
    photos = json.load(f)

queries = [
    '전차', '장발', '미니스커트', '프로야구', '칼라TV', '컬러TV', '컬러텔레비전',
    '통행금지', '야간통행금지', '63빌딩', '6월 민주항쟁', '6월 항쟁', '박종철',
    '해외여행', '영구와 땡칠이', '꿈돌이', '엑스포', '성수대교', '삼풍백화점',
    '조선총독부', '초등학교', '소떼', '남북정상회담', '로또', 'KTX', '청계천'
]

for q in queries:
    found = [it for it in items if q in it.get('title', '') or q in it.get('description', '')]
    res = []
    for it in found[:3]:
        y = it.get('year')
        t = it.get('title')
        k = f'{y}|{t}'
        res.append(f'[{y}] {t} (HasPhoto: {k in photos})')
    if res:
        print(f'{q}: ' + ' / '.join(res))
