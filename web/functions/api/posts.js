// 사용자 사연 등록 API (Cloudflare Pages Functions + D1)
const MAX_MSG = 2000;
const MAX_TITLE = 60;
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

  const year = Number(body?.year);
  const month = body?.month ? Number(body.month) : null;
  const category = String(body?.category ?? "사건·생활상").trim();
  const title = String(body?.title ?? "").trim().slice(0, MAX_TITLE);
  const content = String(body?.content ?? "").trim();
  const author = String(body?.author ?? "익명의 시간여행자").trim().slice(0, MAX_NAME) || "익명의 시간여행자";

  if (!year || year < 1950 || year > 2026) return json({ ok: false, error: "연도가 올바르지 않습니다." }, 400);
  if (!title) return json({ ok: false, error: "사연 제목을 입력해 주세요." }, 400);
  if (!content) return json({ ok: false, error: "사연 내용을 작성해 주세요." }, 400);
  if (content.length > MAX_MSG) return json({ ok: false, error: `${MAX_MSG}자 이내로 작성해 주세요.` }, 400);

  const at = new Date().toISOString();
  const id = `post_${year}_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const post = { id, year, month, category, title, content, author, at };

  if (env?.DB) {
    try {
      await env.DB.prepare(
        "INSERT INTO posts (id, year, month, category, title, content, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, year, month, category, title, content, author, at).run();
    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  return json({ ok: true, post });
}
