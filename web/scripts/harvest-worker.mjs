// 한국어 위키백과 연도별 분류 기반 수집·크롤링·파싱 고속 워커
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const DIR = path.join(root, "수집");
const KO = "https://ko.wikipedia.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const UA = "chueok-timemachine/0.1 (https://chueok-timemachine.pages.dev)";

// CLI args
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
}

const FROM = Number(getArg("--from", process.env.FROM_YEAR || 1998));
const TO = Number(getArg("--to", process.env.TO_YEAR || 1998));
const WORKER_ID = getArg("--worker-id", `worker_${FROM}_${TO}`);
const CAP = Number(getArg("--cap", process.env.CAP || 120));

const workerPhotoFile = path.resolve(here, `../src/item-photos-${WORKER_ID}.json`);

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
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) {
        console.warn(`[${WORKER_ID}] HTTP ${r.status}, backing off ${2000 * i}ms...`);
        await sleep(2000 * i);
        continue;
      }
      return await r.json();
    } catch (err) {
      if (i === 4) console.error(`[${WORKER_ID}] Fetch failed: ${err.message}`);
      await sleep(1000 * i);
    }
  }
  return null;
}

async function members(cat) {
  const out = [];
  let cont = {};
  let pages = 0;
  do {
    const d = await api(KO, {
      action: "query",
      list: "categorymembers",
      cmtitle: "분류:" + cat,
      cmnamespace: "0",
      cmlimit: "500",
      ...cont
    });
    out.push(...(d?.query?.categorymembers ?? []).map((m) => m.title));
    cont = d?.continue ?? null;
    pages++;
  } while (cont && pages < 3); // max 1500 titles
  return out;
}

async function details(titles) {
  const chunks = [];
  for (let i = 0; i < titles.length; i += 20) {
    chunks.push(titles.slice(i, i + 20));
  }
  const res = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const batchRes = await Promise.all(
      batch.map(async (chunk) => {
        const d = await api(KO, {
          action: "query",
          titles: chunk.join("|"),
          redirects: "1",
          prop: "categories|extracts|pageimages|info",
          cllimit: "max",
          clshow: "!hidden",
          exintro: "1",
          explaintext: "1",
          exsentences: "3",
          exlimit: "20",
          piprop: "thumbnail|name",
          pithumbsize: "800",
          pilicense: "free",
          inprop: "url",
        });
        return (d?.query?.pages ?? []).filter((p) => !p.missing);
      })
    );
    for (const list of batchRes) res.push(...list);
    await sleep(150);
  }
  return res;
}

async function photoInfo(names) {
  const map = {};
  for (let i = 0; i < names.length; i += 50) {
    const d = await api(COMMONS, {
      action: "query",
      titles: names.slice(i, i + 50).map((n) => "File:" + n).join("|"),
      prop: "imageinfo",
      iiprop: "extmetadata|url",
    });
    for (const p of d?.query?.pages ?? []) {
      const ii = p.imageinfo?.[0];
      const m = ii?.extmetadata ?? {};
      const lic = m.LicenseShortName?.value ?? "";
      if (ii && OK_LICENSE.test(lic) && !/NC|ND/.test(lic)) {
        map[p.title.replace(/^File:/, "")] = {
          license: lic,
          artist: strip(m.Artist?.value) || "작가 미상",
          page: ii.descriptionurl,
        };
      }
    }
  }
  return map;
}

function extractMonth(text, year) {
  if (!text) return null;
  const m1 = text.match(new RegExp('(?:^|[^0-9])' + year + '년\\s*([1-9]|1[0-2])월'));
  if (m1) return parseInt(m1[1], 10);

  const m2 = text.match(new RegExp('(?:^|[^0-9])' + year + '년[^0-9\n.]{1,30}?([1-9]|1[0-2])월'));
  if (m2) return parseInt(m2[1], 10);

  const m3 = text.match(new RegExp('(?:^|[^0-9])' + year + '[.-]\\s*([1-9]|0[1-9]|1[0-2])[.-]'));
  if (m3) return parseInt(m3[1], 10);

  return null;
}

const fileOf = (y) => path.join(DIR, `텍스트_${Math.floor(y / 10) * 10}s.json`);
const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return [];
  }
};

const photos = {};
console.log(`[${WORKER_ID}] Starting harvest from ${FROM} to ${TO} (cap: ${CAP})...`);

