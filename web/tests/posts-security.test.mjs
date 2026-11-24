import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsBadWords, checkPostSafety, BAD_WORD_MESSAGE } from '../lib/badwords.js';
import { onRequestPost as post, onRequestDelete as deletePost } from '../functions/api/posts.js';
import { onRequestGet as getYear } from '../functions/api/year-data.js';

const request = (data, method = 'POST') =>
  new Request('https://example.com/api/posts', {
    method,
    headers: { 'cf-connecting-ip': '127.0.0.1', 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });

test('bad words filter accurately catches curses, spam, obscenity without false positives', () => {
  // Safe nostalgia text
  assert.equal(containsBadWords('1997년 IMF 당시 금모으기 운동 기억나네요.'), false);
  assert.equal(containsBadWords('초등학교 앞 문방구에서 뽑기 하던 시절'), false);
  assert.equal(containsBadWords('시발점이라는 1969년 영화를 봤습니다'), false);
  assert.equal(containsBadWords('서태지와 아이들 음반이 동시발매 되었습니다'), false);
  assert.equal(containsBadWords('포카칩과 새우깡 과자가 맛있었어요'), false);
  assert.equal(checkPostSafety({ title: '추억의 오락실', content: '킹오파를 매일 했어요', author: '90년대생' }).safe, true);

  // Unsafe bad words & spam
  assert.equal(containsBadWords('씨발 진짜'), true);
  assert.equal(containsBadWords('시.발 놈'), true);
  assert.equal(containsBadWords('개새끼'), true);
  assert.equal(containsBadWords('바카라 꽁머니 즉시지급'), true);
  assert.equal(containsBadWords('출장샵 조건만남 텔레그램 문의'), true);
  assert.equal(containsBadWords('카톡아이디 777로 연락주세요'), true);
  assert.equal(containsBadWords('고수익보장 리딩방 초대'), true);
  assert.equal(containsBadWords('ㅅㅂ 너무하네'), true);
  assert.equal(containsBadWords('존나 웃기네'), true);

  const check = checkPostSafety({ title: '정상 제목', content: '바카라 사이트 추천', author: '홍길동' });
  assert.equal(check.safe, false);
});

test('posts API blocks bad words submission with 400 status', async () => {
  const env = { ADMIN_KEY: 'test-secret', DB: { prepare() { return { bind() { return { async first() { return { count: 1 }; } }; } }; } } };
  const res = await post({
    request: request({
      year: 1997,
      title: '씨발 진짜 화나네',
      content: '추억 이야기입니다.',
      author: '길동',
    }),
    env,
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, BAD_WORD_MESSAGE);
});

test('posts API saves password_hash and does not expose it in response', async () => {
  let inserted = null;
  const env = {
    ADMIN_KEY: 'test-secret',
    DB: {
      prepare(query) {
        if (query.includes('cheer_limits')) {
          return { bind() { return { async first() { return { count: 1 }; } }; } };
        }
        return {
          bind(...args) {
            inserted = args;
            return { async run() { return { success: true }; } };
          },
        };
      },
    },
  };

  const res = await post({
    request: request({
      year: 1997,
      title: '문방구 오락실',
      content: '스트리트 파이터 열심히 했습니다.',
      author: '오락실보이',
      password: '1234',
    }),
    env,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.post.hasPassword, true);
  assert.equal(data.post.password_hash, undefined); // Never expose password_hash!
  assert.ok(inserted[8]); // 9th parameter is password_hash
  assert.notEqual(inserted[8], '1234'); // Must be hashed SHA-256!
});

test('posts API handles report action', async () => {
  let updatedSql = '';
  const env = {
    ADMIN_KEY: 'test-secret',
    DB: {
      prepare(query) {
        updatedSql = query;
        if (query.includes('cheer_limits')) {
          return { bind() { return { async first() { return { count: 1 }; } }; } };
        }
        return {
          bind() {
            return { async run() { return { success: true }; } };
          },
        };
      },
    },
  };

  const res = await post({
    request: request({ action: 'report', id: 'post_1997_1' }),
    env,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.match(updatedSql, /reports = COALESCE\(reports, 0\) \+ 1/);
});

test('delete post rejects incorrect password with 403 and deletes when password matches', async () => {
  // Pre-hashed '1234' with SHA-256
  const hash1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  let deletedId = null;

  const env = {
    ADMIN_KEY: 'test-secret',
    DB: {
      prepare(query) {
        if (query.includes('cheer_limits')) {
          return { bind() { return { async first() { return { count: 1 }; } }; } };
        }
        if (query.includes('SELECT')) {
          return {
            bind() {
              return {
                async first() {
                  return { id: 'post_123', password_hash: hash1234, year: 1997, title: '문방구' };
                },
              };
            },
          };
        }
        if (query.includes('DELETE')) {
          return {
            bind(id) {
              deletedId = id;
              return { async run() { return { success: true }; } };
            },
          };
        }
        return { bind() { return {}; } };
      },
    },
  };

  // 1. Wrong password
  const failRes = await deletePost({
    request: request({ id: 'post_123', password: '9999' }, 'DELETE'),
    env,
  });
  assert.equal(failRes.status, 403);
  assert.equal(deletedId, null);

  // 2. Correct password
  const okRes = await deletePost({
    request: request({ id: 'post_123', password: '1234' }, 'DELETE'),
    env,
  });
  assert.equal(okRes.status, 200);
  const okData = await okRes.json();
  assert.equal(okData.ok, true);
  assert.equal(deletedId, 'post_123');
});

test('year data API filters out password_hash and reported/hidden posts', async () => {
  const hash1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  const env = {
    DB: {
      prepare() { return { bind() { return {}; } }; },
      async batch() {
        return [
          {
            results: [
              { id: 'p1', title: '정상 사연', password_hash: hash1234, status: 'approved', created_at: '2026-01-01T00:00:00Z' },
              { id: 'p2', title: '신고 누적 사연', password_hash: hash1234, status: 'reported', created_at: '2026-01-01T00:00:00Z' },
              { id: 'p3', title: '비밀번호 없는 구형 사연', status: null, created_at: '2026-01-01T00:00:00Z' },
            ],
          },
          { results: [] },
          { results: [] },
        ];
      },
    },
  };

  const response = await getYear({ request: new Request('https://example.com/?year=1997'), env });
  const data = await response.json();
  assert.equal(data.ok, true);
  // p2 (reported) should be filtered out
  assert.equal(data.posts.length, 2);
  assert.equal(data.posts[0].id, 'p1');
  assert.equal(data.posts[0].hasPassword, true);
  assert.equal(data.posts[0].password_hash, undefined); // Must NOT expose password_hash
  assert.equal(data.posts[1].id, 'p3');
  assert.equal(data.posts[1].hasPassword, false);
});
