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
  const reactCountsKey = `react_counts_${targetId}`;
  const reactStateKey = `react_state_${targetId}`;
  const cmtLocalKey = `cmt_local_${targetId}`;

  // 반응 및 댓글 불러오기 (순수 클라이언트 로컬 스토리지 — KV/서버 호출 0)
  useEffect(() => {
    try {
      const savedState = JSON.parse(localStorage.getItem(reactStateKey) || "null");
      const savedUserReactions = savedState?.active ?? JSON.parse(localStorage.getItem(reactLocalKey) || "[]");
      setUserActiveReactions(new Set(savedUserReactions));
      const savedCounts = savedState?.counts ?? JSON.parse(localStorage.getItem(reactCountsKey) || '{"ah":0,"kkk":0,"weep":0,"b486":0,"b8282":0,"like":0}');
      setReactions(savedCounts);
      const savedComments = JSON.parse(localStorage.getItem(cmtLocalKey) || "[]");
      setComments(savedComments);
    } catch {}
  }, [targetId]);

  // 공감 반응 토글 (로컬 즉시 저장)
  const toggleReaction = (type) => {
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
    try {
      localStorage.setItem(reactStateKey, JSON.stringify({ active: Array.from(newActive), counts: nextCounts }));
      setUserActiveReactions(newActive);
      setReactions(nextCounts);
    } catch {
      onToast("반응을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
    }
  };

  // 댓글 등록 (로컬 즉시 저장)
  const submitComment = (e) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;

    setSubmitting(true);
    const finalAuthor = author.trim() || "익명의 시간여행자";
    try {
      localStorage.setItem("chueok_nickname", finalAuthor);
    } catch {}

    const newObj = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetId,
      author: finalAuthor,
      content,
      at: new Date().toISOString(),
    };

    let nextCmts;
    try {
      const savedComments = JSON.parse(localStorage.getItem(cmtLocalKey) || "[]");
      if (!Array.isArray(savedComments)) throw new Error("Invalid saved comments");
      nextCmts = [newObj, ...savedComments];
      localStorage.setItem(cmtLocalKey, JSON.stringify(nextCmts));
    } catch {
      onToast("이야기를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
      setSubmitting(false);
      return;
    }
    setComments(nextCmts);
    setNewComment("");

    onToast("추억 이야기를 남겼어요!");
    setSubmitting(false);
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
