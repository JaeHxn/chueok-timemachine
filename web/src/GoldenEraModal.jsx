import { useEffect, useMemo, useRef, useState } from "react";
import items from "./items.json";
import itemPhotos from "./item-photos.json";

// 세대별 칭호 및 컬러 테마 매핑
const GENERATIONS = [
  { min: 1950, max: 1959, label: "50년대", title: "전후 재건과 통기타 포크 1세대", color: "#fcd34d", badge: "통기타 낭만" },
  { min: 1960, max: 1969, label: "60년대", title: "88 서울올림픽 & 대학가요제 황금기 세대", color: "#fbbf24", badge: "호돌이 & 응답하라" },
  { min: 1970, max: 1979, label: "70년대", title: "X세대 신인류 & 세기말 사이버펑크 주역", color: "#f472b6", badge: "X세대 & 삐삐" },
  { min: 1980, max: 1989, label: "80년대", title: "밀레니엄 붉은악마 & 싸이월드 도토리 부자", color: "#fb923c", badge: "월드컵 & 도토리" },
  { min: 1990, max: 1999, label: "90년대", title: "스마트폰 혁명 & K-POP 2세대 감성 리더", color: "#38bdf8", badge: "스마트 혁명 & MP3" },
  { min: 2000, max: 2015, label: "00년대+", title: "알고리즘 숏폼 & 레트로 뉴트로 탐험가", color: "#c084fc", badge: "숏폼 & 뉴트로" },
];

function getGeneration(birthYear) {
  const y = Number(birthYear);
  return (
    GENERATIONS.find((g) => y >= g.min && y <= g.max) || {
      title: "시대를 초월한 시간 여행자",
      color: "#fbbf24",
      badge: "타임 트래블러",
    }
  );
}

// 연도별 아이템 사전 인덱싱
const BY_YEAR = items.reduce((acc, it) => {
  (acc[it.year] ||= []).push(it);
  return acc;
}, {});

function getItemsForYear(targetYear) {
  if (BY_YEAR[targetYear]?.length) return BY_YEAR[targetYear];
  // 해당 연도 아이템이 없으면 주변 연도 탐색
  for (let offset = 1; offset <= 3; offset++) {
    if (BY_YEAR[targetYear - offset]?.length) return BY_YEAR[targetYear - offset];
    if (BY_YEAR[targetYear + offset]?.length) return BY_YEAR[targetYear + offset];
  }
  return [];
}

// 특정 연도와 선호 카테고리에서 가장 상징적인 킬러 아이템 추출
function pickKillerItem(targetYear, preferredCats = []) {
  const list = getItemsForYear(targetYear);
  if (!list || list.length === 0) {
    return {
      year: targetYear,
      title: `${targetYear}년의 찬란한 순간`,
      cat: "추억",
      summary: `${targetYear}년 대한민국의 거리를 물들였던 그때 그 시절의 따뜻한 기억들.`,
    };
  }

  // 1순위: 선호 카테고리 중 사진이 등록된 아이템
  for (const cat of preferredCats) {
    const item = list.find((it) => it.cat === cat && itemPhotos[`${it.year}|${it.title}`]);
    if (item) return item;
  }

  // 2순위: 선호 카테고리 아이템
  for (const cat of preferredCats) {
    const item = list.find((it) => it.cat === cat);
    if (item) return item;
  }

  // 3순위: 전체 중 사진이 있는 아이템
  const photoItem = list.find((it) => itemPhotos[`${it.year}|${it.title}`]);
  if (photoItem) return photoItem;

  // 4순위: 첫 번째 대표 아이템
  return list[0];
}

