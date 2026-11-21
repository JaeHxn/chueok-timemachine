import { useState } from "react";

const CATS = ["사건·생활상", "먹거리", "놀이·문구", "음악", "TV·영화", "가전·기술", "패션", "유행어·풍속"];

export default function WritePostModal({ defaultYear, onClose, onToast, onPostCreated }) {
  const [year, setYear] = useState(defaultYear || 1997);
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("사건·생활상");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem("chueok_nickname") || "";
    } catch {
      return "";
    }
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      onToast("제목을 입력해 주세요.");
      return;
    }
    if (!content.trim()) {
      onToast("사연 내용을 적어 주세요.");
      return;
    }

    setSubmitting(true);
    const finalAuthor = author.trim() || "익명의 시간여행자";
    try {
      localStorage.setItem("chueok_nickname", finalAuthor);
    } catch {}

    const payload = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      year: Number(year),
      month: month ? Number(month) : null,
      category,
      title: title.trim(),
      content: content.trim(),
      author: finalAuthor,
      at: new Date().toISOString(),
    };

    try {
      const saved = JSON.parse(localStorage.getItem("chueok_user_posts") || "[]");
      localStorage.setItem("chueok_user_posts", JSON.stringify([payload, ...saved]));
    } catch {
      onToast("사연을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
      setSubmitting(false);
      return;
    }

    // D1 데이터베이스로 백그라운드 전송
    fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

    onPostCreated?.(payload);
    onToast("소중한 추억 사연을 남겨주셔서 고맙습니다!");
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="추억 사연 남기기" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="box post-form-box" onSubmit={handleSubmit}>
        <h3>✏️ 나의 추억 사연 남기기</h3>
        <p className="note">내가 겪었던 그 시절 물건, 유행, 동네 이야기를 들려주세요.</p>

        <div className="form-grid">
          <div className="form-group">
            <label>연도 (1950~2026)</label>
            <input
              type="number"
              min={1950}
              max={2026}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>월 (선택)</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">연도 전체</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>분류</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>작성자 닉네임</label>
            <input
              type="text"
              placeholder="예: 90년대키즈"
              maxLength={20}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group full">
          <label>사연 제목</label>
          <input
            type="text"
            placeholder="예: 초등학교 앞 문방구에서 뽑기 하던 시절"
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group full">
          <label>추억 이야기</label>
          <textarea
            rows={5}
            maxLength={1500}
            placeholder="그때 어떤 일이 있었나요? 어떤 노래를 듣고 어떤 음식을 먹었는지 자유롭게 적어주세요."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
          <small className="char-count">{content.length}/1500자</small>
        </div>

        <div className="post-btn-row">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "등록 중..." : "추억 이야기 등록하기"}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
