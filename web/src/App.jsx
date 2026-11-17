import { useEffect, useMemo, useRef, useState } from "react";
import items from "./items.json";
import itemPhotos from "./item-photos.json";
import Flight from "./Flight.jsx";

const YEARS = Array.from({ length: 77 }, (_, i) => 1950 + i); // 1950~2026
const CATS = ["음악", "TV·영화", "먹거리", "패션", "놀이·문구", "가전·기술", "사건·생활상", "유행어·풍속"];
const TARGET = 20;
const ERAS = [
  { to: 1959, name: "전후 잿더미와 희망", color: "#a08060" },
  { to: 1969, name: "흑백 재건과 근대화", color: "#8a8f99" },
  { to: 1979, name: "청년 문화와 통기타", color: "#3e4f9a" },
  { to: 1989, name: "컬러 혁명과 호돌이", color: "#d4a62a" },
  { to: 1994, name: "아날로그 여명", color: "#c96a2a" },
  { to: 1999, name: "사이버 펑크", color: "#d02a8a" },
  { to: 2009, name: "밀레니엄 붉은 함성", color: "#c0c4cc" },
  { to: 2019, name: "스마트 초연결", color: "#39b6d8" },
  { to: 2026, name: "네오 숏폼 & 메타", color: "#8a5cf6" },
];
const eraOf = (y) => ERAS.find((e) => y <= e.to);
const itemsOf = (y) => items.filter((i) => i.year === y);
// 항목 사진: 제목이 파일 이름에 실제로 들어 있을 때만 붙인다(수집 스크립트에서 검증)
const photoOf = (it) => itemPhotos[`${it.year}|${it.title}`] ?? null;
const CENTER = { x: 50, y: 46 };

