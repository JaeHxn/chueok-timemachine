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
    <button className="share-btn" onClick={shareToKakao}>💬 카카오톡 공유</button>
    <button className="insta-badge-btn" onClick={onInstagram}>📸 인스타그램 공유</button>
  </>;
}
