export default function ShareButtons({ share, onInstagram, onToast }) {
  async function shareToKakao() {
    const it = share.item || {};
    const title = it.title || share.title || "그 시절 추억";
    const yearStr = it.year ? `${it.year}년 ` : "";
    const hookText = `야 너 이거 기억나? ㅋㅋㅋ ${yearStr}[${title}] 추억 소환!`;
    const summary = it.summary || share.text || "";
    const url = share.url;
    const thumb = share.photo?.thumb || `${location.origin}/og-image.jpg`;

    // 1. Kakao SDK가 초기화되어 있는 경우
    if (typeof window !== "undefined" && window.Kakao?.isInitialized && window.Kakao.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: `[추억 소환] 야 너 이거 기억나? ㅋㅋㅋ`,
            description: `${yearStr}${title}\n${summary}`.slice(0, 100),
            imageUrl: thumb,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [
            {
              title: "그 시절 추억 보러가기 👉",
              link: { mobileWebUrl: url, webUrl: url },
            },
          ],
        });
        onToast("카카오톡으로 추억을 보냈어요!");
        return;
      } catch (e) {
        console.warn("Kakao.Share.sendDefault error:", e);
      }
    }

    // 2. 모바일 브라우저 Web Share API
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `[추억 소환] ${title}`,
          text: `${hookText}\n\n${summary}`,
          url: url,
        });
        return;
      } catch (error) {
        if (error.name !== "AbortError") {
          // 공유창 오류 시 클립보드로 폴백
        } else {
          return; // 사용자가 취소
        }
      }
    }

    // 3. 단톡방 맞춤형 클립보드 복사 폴백
    try {
      const copyPayload = `${hookText}\n\n${summary}\n\n👉 지금 바로 타임머신 타기:\n${url}`;
      await navigator.clipboard.writeText(copyPayload);
      onToast("단톡방 공유 문구와 링크를 복사했어요! 카톡에 바로 붙여넣어 보세요 💌");
    } catch {
      onToast("링크를 복사하지 못했어요. 주소창의 링크를 복사해 주세요.");
    }
  }

  return (
    <>
      <button
        className="share-btn share-icon share-icon--kakao"
        onClick={shareToKakao}
        aria-label="카카오톡으로 공유하기"
        title="카카오톡 단톡방으로 공유하기"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3C6.8 3 2.5 6.3 2.5 10.4c0 2.6 1.7 4.9 4.3 6.2l-1.1 4 4.4-2.9c.6.1 1.3.2 1.9.2 5.2 0 9.5-3.3 9.5-7.5S17.2 3 12 3Z"
          />
          <text
            x="12"
            y="12.5"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="5"
            fontWeight="800"
            fill="#fee500"
          >
            TALK
          </text>
        </svg>
      </button>
      <button
        className="insta-badge-btn share-icon share-icon--instagram"
        onClick={onInstagram}
        aria-label="인스타그램으로 공유하기"
        title="인스타그램 카드뉴스 만들기"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </>
  );
}
