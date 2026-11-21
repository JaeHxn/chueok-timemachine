import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as post } from '../functions/api/posts.js';
import { onRequestPost as comment } from '../functions/api/comments.js';
import { onRequestPost as react } from '../functions/api/reactions.js';
import { onRequestGet as getYear } from '../functions/api/year-data.js';

const request = (data) => new Request('https://example.com/', { method: 'POST', headers: { 'cf-connecting-ip': '127.0.0.1' }, body: JSON.stringify(data) });
test('community endpoints report unavailable database rather than success', async () => {
  for (const handler of [post, comment, react]) {
    const response = await handler({ request: request({}), env: {} });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  }
  const response = await getYear({ request: new Request('https://example.com/?year=1974'), env: {} });
  assert.equal(response.status, 503);
});

test('database errors do not reveal private details', async () => {
  const env = { ADMIN_KEY: 'test-secret', DB: { prepare() { throw new Error('private database detail'); } } };
  const response = await post({ request: request({ year: 1974, title: '기억', content: '이야기' }), env });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database detail/);
});

test('year data normalizes persisted post timestamp', async () => {
  const env = { DB: { prepare() { return { bind() { return {}; } }; }, async batch() { return [{ results: [{ id: 'p', created_at: '2026-01-01T00:00:00Z' }] }, { results: [] }, { results: [] }]; } } };
  const response = await getYear({ request: new Request('https://example.com/?year=1974'), env });
  assert.equal((await response.json()).posts[0].at, '2026-01-01T00:00:00Z');
});

test('public submissions fail closed when rate limit is exceeded', async () => {
  let sql = '';
  const env = { ADMIN_KEY: 'test-secret', DB: { prepare(query) { sql = query; return { bind() { return { async first() { return null; } }; } }; } } };
  const response = await post({ request: request({ year: 1974, title: '기억', content: '이야기' }), env });
  assert.equal(response.status, 429);
  assert.match(sql, /cheer_limits/);
});

test('successful community writes return persisted identity and reaction count', async () => {
  const env = { ADMIN_KEY: 'test-secret', DB: { prepare(query) { return { bind() { return { async first() { return { count: query.includes('cheer_limits') ? 1 : 7 }; }, async run() { return { success: true }; } }; } }; } } };
  const p = await post({ request: request({ year: 1974, title: '기억', content: '이야기' }), env });
  const saved = (await p.json()).post;
  assert.ok(saved.id && saved.at);
  const c = await comment({ request: request({ year: 1974, targetId: '1974_기억', content: '댓글' }), env });
  assert.ok((await c.json()).comment.id);
  const r = await react({ request: request({ year: 1974, targetId: '1974_기억', type: 'like', delta: 1 }), env });
  assert.equal((await r.json()).counts.like, 7);
});

test('oversized bodies are rejected before writing', async () => {
  const env = { ADMIN_KEY: 'test-secret', DB: { prepare(query) { assert.match(query, /cheer_limits/); return { bind() { return { async first() { return { count: 1 }; } }; } }; } } };
  const r = await post({ request: request({ year: 1974, title: '기억', content: '가'.repeat(3000) }), env });
  assert.equal(r.status, 400);
});
