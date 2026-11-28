import { useEffect, useMemo, useRef, useState } from "react";
import items from "./items.json";
import itemPhotos from "./item-photos.json";
import "./golden.css";

// 세대별 칭호 및 컬러 테마 매핑
const GENERATIONS = [
  { min: 1950, max: 1959, label: "50년대", title: "전후 재건과 통기타 포크 1세대", color: "#9a3b26", badge: "통기타 낭만" },
  { min: 1960, max: 1969, label: "60년대", title: "88 서울올림픽 & 대학가요제 황금기 세대", color: "#9a3b26", badge: "호돌이 & 응답하라" },
  { min: 1970, max: 1979, label: "70년대", title: "X세대 신인류 & 세기말 사이버펑크 주역", color: "#9a3b26", badge: "X세대 & 삐삐" },
  { min: 1980, max: 1989, label: "80년대", title: "밀레니엄 붉은악마 & 싸이월드 도토리 부자", color: "#9a3b26", badge: "월드컵 & 도토리" },
  { min: 1990, max: 1999, label: "90년대", title: "스마트폰 혁명 & K-POP 2세대 감성 리더", color: "#9a3b26", badge: "스마트 혁명 & MP3" },
  { min: 2000, max: 2015, label: "00년대+", title: "알고리즘 숏폼 & 레트로 뉴트로 탐험가", color: "#9a3b26", badge: "숏폼 & 뉴트로" },
];

