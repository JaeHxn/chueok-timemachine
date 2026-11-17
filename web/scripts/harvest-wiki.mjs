// 한국어 위키백과 연도별 분류에서 그 해의 한국 대중문화 항목을 직접 수집한다(크롤링·파싱).
// 연도 근거 = 분류 소속(예: "1997년 시작한 대한민국의 텔레비전 프로그램").
// 전 세계 분류(영화·음반·노래·게임)는 문서가 '대한민국/한국' 분류에도 속할 때만 채택.
// 문서가 긴 순(유명도 대용)으로 연도당 CAP개까지. 요약=위키백과 첫 문장(CC BY-SA, 출처 표기).
// 진행 상황은 ~/.claude/status/board.json(상태줄)과 수집/진행상황.md 에 매 연도 갱신.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const DIR = path.join(root, "수집");
const PHOTOS = path.resolve(here, "../src/item-photos.json");
const BOARD = path.join(os.homedir(), ".claude", "status", "board.json");
const KO = "https://ko.wikipedia.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const UA = "chueok-timemachine/0.1 (https://chueok-timemachine.pages.dev)";
const CAP = Number(process.env.CAP || 120);
const FROM = Number(process.env.FROM_YEAR || 1950), TO = Number(process.env.TO_YEAR || 2026);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const norm = (s) => String(s).toLowerCase().replace(/\s*\(.*?\)\s*/g, "").replace(/[\s·\-_.,!?'"‘’“”:〈〉《》]/g, "");
const OK_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)?)/i;
const KOREA = /대한민국|한국|서울/;
const NOT_KOREA = /조선민주주의인민공화국|북한/;

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
      if (r.status === 429 || r.status >= 500) { await sleep(2500 * i); continue; }
      return await r.json();
    } catch { await sleep(1500 * i); }
  }
  return null;
}

async function members(cat) {
  const out = []; let cont = {};
  do {
    const d = await api(KO, { action: "query", list: "categorymembers", cmtitle: "분류:" + cat, cmnamespace: "0", cmlimit: "500", ...cont });
    out.push(...(d?.query?.categorymembers ?? []).map((m) => m.title));
    cont = d?.continue ?? null;
  } while (cont);
  return out;
}

// 20개씩: 분류·첫 문장·대표 사진·문서 길이·주소
async function details(titles) {
  const res = [];
  for (let i = 0; i < titles.length; i += 20) {
    const d = await api(KO, {
      action: "query", titles: titles.slice(i, i + 20).join("|"), redirects: "1",
      prop: "categories|extracts|pageimages|info", cllimit: "max", clshow: "!hidden",
      exintro: "1", explaintext: "1", exsentences: "2", exlimit: "20",
      piprop: "thumbnail|name", pithumbsize: "800", pilicense: "free", inprop: "url",
    });
    res.push(...(d?.query?.pages ?? []).filter((p) => !p.missing));
    await sleep(120);
  }
  return res;
}

async function photoInfo(names) {
  const map = {};
  for (let i = 0; i < names.length; i += 50) {
    const d = await api(COMMONS, { action: "query", titles: names.slice(i, i + 50).map((n) => "File:" + n).join("|"), prop: "imageinfo", iiprop: "extmetadata|url" });
    for (const p of d?.query?.pages ?? []) {
      const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
      const lic = m.LicenseShortName?.value ?? "";
      if (ii && OK_LICENSE.test(lic) && !/NC|ND/.test(lic)) map[p.title.replace(/^File:/, "")] = { license: lic, artist: strip(m.Artist?.value) || "작가 미상", page: ii.descriptionurl };
    }
  }
  return map;
}

const fileOf = (y) => path.join(DIR, `텍스트_${Math.floor(y / 10) * 10}s.json`);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; } };
const photos = fs.existsSync(PHOTOS) ? JSON.parse(fs.readFileSync(PHOTOS, "utf8")) : {};
const startedAt = new Date().toISOString();
const perYear = {};