for (let y = FROM; y <= TO; y++) {
  const sources = [
    { cat: `${y}년 시작한 대한민국의 텔레비전 프로그램`, category: "TV·영화", korea: true, cap: 30 },
    { cat: `${y}년 대한민국`, category: "사건·생활상", korea: true, cap: 40 },
    { cat: `${y}년 결성된 음악 그룹`, category: "음악", cap: 15 },
    { cat: `${y}년 영화`, category: "TV·영화", cap: 25 },
    { cat: `${y}년 음반`, category: "음악", cap: 20 },
    { cat: `${y}년 노래`, category: "음악", cap: 20 },
    { cat: `${y}년 싱글`, category: "음악", cap: 20 },
    { cat: `${y}년 비디오 게임`, category: "놀이·문구", cap: 15 },
    { cat: `${y}년 한국`, category: "사건·생활상", korea: true, cap: 20 },
    { cat: `${y}년 웹툰`, category: "놀이·문구", cap: 10 },
  ];

  const picked = new Map();
  for (const s of sources) {
    const rawTitles = await members(s.cat);
    if (!rawTitles.length) continue;
    const maxCandidate = s.korea ? Math.min(rawTitles.length, s.cap * 2) : Math.min(rawTitles.length, 120);
    const titles = rawTitles.slice(0, maxCandidate);

    const ok = [];
    for (const p of await details(titles)) {
      const cats = (p.categories ?? []).map((c) => c.title).join(" ");
      if (!s.korea && (!KOREA.test(cats) || NOT_KOREA.test(cats))) continue;
      if (/^(목록|분류|틀)/.test(p.title) || /목록$/.test(p.title)) continue;
      ok.push(p);
    }
    ok.sort((a, b) => (b.length || 0) - (a.length || 0));
    for (const p of ok.slice(0, s.cap)) {
      if (!picked.has(p.title)) picked.set(p.title, { p, category: s.category });
    }
  }

  const chosen = [...picked.values()].sort((a, b) => (b.p.length || 0) - (a.p.length || 0)).slice(0, CAP);
  const file = fileOf(y);
  const base = read(file);
  const seen = new Set(base.filter((x) => x.year).map((x) => `${x.year}|${norm(x.title)}`));
  const photoNames = chosen.map((c) => c.p.pageimage).filter(Boolean);
  const pinfo = photoNames.length ? await photoInfo(photoNames) : {};
  let added = 0, ph = 0, monthCount = 0;

  for (const { p, category } of chosen) {
    const key = `${y}|${norm(p.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const extract = (p.extract || "").replace(/\s+/g, " ").trim();
    const month = extractMonth(extract, y);
    if (month) monthCount++;

    base.push({
      year: y,
      month,
      date_precision: month ? "month" : "year",
      category,
      title: p.title,
      summary: extract.length > 180 ? extract.slice(0, 178) + "…" : extract || `${y}년 ${category} 관련 항목.`,
      sources: [{ url: p.fullurl, name: `위키백과: ${p.title}`, license: "CC BY-SA 4.0" }],
      confidence: "high",
      collected_by: "wiki-category",
      wiki_checked: true,
    });
    added++;

    const info = p.pageimage && pinfo[p.pageimage];
    if (info && p.thumbnail?.source) {
      photos[`${y}|${p.title}`] = {
        title: p.pageimage.replace(/\.[A-Za-z]+$/, ""),
        thumb: p.thumbnail.source,
        page: info.page,
        artist: info.artist,
        license: info.license,
        via: p.fullurl,
      };
      ph++;
    }
  }

  base.sort((a, b) => a.year - b.year || (a.month ?? 99) - (b.month ?? 99));
  fs.writeFileSync(file, JSON.stringify(base, null, 2), "utf8");
  fs.writeFileSync(workerPhotoFile, JSON.stringify(photos, null, 2), "utf8");

  console.log(`[${WORKER_ID}] ${y}년: 후보 ${picked.size}개 중 신규 추가 ${added}개 (월 배정 ${monthCount}개), 사진 ${ph}장. 전체 ${base.filter(x => x.year === y).length}개`);
}

console.log(`[${WORKER_ID}] Done harvest ${FROM} ~ ${TO}. Total photos collected: ${Object.keys(photos).length}`);
