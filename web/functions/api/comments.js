// 카드별 댓글 등록 API (Cloudflare Pages Functions + D1)
import { communityLimit, readCommunityBody } from '../../lib/community-limit.js';
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
  if (!env?.DB) return json({ ok: false, error: "저장소를 사용할 수 없습니다." }, 503);
  try { if (!await communityLimit(request, env, 'comment')) return json({ ok: false, error: "요청이 너무 많거나 서비스 설정이 완료되지 않았습니다." }, 429); }
  catch { return json({ ok: false, error: "서비스를 사용할 수 없습니다." }, 503); }
  let body;
  try { body = await readCommunityBody(request); } catch { return json({ ok: false, error: "요청 크기 또는 형식을 확인해 주세요." }, 400); }

  const targetId = String(body?.targetId ?? "").trim();
  const year = Number(body?.year ?? (targetId.split("_")[0]));
  const content = String(body?.content ?? "").trim();
  const author = String(body?.author ?? "익명의 시간여행자").trim().slice(0, MAX_NAME) || "익명의 시간여행자";

  if (!targetId || targetId.length > 300) return json({ ok: false, error: "targetId가 올바르지 않습니다." }, 400);
  if (!Number.isInteger(year) || year < 1950 || year > 2026 || !targetId.startsWith(`${year}_`)) return json({ ok: false, error: "올바른 연도가 필요합니다." }, 400);
  if (!content) return json({ ok: false, error: "댓글 내용을 작성해 주세요." }, 400);
  if (content.length > MAX_MSG) return json({ ok: false, error: `${MAX_MSG}자 이내로 작성해 주세요.` }, 400);

  const at = new Date().toISOString();
  const id = `cmt_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const comment = { id, targetId, year, author, content, at };

  if (env?.DB) {
    try {
      await env.DB.prepare(
        "INSERT INTO comments (id, target_id, year, author, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(id, targetId, year, author, content, at).run();
    } catch (err) {
      return json({ ok: false, error: "댓글을 저장하지 못했습니다." }, 503);
    }
  }

  return json({ ok: true, comment });
}
