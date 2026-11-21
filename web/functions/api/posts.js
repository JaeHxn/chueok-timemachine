// 사용자 사연 등록 API (Cloudflare Pages Functions + D1)
import { communityLimit, readCommunityBody } from '../../lib/community-limit.js';
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
  if (!env?.DB) return json({ ok: false, error: "저장소를 사용할 수 없습니다." }, 503);
  try { if (!await communityLimit(request, env, 'post')) return json({ ok: false, error: "요청이 너무 많거나 서비스 설정이 완료되지 않았습니다." }, 429); }
  catch { return json({ ok: false, error: "서비스를 사용할 수 없습니다." }, 503); }
  let body;
  try { body = await readCommunityBody(request); } catch { return json({ ok: false, error: "요청 크기 또는 형식을 확인해 주세요." }, 400); }

  const year = Number(body?.year);
  const month = body?.month ? Number(body.month) : null;
  const category = String(body?.category ?? "사건·생활상").trim();
  const title = String(body?.title ?? "").trim().slice(0, MAX_TITLE);
  const content = String(body?.content ?? "").trim();
  const author = String(body?.author ?? "익명의 시간여행자").trim().slice(0, MAX_NAME) || "익명의 시간여행자";

  if (!Number.isInteger(year) || year < 1950 || year > 2026 || (month !== null && (!Number.isInteger(month) || month < 1 || month > 12))) return json({ ok: false, error: "연도 또는 월이 올바르지 않습니다." }, 400);
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
      return json({ ok: false, error: "사연을 저장하지 못했습니다." }, 503);
    }
  }

  return json({ ok: true, post });
}
