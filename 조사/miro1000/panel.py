"""Synthetic concept test via separate Codex subscription CLI calls.

Profiles are constructed attribute combinations, not people or population estimates.
Each valid result is a separate model request; actual return visits are not measured.
"""
import argparse
import concurrent.futures
import hashlib
import itertools
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
LOCK = threading.Lock()
OPTIONS = {
    'age_group': ['10대', '20대', '30대', '40대', '50대 이상'],
    'digital_habit': ['매일 SNS', '검색 위주', '가족과 메시지', '커뮤니티 이용', '인터넷 드물게 사용'],
    'motivation': ['어린 시절 회상', '가족과 대화', '시대 자료 조사', '친구와 공유', '과거 문화 탐색'],
    'concern': ['정보 정확성', '개인정보', '사용 편의성', '광고와 운영'],
    'device': ['스마트폰', 'PC'],
}
CONTEXT = ('한국 추억 타임머신 사이트의 설명: 1950~2026년을 선택해 그 시절 문화 항목을 '
           '찾고, 연도·월·분류·검색을 이용할 수 있으며, 사연·댓글·반응 및 공유 기능을 제공하려 한다. '
           '공개 항목 5759개 중 사진이 연결된 것은 183개이며, 개별 카드 직접 링크는 확인되지 않았다. '
           '일부 항목에 연도와 설명의 불일치가 발견되었다. 사용자는 실제 사이트를 방문하지 않았다.')
QUESTION = ('실제로 방문했다고 주장하지 마세요. 조건부 의향만 판단하세요. '
            'JSON 객체만 답하세요: use(사용 의향), share(공유 의향), revisit(7일 뒤 재방문 의향)는 '
            '각각 yes/no/unsure 중 하나; reason(이유), risk(이탈 요인), improvement(개선점)는 한국어 문자열. '
            '구체적으로 답하고 불확실하면 unsure를 선택하세요.')
MODEL = 'gpt-6-luna'


def make_profiles():
    keys = list(OPTIONS)
    return [{'id': f'P{i:04d}', **dict(zip(keys, values))} for i, values in
            enumerate(itertools.product(*(OPTIONS[k] for k in keys)), 1)]


def valid_answer(answer):
    return (isinstance(answer, dict) and all(answer.get(k) in ('yes', 'no', 'unsure') for k in ('use', 'share', 'revisit'))
            and all(isinstance(answer.get(k), str) and 2 <= len(answer[k].strip()) <= 1000 for k in ('reason', 'risk', 'improvement')))


def experiment_hash(profile):
    encoded = json.dumps({'version': 2, 'profile': profile, 'context': CONTEXT, 'question': QUESTION,
                          'model': MODEL}, ensure_ascii=False, sort_keys=True).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def completed_ids(path, profiles):
    if not path.exists():
        return set()
    ids = set()
    expected = {p['id']: experiment_hash(p) for p in profiles}
    with path.open(encoding='utf-8') as source:
        for n, line in enumerate(source, 1):
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f'잘못된 결과 파일 {path}:{n}') from exc
            if row.get('id') not in expected or row.get('experiment') != expected[row['id']]:
                raise ValueError(f'프로필 또는 실험 조건이 다른 결과 {path}:{n}')
            if row.get('status') == 'ok' and valid_answer(row.get('answer')):
                raw = row.get('raw')
                if (not isinstance(raw, str) or row.get('model_requested') != MODEL or
                        hashlib.sha256(raw.encode('utf-8')).hexdigest() != row.get('raw_sha256')):
                    raise ValueError(f'응답 무결성 또는 모델 검증 실패 {path}:{n}')
                try:
                    parsed = json.loads(raw.strip().removeprefix('```json').removesuffix('```').strip())
                except json.JSONDecodeError as exc:
                    raise ValueError(f'응답 원문 파싱 실패 {path}:{n}') from exc
                if parsed != row['answer']:
                    raise ValueError(f'응답 원문과 집계 불일치 {path}:{n}')
                if row['id'] in ids:
                    raise ValueError(f'중복 성공 응답 {path}:{n}')
                ids.add(row['id'])
    return ids


def append(path, record):
    with LOCK, path.open('a', encoding='utf-8', newline='\n') as output:
        output.write(json.dumps(record, ensure_ascii=False) + '\n')
        output.flush()
        os.fsync(output.fileno())


