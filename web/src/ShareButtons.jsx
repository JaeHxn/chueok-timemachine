export default function ShareButtons({ share, onInstagram, onToast }) {
  async function shareToKakao() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(share);
      } catch (error) {
        if (error.name !== "AbortError") onToast("공유창을 열지 못했어요. 링크 복사를 이용해 주세요.");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(share.url);
      onToast("링크를 복사했어요. 카카오톡 대화에 붙여 넣어 주세요.");
    } catch {
      onToast("링크를 복사하지 못했어요. 주소창의 링크를 복사해 주세요.");
    }
  }

  return <>
    <button className="share-btn share-icon share-icon--kakao" onClick={shareToKakao} aria-label="카카오톡으로 공유하기" title="카카오톡으로 공유하기">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.8 3 2.5 6.3 2.5 10.4c0 2.6 1.7 4.9 4.3 6.2l-1.1 4 4.4-2.9c.6.1 1.3.2 1.9.2 5.2 0 9.5-3.3 9.5-7.5S17.2 3 12 3Z"/><text x="12" y="12.5" textAnchor="middle" dominantBaseline="middle" fontSize="5" fontWeight="800" fill="#fee500">TALK</text></svg>
    </button>
    <button className="insta-badge-btn share-icon share-icon--instagram" onClick={onInstagram} aria-label="인스타그램으로 공유하기" title="인스타그램으로 공유하기">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
    </button>
  </>;
}
