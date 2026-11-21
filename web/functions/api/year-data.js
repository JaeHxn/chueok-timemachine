// 연도별 온디맨드 1회 통합 조회 API (Cloudflare Pages Functions + D1)
// 연도 클릭 시 사연 + 댓글 + 반응을 한 번의 쿼리로 묶어서 가져옵니다.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=10, s-maxage=30",
      "access-control-allow-origin": "*",
    },
  });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 1950 || year > 2026) return json({ ok: false, error: "올바른 연도가 필요합니다." }, 400);

  if (!env?.DB) {
    return json({ ok: false, error: "저장소를 사용할 수 없습니다." }, 503);
  }

  try {
    // 3개 쿼리를 D1 배치로 동시 실행 (단 1번의 왕복)
    const [postsRes, commentsRes, reactionsRes] = await env.DB.batch([
      env.DB.prepare("SELECT * FROM posts WHERE year = ? ORDER BY created_at DESC").bind(year),
      env.DB.prepare("SELECT * FROM comments WHERE year = ? ORDER BY created_at ASC").bind(year),
      env.DB.prepare("SELECT target_id, type, count FROM reactions WHERE year = ?").bind(year),
    ]);

    const posts = (postsRes?.results || []).map(({ created_at, ...post }) => ({ ...post, at: created_at }));
    
    // 댓글을 target_id별로 그룹화
    const commentsMap = {};
    for (const c of (commentsRes?.results || [])) {
      if (!commentsMap[c.target_id]) commentsMap[c.target_id] = [];
      commentsMap[c.target_id].push({
        id: c.id,
        targetId: c.target_id,
        author: c.author,
        content: c.content,
        at: c.created_at,
      });
    }

    // 반응을 target_id별 카운트 객체로 변환
    const reactionsMap = {};
    for (const r of (reactionsRes?.results || [])) {
      if (!reactionsMap[r.target_id]) {
        reactionsMap[r.target_id] = { ah: 0, kkk: 0, weep: 0, b486: 0, b8282: 0, like: 0 };
      }
      reactionsMap[r.target_id][r.type] = Number(r.count || 0);
    }

    return json({
      ok: true,
      year,
      posts,
      comments: commentsMap,
      reactions: reactionsMap,
    });
  } catch (err) {
    return json({ ok: false, error: "자료를 불러오지 못했습니다." }, 503);
  }
}