function progress(y, note) {
  const verified = (x) => x.year && (x.sources || []).some((s) => s.url);
  const c = {};
  for (let d = 1950; d <= 2020; d += 10) for (const x of read(path.join(DIR, `텍스트_${d}s.json`))) if (verified(x)) c[x.year] = (c[x.year] || 0) + 1;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const ys = Array.from({ length: 77 }, (_, i) => 1950 + i);
  const done = ys.filter((yy) => (c[yy] || 0) >= 100).length;
  const rows = [];
  for (let d = 1950; d <= 2020; d += 10) {
    const dy = ys.filter((yy) => yy >= d && yy < d + 10);
    rows.push(`| ${d}년대 | ${dy.reduce((a, yy) => a + (c[yy] || 0), 0)} | ${Math.min(...dy.map((yy) => c[yy] || 0))} | ${Math.max(...dy.map((yy) => c[yy] || 0))} | ${dy.filter((yy) => (c[yy] || 0) >= 100).length}/${dy.length} |`);
  }
  const now = new Date();
  fs.writeFileSync(path.join(DIR, "진행상황.md"), `# 수집 진행 상황 (위키백과 분류 직접 수집)\n\n- 갱신: ${now.toLocaleString("ko-KR")}\n- 목표: 연도당 출처 확인 100개 (연도당 최대 ${CAP}개 수집)\n- 현재: ${y}년 처리 ${note}\n- 전체 확인 항목: **${total}개** · 사진 **${Object.keys(photos).length}장** · 목표 달성 연도: **${done}/77**\n\n| 연대 | 확인 항목 | 연도 최소 | 연도 최대 | 목표 달성 연도 |\n|---|---|---|---|---|\n${rows.join("\n")}\n`, "utf8");
  try {
    const running = note !== "완료";
    fs.writeFileSync(BOARD, JSON.stringify({ updated: now.toISOString(), title: "추억 타임머신 자료 수집",
      tasks: [{ name: `위키백과 분류 수집 · ${y}년 · 확인 ${total}개 · 사진 ${Object.keys(photos).length} · 달성 ${done}/77`, owner: "스크립트",
        state: running ? "running" : "done", startedAt, ...(running ? {} : { endedAt: now.toISOString() }), note }] }, null, 2), "utf8");
  } catch {}
}

for (let y = FROM; y <= TO; y++) {
  const sources = [
    { cat: `${y}년 시작한 대한민국의 텔레비전 프로그램`, category: "TV·영화", korea: true, cap: 25 },
    { cat: `${y}년 대한민국`, category: "사건·생활상", korea: true, cap: 40 },
    { cat: `${y}년 결성된 음악 그룹`, category: "음악", cap: 15 },
    { cat: `${y}년 영화`, category: "TV·영화", cap: 20 },
    { cat: `${y}년 음반`, category: "음악", cap: 15 },
    { cat: `${y}년 노래`, category: "음악", cap: 15 },
    { cat: `${y}년 비디오 게임`, category: "놀이·문구", cap: 10 },
  ];
  const picked = new Map();
  for (const s of sources) {
    const titles = await members(s.cat);
    if (!titles.length) continue;
    const ok = [];
    for (const p of await details(titles)) {
      const cats = (p.categories ?? []).map((c) => c.title).join(" ");
      if (!s.korea && (!KOREA.test(cats) || NOT_KOREA.test(cats))) continue;
      if (/^(목록|분류|틀)/.test(p.title) || /목록$/.test(p.title)) continue;
      ok.push(p);
    }
    ok.sort((a, b) => (b.length || 0) - (a.length || 0));
    for (const p of ok.slice(0, s.cap)) if (!picked.has(p.title)) picked.set(p.title, { p, category: s.category });
  }
  // 유명도 대용: 문서 길이 긴 순으로 CAP개
  const chosen = [...picked.values()].sort((a, b) => (b.p.length || 0) - (a.p.length || 0)).slice(0, CAP);
  const file = fileOf(y);
  const base = read(file);
  const seen = new Set(base.filter((x) => x.year).map((x) => `${x.year}|${norm(x.title)}`));
  const photoNames = chosen.map((c) => c.p.pageimage).filter(Boolean);
  const pinfo = photoNames.length ? await photoInfo(photoNames) : {};
  let added = 0, ph = 0;
  for (const { p, category } of chosen) {
    const key = `${y}|${norm(p.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const extract = (p.extract || "").replace(/\s+/g, " ").trim();
    const mm = extract.match(new RegExp(`${y}년\\s*(\\d{1,2})월`));
    const month = mm && +mm[1] >= 1 && +mm[1] <= 12 ? +mm[1] : null;
    base.push({
      year: y, month, date_precision: month ? "month" : "year", category,
      title: p.title, summary: extract.length > 180 ? extract.slice(0, 178) + "…" : extract || `${y}년 ${category} 관련 항목.`,
      sources: [{ url: p.fullurl, name: `위키백과: ${p.title}`, license: "CC BY-SA 4.0" }],
      confidence: "high", collected_by: "wiki-category", wiki_checked: true,
    });
    added++;
    const info = p.pageimage && pinfo[p.pageimage];
    if (info && p.thumbnail?.source) {
      photos[`${y}|${p.title}`] = { title: p.pageimage.replace(/\.[A-Za-z]+$/, ""), thumb: p.thumbnail.source, page: info.page, artist: info.artist, license: info.license, via: p.fullurl };
      ph++;
    }
  }
  base.sort((a, b) => a.year - b.year || (a.month ?? 99) - (b.month ?? 99));
  fs.writeFileSync(file, JSON.stringify(base, null, 2), "utf8");
  fs.writeFileSync(PHOTOS, JSON.stringify(photos, null, 2), "utf8");
  perYear[y] = { 후보: picked.size, 추가: added, 사진: ph };
  console.log(`${y}: 후보 ${picked.size} · 추가 ${added} · 사진 ${ph}`);
  progress(y, `(추가 ${added})`);
}
progress(TO, "완료");
console.log("완료");
