// 공감 반응 토글 API (Cloudflare Pages Functions + D1)
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

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "잘못된 JSON 형식입니다." }, 400); }

  const targetId = String(body?.targetId ?? "").trim();
  const year = Number(body?.year ?? (targetId.split("_")[0]));
  const type = String(body?.type ?? "").trim();
  const delta = Number(body?.delta ?? 1); // 1 = add, -1 = remove

  if (!targetId) return json({ ok: false, error: "targetId가 필요합니다." }, 400);
  if (!VALID_TYPES.has(type)) return json({ ok: false, error: "유효하지 않은 반응 종류입니다." }, 400);

  if (env?.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO reactions (target_id, year, type, count)
        VALUES (?, ?, ?, MAX(0, ?))
        ON CONFLICT(target_id, type) DO UPDATE SET count = MAX(0, count + ?)
      `).bind(targetId, year, type, delta > 0 ? 1 : 0, delta > 0 ? 1 : -1).run();
    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  return json({ ok: true });
}