// 연도 행성의 달(월) 배치: 12개가 원형 궤도를 돈다. 각도는 도(degree).
const MOON_ANGLE = (m) => (m - 1) * 30 - 90;
// 비행 경로 계산용 달 위치(%) — 화면 비율 기준의 대략 좌표
function moonPos(m) {
  const a = (MOON_ANGLE(m) * Math.PI) / 180;
  return { x: 50 + Math.cos(a) * 38, y: 46 + Math.sin(a) * 38 };
}
const readReduce = () => {
  try {
    return localStorage.getItem("reduceMotion") === "1" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { return false; }
};

export default function App() {
  const [view, setView] = useState("home"); // home | year | ground
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null);
  const [cat, setCat] = useState("전체");
  const [flight, setFlight] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(readReduce);
  const [share, setShare] = useState(null);
  const skipRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem("reduceMotion", reduceMotion ? "1" : "0"); } catch {}
  }, [reduceMotion]);

  // 상단 연도 바에서 선택한 연도가 가운데로 오도록 스크롤
  useEffect(() => {
    document.querySelector(".yearbar .sel")?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [year, reduceMotion]);

  // 비행 연출 후 실행. 모션 줄이기면 즉시 실행.
  function travel({ from, to, color }, next) {
    if (reduceMotion) { next(); return; }
    skipRef.current = false;
    setFlight({ from, to, color, onDone: () => { setFlight(null); next(); } });
  }

  // 연도 이동은 연출 없이 바로 보여준다 (상단 바 스크롤만 움직임)
  function goYear(y) {
    if (y === year && view !== "home") return;
    setYear(y); setMonth(null); setCat("전체"); setView("year");
  }
  function goMonth(m) {
    travel({ from: moonPos(m), to: CENTER, color: eraOf(year).color }, () => {
      setMonth(m); setCat("전체"); setView("ground");
    });
  }
  function goHome() { setView("home"); setYear(null); setMonth(null); }
  function back() {
    if (view === "ground") { setMonth(null); setView("year"); }
    else goHome();
  }

  const yearItems = useMemo(() => (year ? itemsOf(year) : []), [year]);
  const landingItems = useMemo(() => {
    if (!year) return [];
    const list = month ? yearItems.filter((i) => i.month === month) : yearItems;
    return cat === "전체" ? list : list.filter((i) => i.cat === cat);
  }, [year, month, cat, yearItems]);

  function openShare(it) {
    setShare({
      title: `${it.title} (${it.year}${it.month ? "." + it.month : ""}) · 추억 타임머신`,
      text: it.summary,
      url: location.href,
    });
  }
  async function nativeShare() { try { await navigator.share(share); } catch {} }
  const copy = (t) => { navigator.clipboard?.writeText(t); alert("복사했습니다."); };

  return (
    <div className={`app ${reduceMotion ? "rm" : ""}`}>
      <header className="top">
        <button className="brand" onClick={goHome}>🪐 추억 타임머신</button>
        <div className="top-r">
          <button className="ghost" onClick={() => setReduceMotion((v) => !v)}>
            {reduceMotion ? "🎞 연출 켜기" : "🌙 모션 줄이기"}
          </button>
          {flight && <button className="ghost" onClick={() => { skipRef.current = true; }}>⏭ 건너뛰기</button>}
        </div>
      </header>

      {/* 상단 연도 바: 좌우로 스크롤 */}
      <nav className="yearbar" aria-label="연도 선택">
        {YEARS.map((y) => {
          const has = itemsOf(y).length > 0;
          const sel = y === year;
          return (
            <button
              key={y}
              className={`yb ${sel ? "sel" : ""} ${has ? "has" : ""}`}
              onClick={() => goYear(y)}
              title={`${y}년 · ${eraOf(y).name}${has ? "" : " (준비 중)"}`}
            >
              {y}
            </button>
          );
        })}
      </nav>

      {flight && <Flight from={flight.from} to={flight.to} color={flight.color} skipRef={skipRef} onDone={flight.onDone} />}

      {view === "home" && (
        <section className="home">
          <p className="lead">위 연도 바를 옆으로 밀어 보고, 연도를 누르면 그 해의 달(월)이 인공위성처럼 돕니다.</p>
          <p className="note">● 표시된 해는 수집 자료가 있는 해입니다(1950~1979). 나머지는 준비 중입니다.</p>
        </section>
      )}

      {view === "year" && year && (
        <section className="orbit-view">
          <button className="back" onClick={back}>← 처음으로</button>
          <h2>{year}년 · {eraOf(year).name}</h2>
          <div className={`orbit ${reduceMotion ? "still" : ""}`} style={{ "--c": eraOf(year).color }}>
            <div className="core"><span>{year}</span></div>
            <div className="ring">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const n = yearItems.filter((it) => it.month === m).length;
                return (
                  <div key={m} className="sat" style={{ "--a": `${MOON_ANGLE(m) + 90}deg` }}>
                    <button className={`moon ${n ? "has" : ""}`} onClick={() => goMonth(m)} title={`${m}월 · ${n}개`}>
                      <span className="moon-label">{m}월</span>
                      {n > 0 && <span className="moon-n">{n}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="note">
            {yearItems.length
              ? `수집 ${yearItems.length}개 · 목표 ${TARGET}개 ${yearItems.length < TARGET ? "(목표 미달)" : "(목표 충족)"}`
              : "이 해는 아직 준비 중입니다."}
          </p>
          {yearItems.length > 0 && (
            <button className="primary" onClick={() => { setMonth(null); setCat("전체"); setView("ground"); }}>
              {year}년 전체 보기 →
            </button>
          )}
        </section>
      )}

      {view === "ground" && year && (
        <section className="ground">
          <button className="back" onClick={back}>← {year}년 궤도로</button>
          <h2>{year}년 {month ? `${month}월` : "전체"}의 추억</h2>
          <div className="cats">
            {["전체", ...CATS].map((c) => (
              <button key={c} className={c === cat ? "on" : ""} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="grid">
            {landingItems.length === 0 && <div className="empty">이 분류에는 아직 자료가 없습니다.</div>}
            {landingItems.map((it, idx) => {
              const ok = it.sources.length > 0 && it.confidence !== "low";
              const ph = photoOf(it);
              return (
                <article className="card" key={idx}>
                  {ph ? (
                    <figure className="item-photo">
                      <img src={ph.thumb} alt={ph.title} loading="lazy" />
                      <figcaption>
                        사진: {ph.title} · 작가: {ph.artist} · {ph.license} · <a href={ph.page} target="_blank" rel="noopener">원본</a>
                      </figcaption>
                    </figure>
                  ) : (
                    <div className="item-photo none">📷 사진 준비 중</div>
                  )}
                  <div className="meta">
                    <span className="tag">{it.month ? `${it.year}년 ${it.month}월` : `${it.year}년`}</span>
                    <span className="tag">{it.cat}</span>
                    <span className={`tag ${ok ? "ok" : "warn"}`}>{ok ? "출처 확인" : "검증 필요"}</span>
                  </div>
                  <h3>{it.title}</h3>
                  <p>{it.summary}</p>
                  <div className="src">
                    출처: {it.sources.length
                      ? it.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener">{s.name || s.url}</a>)
                      : "확인된 출처 없음"}
                  </div>
                  <button className="share-btn" onClick={() => openShare(it)}>📤 공유</button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {share && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setShare(null)}>
          <div className="box">
            <b>{share.title}</b>
            <button onClick={nativeShare}>📤 기기 공유 (지원 기기)</button>
            <button onClick={() => copy(share.url)}>🔗 링크 복사</button>
            <button onClick={() => copy(`${share.title}\n${share.text}\n${share.url}`)}>🖼️ 공유 글 복사 (인스타·블로그용)</button>
            <button disabled>💬 카카오톡 (JavaScript 키·도메인 등록 후 활성화)</button>
            <button onClick={() => setShare(null)}>닫기</button>
          </div>
        </div>
      )}

      <footer className="foot">
        AI 재현 이미지는 배지를 붙입니다. 모든 자료는 검수 전 "검증 필요"로 표시됩니다.
      </footer>
    </div>
  );
}
