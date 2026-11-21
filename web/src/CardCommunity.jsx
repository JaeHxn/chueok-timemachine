import { useEffect, useState } from "react";

const REACTION_CONFIG = [
  { key: "ah", label: "아 이거!", emoji: "😲" },
  { key: "kkk", label: "ㅋㅋㅋ", emoji: "😆" },
  { key: "weep", label: "울컥", emoji: "🥹" },
  { key: "b486", label: "486", emoji: "📟" },
  { key: "b8282", label: "8282", emoji: "🚀" },
];

export default function CardCommunity({ item, onToast }) {
  const targetId = `${item.year}_${item.title}`;
  const [openComments, setOpenComments] = useState(false);
  const [openReactions, setOpenReactions] = useState(false);
  const [reactions, setReactions] = useState({ ah: 0, kkk: 0, weep: 0, b486: 0, b8282: 0 });
  const [userActiveReactions, setUserActiveReactions] = useState(new Set());
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem("chueok_nickname") || "";
    } catch {
      return "";
    }
  });
  const [submitting, setSubmitting] = useState(false);

  // 로컬 스토리지 키
  const reactLocalKey = `react_user_${targetId}`;
  const cmtLocalKey = `cmt_local_${targetId}`;

  // 반응 및 댓글 불러오기
  useEffect(() => {
    // 1. 유저 로컬 활성 반응 복원
    try {
      const savedUserReactions = JSON.parse(localStorage.getItem(reactLocalKey) || "[]");
      setUserActiveReactions(new Set(savedUserReactions));
    } catch {}

    // 2. 반응 API 호출 (실패 시 로컬 집계)
    fetch(`/api/reactions?targetId=${encodeURIComponent(targetId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d?.counts) setReactions(d.counts);
      })
      .catch(() => {
        setReactions({ ah: 0, kkk: 0, weep: 0, b486: 0, b8282: 0 });
      });

    // 3. 댓글 API 호출
    fetch(`/api/comments?targetId=${encodeURIComponent(targetId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d?.comments)) {
          // 로컬에 추가된 댓글과 병합
          const localCmts = JSON.parse(localStorage.getItem(cmtLocalKey) || "[]");
          const map = new Map();
          [...localCmts, ...d.comments].forEach((c) => map.set(c.id, c));
          setComments(Array.from(map.values()));
        }
      })
      .catch(() => {
        const localCmts = JSON.parse(localStorage.getItem(cmtLocalKey) || "[]");
        setComments(localCmts);
      });
  }, [targetId]);

  // 공감 반응 토글
  const toggleReaction = async (type) => {
    const isCurrentlyActive = userActiveReactions.has(type);
    const newActive = new Set(userActiveReactions);
    const delta = isCurrentlyActive ? -1 : 1;

    if (isCurrentlyActive) {
      newActive.delete(type);
    } else {
      newActive.add(type);
    }
    setUserActiveReactions(newActive);
    try {
      localStorage.setItem(reactLocalKey, JSON.stringify(Array.from(newActive)));
    } catch {}

    // 낙관적 UI 업데이트
    setReactions((prev) => ({
      ...prev,
      [type]: Math.max(0, (prev[type] || 0) + delta),
    }));

    try {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId, type, delta }),
      });
    } catch {}
  };

  // 댓글 등록
  const submitComment = async (e) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;

    setSubmitting(true);
    const finalAuthor = author.trim() || "익명의 시간여행자";
    try {
      localStorage.setItem("chueok_nickname", finalAuthor);
    } catch {}

    const newObj = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetId,
      author: finalAuthor,
      content,
      at: new Date().toISOString(),
    };

    // 낙관적 UI 추가 및 로컬 보관
    setComments((prev) => [newObj, ...prev]);
    setNewComment("");
    try {
      const localCmts = JSON.parse(localStorage.getItem(cmtLocalKey) || "[]");
      localStorage.setItem(cmtLocalKey, JSON.stringify([newObj, ...localCmts]));
    } catch {}

    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId, content, author: finalAuthor }),
      });
      onToast("추억 이야기를 남겼어요!");
    } catch {
      onToast("댓글이 등록되었습니다.");
    } finally {
      setSubmitting(false);
    }
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
