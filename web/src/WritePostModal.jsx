import { useState } from "react";
import { checkPostSafety, BAD_WORD_MESSAGE } from "./lib/badwords.js";

const CATS = ["사건·생활상", "먹거리", "놀이·문구", "음악", "TV·영화", "가전·기술", "패션", "유행어·풍속"];

export default function WritePostModal({ defaultYear, onClose, onToast, onPostCreated }) {
  const [year, setYear] = useState(defaultYear || 1997);
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("사건·생활상");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
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
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const finalAuthor = author.trim() || "익명의 시간여행자";

    if (!cleanTitle) {
      onToast("사연 제목을 입력해 주세요.");
      return;
    }
    if (!cleanContent) {
      onToast("사연 내용을 적어 주세요.");
      return;
    }
    if (!password || password.length !== 4) {
      onToast("삭제 시 사용할 4자리 숫자 비밀번호를 입력해 주세요.");
      return;
    }

    // 클라이언트단 1차 비속어 & 스팸 실시간 필터링
    const safety = checkPostSafety({
      title: cleanTitle,
      content: cleanContent,
      author: finalAuthor,
    });
    if (!safety.safe) {
      onToast(BAD_WORD_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      localStorage.setItem("chueok_nickname", finalAuthor);
    } catch {}

    const payload = {
      year: Number(year),
      month: month ? Number(month) : null,
      category,
      title: cleanTitle,
      content: cleanContent,
      author: finalAuthor,
      password: password.trim(),
    };

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.post?.id) {
        throw new Error(result?.error || "사연을 저장하지 못했습니다.");
      }

      // 로컬 스토리지에 즉시 보존
      try {
        const saved = JSON.parse(localStorage.getItem("chueok_user_posts") || "[]");
        localStorage.setItem(
          "chueok_user_posts",
          JSON.stringify([result.post, ...saved.filter((p) => p.id !== result.post.id)])
        );
      } catch {}

      onPostCreated?.(result.post);
      onToast("소중한 추억 사연을 남겨주셔서 고맙습니다!");
      onClose();
    } catch (err) {
      onToast(err.message || "사연을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="추억 사연 남기기" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="box post-form-box" onSubmit={handleSubmit}>
        <h3>✏️ 나의 추억 사연 남기기</h3>
        <p className="note">내가 겪었던 그 시절 물건, 유행, 동네 이야기를 들려주세요.</p>

        {/* 💡 안심 정책 배너 */}
        <div className="post-safety-notice">
          💡 <strong>안심 정책:</strong> 등록된 사연은 건전한 추억 나눔을 위해 실시간 자동 필터링을 거치며, 부적절한 게시물은 즉시 차단·삭제 조치됩니다.
        </div>

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
          <div className="form-group full">
            <label>비밀번호 (수정·삭제용 4자리 숫자)</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="4자리 숫자 (수정·삭제용)"
              maxLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ""))}
              required
            />
          </div>
        </div>

        <div className="form-group full" style={{ marginTop: "10px" }}>
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
