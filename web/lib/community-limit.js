// Limit public writes without storing visitors' IP addresses.
export async function communityLimit(request, env, action) {
  const ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';
  const salt = env?.ADMIN_KEY || 'chueok-salt-2026';
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}\0${action}\0${ip}`));
    const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(`INSERT INTO cheer_limits (key, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
        count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END
      WHERE window_start <= ? OR count < ? RETURNING count`).bind(key, now, now - 60, now - 60, now - 60, action === 'reaction' ? 30 : 5).first();
    return !!row;
  } catch (err) {
    // If rate limit table is not created or DB temporary failure, fail open for normal user experience
    return true;
  }
}

export async function readCommunityBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('missing body');
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) { await reader.cancel(); throw new Error('body too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
