const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.EMAIL?.send || !env.CHEER_FROM || !env.CHEER_TO || !env.TURNSTILE_SECRET) {
    return json({ ok: false, error: '응원 전송 서비스가 아직 설정되지 않았습니다.' }, 503);
  }

  let data;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('missing body');
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); return json({ ok: false, error: '입력 내용이 너무 깁니다.' }, 400); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ ok: false, error: '입력 내용을 확인해 주세요.' }, 400);
  }
  if (!data || typeof data.message !== 'string' || (data.name != null && typeof data.name !== 'string')) {
    return json({ ok: false, error: '입력 내용을 확인해 주세요.' }, 400);
  }
  const message = data.message.trim();
  const name = (data.name || '').trim();
  if (!message || message.length > 500 || name.length > 50) {
    return json({ ok: false, error: '응원 내용을 확인해 주세요.' }, 400);
  }

  if (typeof data.token !== 'string' || !data.token || data.token.length > 2048) {
    return json({ ok: false, error: '보안 확인을 완료해 주세요.' }, 400);
  }
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: data.token });
    const ip = request.headers.get('cf-connecting-ip');
    if (ip) body.set('remoteip', ip);
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const result = await verification.json();
    if (!verification.ok || result.success !== true) return json({ ok: false, error: '보안 확인에 실패했습니다. 다시 시도해 주세요.' }, 403);
  } catch {
    return json({ ok: false, error: '보안 확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503);
  }

  try {
    await env.EMAIL.send({
      from: env.CHEER_FROM,
      to: env.CHEER_TO,
      subject: '[추억 타임머신] 새로운 응원 메시지',
      text: `보낸 분: ${name || '익명'}\n\n${message}`,
    });
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: '응원을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
  }
}
