import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/cheer.js';

const request = (body) => new Request('https://example.com/api/cheer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('unconfigured service fails rather than pretending to send', async () => {
  const response = await onRequestPost({ request: request({ message: '응원' }), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});

test('valid input goes only to configured recipient', async () => {
  let sent;
  const env = { CHEER_FROM: 'sender@example.com', CHEER_TO: 'admin@example.com', TURNSTILE_SECRET: 'secret', EMAIL: { send: async (mail) => { sent = mail; } } };
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ success: true });
    const response = await onRequestPost({ request: request({ name: '방문자', message: '응원합니다', token: 'token', to: 'other@example.com' }), env });
    assert.equal(response.status, 200);
    assert.equal(sent.to, 'admin@example.com');
    assert.match(sent.text, /응원합니다/);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid input and provider errors fail without claiming success', async () => {
  const env = { CHEER_FROM: 'sender@example.com', CHEER_TO: 'admin@example.com', TURNSTILE_SECRET: 'secret', EMAIL: { send: async () => { throw new Error('private details'); } } };
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ success: true });
    assert.equal((await onRequestPost({ request: request({ message: '' }), env })).status, 400);
    const response = await onRequestPost({ request: request({ message: '응원', token: 'token' }), env });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('security verification is required and fails closed', async () => {
  let sends = 0;
  const env = { CHEER_FROM: 'sender@example.com', CHEER_TO: 'admin@example.com', TURNSTILE_SECRET: 'secret', EMAIL: { send: async () => { sends++; } } };
  assert.equal((await onRequestPost({ request: request({ message: '응원' }), env })).status, 400);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ success: false });
    assert.equal((await onRequestPost({ request: request({ message: '응원', token: 'invalid' }), env })).status, 403);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await onRequestPost({ request: request({ message: '응원', token: 'token' }), env })).status, 503);
    assert.equal(sends, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('oversized request is rejected before verification', async () => {
  const env = { CHEER_FROM: 'sender@example.com', CHEER_TO: 'admin@example.com', TURNSTILE_SECRET: 'secret', EMAIL: { send: async () => assert.fail('must not send') } };
  assert.equal((await onRequestPost({ request: request({ message: '가'.repeat(1500), token: 'token' }), env })).status, 400);
});
