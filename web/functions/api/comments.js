// 카드별 댓글 등록 API (Cloudflare Pages Functions + D1)
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

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "잘못된 JSON 형식입니다." }, 400); }

  const targetId = String(body?.targetId ?? "").trim();
  const year = Number(body?.year ?? (targetId.split("_")[0]));
  const content = String(body?.content ?? "").trim();
  const author = String(body?.author ?? "익명의 시간여행자").trim().slice(0, MAX_NAME) || "익명의 시간여행자";

  if (!targetId) return json({ ok: false, error: "targetId가 필요합니다." }, 400);
  if (!year || isNaN(year)) return json({ ok: false, error: "올바른 연도가 필요합니다." }, 400);
  if (!content) return json({ ok: false, error: "댓글 내용을 작성해 주세요." }, 400);
  if (content.length > MAX_MSG) return json({ ok: false, error: `${MAX_MSG}자 이내로 작성해 주세요.` }, 400);

  const at = new Date().toISOString();
  const id = `cmt_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const comment = { id, targetId, author, content, at };

  if (env?.DB) {
    try {
      await env.DB.prepare(
        "INSERT INTO comments (id, target_id, year, author, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(id, targetId, year, author, content, at).run();
    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  return json({ ok: true, comment });
}
