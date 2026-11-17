// 수집 항목을 한국어 위키백과로 보강한다.
// 1) 항목 제목으로 위키백과 문서를 찾고, 문서 제목이 항목 이름과 맞을 때만 채택
// 2) 문서 본문에 항목 연도가 실제로 나오면 → 출처로 추가 (자동 검증, source_auto 표시)
// 3) 문서 대표 사진이 자유 라이선스면 → src/item-photos.json 에 사진 추가 (작가·라이선스 포함)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const PHOTOS = path.resolve(here, "../src/item-photos.json");
const KO = "https://ko.wikipedia.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const UA = "chueok-timemachine/0.1 (https://chueok-timemachine.pages.dev)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s).toLowerCase().replace(/[\s·\-_.,!?()\[\]「」『』'"‘’“”:]/g, "");
const strip = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const OK_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)?)/i;

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429) { await sleep(3000 * i); continue; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { if (i === 3) return null; await sleep(1500 * i); }
  }
  return null;
}

// 제목에서 핵심 이름만: 따옴표 안 이름 우선, 없으면 괄호·꾸밈말 제거
function coreName(title) {
  const q = title.match(/['‘"“「『]([^'’"”」』]{2,30})['’"”」』]/);
  if (q) return q[1].trim();
  return title.replace(/\(.*?\)/g, "").replace(/\s*(출시|개봉|발표|방영|첫 방송|개통|사건|유행|등장|인기)$/, "").trim();
}

async function lookup(it) {
  const name = coreName(it.title);
  if (norm(name).length < 2) return null;
  const s = await api(KO, { action: "query", list: "search", srsearch: name, srlimit: "3", srnamespace: "0" });
  const cand = (s?.query?.search ?? []).find((p) => {
    const a = norm(p.title.replace(/\(.*?\)/g, "")), b = norm(name);
    return a === b || (a.length >= 2 && b.includes(a)) || (b.length >= 2 && a.includes(b));
  });
  if (!cand) return null;
  const d = await api(KO, {
    action: "query", titles: cand.title, prop: "extracts|pageimages|info", inprop: "url",
    explaintext: "1", exchars: "8000", piprop: "thumbnail|name", pithumbsize: "800", pilicense: "free", redirects: "1",
  });
  const page = d?.query?.pages?.[0];
  if (!page || page.missing) return null;
  const yearOk = (page.extract || "").includes(String(it.year));
  let photo = null;
  if (page.pageimage && page.thumbnail?.source) {
    const c = await api(COMMONS, { action: "query", titles: "File:" + page.pageimage, prop: "imageinfo", iiprop: "extmetadata|url" });
    const ii = c?.query?.pages?.[0]?.imageinfo?.[0];
    const m = ii?.extmetadata ?? {};
    const license = m.LicenseShortName?.value ?? "";
    if (ii && OK_LICENSE.test(license) && !/NC|ND/.test(license)) {
      photo = { title: page.pageimage.replace(/\.[A-Za-z]+$/, ""), thumb: page.thumbnail.source, page: ii.descriptionurl,
        artist: strip(m.Artist?.value) || "작가 미상", license, via: page.fullurl };
    }
  }
  return { url: page.fullurl, title: page.title, yearOk, photo };
}

const files = fs.readdirSync(path.join(root, "수집")).filter((f) => /^텍스트_\d{4}s\.json$/.test(f));
const photos = fs.existsSync(PHOTOS) ? JSON.parse(fs.readFileSync(PHOTOS, "utf8")) : {};
const stats = [];
for (const f of files) {
  const p = path.join(root, "수집", f);
  const arr = JSON.parse(fs.readFileSync(p, "utf8"));
  let matched = 0, srcAdded = 0, photoAdded = 0;
  const todo = arr.filter((x) => x.year && x.title && !x.wiki_checked);
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async (it) => {
      const r = await lookup(it);
      it.wiki_checked = true;
      if (!r) return;
      matched++;
      if (r.yearOk && !(it.sources || []).some((s) => s.url === r.url)) {
        it.sources = [...(it.sources || []), { url: r.url, name: `위키백과: ${r.title}`, license: "CC BY-SA 4.0", source_auto: true }];
        if (it.confidence === "low") it.confidence = "medium";
        srcAdded++;
      }
      const key = `${it.year}|${it.title}`;
      if (r.photo && r.yearOk && !photos[key]) { photos[key] = r.photo; photoAdded++; }
    }));
    await sleep(200);
  }
  fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8");
  stats.push({ file: f, checked: todo.length, matched, srcAdded, photoAdded });
  console.log(JSON.stringify(stats.at(-1)));
}
fs.writeFileSync(PHOTOS, JSON.stringify(photos, null, 2), "utf8");
console.table(stats);
console.log("item-photos 총", Object.keys(photos).length);
