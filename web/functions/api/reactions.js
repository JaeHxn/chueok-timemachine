// 추억 공감 반응 API (Cloudflare Pages Functions + KV)
// types: 'ah' (아 이거!), 'kkk' (ㅋㅋㅋ), 'weep' (울컥), 'b486' (486 사랑해), 'b8282' (8282 빨리빨리)
const VALID_TYPES = new Set(["like", "ah", "kkk", "weep", "b486", "b8282"]);

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
    return json({ ok: true, counts: { ah: 0, kkk: 0, weep: 0, b486: 0, b8282: 0 } });
  }

  try {
    const key = `react:${encodeURIComponent(targetId)}`;
    const val = await env.CHEERS.get(key);
    const counts = val ? JSON.parse(val) : { ah: 0, kkk: 0, weep: 0, b486: 0, b8282: 0 };
    return json({ ok: true, counts });
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
  const type = String(body?.type ?? "").trim();
  const delta = Number(body?.delta ?? 1); // 1 = add, -1 = remove

  if (!targetId) return json({ ok: false, error: "targetId가 필요합니다." }, 400);
  if (!VALID_TYPES.has(type)) return json({ ok: false, error: "유효하지 않은 반응 종류입니다." }, 400);

  if (!env?.CHEERS) {
    return json({ ok: true, counts: { [type]: 1 } });
  }

  try {
    const key = `react:${encodeURIComponent(targetId)}`;
    const val = await env.CHEERS.get(key);
    const counts = val ? JSON.parse(val) : { ah: 0, kkk: 0, weep: 0, b486: 0, b8282: 0 };
    counts[type] = Math.max(0, (counts[type] || 0) + (delta > 0 ? 1 : -1));

    await env.CHEERS.put(key, JSON.stringify(counts));
    return json({ ok: true, counts });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
