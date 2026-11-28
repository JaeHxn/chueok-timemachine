import { useEffect, useRef, useState } from "react";

export default function InstagramCardModal({ item, photo, onClose, onToast }) {
  const canvasRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [dataUrl, setDataUrl] = useState("");

  const eraColor = "#d4a62a"; // 기본 골드 톤

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 1080;
    const H = 1080;

    // 1. 배경 (빈티지 다크 코스믹 그라디언트)
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(0, 0, W, H);

    // 은은한 외곽 골드 프레임 테두리
    ctx.strokeStyle = "#231d18";
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, W - 72, H - 72);


    // 2. 상단 헤더
    ctx.textAlign = "center";
    ctx.fillStyle = "#231d18";
    ctx.font = "bold 34px 'Noto Serif KR', serif";
    ctx.fillText("추억 타임머신", W / 2, 120);


    // 시대 & 카테고리 태그 칩
    const tagText = `${item.year}년 ${item.month ? item.month + "월" : ""}  ·  ${item.cat}`;
    ctx.fillStyle = "#fbf8f2";
    ctx.strokeStyle = "#9a3b26";
    ctx.lineWidth = 2;
    const tagWidth = 360;
    const tagHeight = 44;
    const tagX = (W - tagWidth) / 2;
    const tagY = 165;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#9a3b26";
    ctx.font = "bold 22px Pretendard, sans-serif";
    ctx.fillText(tagText, W / 2, tagY + 30);

    // 3. 사진 또는 레트로 심볼 박스
    const renderContent = (img = null) => {
      const boxY = 240;
      const boxH = 460;
      const boxW = 860;
      const boxX = (W - boxW) / 2;

      if (img) {
        // 폴라로이드 스타일 프레임
        ctx.fillStyle = "#fbf8f2";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = "rgba(35, 29, 24, 0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // 이미지 그리기 (비율 유지 클리핑)
        const pad = 20;
        const imgX = boxX + pad;
        const imgY = boxY + pad;
        const imgW = boxW - pad * 2;
        const imgH = boxH - pad * 2 - 20;

        ctx.save();
        ctx.beginPath();
        ctx.rect(imgX, imgY, imgW, imgH);
        ctx.clip();

        const aspect = img.width / img.height;
        const targetAspect = imgW / imgH;
        let sW, sH, sX, sY;
        if (aspect > targetAspect) {
          sH = img.height;
          sW = img.height * targetAspect;
          sX = (img.width - sW) / 2;
          sY = 0;
        } else {
          sW = img.width;
          sH = img.width / targetAspect;
          sX = 0;
          sY = (img.height - sH) / 2;
        }
        ctx.drawImage(img, sX, sY, sW, sH, imgX, imgY, imgW, imgH);
        ctx.restore();

        // 폴라로이드 하단 캡션
        ctx.fillStyle = "#6e6157";
        ctx.font = "16px Pretendard, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`photo: ${photo.artist || "자유 라이선스 사료"}`, boxX + boxW - 24, boxY + boxH - 10);
      } else {
        // 사진이 없을 때: 레트로 엠블럼 박스
        ctx.fillStyle = "#fbf8f2";
        ctx.strokeStyle = "rgba(35, 29, 24, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(154, 59, 38, 0.35)";
        ctx.font = "bold 140px 'Noto Serif KR', serif";
        ctx.textAlign = "center";
        ctx.fillText(String(item.year), W / 2, boxY + 240);

        ctx.fillStyle = "#231d18";
        ctx.font = "bold 36px 'Noto Serif KR', serif";
        ctx.fillText(`${item.year}년의 기록`, W / 2, boxY + 310);

        ctx.fillStyle = "#6e6157";
        ctx.font = "22px Pretendard, sans-serif";
        ctx.fillText(`“${item.title}”의 기억`, W / 2, boxY + 360);
      }

      // 4. 제목 (Title)
      ctx.textAlign = "center";
      ctx.fillStyle = "#231d18";
      ctx.font = "bold 48px 'Noto Serif KR', serif";
      ctx.fillText(item.title, W / 2, 770);

      // 5. 요약 문구 (Summary 워드랩)
      ctx.fillStyle = "#3a312a";
      ctx.font = "26px Pretendard, sans-serif";
      const summaryText = item.summary || `${item.year}년 대한민국을 뜨겁게 달군 그 시절 추억 이야기.`;

      // 텍스트 줄바꿈 계산 (최대 3줄)
      const maxTextW = 860;
      const words = summaryText.split("");
      let line = "";
      const lines = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextW && n > 0) {
          lines.push(line);
          line = words[n];
          if (lines.length === 3) {
            lines[2] = lines[2].slice(0, -2) + "…";
            break;
          }
        } else {
          line = testLine;
        }
      }
      if (lines.length < 3 && line) lines.push(line);

      let textY = 830;
      lines.forEach((l) => {
        ctx.fillText(l, W / 2, textY);
        textY += 38;
      });

      // 6. 하단 푸터 및 워터마크
      ctx.fillStyle = "#9a3b26";
      ctx.font = "bold 20px Pretendard, sans-serif";
      ctx.fillText("chueok-timemachine.pages.dev", W / 2, 990);

      ctx.fillStyle = "#6e6157";
      ctx.font = "18px Pretendard, sans-serif";
      ctx.fillText("그 해의 물건과 유행을 연도별로 모은 기록", W / 2, 1020);

      setDataUrl(canvas.toDataURL("image/png"));
      setRendering(false);
    };

    // 사진 이미지 로드
    if (photo?.thumb) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => renderContent(img);
      img.onerror = () => renderContent(null);
      img.src = photo.thumb;
    } else {
      renderContent(null);
    }
  }, [item, photo]);

  const downloadImage = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `추억타임머신_${item.year}_${item.title.replace(/[\s/\\:]/g, "_")}.png`;
    a.click();
    onToast("카드 이미지를 저장했어요.");
  };

  const shareImage = async () => {
    if (!dataUrl) return;
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (char) => char.charCodeAt(0));
    const file = new File([bytes], "추억타임머신.png", { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) {
      onToast("이 기기에서는 사진을 저장한 뒤 인스타그램에 올려 주세요.");
      return;
    }
    try {
      await navigator.share({ files: [file], title: item.title });
    } catch (error) {
      if (error.name !== "AbortError") onToast("공유하지 못했어요. 사진 저장을 이용해 주세요.");
    }
  };

  const copyInstaText = async () => {
    const text = `[추억 타임머신] ${item.year}년 ${item.month ? item.month + "월" : ""}의 기억\n\n${item.title}\n${item.summary}\n\n이 시절, 기억나세요?\nhttps://chueok-timemachine.pages.dev/#/${item.year}${item.month ? "/" + item.month : ""}\n\n#추억타임머신 #${item.year}년 #${item.cat} #그때그시절 #레트로`;
    try {
      await navigator.clipboard.writeText(text);
      onToast("캡션을 복사했어요.");
    } catch {
      onToast("복사하지 못했어요. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="인스타그램 카드뉴스 만들기" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box insta-modal-box">
        <div className="insta-modal-header">
          <h2>인스타그램 카드 만들기</h2>
          <p className="note">1080×1080 정사각형 이미지예요. 피드와 스토리에 그대로 올릴 수 있어요.</p>
        </div>

        <div className="canvas-wrap">
          <canvas ref={canvasRef} width="1080" height="1080" className="insta-canvas" />
        </div>

        <div className="insta-btn-row">
          <button className="primary" onClick={shareImage} disabled={rendering}>
            이미지 공유
          </button>
          <p className="note">공유 목록에서 인스타그램을 선택해 주세요. 지원하지 않는 기기는 사진을 저장할 수 있어요.</p>
          <button className="ghost" onClick={downloadImage} disabled={rendering}>
            PNG 저장
          </button>
          <button className="ghost" onClick={copyInstaText}>
            캡션 복사
          </button>
          <button className="ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
