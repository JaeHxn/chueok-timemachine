import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestPost, onRequestGet, onRequestDelete } from '../functions/api/cheer.js';

const makeRequest = (method, body, key = '') => new Request('https://example.com/api/cheer?id=123', { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1', 'x-admin-key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const limiter = { prepare: () => ({ bind: () => ({ first: async () => ({ count: 1 }) }) }) };
test('unconfigured storage refuses submissions', async () => {
  const r = await onRequestPost({ request: makeRequest('POST', {message:'응원'}), env: {} });
  assert.equal(r.status, 503);
});
test('administrator endpoints fail closed for missing or wrong key', async () => {
  const env = { DB: limiter, ADMIN_KEY: 'correct-password' };
  for (const handler of [onRequestGet, onRequestDelete]) {
    const r = await handler({ request: makeRequest(handler === onRequestGet ? 'GET' : 'DELETE', undefined, 'wrong'), env });
    assert.equal(r.status, 401);
  }
});
test('valid anonymous message is written and rate limiting is enforced', async () => {
  let inserted;
  const db = { prepare(sql) { return { bind(...values) { return { first: async () => ({count:1}), run: async () => { inserted = values; return {success:true}; } }; } }; } };
  const env = { DB: db, ADMIN_KEY: 'correct-password' };
  const r = await onRequestPost({request: makeRequest('POST', {message: ' 응원해요 ', name: 'ignored'}), env});
  assert.equal(r.status, 200);
  assert.equal(inserted[1], '응원해요');
  assert.equal(inserted.includes('ignored'), false);
  const blocked = { DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) }, ADMIN_KEY: 'correct-password' };
  assert.equal((await onRequestPost({request: makeRequest('POST', {message:'응원'}), env: blocked})).status, 429);
});

test('D1 schema stores anonymous submissions, blocks bad credentials, and allows admin deletion', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_cheers.sql', import.meta.url), 'utf8'));
  const db = { prepare(sql) { const stmt = sqlite.prepare(sql); return { bind(...values) { return { first: async () => stmt.get(...values) ?? null, run: async () => ({ meta: { changes: Number(stmt.run(...values).changes) } }), all: async () => ({results: stmt.all(...values)}) }; }, all: async () => ({results: stmt.all()}) }; } };
  const env = { DB: db, ADMIN_KEY: 'correct-password' };
  assert.equal((await onRequestPost({request:makeRequest('POST', {message:'기억할게요'}), env})).status, 200);
  const list = await onRequestGet({request:makeRequest('GET', undefined, 'correct-password'), env});
  const {rows} = await list.json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].message, '기억할게요');
  const deleteRequest = new Request(`https://example.com/api/cheer?id=${rows[0].id}`, {method:'DELETE',headers:{'cf-connecting-ip':'192.0.2.1','x-admin-key':'correct-password'}});
  assert.equal((await onRequestDelete({request:deleteRequest,env})).status, 200);
  assert.equal((await (await onRequestGet({request:makeRequest('GET', undefined, 'correct-password'), env})).json()).rows.length, 0);
  const insert = sqlite.prepare('INSERT INTO cheers VALUES (?, ?, ?)');
  for (let i=0; i<201; i++) insert.run(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, '응원', '2026-01-01T00:00:00.000Z');
  const page1 = await (await onRequestGet({request:makeRequest('GET', undefined, 'correct-password'),env})).json();
  assert.equal(page1.rows.length, 200);
  assert.equal(page1.hasMore, true);
  insert.run('00000000-0000-4000-8000-999999999999', '새 응원', '2026-01-02T00:00:00.000Z');
  const cursor = page1.rows.at(-1);
  const query = new URLSearchParams({ beforeAt: cursor.at, beforeId: cursor.id });
  const pageRequest = new Request(`https://example.com/api/cheer?${query}`, {headers:{'cf-connecting-ip':'192.0.2.1','x-admin-key':'correct-password'}});
  const page2 = await (await onRequestGet({request:pageRequest,env})).json();
  assert.equal(page2.rows.length, 1);
  assert.equal(page2.hasMore, false);
  assert.equal(page1.rows.some(row => row.id === page2.rows[0].id), false);
  sqlite.close();
});
