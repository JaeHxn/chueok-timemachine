// 카드별 그때 그 시절 이야기(댓글) API (Cloudflare Pages Functions + KV)
const MAX_MSG = 500;
const MAX_NAME = 20;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const targetId = url.searchParams.get("targetId");
  if (!targetId) return json({ ok: false, error: "targetId가 필요합니다." }, 400);

  if (!env?.CHEERS) {
    return json({ ok: true, comments: [] });
  }

  try {
    const prefix = `cmt:${encodeURIComponent(targetId)}:`;
    const list = await env.CHEERS.list({ prefix, limit: 100 });
    const comments = await Promise.all(
      list.keys.map(async (k) => {
        const val = await env.CHEERS.get(k.name);
        return val ? JSON.parse(val) : null;
      })
    );
    const valid = comments.filter(Boolean);
    valid.sort((a, b) => (a.at > b.at ? 1 : -1));
    return json({ ok: true, comments: valid });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "잘못된 JSON 형식입니다." }, 400);
  }

  const targetId = String(body?.targetId ?? "").trim();
  const content = String(body?.content ?? "").trim();
  const author = String(body?.author ?? "익명의 시간여행자").trim().slice(0, MAX_NAME) || "익명의 시간여행자";

  if (!targetId) return json({ ok: false, error: "targetId가 필요합니다." }, 400);
  if (!content) return json({ ok: false, error: "댓글 내용을 작성해 주세요." }, 400);
  if (content.length > MAX_MSG) return json({ ok: false, error: `${MAX_MSG}자 이내로 작성해 주세요.` }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env?.CHEERS) {
    const rlKey = `rl:cmt:${ip}`;
    if (await env.CHEERS.get(rlKey)) {
      return json({ ok: false, error: "잠시 후 다시 작성해 주세요." }, 429);
    }
    await env.CHEERS.put(rlKey, "1", { expirationTtl: 5 }); // 5초 쿨타임
  }

  const at = new Date().toISOString();
  const id = `cmt:${encodeURIComponent(targetId)}:${Date.now()}:${crypto.randomUUID().slice(0, 6)}`;
  const comment = { id, targetId, author, content, at };

  if (env?.CHEERS) {
    await env.CHEERS.put(id, JSON.stringify(comment));
  }

  return json({ ok: true, comment });
}
