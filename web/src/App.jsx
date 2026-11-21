import { useEffect, useMemo, useRef, useState } from "react";
import items from "./items.json";
import itemPhotos from "./item-photos.json";
import InstagramCardModal from "./InstagramCardModal.jsx";
import ShareButtons from "./ShareButtons.jsx";
import WritePostModal from "./WritePostModal.jsx";
import CardCommunity from "./CardCommunity.jsx";

const YEARS = Array.from({ length: 77 }, (_, i) => 1950 + i); // 1950~2026
const CATS = ["음악", "TV·영화", "먹거리", "패션", "놀이·문구", "가전·기술", "사건·생활상", "유행어·풍속"];
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
const BY_YEAR = items.reduce((m, it) => ((m[it.year] ||= []).push(it), m), {});
const itemsOf = (y) => BY_YEAR[y] ?? [];
const YEARS_WITH_DATA = YEARS.filter((y) => itemsOf(y).length);
const photoOf = (it) => itemPhotos[`${it.year}|${it.title}`] ?? null;

// 주소(#/1974/3) ↔ 화면 상태. 뒤로가기·공유 링크가 그대로 동작한다.
function parseHash() {
  const [, y, m] = location.hash.match(/^#\/(\d{4})(?:\/(unknown|\d{1,2}))?/) ?? [];
  const year = Number(y);
  if (!YEARS.includes(year)) return { year: null, month: null };
  const month = Number(m);
  return { year, month: m === "unknown" ? "unknown" : month >= 1 && month <= 12 ? month : null };
}
const hashOf = (y, m) => (y ? `#/${y}${m ? "/" + m : ""}` : "#/");
const nearestWithData = (y) =>
  YEARS_WITH_DATA.reduce((best, d) => (Math.abs(d - y) < Math.abs(best - y) ? d : best), YEARS_WITH_DATA[0]);

const readReduce = () => {
  try { const saved = localStorage.getItem("reduceMotion"); return saved === null ? matchMedia("(prefers-reduced-motion: reduce)").matches : saved === "1"; }
  catch { return false; }
};

export default function App() {
  const [{ year, month }, setRoute] = useState(parseHash);
  const [cat, setCat] = useState("전체");
  const [query, setQuery] = useState("");
  const [reduceMotion, setReduceMotion] = useState(readReduce);
  const [share, setShare] = useState(null);
  const [toast, setToast] = useState("");
  const [cheerOpen, setCheerOpen] = useState(false);
  const [adminView, setAdminView] = useState(location.hash.startsWith("#/admin"));
  const [instaModalItem, setInstaModalItem] = useState(null);
  const [writePostOpen, setWritePostOpen] = useState(false);
  const [photoOnly, setPhotoOnly] = useState(false);
  const [customPosts, setCustomPosts] = useState([]);
  const [detail, setDetail] = useState(null);
  const detailRef = useRef(null);
  const barRef = useRef(null);
  const monthBarRef = useRef(null);
  useEffect(() => { if (detail) detailRef.current?.showModal(); }, [detail]);

  // 연도별 D1 데이터 (사연, 댓글, 반응) 온디맨드 1회 묶음 조회
  const [yearDataCache, setYearDataCache] = useState({});
  const updateCommunity = (item, update) => {
    const target = `${item.year}_${item.title}`;
    setYearDataCache((prev) => {
      const data = prev[item.year];
      if (!data) return prev;
      return { ...prev, [item.year]: {
        ...data,
        reactions: update.reactions ? { ...data.reactions, [target]: update.reactions } : data.reactions,
        comments: update.comment ? { ...data.comments, [target]: [update.comment, ...(data.comments?.[target] || []).filter((c) => c.id !== update.comment.id)] } : data.comments,
      } };
    });
  };

  useEffect(() => {
    if (!year) { setCustomPosts([]); return; }
    let active = true;

    // 1. 로컬 저장소 사연 우선 로드
    let localPosts = [];
    try {
      const saved = JSON.parse(localStorage.getItem("chueok_user_posts") || "[]");
      localPosts = saved.filter((p) => Number(p.year) === year);
    } catch {}
    setCustomPosts(localPosts);

    // 2. 해당 연도 데이터 D1 서버에서 '딱 1번' 묶음 호출
    if (!yearDataCache[year]) {
      fetch(`/api/year-data?year=${year}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) {
            setYearDataCache((prev) => ({ ...prev, [year]: { ...d, posts: [...new Map([...(d.posts || []), ...(prev[year]?.posts || [])].map((p) => [p.id, p])).values()] } }));
            const serverPosts = d.posts || [];
            const map = new Map();
            [...localPosts, ...serverPosts].forEach((p) => map.set(p.id, p));
            if (active) setCustomPosts((current) => Array.from(new Map([...map.values(), ...current.filter((p) => Number(p.year) === year)].map((p) => [p.id, p])).values()));
          } else {
            if (active) setCustomPosts(localPosts);
          }
        })
        .catch(() => { if (active) setCustomPosts(localPosts); });
    } else {
      const serverPosts = yearDataCache[year]?.posts || [];
      const map = new Map();
      [...localPosts, ...serverPosts].forEach((p) => map.set(p.id, p));
      setCustomPosts(Array.from(map.values()));
    }
    return () => { active = false; };
  }, [year]);

  // 주소가 바뀌면(뒤로가기 포함) 화면을 따라가게
  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); setCat("전체"); setAdminView(location.hash.startsWith("#/admin")); };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const go = (y, m = null) => { location.hash = hashOf(y, m); };

  useEffect(() => { try { localStorage.setItem("reduceMotion", reduceMotion ? "1" : "0"); } catch {} }, [reduceMotion]);

  // 선택한 연도를 다이얼 가운데로
  useEffect(() => {
    const bar = barRef.current;
    const center = () => {
      const selected = bar?.querySelector(".sel");
      if (selected) bar.scrollTo({ left: selected.offsetLeft - bar.clientWidth / 2 + selected.offsetWidth / 2, behavior: reduceMotion ? "auto" : "smooth" });
    };
    center();
    addEventListener("resize", center);
    return () => removeEventListener("resize", center);
  }, [year, reduceMotion]);

  useEffect(() => {
    const bar = monthBarRef.current;
    const selected = bar?.querySelector('[aria-current="page"]');
    if (selected) bar.scrollTo({ left: selected.offsetLeft - bar.clientWidth / 2 + selected.offsetWidth / 2, behavior: reduceMotion ? "auto" : "smooth" });
  }, [year, month, reduceMotion]);

  // ←/→ 키로 연도 이동 (입력 중엔 무시)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input,textarea,select,button,a,[contenteditable=true]") || !year) return;
      if (e.key === "ArrowLeft" && year > YEARS[0]) go(year - 1);
      if (e.key === "ArrowRight" && year < YEARS.at(-1)) go(year + 1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [year]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const onBarWheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) barRef.current.scrollLeft += e.deltaY; };
  const nudge = (dir) => barRef.current.scrollBy({ left: dir * 320, behavior: reduceMotion ? "auto" : "smooth" });

  const yearItems = year ? itemsOf(year) : [];
  const monthCount = (m) => yearItems.filter((it) => it.month === m).length + customPosts.filter((p) => p.month === m).length;
  const shown = useMemo(() => {
    const list = month ? yearItems.filter((i) => month === "unknown" ? !i.month : i.month === month) : yearItems;
    return cat === "전체" ? list : list.filter((i) => i.cat === cat);
  }, [year, month, cat]);
  const shownPosts = customPosts.filter((p) => (!month || (month === "unknown" ? !p.month : p.month === month)) && (cat === "전체" || p.category === cat));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return items.filter((i) => (i.title + " " + i.summary).toLowerCase().includes(q)).slice(0, 30);
  }, [query]);

  const shareUrl = (it) => `${location.origin}${location.pathname}${hashOf(it.year, it.month)}`;
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); setToast(msg); }
    catch { setToast("복사하지 못했습니다. 주소창의 링크를 직접 복사해 주세요."); }
  }
  async function nativeShare() {
    try { await navigator.share(share); setShare(null); } catch { /* 사용자가 취소 */ }
  }

  const birthRef = useRef(null);
  function goBirth(e) {
    e.preventDefault();
    const y = Number(birthRef.current.value);
    if (!YEARS.includes(y)) { setToast("1950~2026 사이 연도를 입력해 주세요."); return; }
    go(y);
  }

  return (
    <div className={`app ${reduceMotion ? "rm" : ""}`}>
      <header className="top">
        <a className="brand" href="#/">🪐 추억 타임머신</a>
        <div className="top-r">
          <button className="write-post-btn" onClick={() => setWritePostOpen(true)}>✏️ 내 추억 사연 남기기</button>
          <button className="ghost cheer-btn" onClick={() => setCheerOpen(true)}>💌 응원 한마디</button>
          <input
            className="search"
            type="search"
            placeholder="추억 검색 (예: 라면, 통기타)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="추억 검색"
          />
          <button className="ghost" onClick={() => setReduceMotion((v) => !v)} aria-pressed={reduceMotion}>
            {reduceMotion ? "효과 켜기" : "효과 줄이기"}
          </button>
        </div>
      </header>

      <div className="dial">
        <button className="dial-arrow" onClick={() => nudge(-1)} aria-label="이전 연도들">‹</button>
        <nav className="yearbar" ref={barRef} onWheel={onBarWheel} aria-label="연도 선택">
          {YEARS.map((y) => {
            const has = itemsOf(y).length > 0;
            const sel = y === year;
            const decade = y % 10 === 0;
            return (
              <a
                key={y}
                href={hashOf(y)}
                className={`yb ${sel ? "sel" : ""} ${has ? "has" : ""} ${decade ? "decade" : ""}`}
                style={{ "--c": eraOf(y).color }}
                aria-current={sel ? "page" : undefined}
                aria-label={`${y}년${has ? ` · 자료 ${itemsOf(y).length}개` : " · 준비 중"}`}
              >
                <span className="yb-n">{decade || sel ? y : String(y).slice(2)}</span>
                <span className="yb-tick" />
              </a>
            );
          })}
        </nav>
        <button className="dial-arrow" onClick={() => nudge(1)} aria-label="다음 연도들">›</button>
      </div>

      {adminView && <AdminCheers onToast={setToast} />}

      {!adminView && query.trim() && (
        <section className="results" aria-live="polite">
          <h2 className="sec-h">“{query.trim()}” 검색 결과 {results.length}건</h2>
          {results.length === 0 && <div className="empty">맞는 추억이 없습니다. 다른 낱말로 찾아보세요.</div>}
          <ul className="result-list">
            {results.map((it) => (
              <li key={it.year + it.title}>
                <a href={hashOf(it.year, it.month)} onClick={() => setQuery("")}>
                  <span className="r-year">{it.year}{it.month ? `.${it.month}` : ""}</span>
                  <span className="r-title">{it.title}</span>
                  <span className="r-cat">{it.cat}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!adminView && !query.trim() && !year && (
        <section className="home">
          <p className="lead">그 시절, 우리가 좋아했던 것들.</p>
          <p className="note">연도를 고르면 그해 유행한 노래·먹거리·물건·사건을 볼 수 있어요.</p>
          <form className="birth" onSubmit={goBirth}>
            <label htmlFor="birth">태어난 해로 가기</label>
            <input id="birth" ref={birthRef} type="number" inputMode="numeric" placeholder="예: 1965" />
            <button className="primary" type="submit">이동</button>
          </form>
          <div className="quick">
            {[1953, 1965, 1974, 1979, 1988, 1997, 2002, 2010, 2020].filter((y) => itemsOf(y).length).map((y) => (
              <a key={y} className="chip" href={hashOf(y)}>{y}<small>{itemsOf(y).length}개</small></a>
            ))}
          </div>
          <p className="note small">1950년부터 2026년까지 77개년 5,600여 개 추억이 수록되어 있습니다.</p>
        </section>
      )}

      {!adminView && !query.trim() && year && (
        <section className="year-view" key={year}>
          <div className="year-head">
            <h2 key={year}>{year}</h2>
            <p className="era" style={{ "--c": eraOf(year).color }}>{eraOf(year).name}</p>
          </div>

          {yearItems.length === 0 ? (
            <div className="empty">
              {year}년 자료는 준비 중입니다.
              <a className="primary inline" href={hashOf(nearestWithData(year))}>가까운 {nearestWithData(year)}년 보기</a>
            </div>
          ) : (
            <>
              <nav className="orbit" style={{ "--c": eraOf(year).color }} aria-label={`${year}년 월 선택`}>
                <a className={`core ${month ? "" : "on"}`} href={hashOf(year)} aria-label={`${year}년 전체 보기`}>
                  <span>전체</span>
                </a>
                <div className="ring" ref={monthBarRef}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const n = monthCount(m);
                    return (
                      <div key={m} className="sat" style={{ "--d": m }}>
                        {n ? (
                          <a className={`moon has ${m === month ? "on" : ""}`} href={hashOf(year, m)} aria-label={`${m}월 · ${n}개`} aria-current={m === month ? "page" : undefined}>
                            <span className="moon-label">{m}월</span>
                            <span className="moon-n">{n}</span>
                          </a>
                        ) : (
                          <span className="moon" aria-hidden="true"><span className="moon-label">{m}월</span></span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </nav>
              <a className={`unknown-month ${month === "unknown" ? "on" : ""}`} href={hashOf(year, "unknown")} aria-current={month === "unknown" ? "page" : undefined}>
                월 미확인 {yearItems.filter((i) => !i.month).length + customPosts.filter((p) => !p.month).length}개
              </a>
              <p className="note center">
                {photoOnly ? `사진 있는 추억 ${shown.filter((it) => photoOf(it)).length}개` : month ? `${month === "unknown" ? "월 미확인" : `${month}월`} 추억 ${shown.length + shownPosts.length}개` : `${year}년 추억 ${yearItems.length + customPosts.length}개`} · 달을 누르면 그달만 볼 수 있어요
              </p>

              <div className="cats" role="tablist" aria-label="분류">
                {["전체", ...CATS].map((c) => {
                  const base = month ? yearItems.filter((i) => month === "unknown" ? !i.month : i.month === month) : yearItems;
                  const posts = month ? customPosts.filter((p) => month === "unknown" ? !p.month : p.month === month) : customPosts;
                  const n = c === "전체" ? base.length + posts.length : base.filter((i) => i.cat === c).length + posts.filter((p) => p.category === c).length;
                  if (c !== "전체" && !n) return null;
                  return (
                    <button key={c} role="tab" aria-selected={c === cat} className={c === cat ? "on" : ""} onClick={() => setCat(c)}>
                      {c} <small>{n}</small>
                    </button>
                  );
                })}
              </div>

              <button type="button" className="photo-filter" aria-pressed={photoOnly} onClick={() => setPhotoOnly((value) => !value)}>
                사진 있는 추억만 보기
              </button>
              <div className="grid" key={`${year}-${month}-${cat}-${photoOnly}`}>
                {/* 이용자가 직접 남긴 추억 사연 카드 */}
                {!photoOnly && shownPosts.map((p) => (
                    <article className="card user-post-card" key={p.id} onClick={(e) => { if (!e.target.closest("button, a, input, textarea, select")) setDetail({item: { ...p, cat: p.category, summary: p.content, sources: [] }, photo: null}); }}>
                      <div className="meta">
                        <span className="tag" style={{ background: "rgba(255, 215, 0, 0.2)", color: "#ffd700", fontWeight: 700 }}>
                          ✍️ 이용자 추억 사연
                        </span>
                        <span className="tag">{p.month ? `${p.year}년 ${p.month}월` : `${p.year}년`}</span>
                        <span className="tag">{p.category}</span>
                      </div>
                      <h3>{p.title}</h3>
                      <p className="card-excerpt" style={{ whiteSpace: "pre-wrap" }}>{p.content}</p>
                      <div className="src" style={{ marginTop: "6px" }}>
                        글쓴이: <b>{p.author || "익명의 시간여행자"}</b> · {new Date(p.at).toLocaleDateString("ko-KR")}
                      </div>
                      <div className="card-actions">
                        <button className="detail-open" onClick={() => setDetail({item: { ...p, cat: p.category, summary: p.content, sources: [] }, photo: null})}>자세히 보기</button>
                        <button
                          className="share-btn share-icon" aria-label="공유하기" title="공유하기"
                          onClick={() => setShare({ title: `${p.title} (${p.year}) · 추억 사연`, text: p.content, url: shareUrl(p) })}
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>
                        </button>
                        <ShareButtons share={{ title: `${p.title} (${p.year}) · 추억 사연`, text: p.content, url: shareUrl(p) }} onInstagram={() => setInstaModalItem({ item: { year: p.year, month: p.month, cat: p.category, title: p.title, summary: p.content }, photo: null })} onToast={setToast} />
                      </div>
                      <CardCommunity
                        item={{ year: p.year, title: p.title }}
                        initialReactions={yearDataCache[p.year]?.reactions?.[`${p.year}_${p.title}`]}
                        initialComments={yearDataCache[p.year]?.comments?.[`${p.year}_${p.title}`]}
                        onCommunityUpdate={(update) => updateCommunity(p, update)}
                        onToast={setToast}
                      />
                    </article>
                  ))}

                {(photoOnly ? !shown.some((it) => photoOf(it)) : shown.length === 0 && shownPosts.length === 0) && <div className="empty">{photoOnly ? "이 조건에 맞는 사진이 아직 없어요." : "이 분류에는 자료가 없습니다."}</div>}
                {shown.filter((it) => !photoOnly || photoOf(it)).map((it) => {
                  const ok = it.sources.length > 0 && it.confidence !== "low";
                  const ph = photoOf(it);
                  return (
                    <article className={`card ${ph ? "has-photo" : "no-photo"}`} key={it.title} onClick={(e) => { if (!e.target.closest("button, a, input, textarea, select")) setDetail({item: it, photo: ph}); }}>
                      {ph && (
                        <figure className="item-photo">
                          <img src={ph.thumb} alt={ph.title} loading="lazy" />
                          <figcaption>사진: {ph.artist} · {ph.license} · <a href={ph.page} target="_blank" rel="noopener">원본</a></figcaption>
                        </figure>
                      )}
                      {!ph && <div className="memory-placeholder" aria-label="사진 자료 없음"><span className="memory-placeholder-year">{it.year}</span><span className="memory-placeholder-label">사진 자료 없음 · {it.cat}</span></div>}
                      <div className="meta">
                        <span className="tag">{it.month ? `${it.year}년 ${it.month}월` : `${it.year}년`}</span>
                        <span className="tag">{it.cat}</span>
                        {!ok && <span className="tag warn">출처 확인 중</span>}
                      </div>
                      <h3>{it.title}</h3>
                      <p className="card-excerpt">{it.summary}</p>
                      {it.sources.length > 0 && (
                        <div className="src">
                          출처 {it.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener">{s.name || "링크"}</a>)}
                        </div>
                      )}
                      <div className="card-actions">
                        <button className="detail-open" onClick={() => setDetail({item: it, photo: ph})}>자세히 보기</button>
                        <button className="share-btn share-icon" aria-label="공유하기" title="공유하기" onClick={() => setShare({ title: `${it.title} (${it.year}) · 추억 타임머신`, text: it.summary, url: shareUrl(it) })}>
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>
                        </button>
                        <ShareButtons share={{ title: `${it.title} (${it.year}) · 추억 타임머신`, text: it.summary, url: shareUrl(it) }} onInstagram={() => setInstaModalItem({ item: it, photo: ph })} onToast={setToast} />
                      </div>
                      <CardCommunity
                        item={it}
                        initialReactions={yearDataCache[it.year]?.reactions?.[`${it.year}_${it.title}`]}
                        initialComments={yearDataCache[it.year]?.comments?.[`${it.year}_${it.title}`]}
                        onCommunityUpdate={(update) => updateCommunity(it, update)}
                        onToast={setToast}
                      />
                    </article>
                  );
                })}
              </div>

              {/* 하단 📻 그 시절 한 줄 헤드라인 & 유행어 전광판 티커 바 */}
              {yearItems.length > 0 && (
                <section className="retro-ticker-section" aria-label={`${year}년 그 시절 한 줄 뉴스 & 유행어`}>
                  <div className="retro-ticker-head">
                    <span>📻 {year}년 그 시절 한 줄 헤드라인 & 유행어</span>
                    <small>클릭하면 자세히 볼 수 있어요</small>
                  </div>
                  <div className="retro-ticker-scroll">
                    {yearItems
                      .filter((it) => it.cat === "유행어·풍속" || it.cat === "사건·생활상" || !photoOf(it))
                      .slice(0, 24)
                      .map((it) => (
                        <button
                          key={`ticker-${it.title}`}
                          type="button"
                          className="ticker-btn"
                          onClick={() => setDetail({ item: it, photo: photoOf(it) })}
                        >
                          <span className="ticker-badge">{it.cat}</span>
                          <span>{it.title}</span>
                        </button>
                      ))}
                  </div>
                </section>
              )}

              {/* 특정 월 선택 시 연계되는 해당 연도 대표 추억 스마트 연계 섹션 */}
              {month && month !== "unknown" && shown.length < 5 && (
                <section className="month-fallback-section" aria-label={`${year}년 연중 대표 추억`}>
                  <h3 className="fallback-title">🌟 {year}년 대표 추억도 함께 둘러보세요</h3>
                  <div className="fallback-grid">
                    {yearItems.filter((it) => !it.month || it.month !== month).slice(0, 4).map((it) => {
                      const ph = photoOf(it);
                      return (
                        <div
                          key={`fb-${it.title}`}
                          className="fallback-card"
                          onClick={() => setDetail({ item: it, photo: ph })}
                        >
                          <div className="meta">
                            <span className="tag">{it.cat}</span>
                            {ph && <span className="tag ok">사진 있음</span>}
                          </div>
                          <h4 style={{ margin: "4px 0 2px", fontSize: "1rem" }}>{it.title}</h4>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-3)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.summary}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      )}

      {detail && <dialog className="detail-dialog" ref={detailRef} aria-labelledby="detail-title" onClose={() => setDetail(null)}>
        <button className="detail-close" onClick={() => detailRef.current.close()} aria-label="상세 닫기">✕</button>
        {detail.photo && <figure className="detail-photo"><img src={detail.photo.thumb} alt={detail.photo.title} /><figcaption>사진: {detail.photo.artist} · {detail.photo.license} · <a href={detail.photo.page} target="_blank" rel="noopener">원본</a></figcaption></figure>}
        <p className="detail-meta">{detail.item.year}년 {detail.item.month ? `${detail.item.month}월` : "· 월 미확인"} · {detail.item.cat}</p>
        <h2 id="detail-title">{detail.item.title}</h2>
        <p className="detail-summary">{detail.item.summary}</p>
        {detail.item.sources?.length > 0 && <p className="src">출처 {detail.item.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener">{s.name || "링크"}</a>)}</p>}
      </dialog>}
      {share && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="공유" onClick={(e) => e.target === e.currentTarget && setShare(null)}
          onKeyDown={(e) => e.key === "Escape" && setShare(null)}>
          <div className="box">
            <b>{share.title}</b>
            {typeof navigator.share === "function" && <button onClick={nativeShare} autoFocus>기기 공유 (카톡·인스타 등)</button>}
            <button onClick={() => copy(share.url, "링크를 복사했어요")}>링크 복사</button>
            <button onClick={() => copy(`${share.title}\n${share.text}\n${share.url}`, "공유 글을 복사했어요. 인스타·블로그에 붙여 넣으세요")}>공유 글 복사</button>
            <button onClick={() => setShare(null)}>닫기</button>
          </div>
        </div>
      )}

      {cheerOpen && <CheerSheet onClose={() => setCheerOpen(false)} onToast={setToast} />}

      {instaModalItem && (
        <InstagramCardModal
          item={instaModalItem.item}
          photo={instaModalItem.photo}
          onClose={() => setInstaModalItem(null)}
          onToast={setToast}
        />
      )}

      {writePostOpen && (
        <WritePostModal
          defaultYear={year || 1997}
          onClose={() => setWritePostOpen(false)}
          onToast={setToast}
          onPostCreated={(newPost) => {
            setYearDataCache((prev) => prev[newPost.year] ? { ...prev, [newPost.year]: { ...prev[newPost.year], posts: [newPost, ...(prev[newPost.year].posts || [])] } } : prev);
            if (newPost.year === year) setCustomPosts((prev) => [newPost, ...prev]);
          }}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <footer className="foot">
        자료는 위키백과·공공기관 등 공개 출처를 요약했습니다. 사진은 공개 라이선스 사진만 쓰고 작가·라이선스를 표시합니다.
      </footer>
    </div>
  );
}

// 응원 한마디 작성 창: 누구나 쓸 수 있고, 읽기는 관리자만
function CheerSheet({ onClose, onToast }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) { onToast("응원 내용을 적어 주세요."); return; }
    setSending(true);
    try {
      const response = await fetch("/api/cheer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: message.trim() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "응원을 보내지 못했습니다. 다시 시도해 주세요.");
      onToast("응원을 보냈어요. 고맙습니다!");
      onClose();
    } catch (error) {
      onToast(error.message || "응원을 남기지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="개발자에게 응원 한마디" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="box cheer-form" onSubmit={submit}>
        <b>개발자에게 응원 한마디</b>
        <p className="note">익명으로 남긴 글은 관리자만 볼 수 있어요.</p>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={5} placeholder="예: 1974년 보다가 울컥했어요. 고마워요!" aria-label="응원 내용" autoFocus />
        <div className="cheer-row">
          <small>{message.length}/500</small>
        </div>
        <button className="primary" type="submit" disabled={sending}>{sending ? "보내는 중…" : "보내기"}</button>
        <button type="button" onClick={onClose}>닫기</button>
      </form>
    </div>
  );
}

// 관리자 전용: 비밀번호는 현재 화면에만 보관한다.
function AdminCheers({ onToast }) {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  async function load(more = false) {
    setLoading(true);
    try {
      const query = more && cursor ? `?${new URLSearchParams({ beforeAt: cursor.at, beforeId: cursor.id })}` : "";
      const response = await fetch(`/api/cheer${query}`, { headers: { "x-admin-key": key }, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !Array.isArray(result.rows)) throw new Error(result.error || "응원 목록을 불러오지 못했습니다.");
      setRows((current) => more ? [...current, ...result.rows.filter((row) => !current.some((existing) => existing.id === row.id))] : result.rows);
      setCursor(result.rows.at(-1) || (more ? cursor : null));
      setHasMore(result.hasMore === true);
    } catch {
      if (!more) setRows(null);
      onToast("응원 목록을 불러오지 못했습니다. 비밀번호와 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }
  async function remove(id) {
    if (!confirm("이 응원 글을 지울까요?")) return;
    try {
      const response = await fetch(`/api/cheer?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-admin-key": key } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error();
      setRows((current) => current.filter((row) => row.id !== id));
      onToast("지웠습니다.");
    } catch {
      onToast("지우지 못했습니다.");
    }
  }
  return (
    <section className="admin">
      <h2 className="sec-h">응원 한마디 (관리자)</h2>
      {!rows ? (
        <form className="birth" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="관리자 비밀번호" aria-label="관리자 비밀번호" autoComplete="current-password" style={{ width: 260 }} />
          <button className="primary" type="submit" disabled={loading || !key}>{loading ? "불러오는 중…" : "열기"}</button>
        </form>
      ) : (
        <>
          <p className="note">불러온 {rows.length}개 · <button className="link" onClick={() => load()}>새로고침</button></p>
          {rows.length === 0 && <div className="empty">아직 응원 글이 없습니다.</div>}
          <ul className="result-list">
            {rows.map((r) => (
              <li key={r.id} className="cheer-item">
                <div><b>익명</b> <span className="r-cat">{new Date(r.at).toLocaleString("ko-KR")}</span></div>
                <p>{r.message}</p>
                <button className="link" onClick={() => remove(r.id)}>삭제</button>
              </li>
            ))}
          </ul>
          {hasMore && <button className="ghost" type="button" disabled={loading} onClick={() => load(true)}>{loading ? "불러오는 중…" : "더 보기"}</button>}
        </>
      )}
    </section>
  );
}
