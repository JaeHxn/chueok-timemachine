const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function hash(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function permitted(request, env, action, limit) {
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip) return false;
  const key = Array.from(await hash(`${env.ADMIN_KEY}\0${action}\0${ip}`), b => b.toString(16).padStart(2, '0')).join('');
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`INSERT INTO cheer_limits (key, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
      count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END
    WHERE window_start <= ? OR count < ? RETURNING count`).bind(key, now, now - 60, now - 60, now - 60, limit).first();
  if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM cheer_limits WHERE window_start < ?').bind(now - 86400).run();
  return !!row;
}

async function authorized(request, env) {
  const key = request.headers.get('x-admin-key') || '';
  if (!key || key.length > 512) return false;
  const [actual, expected] = await Promise.all([hash(key), hash(env.ADMIN_KEY)]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

async function ready(request, env, action, limit, admin = false) {
  if (!env.DB || !env.ADMIN_KEY) return json({ ok: false, error: '응원 서비스가 아직 설정되지 않았습니다.' }, 503);
  if (!await permitted(request, env, action, limit)) return json({ ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, 429);
  if (admin && !await authorized(request, env)) return json({ ok: false, error: '관리자 비밀번호가 올바르지 않습니다.' }, 401);
  return null;
}

export async function onRequestPost({ request, env }) {
  try {
    const blocked = await ready(request, env, 'submit', 5);
    if (blocked) return blocked;
    const reader = request.body?.getReader();
    if (!reader) return json({ ok: false, error: '내용을 입력해 주세요.' }, 400);
    let size = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return json({ ok: false, error: '입력 내용이 너무 깁니다.' }, 400); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let data;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ ok: false, error: '내용을 확인해 주세요.' }, 400); }
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    if (!message || message.length > 500) return json({ ok: false, error: '응원 내용은 1~500자로 입력해 주세요.' }, 400);
    await env.DB.prepare('INSERT INTO cheers (id, message, created_at) VALUES (?, ?, ?)').bind(crypto.randomUUID(), message, new Date().toISOString()).run();
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: '응원을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503);
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const blocked = await ready(request, env, 'admin', 10, true);
    if (blocked) return blocked;
    const params = new URL(request.url).searchParams;
    const beforeAt = params.get('beforeAt');
    const beforeId = params.get('beforeId');
    if ((beforeAt === null) !== (beforeId === null) || (beforeAt !== null && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(beforeAt) || !/^[0-9a-f-]{36}$/i.test(beforeId)))) {
      return json({ ok: false, error: '목록 위치를 확인해 주세요.' }, 400);
    }
    const { results } = beforeAt === null
      ? await env.DB.prepare('SELECT id, message, created_at AS at FROM cheers ORDER BY created_at DESC, id DESC LIMIT 201').all()
      : await env.DB.prepare('SELECT id, message, created_at AS at FROM cheers WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC, id DESC LIMIT 201').bind(beforeAt, beforeAt, beforeId).all();
    return json({ ok: true, rows: results.slice(0, 200), hasMore: results.length > 200 });
  } catch { return json({ ok: false, error: '응원 목록을 불러오지 못했습니다.' }, 503); }
}

export async function onRequestDelete({ request, env }) {
  try {
    const blocked = await ready(request, env, 'admin', 10, true);
    if (blocked) return blocked;
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: '응원 번호를 확인해 주세요.' }, 400);
    const result = await env.DB.prepare('DELETE FROM cheers WHERE id = ?').bind(id).run();
    if (!result.meta?.changes) return json({ ok: false, error: '이미 삭제된 응원입니다.' }, 404);
    return json({ ok: true });
  } catch { return json({ ok: false, error: '응원을 삭제하지 못했습니다.' }, 503); }
}
