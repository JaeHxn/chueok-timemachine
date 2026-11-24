// 공감 반응 토글 API (Cloudflare Pages Functions + D1)
import { communityLimit, readCommunityBody } from '../../lib/community-limit.js';
const VALID_TYPES = new Set(["like", "ah", "kkk", "weep", "b486", "b8282", "agree", "daebak"]);

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
  try { if (!await communityLimit(request, env, 'reaction')) return json({ ok: false, error: "요청이 너무 많거나 서비스 설정이 완료되지 않았습니다." }, 429); }
  catch { return json({ ok: false, error: "서비스를 사용할 수 없습니다." }, 503); }
  let body;
  try { body = await readCommunityBody(request); } catch { return json({ ok: false, error: "요청 크기 또는 형식을 확인해 주세요." }, 400); }

  const targetId = String(body?.targetId ?? "").trim();
  const year = Number(body?.year ?? (targetId.split("_")[0]));
  const type = String(body?.type ?? "").trim();
  const delta = Number(body?.delta ?? 1); // 1 = add, -1 = remove

  if (!targetId || targetId.length > 300 || !Number.isInteger(year) || year < 1950 || year > 2026 || !targetId.startsWith(`${year}_`)) return json({ ok: false, error: "대상 정보가 올바르지 않습니다." }, 400);
  if (!VALID_TYPES.has(type)) return json({ ok: false, error: "유효하지 않은 반응 종류입니다." }, 400);
  if (delta !== 1 && delta !== -1) return json({ ok: false, error: "유효하지 않은 반응 변경입니다." }, 400);

  if (env?.DB) {
    try {
      const row = await env.DB.prepare(`
        INSERT INTO reactions (target_id, year, type, count)
        VALUES (?, ?, ?, MAX(0, ?))
        ON CONFLICT(target_id, type) DO UPDATE SET count = MAX(0, count + ?)
        RETURNING count
      `).bind(targetId, year, type, delta > 0 ? 1 : 0, delta > 0 ? 1 : -1).first();
      return json({ ok: true, counts: { [type]: row.count } });
    } catch (err) {
      return json({ ok: false, error: "반응을 저장하지 못했습니다." }, 503);
    }
  }

  return json({ ok: true });
}