export default function GoldenEraModal({ onClose, onToast, onSelectYear }) {
  const [step, setStep] = useState(1); // 1: 입력, 2: 리포트 결과
  const [inputYear, setInputYear] = useState("1988");
  const [birthYear, setBirthYear] = useState(1988);
  const [activeStage, setActiveStage] = useState(0); // 0: 초등, 1: 중고등, 2: 20대 청춘
  const [canvasDataUrl, setCanvasDataUrl] = useState("");
  const [isRendering, setIsRendering] = useState(false);

  const canvasRef = useRef(null);

  // 3대 인생 전환기 계산
  const eraReport = useMemo(() => {
    const y = Number(birthYear) || 1988;
    const currentYear = 2026;

    // 1) 초등학교 시절 (출생 + 11년, 만 11세 전후)
    const elemYear = Math.min(currentYear, y + 11);
    const elemItem = pickKillerItem(elemYear, ["놀이·문구", "먹거리", "TV·영화", "음악"]);
    const elemPhoto = itemPhotos[`${elemItem.year}|${elemItem.title}`] || null;

    // 2) 중·고등학교 시절 (출생 + 16년, 만 16세 전후)
    const midYear = Math.min(currentYear, y + 16);
    const midItem = pickKillerItem(midYear, ["음악", "패션", "TV·영화", "놀이·문구"]);
    const midPhoto = itemPhotos[`${midItem.year}|${midItem.title}`] || null;

    // 3) 청춘 & 20대 시절 (출생 + 22년, 만 21~22세 청춘)
    const youthYear = Math.min(currentYear, y + 22);
    const youthItem = pickKillerItem(youthYear, ["가전·기술", "사건·생활상", "유행어·풍속", "음악", "패션"]);
    const youthPhoto = itemPhotos[`${youthItem.year}|${youthItem.title}`] || null;

    const gen = getGeneration(y);

    return {
      birthYear: y,
      generation: gen,
      stages: [
        {
          id: "elem",
          title: "🎈 초등학교 시절",
          sub: "골목길 놀이 & 문방구 보물",
          targetYear: elemYear,
          ageDesc: "약 11~12세",
          item: elemItem,
          photo: elemPhoto,
          themeColor: "#fbbf24",
        },
        {
          id: "mid",
          title: "📼 중·고등학교 시절",
          sub: "이어폰 너머 감성 가요 & 드라마",
          targetYear: midYear,
          ageDesc: "약 16~17세",
          item: midItem,
          photo: midPhoto,
          themeColor: "#f472b6",
        },
        {
          id: "youth",
          title: "🚀 청춘 & 20대 시절",
          sub: "세상을 흔든 트렌드 & 열정",
          targetYear: youthYear,
          ageDesc: "약 21~23세",
          item: youthItem,
          photo: youthPhoto,
          themeColor: "#60a5fa",
        },
      ],
    };
  }, [birthYear]);

  // 빠른 선택 칩 클릭
  const handleQuickChip = (year) => {
    setInputYear(String(year));
  };

  // 분석 시작
  const handleStartAnalysis = (e) => {
    e?.preventDefault();
    const y = parseInt(inputYear, 10);
    if (isNaN(y) || y < 1950 || y > 2015) {
      onToast("1950년부터 2015년 사이의 출생연도를 입력해 주세요!");
      return;
    }
    setBirthYear(y);
    setStep(2);
  };

  // 9:16 인스타 스토리용 캔버스 렌더링 (1080 x 1920)
  useEffect(() => {
    if (step !== 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRendering(true);
    const ctx = canvas.getContext("2d");
    const W = 1080;
    const H = 1920;

    // 이미지 로더 헬퍼
    const loadImage = (url) => {
      return new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    };

    // 3개 시절의 이미지 병렬 로드
    Promise.all([
      loadImage(eraReport.stages[0].photo?.thumb),
      loadImage(eraReport.stages[1].photo?.thumb),
      loadImage(eraReport.stages[2].photo?.thumb),
    ]).then(([imgElem, imgMid, imgYouth]) => {
      const stageImgs = [imgElem, imgMid, imgYouth];

      // 1. 전체 배경 (빈티지 딥 코스믹 그라디언트)
      const bgGrad = ctx.createRadialGradient(W / 2, H * 0.35, 100, W / 2, H * 0.5, W * 0.95);
      bgGrad.addColorStop(0, "#192238");
      bgGrad.addColorStop(0.5, "#0d1322");
      bgGrad.addColorStop(1, "#060911");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. 골드 & 네온 장식 테두리 (인스타 스토리 세이프존 가이드 반영)
      ctx.strokeStyle = "rgba(251, 191, 36, 0.65)";
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 60, W - 80, H - 120);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(54, 74, W - 108, H - 148);

      // 코너 장식 아치 포인트
      const drawCorner = (cx, cy) => {
        ctx.strokeStyle = "#fde047";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.stroke();
      };
      drawCorner(60, 80);
      drawCorner(W - 60, 80);
      drawCorner(60, H - 80);
      drawCorner(W - 60, H - 80);

      // 3. 상단 헤더
      ctx.textAlign = "center";
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 34px Pretendard, -apple-system, sans-serif";
      ctx.fillText("🪐  추 억  타 임 머 신  공 식  인 증 서", W / 2, 140);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 20px 'Space Grotesk', Pretendard, sans-serif";
      ctx.fillText("LIFE GOLDEN ERA CERTIFICATE", W / 2, 175);

      // 출생연도 & 칭호 메인 타이틀 박스
      const titleBoxY = 210;
      const titleBoxW = 920;
      const titleBoxH = 150;
      const titleBoxX = (W - titleBoxW) / 2;

      ctx.fillStyle = "rgba(251, 191, 36, 0.12)";
      ctx.strokeStyle = "rgba(251, 191, 36, 0.65)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(titleBoxX, titleBoxY, titleBoxW, titleBoxH, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px Pretendard, -apple-system, sans-serif";
      ctx.fillText(`${eraReport.birthYear}년생의 인생 황금기 리포트`, W / 2, titleBoxY + 60);

      ctx.fillStyle = eraReport.generation.color || "#fde047";
      ctx.font = "bold 36px Pretendard, -apple-system, sans-serif";
      ctx.fillText(`“${eraReport.generation.title}”`, W / 2, titleBoxY + 116);

      // 4. 3대 황금기 시절 카드 3개 세로 렌더링
      const cardStartY = 395;
      const cardHeight = 370;
      const cardGap = 30;
      const cardWidth = 920;
      const cardX = (W - cardWidth) / 2;

      eraReport.stages.forEach((stage, idx) => {
        const curY = cardStartY + idx * (cardHeight + cardGap);
        const img = stageImgs[idx];

        // 개별 카드 배경
        ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cardX, curY, cardWidth, cardHeight, 22);
        ctx.fill();
        ctx.stroke();

        // 좌측 색상 액센트 바
        ctx.fillStyle = stage.themeColor;
        ctx.beginPath();
        ctx.roundRect(cardX, curY, 10, cardHeight, [22, 0, 0, 22]);
        ctx.fill();

        // 상단 스테이지 뱃지 및 연도 정보
        ctx.textAlign = "left";
        ctx.fillStyle = stage.themeColor;
        ctx.font = "bold 28px Pretendard, -apple-system, sans-serif";
        ctx.fillText(`${stage.title} (${stage.ageDesc})`, cardX + 34, curY + 50);

        // 연도 뱃지
        const yearBadgeText = `${stage.targetYear}년 무렵`;
        ctx.font = "bold 22px 'Space Grotesk', Pretendard, sans-serif";
        const yrW = ctx.measureText(yearBadgeText).width + 32;
        const yrH = 36;
        const yrX = cardX + cardWidth - yrW - 28;
        const yrY = curY + 23;

        ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
        ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(yrX, yrY, yrW, yrH, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fde047";
        ctx.textAlign = "center";
        ctx.fillText(yearBadgeText, yrX + yrW / 2, yrY + 26);

        // 카드 내부 컨텐츠 분기 (사진 유무)
        const contentY = curY + 70;
        const imgBoxSize = 250;
        const imgBoxX = cardX + 30;
        const imgBoxY = contentY + 15;

        if (img) {
          // 사진 렌더링 (둥근 사각형 클리핑)
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(imgBoxX, imgBoxY, imgBoxSize, imgBoxSize, 18);
          ctx.clip();

          const aspect = img.width / img.height;
          const targetAspect = 1;
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
          ctx.drawImage(img, sX, sY, sW, sH, imgBoxX, imgBoxY, imgBoxSize, imgBoxSize);
          ctx.restore();

          // 사진 테두리
          ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(imgBoxX, imgBoxY, imgBoxSize, imgBoxSize, 18);
          ctx.stroke();

          // 텍스트 영역 (우측)
          const textLeft = imgBoxX + imgBoxSize + 30;
          const maxTextW = cardWidth - (imgBoxSize + 90);

          ctx.textAlign = "left";
          // 카테고리 태그
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 22px Pretendard, -apple-system, sans-serif";
          ctx.fillText(`[${stage.item.cat || "추억"}]`, textLeft, imgBoxY + 36);

          // 아이템 제목
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 38px Pretendard, -apple-system, sans-serif";
          const title = stage.item.title || "";
          ctx.fillText(title.length > 14 ? title.slice(0, 13) + "…" : title, textLeft, imgBoxY + 82);

          // 요약문 (2~3줄 랩핑)
          ctx.fillStyle = "#f8fafc";
          ctx.font = "500 24px Pretendard, -apple-system, sans-serif";
          const summary = stage.item.summary || stage.sub;
          const words = summary.split("");
          let line = "";
          let lineCount = 0;
          let curLineY = imgBoxY + 132;

          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTextW && n > 0) {
              ctx.fillText(line, textLeft, curLineY);
              line = words[n];
              curLineY += 36;
              lineCount++;
              if (lineCount >= 3) {
                line = line.slice(0, -2) + "…";
                break;
              }
            } else {
              line = testLine;
            }
          }
          if (line && lineCount < 4) {
            ctx.fillText(line, textLeft, curLineY);
          }
        } else {
          // 사진이 없는 경우: 엠블럼 + 와이드 텍스트 레이아웃
          const emblemW = 160;
          const emblemH = 220;
          const emblemX = cardX + 30;
          const emblemY = contentY + 25;

          ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
          ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(emblemX, emblemY, emblemW, emblemH, 18);
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = "center";
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 58px 'Space Grotesk', sans-serif";
          ctx.fillText(String(stage.targetYear), emblemX + emblemW / 2, emblemY + 95);

          ctx.fillStyle = "#f8fafc";
          ctx.font = "bold 22px Pretendard, -apple-system, sans-serif";
          ctx.fillText("MEMORY", emblemX + emblemW / 2, emblemY + 140);

          // 텍스트 영역
          const textLeft = emblemX + emblemW + 30;
          const maxTextW = cardWidth - (emblemW + 90);

          ctx.textAlign = "left";
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 22px Pretendard, -apple-system, sans-serif";
          ctx.fillText(`[${stage.item.cat || "추억"}]`, textLeft, emblemY + 36);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 40px Pretendard, -apple-system, sans-serif";
          const title = stage.item.title || "";
          ctx.fillText(title.length > 15 ? title.slice(0, 14) + "…" : title, textLeft, emblemY + 84);

          ctx.fillStyle = "#f8fafc";
          ctx.font = "500 25px Pretendard, -apple-system, sans-serif";
          const summary = stage.item.summary || stage.sub;
          const words = summary.split("");
          let line = "";
          let lineCount = 0;
          let curLineY = emblemY + 134;

          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTextW && n > 0) {
              ctx.fillText(line, textLeft, curLineY);
              line = words[n];
              curLineY += 38;
              lineCount++;
              if (lineCount >= 3) {
                line = line.slice(0, -2) + "…";
                break;
              }
            } else {
              line = testLine;
            }
          }
          if (line && lineCount < 4) {
            ctx.fillText(line, textLeft, curLineY);
          }
        }
      });

      // 5. 하단 엠블럼 & 도장(Seal) & 워터마크
      const sealY = H - 220;
      ctx.textAlign = "center";

      // 황금 도장 테두리 원
      ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(W / 2, sealY, 46, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#fde047";
      ctx.font = "bold 28px Pretendard, sans-serif";
      ctx.fillText("公 認", W / 2, sealY + 10);

      // 하단 텍스트
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 28px 'Space Grotesk', Pretendard, sans-serif";
      ctx.fillText("🪐  chueok-timemachine.pages.dev", W / 2, H - 130);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 22px Pretendard, -apple-system, sans-serif";
      ctx.fillText("1,000만 국민과 함께 타는 대한민국 추억 타임머신", W / 2, H - 95);

      const url = canvas.toDataURL("image/png");
      setCanvasDataUrl(url);
      setIsRendering(false);
    });
  }, [step, eraReport]);

  // 이미지 저장 다운로드 핸들러
  const handleDownloadCertificate = () => {
    if (!canvasDataUrl) return;
    const a = document.createElement("a");
    a.href = canvasDataUrl;
    a.download = `추억타임머신_황금기인증서_${birthYear}년생.png`;
    a.click();
    onToast?.("9:16 인스타 스토리용 인증서를 다운로드했어요! 📸");
  };

  // 인스타 스토리 직접 공유 (Web Share API 지원 기기)
  const handleShareStory = async () => {
    if (!canvasDataUrl) return;
    try {
      const bytes = Uint8Array.from(atob(canvasDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const file = new File([bytes], `추억타임머신_${birthYear}년생_황금기인증서.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `[추억 타임머신] ${birthYear}년생 황금기 인증서`,
          text: `야 내 인생 황금기 리포트 나왔는데 너도 해봐 ㅋㅋㅋ [결과: ${eraReport.generation.title}]`,
        });
        return;
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.warn("Share failed, falling back to download:", e);
      } else {
        return;
      }
    }
    // Web Share 미지원 시 다운로드로 유도
    handleDownloadCertificate();
  };

  // 카카오톡 단톡방 전파 복사 핸들러
  const handleShareKakao = async () => {
    const title = eraReport.generation.title;
    const stages = eraReport.stages;
    const siteUrl = `${window.location.origin}/#/${stages[1].targetYear}`;

    const textPayload =
      `야 내 인생 황금기 리포트 나왔는데 너도 해봐 ㅋㅋㅋ\n` +
      `[결과: ${birthYear}년생 “${title}”]\n\n` +
      `🎈 초등 시절(${stages[0].targetYear}년): ${stages[0].item.title}\n` +
      `📼 중고등 시절(${stages[1].targetYear}년): ${stages[1].item.title}\n` +
      `🚀 청춘 20대(${stages[2].targetYear}년): ${stages[2].item.title}\n\n` +
      `👉 너의 황금기도 지금 바로 확인해봐:\n${siteUrl}`;

    // 1. Kakao SDK 연동 (있는 경우)
    if (typeof window !== "undefined" && window.Kakao?.isInitialized && window.Kakao.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: `[인생 황금기 테스트] ${birthYear}년생: “${title}”`,
            description: `초등: ${stages[0].item.title} / 중고등: ${stages[1].item.title} / 20대: ${stages[2].item.title}`,
            imageUrl: stages[1].photo?.thumb || `${window.location.origin}/og-image.jpg`,
            link: { mobileWebUrl: siteUrl, webUrl: siteUrl },
          },
          buttons: [
            {
              title: "나의 황금기 테스트하기 👉",
              link: { mobileWebUrl: siteUrl, webUrl: siteUrl },
            },
          ],
        });
        onToast?.("카카오톡으로 황금기 리포트를 전송했어요! 💌");
        return;
      } catch (err) {
        console.warn("Kakao share failed:", err);
      }
    }

    // 2. 클립보드 복사
    try {
      await navigator.clipboard.writeText(textPayload);
      onToast?.("카톡 공유 문구와 링크를 복사했어요! 단톡방에 붙여넣어 보세요 💌");
    } catch {
      onToast?.("공유 링크 복사에 실패했습니다.");
    }
  };

  // 연도 바로가기
  const handleNavigateYear = (year) => {
    if (onSelectYear) {
      onSelectYear(year);
      onClose();
    }
  };

  return (
    <div
      className="sheet golden-era-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="나의 추억 나이 & 황금기 테스트"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="box golden-era-box">
        {/* 모달 닫기 버튼 */}
        <button className="golden-modal-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        {/* ──────── 1단계: 출생연도 입력 화면 ──────── */}
        {step === 1 && (
          <div className="golden-step1">
            <div className="golden-header">
              <span className="golden-badge">✨ 바이럴 미니 퀴즈</span>
              <h2 className="golden-title">나의 추억 나이 &amp; 황금기 테스트</h2>
              <p className="golden-desc">
                몇 년도에 태어나셨나요? <br />
                당신의 인생을 뒤흔든 3대 황금기 시절과 그 시절 킬러 아이템을 소환해 드립니다!
              </p>
            </div>

            <form onSubmit={handleStartAnalysis} className="golden-form">
              <div className="golden-input-wrap">
                <input
                  type="number"
                  min="1950"
                  max="2015"
                  value={inputYear}
                  onChange={(e) => setInputYear(e.target.value)}
                  placeholder="예: 1988"
                  className="golden-year-input"
                  autoFocus
                />
                <span className="golden-input-suffix">년생</span>
              </div>

              {/* 연대별 빠른 선택 칩 */}
              <div className="golden-quick-chips">
                <span className="chips-label">빠른 선택:</span>
                {GENERATIONS.map((gen) => {
                  const sampleYear = gen.min + 5;
                  const isSelected = parseInt(inputYear, 10) >= gen.min && parseInt(inputYear, 10) <= gen.max;
                  return (
                    <button
                      key={gen.label}
                      type="button"
                      className={`quick-chip ${isSelected ? "active" : ""}`}
                      onClick={() => handleQuickChip(sampleYear)}
                      title={`${gen.min}~${gen.max}년`}
                    >
                      {gen.label}
                    </button>
                  );
                })}
              </div>

              <button type="submit" className="golden-submit-btn">
                나의 황금기 탐험 시작 🚀
              </button>
            </form>

            <div className="golden-feature-points">
              <div className="point-item">
                <span className="point-icon">🎈</span>
                <div>
                  <strong>초등학교 시절</strong>
                  <p>골목길 놀이 &amp; 문방구 과자</p>
                </div>
              </div>
              <div className="point-item">
                <span className="point-icon">📼</span>
                <div>
                  <strong>중고등학교 시절</strong>
                  <p>감성 가요 &amp; 유행 드라마</p>
                </div>
              </div>
              <div className="point-item">
                <span className="point-icon">🚀</span>
                <div>
                  <strong>청춘 20대 시절</strong>
                  <p>사회를 뒤흔든 히트 트렌드</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────── 2단계: 황금기 분석 리포트 카드 화면 ──────── */}
        {step === 2 && (
          <div className="golden-step2">
            <div className="golden-report-header">
              <div className="report-badge-row">
                <span className="report-gen-tag" style={{ borderColor: eraReport.generation.color }}>
                  {eraReport.birthYear}년생
                </span>
                <span className="report-badge-pill">{eraReport.generation.badge}</span>
              </div>
              <h2 className="report-gen-title">“{eraReport.generation.title}”</h2>
              <p className="report-sub">당신의 가슴을 가장 뜨겁게 만들었던 3대 인생 전환기 리포트입니다.</p>
            </div>

            {/* 3대 시절 선택 탭 버튼 */}
            <div className="stage-tab-row">
              {eraReport.stages.map((stg, i) => (
                <button
                  key={stg.id}
                  className={`stage-tab-btn ${activeStage === i ? "active" : ""}`}
                  style={{ "--theme-color": stg.themeColor }}
                  onClick={() => setActiveStage(i)}
                >
                  <span className="tab-title">{stg.title.split(" ")[0]}</span>
                  <span className="tab-year">{stg.targetYear}년</span>
                </button>
              ))}
            </div>

            {/* 활성화된 시절 상세 리포트 카드 */}
            {(() => {
              const currentStage = eraReport.stages[activeStage];
              return (
                <div className="active-stage-card" style={{ borderColor: currentStage.themeColor }}>
                  <div className="stage-card-head">
                    <div>
                      <span className="stage-age-pill" style={{ background: currentStage.themeColor }}>
                        {currentStage.ageDesc}
                      </span>
                      <h3 className="stage-name">{currentStage.title}</h3>
                      <p className="stage-subtitle">{currentStage.sub}</p>
                    </div>
                    <div className="stage-year-emblem">
                      <span className="yr-num">{currentStage.targetYear}</span>
                      <span className="yr-text">그 시절</span>
                    </div>
                  </div>

                  {/* 대표 킬러 아이템 */}
                  <div className="stage-item-box">
                    {currentStage.photo ? (
                      <div className="item-thumb-box">
                        <img src={currentStage.photo.thumb} alt={currentStage.item.title} />
                      </div>
                    ) : (
                      <div className="item-thumb-placeholder">
                        <span>🪐</span>
                        <small>{currentStage.targetYear} MEMORY</small>
                      </div>
                    )}
                    <div className="item-info">
                      <span className="item-cat-tag">#{currentStage.item.cat || "추억"}</span>
                      <h4 className="item-title">{currentStage.item.title}</h4>
                      <p className="item-desc">{currentStage.item.summary || "그 시절 대한민국을 사로잡았던 전설적인 추억의 아이템."}</p>
                    </div>
                  </div>

                  {/* 해당 연도로 즉시 시간여행 바로가기 */}
                  <button
                    className="teleport-btn"
                    onClick={() => handleNavigateYear(currentStage.targetYear)}
                    title={`${currentStage.targetYear}년 전체 추억 아카이브로 이동`}
                  >
                    <span>🧭</span> {currentStage.targetYear}년 타임머신 탑승하기
                  </button>
                </div>
              );
            })()}

            {/* 숨겨진 1080x1920 캔버스 (인스타 스토리용) */}
            <div className="canvas-container-preview">
              <div className="canvas-preview-header">
                <span>📸 9:16 인스타그램 스토리 공식 인증서</span>
                <span className="preview-size">1080 × 1920 HD</span>
              </div>
              <div className="canvas-wrapper">
                <canvas
                  ref={canvasRef}
                  width="1080"
                  height="1920"
                  className="story-cert-canvas"
                  style={{
                    width: "100%",
                    maxWidth: "240px",
                    height: "auto",
                    aspectRatio: "9/16",
                    borderRadius: "14px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                />
              </div>
            </div>

            {/* 액션 버튼 그룹 */}
            <div className="golden-action-group">
              <div className="action-row-primary">
                <button
                  className="action-btn action-insta"
                  onClick={handleShareStory}
                  disabled={isRendering}
                  title="9:16 인스타 스토리 인증서 다운로드 및 공유"
                >
                  📸 인스타 스토리 인증서 받기
                </button>
                <button
                  className="action-btn action-kakao"
                  onClick={handleShareKakao}
                  title="카카오톡 단톡방 친구들에게 테스트 공유"
                >
                  💬 카톡 단톡방에 자랑하기
                </button>
              </div>

              <div className="action-row-secondary">
                <button className="action-btn action-download" onClick={handleDownloadCertificate} disabled={isRendering}>
                  📥 PNG 저장
                </button>
                <button className="action-btn action-retry" onClick={() => setStep(1)}>
                  🔄 다시 테스트하기
                </button>
                <button className="action-btn action-close" onClick={onClose}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 컴포넌트 전용 스타일 */}
      <style>{`
        .golden-era-sheet {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(6, 10, 18, 0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          animation: goldenFadeIn 250ms ease-out both;
          padding: 16px;
        }
        @keyframes goldenFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .golden-era-box {
          position: relative;
          width: 100%;
          max-width: 540px;
          max-height: 90vh;
          overflow-y: auto;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
          background: linear-gradient(175deg, #131c2e 0%, #090e1a 100%);
          border: 1.5px solid rgba(251, 191, 36, 0.45);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(251, 191, 36, 0.2);
          border-radius: 28px;
          padding: clamp(20px, 4vw, 32px);
          color: #f8fafc;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
        }
        .golden-modal-close {
          position: absolute;
          top: 18px;
          right: 18px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          font-size: 1.1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 180ms ease;
        }
        .golden-modal-close:hover {
          background: rgba(255, 255, 255, 0.25);
          color: #fde047;
          border-color: #fde047;
          transform: rotate(90deg);
        }

        /* 1단계 스타일 */
        .golden-step1 {
          text-align: center;
          animation: goldenSlideUp 300ms ease-out both;
        }
        @keyframes goldenSlideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .golden-badge {
          display: inline-block;
          font-size: 0.875rem;
          font-weight: 800;
          color: #fde047;
          background: rgba(251, 191, 36, 0.16);
          border: 1.5px solid rgba(251, 191, 36, 0.5);
          border-radius: 999px;
          padding: 5px 14px;
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .golden-title {
          font-size: clamp(1.5rem, 4.2vw, 2rem);
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1.35;
          margin: 0 0 12px;
          background: linear-gradient(135deg, #ffffff 35%, #fde047 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .golden-desc {
          font-size: 1rem;
          line-height: 1.6;
          color: #f1f5f9;
          font-weight: 500;
          margin: 0 0 24px;
        }
        .golden-form {
          margin-bottom: 24px;
        }
        .golden-input-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.08);
          border: 2.5px solid rgba(251, 191, 36, 0.55);
          border-radius: 20px;
          padding: 12px 22px;
          margin: 0 auto 16px;
          max-width: 290px;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);
          transition: border-color 200ms ease, box-shadow 200ms ease;
        }
        .golden-input-wrap:focus-within {
          border-color: #fde047;
          box-shadow: 0 0 26px rgba(251, 191, 36, 0.45);
        }
        .golden-year-input {
          width: 125px;
          background: transparent;
          border: 0;
          font-size: 2.25rem;
          font-weight: 900;
          text-align: center;
          color: #ffffff;
          outline: none;
          font-variant-numeric: tabular-nums;
          font-family: inherit;
        }
        .golden-input-suffix {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fde047;
        }
        .golden-quick-chips {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 24px;
        }
        .chips-label {
          font-size: 0.875rem;
          font-weight: 700;
          color: #e2e8f0;
          margin-right: 4px;
        }
        .quick-chip {
          border: 1.5px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 180ms ease;
        }
        .quick-chip:hover {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.45);
        }
        .quick-chip.active {
          background: rgba(251, 191, 36, 0.28);
          border-color: #fde047;
          color: #fde047;
          font-weight: 800;
          box-shadow: 0 0 14px rgba(251, 191, 36, 0.35);
        }
        .golden-submit-btn {
          width: 100%;
          border: 0;
          border-radius: 18px;
          padding: 16px 20px;
          font-size: 1.15rem;
          font-weight: 900;
          background: linear-gradient(135deg, #fde047 0%, #f59e0b 100%);
          color: #090e1a;
          cursor: pointer;
          box-shadow: 0 8px 25px rgba(245, 158, 11, 0.45);
          transition: transform 120ms ease, box-shadow 150ms ease, filter 150ms ease;
          font-family: inherit;
        }
        .golden-submit-btn:hover {
          filter: brightness(1.08);
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(245, 158, 11, 0.55);
        }
        .golden-submit-btn:active {
          transform: scale(0.98);
        }
        .golden-feature-points {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.18);
          text-align: left;
        }
        .point-item {
          display: flex;
          align-items: flex-start;
          gap: 7px;
        }
        .point-icon {
          font-size: 1.25rem;
          line-height: 1.2;
        }
        .point-item strong {
          display: block;
          font-size: 0.875rem;
          font-weight: 800;
          color: #ffffff;
        }
        .point-item p {
          margin: 3px 0 0;
          font-size: 0.8rem;
          font-weight: 500;
          color: #e2e8f0;
          line-height: 1.4;
        }

        /* 2단계 리포트 스타일 */
        .golden-step2 {
          animation: goldenSlideUp 300ms ease-out both;
        }
        .golden-report-header {
          text-align: center;
          margin-bottom: 22px;
        }
        .report-badge-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .report-gen-tag {
          font-size: 0.875rem;
          font-weight: 800;
          color: #fde047;
          background: rgba(251, 191, 36, 0.15);
          border: 1.5px solid;
          border-radius: 999px;
          padding: 4px 12px;
        }
        .report-badge-pill {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 999px;
          padding: 4px 12px;
        }
        .report-gen-title {
          font-size: clamp(1.35rem, 4.2vw, 1.85rem);
          font-weight: 900;
          color: #ffffff;
          line-height: 1.4;
          margin: 8px 0;
          letter-spacing: -0.01em;
          text-shadow: 0 2px 14px rgba(0,0,0,0.7);
        }
        .report-sub {
          font-size: 0.95rem;
          font-weight: 500;
          color: #e2e8f0;
          line-height: 1.5;
          margin: 0;
        }

        /* 탭 버튼 */
        .stage-tab-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 18px;
        }
        .stage-tab-btn {
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          color: #f1f5f9;
          cursor: pointer;
          transition: all 180ms ease;
          font-family: inherit;
        }
        .stage-tab-btn .tab-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #e2e8f0;
        }
        .stage-tab-btn .tab-year {
          font-size: 1rem;
          font-weight: 900;
          font-family: 'Space Grotesk', 'Pretendard', sans-serif;
          color: #ffffff;
        }
        .stage-tab-btn.active {
          border-color: var(--theme-color, #fde047);
          background: rgba(255, 255, 255, 0.16);
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
        }
        .stage-tab-btn.active .tab-title {
          color: #ffffff;
        }
        .stage-tab-btn.active .tab-year {
          color: var(--theme-color, #fde047);
          text-shadow: 0 0 10px rgba(253, 224, 71, 0.4);
        }

        /* 활성화된 시절 카드 */
        .active-stage-card {
          background: rgba(255, 255, 255, 0.07);
          border: 2px solid;
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 20px;
          box-shadow: 0 14px 35px rgba(0, 0, 0, 0.5);
        }
        .stage-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .stage-age-pill {
          display: inline-block;
          font-size: 0.775rem;
          font-weight: 800;
          color: #0a0f1d;
          border-radius: 999px;
          padding: 3px 10px;
          margin-bottom: 5px;
        }
        .stage-name {
          font-size: 1.3rem;
          font-weight: 800;
          margin: 4px 0 2px;
          color: #ffffff;
        }
        .stage-subtitle {
          font-size: 0.875rem;
          font-weight: 500;
          color: #f1f5f9;
          margin: 3px 0 0;
        }
        .stage-year-emblem {
          text-align: right;
        }
        .stage-year-emblem .yr-num {
          display: block;
          font-size: 1.6rem;
          font-weight: 900;
          font-family: 'Space Grotesk', 'Pretendard', sans-serif;
          color: #fde047;
          line-height: 1;
          text-shadow: 0 0 12px rgba(253, 224, 71, 0.35);
        }
        .stage-year-emblem .yr-text {
          font-size: 0.8rem;
          font-weight: 700;
          color: #e2e8f0;
        }

        .stage-item-box {
          display: flex;
          gap: 14px;
          background: rgba(0, 0, 0, 0.45);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .item-thumb-box {
          width: 84px;
          height: 84px;
          border-radius: 12px;
          overflow: hidden;
          flex-shrink: 0;
          background: #000;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .item-thumb-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .item-thumb-placeholder {
          width: 84px;
          height: 84px;
          border-radius: 12px;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.08);
          border: 1.5px dashed rgba(251, 191, 36, 0.4);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
        }
        .item-thumb-placeholder small {
          font-size: 0.7rem;
          font-weight: 700;
          color: #f1f5f9;
          margin-top: 3px;
        }
        .item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        .item-cat-tag {
          font-size: 0.8rem;
          font-weight: 800;
          color: #38bdf8;
          margin-bottom: 3px;
        }
        .item-title {
          font-size: 1.125rem;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .item-desc {
          font-size: 0.9rem;
          font-weight: 500;
          color: #f1f5f9;
          margin: 0;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .teleport-btn {
          width: 100%;
          border: 1.5px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-radius: 14px;
          padding: 12px;
          font-size: 0.9375rem;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 180ms ease;
          font-family: inherit;
        }
        .teleport-btn:hover {
          background: rgba(251, 191, 36, 0.22);
          color: #ffffff;
          border-color: #fde047;
          box-shadow: 0 4px 18px rgba(251, 191, 36, 0.25);
        }

        /* 캔버스 프리뷰 */
        .canvas-container-preview {
          background: rgba(0, 0, 0, 0.45);
          border: 1.5px solid rgba(255, 255, 255, 0.18);
          border-radius: 20px;
          padding: 14px;
          margin-bottom: 20px;
          text-align: center;
        }
        .canvas-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 12px;
          padding: 0 4px;
        }
        .preview-size {
          font-size: 0.775rem;
          color: #fde047;
          font-weight: 800;
          background: rgba(251, 191, 36, 0.18);
          border: 1px solid rgba(251, 191, 36, 0.4);
          padding: 3px 8px;
          border-radius: 6px;
        }
        .canvas-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* 액션 버튼 그룹 */
        .golden-action-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .action-row-primary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .action-btn {
          border: 0;
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 0.9375rem;
          font-weight: 800;
          cursor: pointer;
          transition: transform 100ms ease, filter 150ms ease, box-shadow 150ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
          font-family: inherit;
        }
        .action-btn:active {
          transform: scale(0.97);
        }
        .action-insta {
          background: linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #f59e0b 100%);
          color: #ffffff;
          box-shadow: 0 4px 18px rgba(244, 63, 94, 0.35);
        }
        .action-kakao {
          background: #fee500;
          color: #191919;
          box-shadow: 0 4px 18px rgba(254, 229, 0, 0.3);
        }
        .action-row-secondary {
          display: grid;
          grid-template-columns: 1fr 1.2fr 0.8fr;
          gap: 8px;
        }
        .action-download {
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.25);
          font-size: 0.875rem;
        }
        .action-retry {
          background: rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.2);
          font-size: 0.875rem;
        }
        .action-close {
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 0.875rem;
        }
        .action-btn:hover {
          filter: brightness(1.12);
        }
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* 👓 효도 모드(.app.hyodo) 환경 전용 스타일 보강 */
        .app.hyodo .golden-era-box {
          max-width: 620px;
          padding: clamp(24px, 5vw, 40px);
          border: 2px solid #fde047;
          background: linear-gradient(175deg, #101726 0%, #070b14 100%);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 45px rgba(253, 224, 71, 0.3);
        }
        .app.hyodo .golden-badge {
          font-size: 1rem;
          padding: 6px 16px;
        }
        .app.hyodo .golden-title {
          font-size: clamp(1.75rem, 5.5vw, 2.3rem);
          font-weight: 900;
        }
        .app.hyodo .golden-desc {
          font-size: 1.15rem;
          line-height: 1.7;
          color: #ffffff;
          font-weight: 600;
        }
        .app.hyodo .golden-input-wrap {
          max-width: 340px;
          padding: 14px 24px;
          border: 3px solid #fde047;
        }
        .app.hyodo .golden-year-input {
          font-size: 2.6rem;
          font-weight: 900;
        }
        .app.hyodo .golden-input-suffix {
          font-size: 1.5rem;
          font-weight: 800;
        }
        .app.hyodo .chips-label {
          font-size: 1rem;
          font-weight: 700;
          color: #f1f5f9;
        }
        .app.hyodo .quick-chip {
          font-size: 1.05rem;
          padding: 8px 16px;
          font-weight: 800;
          border-width: 2px;
        }
        .app.hyodo .golden-submit-btn {
          font-size: 1.3rem;
          font-weight: 900;
          padding: 18px;
        }
        .app.hyodo .point-item strong {
          font-size: 1.05rem;
          font-weight: 800;
        }
        .app.hyodo .point-item p {
          font-size: 0.95rem;
          color: #ffffff;
          font-weight: 600;
          line-height: 1.45;
        }
        .app.hyodo .report-gen-tag {
          font-size: 1rem;
          padding: 4px 14px;
        }
        .app.hyodo .report-badge-pill {
          font-size: 0.95rem;
          padding: 4px 14px;
        }
        .app.hyodo .report-gen-title {
          font-size: clamp(1.6rem, 5vw, 2.2rem);
          font-weight: 900;
        }
        .app.hyodo .report-sub {
          font-size: 1.15rem;
          color: #ffffff;
          font-weight: 600;
          line-height: 1.6;
        }
        .app.hyodo .stage-tab-btn {
          padding: 14px 10px;
        }
        .app.hyodo .stage-tab-btn .tab-title {
          font-size: 1rem;
          font-weight: 800;
        }
        .app.hyodo .stage-tab-btn .tab-year {
          font-size: 1.25rem;
          font-weight: 900;
        }
        .app.hyodo .stage-age-pill {
          font-size: 0.875rem;
          padding: 4px 12px;
        }
        .app.hyodo .stage-name {
          font-size: 1.5rem;
          font-weight: 900;
        }
        .app.hyodo .stage-subtitle {
          font-size: 1.1rem;
          color: #ffffff;
          font-weight: 600;
        }
        .app.hyodo .stage-year-emblem .yr-num {
          font-size: 1.85rem;
          font-weight: 900;
        }
        .app.hyodo .stage-year-emblem .yr-text {
          font-size: 0.95rem;
          color: #ffffff;
        }
        .app.hyodo .item-cat-tag {
          font-size: 0.95rem;
          font-weight: 800;
        }
        .app.hyodo .item-title {
          font-size: 1.3rem;
          font-weight: 900;
        }
        .app.hyodo .item-desc {
          font-size: 1.1rem;
          line-height: 1.65;
          color: #ffffff;
          font-weight: 600;
          -webkit-line-clamp: 4;
        }
        .app.hyodo .teleport-btn {
          font-size: 1.15rem;
          font-weight: 800;
          padding: 15px;
        }
        .app.hyodo .action-btn {
          font-size: 1.1rem;
          font-weight: 800;
          padding: 16px;
        }

        @media (max-width: 480px) {
          .golden-era-box {
            padding: 18px 14px;
          }
          .action-row-primary {
            grid-template-columns: 1fr;
          }
          .action-row-secondary {
            grid-template-columns: 1fr 1fr;
          }
          .action-close {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  );
}