function getGeneration(birthYear) {
  const y = Number(birthYear);
  return (
    GENERATIONS.find((g) => y >= g.min && y <= g.max) || {
      title: "시대를 초월한 시간 여행자",
      color: "#9a3b26",
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
          title: "초등학교 시절",
          sub: "골목길 놀이 & 문방구 보물",
          targetYear: elemYear,
          ageDesc: "약 11~12세",
          item: elemItem,
          photo: elemPhoto,
          themeColor: "#9a3b26",
        },
        {
          id: "mid",
          title: "중·고등학교 시절",
          sub: "이어폰 너머 감성 가요 & 드라마",
          targetYear: midYear,
          ageDesc: "약 16~17세",
          item: midItem,
          photo: midPhoto,
          themeColor: "#5f6b3a",
        },
        {
          id: "youth",
          title: "청춘 & 20대 시절",
          sub: "세상을 흔든 트렌드 & 열정",
          targetYear: youthYear,
          ageDesc: "약 21~23세",
          item: youthItem,
          photo: youthPhoto,
          themeColor: "#3e5566",
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
      onToast("1950년부터 2015년 사이의 출생연도를 입력해 주세요.");
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
      ctx.fillStyle = "#f4efe6";
      ctx.fillRect(0, 0, W, H);

      // 2. 골드 & 네온 장식 테두리 (인스타 스토리 세이프존 가이드 반영)
      ctx.strokeStyle = "#231d18";
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 60, W - 80, H - 120);

      ctx.lineWidth = 1;
      ctx.strokeRect(54, 74, W - 108, H - 148);

      
      // 3. 상단 헤더
      ctx.textAlign = "center";
      ctx.fillStyle = "#9a3b26";
      ctx.font = "600 30px 'Noto Serif KR', serif";
      ctx.fillText("추억 타임머신", W / 2, 140);

      ctx.fillStyle = "#6b6158";
      ctx.font = "500 20px Pretendard, sans-serif";
      ctx.fillText("세 시절 기록", W / 2, 175);

      // 출생연도 & 칭호 메인 타이틀 박스
      const titleBoxY = 210;
      const titleBoxW = 920;
      const titleBoxH = 150;
      const titleBoxX = (W - titleBoxW) / 2;

      ctx.fillStyle = "#ebe4d6";
      ctx.strokeStyle = "#231d18";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(titleBoxX, titleBoxY, titleBoxW, titleBoxH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#231d18";
      ctx.font = "700 44px 'Noto Serif KR', serif";
      ctx.fillText(`${eraReport.birthYear}년생의 세 시절`, W / 2, titleBoxY + 60);

      ctx.fillStyle = "#9a3b26";
      ctx.font = "600 34px 'Noto Serif KR', serif";
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
        ctx.fillStyle = "#f4efe6";
        ctx.strokeStyle = "#231d18";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(cardX, curY, cardWidth, cardHeight);
        ctx.fill();
        ctx.stroke();

        // 좌측 색상 액센트 바
        ctx.fillStyle = stage.themeColor;
        ctx.beginPath();
        ctx.rect(cardX, curY, 6, cardHeight);
        ctx.fill();

        // 상단 스테이지 뱃지 및 연도 정보
        ctx.textAlign = "left";
        ctx.fillStyle = stage.themeColor;
        ctx.font = "700 28px 'Noto Serif KR', serif";
        ctx.fillText(`${stage.title} (${stage.ageDesc})`, cardX + 34, curY + 50);

        // 연도 뱃지
        const yearBadgeText = `${stage.targetYear}년 무렵`;
        ctx.font = "600 22px Pretendard, sans-serif";
        const yrW = ctx.measureText(yearBadgeText).width + 32;
        const yrH = 36;
        const yrX = cardX + cardWidth - yrW - 28;
        const yrY = curY + 23;

        ctx.strokeStyle = "#231d18";
        ctx.lineWidth = 1;
        ctx.strokeRect(yrX, yrY, yrW, yrH);

        ctx.fillStyle = "#231d18";
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
          ctx.rect(imgBoxX, imgBoxY, imgBoxSize, imgBoxSize);
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
          ctx.strokeStyle = "#231d18";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(imgBoxX, imgBoxY, imgBoxSize, imgBoxSize);
          ctx.stroke();

          // 텍스트 영역 (우측)
          const textLeft = imgBoxX + imgBoxSize + 30;
          const maxTextW = cardWidth - (imgBoxSize + 90);

          ctx.textAlign = "left";
          // 카테고리 태그
          ctx.fillStyle = "#9a3b26";
          ctx.font = "bold 22px Pretendard, -apple-system, sans-serif";
          ctx.fillText(`[${stage.item.cat || "추억"}]`, textLeft, imgBoxY + 36);

          // 아이템 제목
          ctx.fillStyle = "#231d18";
          ctx.font = "700 38px 'Noto Serif KR', serif";
          const title = stage.item.title || "";
          ctx.fillText(title.length > 14 ? title.slice(0, 13) + "…" : title, textLeft, imgBoxY + 82);

          // 요약문 (2~3줄 랩핑)
          ctx.fillStyle = "#4a4038";
          ctx.font = "400 24px Pretendard, -apple-system, sans-serif";
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

          ctx.fillStyle = "#ebe4d6";
          ctx.strokeStyle = "#231d18";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(emblemX, emblemY, emblemW, emblemH);
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = "center";
          ctx.fillStyle = "#231d18";
          ctx.font = "700 52px 'Noto Serif KR', serif";
          ctx.fillText(String(stage.targetYear), emblemX + emblemW / 2, emblemY + 95);

          ctx.fillStyle = "#6b6158";
          ctx.font = "500 22px Pretendard, sans-serif";
          ctx.fillText("그 무렵", emblemX + emblemW / 2, emblemY + 140);

          // 텍스트 영역
          const textLeft = emblemX + emblemW + 30;
          const maxTextW = cardWidth - (emblemW + 90);

          ctx.textAlign = "left";
          ctx.fillStyle = "#9a3b26";
          ctx.font = "bold 22px Pretendard, -apple-system, sans-serif";
          ctx.fillText(`[${stage.item.cat || "추억"}]`, textLeft, emblemY + 36);

          ctx.fillStyle = "#231d18";
          ctx.font = "700 40px 'Noto Serif KR', serif";
          const title = stage.item.title || "";
          ctx.fillText(title.length > 15 ? title.slice(0, 14) + "…" : title, textLeft, emblemY + 84);

          ctx.fillStyle = "#4a4038";
          ctx.font = "400 25px Pretendard, -apple-system, sans-serif";
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
      ctx.strokeStyle = "#9a3b26";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, sealY, 46, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#9a3b26";
      ctx.font = "700 28px 'Noto Serif KR', serif";
      ctx.fillText("추억", W / 2, sealY + 10);

      // 하단 텍스트
      ctx.fillStyle = "#231d18";
      ctx.font = "600 26px Pretendard, sans-serif";
      ctx.fillText("chueok-timemachine.pages.dev", W / 2, H - 130);

      ctx.fillStyle = "#6b6158";
      ctx.font = "400 22px Pretendard, sans-serif";
      ctx.fillText("연도별로 모아 둔 한국의 생활 기록", W / 2, H - 95);

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
    onToast?.("9:16 인스타 스토리용 인증서를 저장했어요.");
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
      `초등 시절(${stages[0].targetYear}년): ${stages[0].item.title}\n` +
      `중고등 시절(${stages[1].targetYear}년): ${stages[1].item.title}\n` +
      `청춘 20대(${stages[2].targetYear}년): ${stages[2].item.title}\n\n` +
      `너의 황금기도 지금 바로 확인해봐:\n${siteUrl}`;

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
              title: "나의 황금기 테스트하기",
              link: { mobileWebUrl: siteUrl, webUrl: siteUrl },
            },
          ],
        });
        onToast?.("카카오톡으로 황금기 리포트를 보냈어요.");
        return;
      } catch (err) {
        console.warn("Kakao share failed:", err);
      }
    }

    // 2. 클립보드 복사
    try {
      await navigator.clipboard.writeText(textPayload);
      onToast?.("카톡 공유 문구와 링크를 복사했어요. 단톡방에 붙여넣으면 됩니다.");
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
      <div className="golden-era-box">
        {/* 모달 닫기 버튼 */}
        <button className="golden-modal-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        {/* ──────── 1단계: 출생연도 입력 화면 ──────── */}
        {step === 1 && (
          <div className="golden-step1">
            <div className="golden-header">
              <span className="golden-badge">출생연도로 보는 세 시절</span>
              <h2 className="golden-title">나의 추억 나이 &amp; 황금기 테스트</h2>
              <p className="golden-desc">
                태어난 해를 적어 주세요. <br />
                초등학교, 중고등학교, 스무 살 무렵에 유행하던 것을 한 장으로 정리해 드려요.
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
                내 시절 보기
              </button>
            </form>

            <div className="golden-feature-points">
              <div className="point-item">
                <span className="point-icon"></span>
                <div>
                  <strong>초등학교 시절</strong>
                  <p>골목길 놀이 &amp; 문방구 과자</p>
                </div>
              </div>
              <div className="point-item">
                <span className="point-icon"></span>
                <div>
                  <strong>중고등학교 시절</strong>
                  <p>감성 가요 &amp; 유행 드라마</p>
                </div>
              </div>
              <div className="point-item">
                <span className="point-icon"></span>
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
              <p className="report-sub">시절을 고르면 그때 유행하던 것이 나옵니다.</p>
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
                      <span className="stage-age-pill" style={{ background: currentStage.themeColor, color: "#f4efe6", fontWeight: 700 }}>
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
                        <small>{currentStage.targetYear} MEMORY</small>
                      </div>
                    )}
                    <div className="item-info">
                      <span className="item-cat-tag">#{currentStage.item.cat || "추억"}</span>
                      <h4 className="item-title">{currentStage.item.title}</h4>
                      <p className="item-desc">{currentStage.item.summary || "그 시절 많이들 쓰고 보던 것."}</p>
                    </div>
                  </div>

                  {/* 해당 연도로 즉시 시간여행 바로가기 */}
                  <button
                    className="teleport-btn"
                    onClick={() => handleNavigateYear(currentStage.targetYear)}
                    title={`${currentStage.targetYear}년 전체 추억 아카이브로 이동`}
                  >
                    {currentStage.targetYear}년 기록 보러 가기
                  </button>
                </div>
              );
            })()}

            {/* 숨겨진 1080x1920 캔버스 (인스타 스토리용) */}
            <div className="canvas-container-preview">
              <div className="canvas-preview-header">
                <span>인스타 스토리용 이미지</span>
                <span className="preview-size">1080 × 1920</span>
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
                    border: "1px solid #231d18",
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
                  스토리 이미지 공유
                </button>
                <button
                  className="action-btn action-kakao"
                  onClick={handleShareKakao}
                  title="카카오톡 단톡방 친구들에게 테스트 공유"
                >
                  카카오톡 공유
                </button>
              </div>

              <div className="action-row-secondary">
                <button className="action-btn action-download" onClick={handleDownloadCertificate} disabled={isRendering}>
                  PNG 저장
                </button>
                <button className="action-btn action-retry" onClick={() => setStep(1)}>
                  다른 연도로
                </button>
                <button className="action-btn action-close" onClick={onClose}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
