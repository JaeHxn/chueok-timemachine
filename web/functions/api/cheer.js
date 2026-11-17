// 응원 한마디 API (Cloudflare Pages Functions + KV)
// POST   /api/cheer            누구나 작성 (글자 수 제한, IP당 30초에 1번)
// GET    /api/cheer            관리자만 목록 (헤더 x-admin-key)
// DELETE /api/cheer?id=...     관리자만 삭제
const MAX_MSG = 500;
const MAX_NAME = 20;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

// 길이가 다르면 바로 false, 같으면 끝까지 비교(시간 차로 키를 추측하지 못하게)
function safeEqual(a = "", b = "") {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const isAdmin = (request, env) => safeEqual(request.headers.get("x-admin-key") || "", env.ADMIN_KEY || "");

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "잘못된 요청입니다." }, 400); }
  const message = String(body?.message ?? "").trim();
  const name = String(body?.name ?? "").trim().slice(0, MAX_NAME);
  if (!message) return json({ ok: false, error: "응원 내용을 적어 주세요." }, 400);
  if (message.length > MAX_MSG) return json({ ok: false, error: `${MAX_MSG}자 이내로 적어 주세요.` }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = `rl:${ip}`;
  if (await env.CHEERS.get(rlKey)) return json({ ok: false, error: "잠시 후 다시 보내 주세요." }, 429);
  await env.CHEERS.put(rlKey, "1", { expirationTtl: 60 });

  const at = new Date().toISOString();
  const id = `cheer:${at}:${crypto.randomUUID().slice(0, 8)}`;
  await env.CHEERS.put(id, JSON.stringify({ message, name, at }));
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "관리자만 볼 수 있습니다." }, 401);
  const list = await env.CHEERS.list({ prefix: "cheer:", limit: 1000 });
  const rows = await Promise.all(list.keys.map(async (k) => ({ id: k.name, ...(JSON.parse((await env.CHEERS.get(k.name)) || "{}")) })));
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  return json({ ok: true, rows });
}

export async function onRequestDelete({ request, env }) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "관리자만 지울 수 있습니다." }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id.startsWith("cheer:")) return json({ ok: false, error: "잘못된 항목입니다." }, 400);
  await env.CHEERS.delete(id);
  return json({ ok: true });
}
