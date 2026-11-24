// 사용자 사연 등록, 삭제, 신고 API (Cloudflare Pages Functions + D1)
import { communityLimit, readCommunityBody } from '../../lib/community-limit.js';
import { checkPostSafety, BAD_WORD_MESSAGE } from '../../lib/badwords.js';

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

async function hashPassword(pwd) {
  if (!pwd) return null;
  const msgUint8 = new TextEncoder().encode(String(pwd));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  if (!env?.DB) return json({ ok: false, error: "저장소를 사용할 수 없습니다." }, 503);

  let body;
  try {
    body = await readCommunityBody(request);
  } catch {
    return json({ ok: false, error: "요청 크기 또는 형식을 확인해 주세요." }, 400);
  }

  // 1. 사연 신고 접수 처리
  if (body?.action === "report" || body?.reportId) {
    try {
      if (!await communityLimit(request, env, 'reaction')) {
        return json({ ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, 429);
      }
    } catch {
      return json({ ok: false, error: "서비스를 사용할 수 없습니다." }, 503);
    }

    const reportTargetId = String(body?.id || body?.reportId || "").trim();
    if (!reportTargetId) return json({ ok: false, error: "게시물 ID가 필요합니다." }, 400);

    try {
      await env.DB.prepare(
        "UPDATE posts SET reports = COALESCE(reports, 0) + 1, status = CASE WHEN COALESCE(reports, 0) + 1 >= 3 THEN 'reported' ELSE status END WHERE id = ?"
      ).bind(reportTargetId).run();
      return json({ ok: true, message: "신고가 접수되었습니다. 관리자 검토를 통해 신속히 조치하겠습니다." });
    } catch (err) {
      try {
        try { await env.DB.prepare("ALTER TABLE posts ADD COLUMN reports INTEGER DEFAULT 0").run(); } catch {}
        try { await env.DB.prepare("ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'approved'").run(); } catch {}
        await env.DB.prepare("UPDATE posts SET reports = 1 WHERE id = ?").bind(reportTargetId).run();
        return json({ ok: true, message: "신고가 접수되었습니다. 관리자 검토를 통해 신속히 조치하겠습니다." });
      } catch {
        return json({ ok: false, error: "신고 처리에 실패했습니다." }, 503);
      }
    }
  }

  // 2. 사연 신규 작성 처리
  try {
    if (!await communityLimit(request, env, 'post')) {
      return json({ ok: false, error: "요청이 너무 많거나 서비스 설정이 완료되지 않았습니다." }, 429);
    }
  } catch {
    return json({ ok: false, error: "서비스를 사용할 수 없습니다." }, 503);
  }

  const year = Number(body?.year);
  const month = body?.month ? Number(body.month) : null;
  const category = String(body?.category ?? "사건·생활상").trim();
  const title = String(body?.title ?? "").trim().slice(0, MAX_TITLE);
  const content = String(body?.content ?? "").trim();
  const author = String(body?.author ?? "익명의 시간여행자").trim().slice(0, MAX_NAME) || "익명의 시간여행자";
  const password = String(body?.password ?? "").trim().slice(0, 10);

  if (!Number.isInteger(year) || year < 1950 || year > 2026 || (month !== null && (!Number.isInteger(month) || month < 1 || month > 12))) {
    return json({ ok: false, error: "연도 또는 월이 올바르지 않습니다." }, 400);
  }
  if (!title) return json({ ok: false, error: "사연 제목을 입력해 주세요." }, 400);
  if (!content) return json({ ok: false, error: "사연 내용을 작성해 주세요." }, 400);
  if (content.length > MAX_MSG) return json({ ok: false, error: `${MAX_MSG}자 이내로 작성해 주세요.` }, 400);

  // 스팸 & 비속어 필터링 검증
  const safety = checkPostSafety({ title, content, author });
  if (!safety.safe) {
    return json({ ok: false, error: BAD_WORD_MESSAGE }, 400);
  }

  const at = new Date().toISOString();
  const id = `post_${year}_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const passwordHash = password ? await hashPassword(password) : null;
  const post = { id, year, month, category, title, content, author, at, hasPassword: !!passwordHash, status: "approved" };

  if (env?.DB) {
    try {
      await env.DB.prepare(
        "INSERT INTO posts (id, year, month, category, title, content, author, created_at, password_hash, status, reports) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 0)"
      ).bind(id, year, month, category, title, content, author, at, passwordHash).run();
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("no such column") || msg.includes("NoSuchColumn") || msg.includes("password_hash") || msg.includes("status") || msg.includes("reports")) {
        try {
          try { await env.DB.prepare("ALTER TABLE posts ADD COLUMN password_hash TEXT").run(); } catch {}
          try { await env.DB.prepare("ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'approved'").run(); } catch {}
          try { await env.DB.prepare("ALTER TABLE posts ADD COLUMN reports INTEGER DEFAULT 0").run(); } catch {}

          await env.DB.prepare(
            "INSERT INTO posts (id, year, month, category, title, content, author, created_at, password_hash, status, reports) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 0)"
          ).bind(id, year, month, category, title, content, author, at, passwordHash).run();
        } catch {
          try {
            await env.DB.prepare(
              "INSERT INTO posts (id, year, month, category, title, content, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(id, year, month, category, title, content, author, at).run();
          } catch {
            return json({ ok: false, error: "사연을 저장하지 못했습니다." }, 503);
          }
        }
      } else {
        return json({ ok: false, error: "사연을 저장하지 못했습니다." }, 503);
      }
    }
  }

  return json({ ok: true, post });
}

export async function onRequestDelete({ request, env }) {
  if (!env?.DB) return json({ ok: false, error: "저장소를 사용할 수 없습니다." }, 503);
  try {
    if (!await communityLimit(request, env, 'post')) {
      return json({ ok: false, error: "요청이 너무 많거나 서비스 설정이 완료되지 않았습니다." }, 429);
    }
  } catch {
    return json({ ok: false, error: "서비스를 사용할 수 없습니다." }, 503);
  }

  let id = "";
  let password = "";

  try {
    const url = new URL(request.url);
    id = url.searchParams.get("id") || "";
    password = url.searchParams.get("password") || "";
  } catch {}

  if (!id || !password) {
    try {
      const body = await readCommunityBody(request);
      if (body?.id) id = String(body.id).trim();
      if (body?.password) password = String(body.password).trim();
    } catch {}
  }

  if (!id) return json({ ok: false, error: "삭제할 사연 id가 필요합니다." }, 400);

  let postRow;
  try {
    postRow = await env.DB.prepare(
      "SELECT id, password_hash, year, title FROM posts WHERE id = ?"
    ).bind(id).first();
  } catch (err) {
    try {
      postRow = await env.DB.prepare(
        "SELECT id, year, title FROM posts WHERE id = ?"
      ).bind(id).first();
    } catch {
      return json({ ok: false, error: "사연 조회 중 오류가 발생했습니다." }, 503);
    }
  }

  if (!postRow) {
    return json({ ok: false, error: "사연을 찾을 수 없습니다." }, 404);
  }

  if (postRow.password_hash) {
    const inputHash = await hashPassword(password);
    if (inputHash !== postRow.password_hash) {
      return json({ ok: false, error: "비밀번호가 일치하지 않습니다." }, 403);
    }
  }

  try {
    await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
  } catch (err) {
    return json({ ok: false, error: "사연 삭제에 실패했습니다." }, 503);
  }

  return json({ ok: true, deletedId: id });
}
