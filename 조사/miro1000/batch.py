"""Synthetic batch feedback: 25 profiles per model call, sharing context."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
import panel

HERE = Path(__file__).resolve().parent
RESULT = HERE / 'batch_responses.jsonl'
MODEL = panel.MODEL
SIZE = 25
CONTEXT = ('추억 타임머신 로컬 미리보기: 첫 화면에서 연도 선택, 태어난 해 입력, 검색과 효과 줄이기를 제공한다. '
           '1950~2026년 연도·월, 8개 분류, 상세 카드, 사연·댓글·반응·공유 기능이 있다. '
           '공개 자료 5759개, 2002년 화면에는 겨울연가와 월드컵 등 카드가 보인다. '
           '사진 연결 항목 183개, 개별 카드 직접 공유 주소 미확인, 일부 자료의 연도와 설명 불일치가 있다. '
           '커뮤니티 저장은 서버 연결이 필요하다. 프로필들은 실제로 사이트를 방문하지 않았다.')
QUESTION = ('각 프로필 관점에서 이용·친구 공유·7일 후 재방문 의향(use, share, revisit)을 '
            '각각 yes/no/unsure로, 이유(reason), 이탈 위험(risk), 개선점(improvement)을 한국어로 작성하세요. '
            '실제 방문을 주장하지 말고, 모든 id를 정확히 복사해 JSON 배열로만 출력하세요.')


def valid_batch(answers, ids):
    return (isinstance(answers, list) and len(answers) == len(ids) and
            all(isinstance(a, dict) and panel.valid_answer(a) for a in answers) and
            len({a.get('id') for a in answers}) == len(ids) and
            {a.get('id') for a in answers} == set(ids))


def fingerprint(profiles):
    content = json.dumps({'version': 1, 'profiles': profiles, 'context': CONTEXT, 'question': QUESTION,
                          'model': MODEL}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def load_done(path, groups):
    if not path.exists():
        return set()
    expected = {i: (fingerprint(group), [p['id'] for p in group]) for i, group in enumerate(groups)}
    done = set()
    with path.open(encoding='utf-8') as src:
        for n, line in enumerate(src, 1):
            row = json.loads(line)
            index = row.get('batch')
            if index not in expected or row.get('fingerprint') != expected[index][0]:
                raise ValueError(f'조건이 다른 결과: {n}행')
            if row.get('status') != 'ok':
                continue
            raw = row.get('raw')
            if not isinstance(raw, str) or hashlib.sha256(raw.encode()).hexdigest() != row.get('raw_sha256'):
                raise ValueError(f'원문 해시 불일치: {n}행')
            parsed = json.loads(raw.strip().removeprefix('```json').removesuffix('```').strip())
            if parsed != row.get('answers') or not valid_batch(parsed, expected[index][1]) or index in done:
                raise ValueError(f'응답 또는 중복 배치 오류: {n}행')
            done.add(index)
    return done


def query(index, profiles, codex, env, timeout):
    prompt = f'{CONTEXT}\n{QUESTION}\n프로필: {json.dumps(profiles, ensure_ascii=False)}'
    row = {'batch': index, 'fingerprint': fingerprint(profiles), 'ids': [p['id'] for p in profiles],
           'started_at': datetime.now(timezone.utc).isoformat(), 'status': 'error',
           'model_requested': MODEL, 'method': 'single model call; shared batch context; synthetic profiles'}
    try:
        with tempfile.TemporaryDirectory(prefix='miro1000-batch-') as folder:
            output = Path(folder) / 'answer.txt'
            cmd = [codex, 'exec', '-m', MODEL, '-s', 'read-only', '--skip-git-repo-check', '--ephemeral',
                   '--color', 'never', '-o', str(output), '-']
            proc = subprocess.run(cmd, input=prompt, text=True, encoding='utf-8', capture_output=True, env=env,
                                  cwd=folder, timeout=timeout, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            if proc.returncode or not output.exists():
                raise RuntimeError(f'Codex 오류 code={proc.returncode}')
            raw = output.read_text(encoding='utf-8')
        row.update(raw=raw, raw_sha256=hashlib.sha256(raw.encode()).hexdigest())
        answers = json.loads(raw.strip().removeprefix('```json').removesuffix('```').strip())
        if not valid_batch(answers, row['ids']):
            raise ValueError('응답 ID·개수·필드가 요청과 다름')
        row.update(status='ok', answers=answers)
    except (OSError, ValueError, TypeError, RuntimeError, subprocess.TimeoutExpired) as exc:
        row['error'] = f'{type(exc).__name__}: {exc}'[:500]
    row['finished_at'] = datetime.now(timezone.utc).isoformat()
    panel.append(RESULT, row)
    return row


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--run', action='store_true')
    cli.add_argument('--limit-batches', type=int, default=40)
    cli.add_argument('--workers', type=int, choices=range(1, 5), default=4)
    cli.add_argument('--timeout', type=int, default=600)
    args = cli.parse_args()
    if not 1 <= args.limit_batches <= 40 or args.timeout < 1:
        cli.error('배치 수 1~40, timeout 양수 필요')
    profiles = panel.make_profiles()
    random.Random(154).shuffle(profiles)
    groups = [profiles[i:i + SIZE] for i in range(0, len(profiles), SIZE)]
    done = load_done(RESULT, groups)
    print(f'프로필 {len(profiles)}개; 유효 응답 {len(done) * SIZE}개; 성공 배치 {len(done)}/40', flush=True)
    if not args.run:
        return
    lock = HERE / '.batch-lock'
    try:
        lock.mkdir()
    except FileExistsError:
        raise SystemExit('배치가 실행 중이거나 이전 잠금이 남아 있습니다.')
    try:
        env = os.environ.copy()
        env.pop('OPENAI_API_KEY', None)
        env.pop('GEMINI_API_KEY', None)
        codex = shutil.which('codex.exe') or shutil.which('codex')
        if not codex:
            raise SystemExit('Codex CLI를 찾지 못했습니다.')
        auth = subprocess.run([codex, 'login', 'status'], env=env, capture_output=True, text=True, timeout=30)
        if auth.returncode or 'Logged in using ChatGPT' not in auth.stdout + auth.stderr:
            raise SystemExit('ChatGPT 로그인 확인 실패')
        done = load_done(RESULT, groups)
        todo = [(i, group) for i, group in enumerate(groups) if i not in done][:args.limit_batches]
        failed = False
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for start in range(0, len(todo), args.workers):
                wave = todo[start:start + args.workers]
                rows = list(pool.map(lambda task: query(*task, codex, env, args.timeout), wave))
                for row in rows:
                    print(f"배치 {row['batch'] + 1}: {row['status']}", flush=True)
                if any(row['status'] != 'ok' for row in rows):
                    print('실패 감지: 이후 요청 중단. 원본을 확인하고 재개하세요.', flush=True)
                    failed = True
                    break
        done = load_done(RESULT, groups)
        print(f'검증 완료 응답 {len(done)*SIZE}/1000; 성공 호출 {len(done)}', flush=True)
        if failed:
            raise SystemExit(1)
    finally:
        lock.rmdir()


if __name__ == '__main__':
    main()