def query(profile, path, timeout, codex, env):
    started = datetime.now(timezone.utc).isoformat()
    prompt = f'당신은 가상의 응답자입니다. 프로필: {json.dumps(profile, ensure_ascii=False)}\n{CONTEXT}\n{QUESTION}'
    record = {'id': profile['id'], 'started_at': started, 'provider': 'Codex CLI / ChatGPT login',
              'experiment': experiment_hash(profile), 'prompt_sha256': hashlib.sha256(prompt.encode('utf-8')).hexdigest(), 'status': 'error'}
    try:
        with tempfile.TemporaryDirectory(prefix='miro1000-') as temp:
            output = Path(temp) / 'answer.txt'
            command = [codex, 'exec', '-m', MODEL, '-s', 'read-only', '--skip-git-repo-check', '--ephemeral',
                       '--color', 'never', '-o', str(output), '-']
            proc = subprocess.run(command, input=prompt, text=True, encoding='utf-8', capture_output=True,
                                  env=env, cwd=temp, timeout=timeout,
                                  creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            if proc.returncode or not output.exists():
                raise RuntimeError(f'Codex 요청 실패 code={proc.returncode}')
            raw = output.read_text(encoding='utf-8')
        record['raw'] = raw
        record['model_requested'] = MODEL
        answer = json.loads(raw.strip().removeprefix('```json').removesuffix('```').strip())
        if not valid_answer(answer):
            raise ValueError('응답 JSON 필드 또는 선택값이 잘못됨')
        record.update(status='ok', answer=answer, raw_sha256=hashlib.sha256(raw.encode('utf-8')).hexdigest())
    except (OSError, ValueError, KeyError, IndexError, TypeError, RuntimeError, subprocess.TimeoutExpired) as exc:
        record['error'] = f'{type(exc).__name__}: {exc}'[:500]
    record['finished_at'] = datetime.now(timezone.utc).isoformat()
    append(path, record)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='실제 모델 요청 실행; 실행 전 구독 인증 확인')
    parser.add_argument('--limit', type=int, default=1000, help='이번 실행에서 시도할 최대 응답 수')
    parser.add_argument('--workers', type=int, default=4, choices=range(1, 5))
    parser.add_argument('--timeout', type=int, default=360)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000 or args.timeout < 1:
        parser.error('limit은 1~1000, timeout은 양수여야 합니다')
    profiles = make_profiles()
    profiles_path = HERE / 'profiles.json'
    encoded = json.dumps({'method': '설계된 속성 조합; 실제 인구 표본 아님', 'profiles': profiles}, ensure_ascii=False, indent=2) + '\n'
    if profiles_path.exists() and profiles_path.read_text(encoding='utf-8') != encoded:
        raise SystemExit('기존 프로필이 달라 중단합니다. 결과를 덮어쓰지 않았습니다.')
    if not profiles_path.exists():
        profiles_path.write_text(encoded, encoding='utf-8')
    result_path = HERE / 'responses_v2.jsonl'
    completed = completed_ids(result_path, profiles)
    remaining = [p for p in profiles if p['id'] not in completed]
    random.Random(154).shuffle(remaining)
    print(f'프로필 {len(profiles)}개, 유효 응답 {len(completed)}개, 미완료 {len(remaining)}개', flush=True)
    if not args.run:
        print('실제 모델 요청은 실행하지 않았습니다. --run을 지정하세요.', flush=True)
        return
    lock_dir = HERE / '.run-lock'
    try:
        lock_dir.mkdir()
    except FileExistsError:
        raise SystemExit('이미 실행 중이거나 이전 실행의 잠금이 남았습니다: .run-lock')
    try:
        env = os.environ.copy()
        env.pop('OPENAI_API_KEY', None)
        env.pop('GEMINI_API_KEY', None)
        codex = shutil.which('codex.exe') or shutil.which('codex')
        if not codex:
            raise SystemExit('Codex CLI를 찾지 못했습니다.')
        auth = subprocess.run([codex, 'login', 'status'], env=env, capture_output=True, text=True, timeout=30)
        if auth.returncode or 'Logged in using ChatGPT' not in auth.stdout + auth.stderr:
            raise SystemExit('ChatGPT 구독 로그인 확인 실패. 모델 요청을 실행하지 않았습니다.')
        # Recheck after acquiring the process-wide lock.
        completed = completed_ids(result_path, profiles)
        todo = [p for p in remaining if p['id'] not in completed][:args.limit]
        failed = False
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for offset in range(0, len(todo), args.workers):
                batch = todo[offset:offset + args.workers]
                records = list(pool.map(lambda p: query(p, result_path, args.timeout, codex, env), batch))
                for record in records:
                    print(f"{record['id']}: {record['status']}", flush=True)
                if any(record['status'] != 'ok' for record in records):
                    print('실패 감지: 추가 요청을 중지합니다. 원인을 확인한 뒤 재개하세요.', flush=True)
                    failed = True
                    break
        done = completed_ids(result_path, profiles)
        print(f'완료 후 유효 응답 {len(done)}/1000; 실패·재시도는 responses_v2.jsonl 확인', flush=True)
        if failed:
            raise SystemExit(1)
    finally:
        lock_dir.rmdir()


if __name__ == '__main__':
    main()
