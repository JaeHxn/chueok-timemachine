import { useEffect, useState } from "react";

const REACTION_CONFIG = [
  { key: "ah", label: "아 이거!", emoji: "😲" },
  { key: "kkk", label: "ㅋㅋㅋ", emoji: "😆" },
  { key: "weep", label: "울컥", emoji: "🥹" },
  { key: "b486", label: "486", emoji: "📟" },
  { key: "b8282", label: "8282", emoji: "🚀" },
];

export default function CardCommunity({ item, onToast, initialReactions, initialComments, onCommunityUpdate }) {
  const targetId = `${item.year}_${item.title}`;
  const [openComments, setOpenComments] = useState(false);
  const [openReactions, setOpenReactions] = useState(false);
  const [reactions, setReactions] = useState(() => initialReactions || { ah: 0, kkk: 0, weep: 0, b486: 0, b8282: 0, like: 0 });
  const [userActiveReactions, setUserActiveReactions] = useState(new Set());
  const [comments, setComments] = useState(() => initialComments || []);
  const [newComment, setNewComment] = useState("");
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem("chueok_nickname") || "";
    } catch {
      return "";
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [reacting, setReacting] = useState(false);

  // 로컬 스토리지 키
  const reactLocalKey = `react_user_${targetId}`;
  const reactStateKey = `react_state_${targetId}`;
  const cmtLocalKey = `cmt_local_${targetId}`;

  // 부모(연도 1회 묶음 조회)로부터 데이터 전달받았을 때 또는 로컬 데이터와 병합
  useEffect(() => {
    try {
      const savedState = JSON.parse(localStorage.getItem(reactStateKey) || "null");
      const savedUserReactions = savedState?.active ?? JSON.parse(localStorage.getItem(reactLocalKey) || "[]");
      setUserActiveReactions(new Set(savedUserReactions));

      // D1 서버 집계치와 로컬 상태 병합
      if (initialReactions) {
        setReactions(initialReactions);
      } else if (savedState?.counts) {
        setReactions(savedState.counts);
      }

      // 댓글 병합
      const localCmts = JSON.parse(localStorage.getItem(cmtLocalKey) || "[]");
      const serverCmts = initialComments || [];
      const map = new Map();
      [...localCmts, ...serverCmts].forEach((c) => map.set(c.id, c));
      setComments(Array.from(map.values()));
    } catch {}
  }, [targetId, initialReactions, initialComments]);

  // 공감 반응 토글 (로컬 즉시 반영 + D1 비동기 동기화)
  const toggleReaction = async (type) => {
    if (reacting) return;
    const isCurrentlyActive = userActiveReactions.has(type);
    const newActive = new Set(userActiveReactions);
    const delta = isCurrentlyActive ? -1 : 1;

    if (isCurrentlyActive) {
      newActive.delete(type);
    } else {
      newActive.add(type);
    }
    const nextCounts = {
      ...reactions,
      [type]: Math.max(0, (reactions[type] || 0) + delta),
    };
    let previous;
    try {
      previous = localStorage.getItem(reactStateKey);
      localStorage.setItem(reactStateKey, JSON.stringify({ active: Array.from(newActive), counts: nextCounts }));
    } catch {
      onToast("반응을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
      return;
    }
    setReacting(true);
    try {
      const response = await fetch("/api/reactions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId, year: item.year, type, delta }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error();
      const counts = { ...nextCounts, ...result.counts };
      setUserActiveReactions(newActive);
      setReactions(counts);
      onCommunityUpdate?.({ reactions: counts });
      try { localStorage.setItem(reactStateKey, JSON.stringify({ active: Array.from(newActive), counts })); } catch {}
    } catch {
      try { if (previous === null) localStorage.removeItem(reactStateKey); else localStorage.setItem(reactStateKey, previous); } catch {}
      onToast("반응을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally { setReacting(false); }
  };

  // 댓글 등록 (로컬 즉시 반영 + D1 비동기 저장)
  const submitComment = async (e) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;

    setSubmitting(true);
    const finalAuthor = author.trim() || "익명의 시간여행자";
    try {
      localStorage.setItem("chueok_nickname", finalAuthor);
    } catch {}

    try {
      const response = await fetch("/api/comments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId, year: item.year, content, author: finalAuthor }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.comment?.id) throw new Error();
      setComments((prev) => [result.comment, ...prev.filter((c) => c.id !== result.comment.id)]);
      onCommunityUpdate?.({ comment: result.comment });
      setNewComment("");
      onToast("추억 이야기를 남겼어요!");
    } catch {
      onToast("이야기를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="card-community" onClick={(e) => e.stopPropagation()}>
      <div className="reaction-bar" aria-label="추억 공감 반응">
        <button type="button" className={`react-chip like-button ${userActiveReactions.has("like") ? "active" : ""}`} onClick={() => toggleReaction("like")} aria-pressed={userActiveReactions.has("like")} aria-label={`좋아요 ${reactions.like || 0}개`}>
          <span aria-hidden="true">{userActiveReactions.has("like") ? "♥" : "♡"}</span> 좋아요 {reactions.like > 0 && <span className="react-count">{reactions.like}</span>}
        </button>
        {REACTION_CONFIG.filter(({ key }) => reactions[key] > 0 || userActiveReactions.has(key)).map(({ key, label, emoji }) => {
          const count = reactions[key] || 0;
          const isActive = userActiveReactions.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`react-chip ${isActive ? "active" : ""}`}
              onClick={() => toggleReaction(key)}
              title={label}
              aria-pressed={isActive}
            >
              <span className="react-emoji">{emoji}</span>
              <span className="sr-only">{label}</span>
              {count > 0 && <span className="react-count">{count}</span>}
            </button>
          );
        })}
        <div className="reaction-picker-wrap" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpenReactions(false); }} onKeyDown={(e) => { if (e.key === "Escape") { setOpenReactions(false); e.currentTarget.querySelector(".reaction-picker-toggle")?.focus(); e.stopPropagation(); } }}>
          <button type="button" className="reaction-picker-toggle" aria-label="이모지 반응 추가" aria-expanded={openReactions} onClick={() => setOpenReactions((v) => !v)}>☺<span aria-hidden="true">＋</span></button>
          {openReactions && <div className="reaction-picker" role="group" aria-label="이모지 반응 선택">
            {REACTION_CONFIG.map(({ key, label, emoji }) => <button key={key} type="button" className={userActiveReactions.has(key) ? "selected" : ""} aria-label={label} aria-pressed={userActiveReactions.has(key)} title={label} onClick={(e) => { e.currentTarget.closest(".reaction-picker-wrap").querySelector(".reaction-picker-toggle").focus(); toggleReaction(key); setOpenReactions(false); }}>{emoji}</button>)}
          </div>}
        </div>
        <button
          type="button"
          className={`comment-toggle-btn ${openComments ? "open" : ""}`}
          onClick={() => setOpenComments((v) => !v)}
          aria-expanded={openComments}
        >
          💬 이야기 {comments.length > 0 ? `(${comments.length})` : ""}
        </button>
      </div>

      {/* 댓글 및 추억 이야기 펼침 영역 */}
      {openComments && (
        <div className="comments-section" aria-live="polite">
          <form className="comment-form" onSubmit={submitComment}>
            <div className="comment-input-row">
              <input
                type="text"
                className="comment-author-input"
                placeholder="닉네임(선택)"
                maxLength={15}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                aria-label="작성자 닉네임"
              />
              <span className="comment-tip">그 시절의 기억을 나눠주세요</span>
            </div>
            <div className="comment-text-row">
              <textarea
                className="comment-textarea"
                rows={2}
                maxLength={400}
                placeholder="이거 기억나시나요? 그때 우리 동네에서는..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                aria-label="추억 이야기 내용"
              />
              <button className="primary comment-submit-btn" type="submit" disabled={submitting || !newComment.trim()}>
                등록
              </button>
            </div>
          </form>

          <div className="comments-list">
            {comments.length === 0 ? (
              <div className="comments-empty">아직 남겨진 이야기가 없어요. 첫 번째 추억을 들려주세요! ✍️</div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="comment-bubble">
                  <div className="comment-meta">
                    <span className="comment-author">{c.author || "익명의 시간여행자"}</span>
                    <span className="comment-time">{new Date(c.at).toLocaleDateString("ko-KR")}</span>
                  </div>
                  <p className="comment-content">{c.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
