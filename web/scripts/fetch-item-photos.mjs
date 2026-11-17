// 자료 항목(제목) 하나하나에 대해 위키미디어 커먼즈에서 대응하는 공개 사진을 찾는다.
// 결과: src/item-photos.json  (항목 키: "연도|제목")
// 재사용 가능한 라이선스(CC0, 퍼블릭 도메인, CC BY, CC BY-SA)만 남기고, NC·ND는 제외한다.
// 찾지 못한 항목은 저장하지 않는다(사이트에서는 "사진 준비 중"으로 표시).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ITEMS = path.resolve(here, "../src/items.json");
const OUT = path.resolve(here, "../src/item-photos.json");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "chueok-timemachine/0.1 (https://chueok-timemachine.pages.dev)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OK_LICENSE = /^(CC0|Public domain|PD-|CC BY(-SA)?)/i;
const NO_LICENSE = /(NC|ND)/i;
const strip = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function getJson(url) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (i === 3) throw e;
      await sleep(1500 * i);
    }
  }
}

// 제목으로 파일 검색 → 라이선스가 맞는 첫 사진 1장
async function findPhoto(query) {
  const q = new URLSearchParams({
    action: "query", format: "json", generator: "search",
    gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "10",
    prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "800",
  });
  const data = await getJson(`${API}?${q}`);
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const m = ii.extmetadata ?? {};
    const license = m.LicenseShortName?.value ?? m.License?.value ?? "";
    if (!OK_LICENSE.test(license) || NO_LICENSE.test(license)) continue;
    return {
      title: p.title.replace(/^File:/, "").replace(/\.[A-Za-z]+$/, ""),
      thumb: ii.thumburl || ii.url,
      page: ii.descriptionurl,
      artist: strip(m.Artist?.value) || "작가 미상",
      license,
    };
  }
  return null;
}

const items = JSON.parse(fs.readFileSync(ITEMS, "utf8"));
const found = {};
let n = 0;
for (const it of items) {
  n++;
  // 검색어: 제목에서 괄호·따옴표 뒤 설명을 떼고 핵심 이름만 쓴다
  const query = it.title.replace(/[()'"「」『』].*$/, "").trim();
  if (!query) continue;
  const photo = await findPhoto(query);
  const key = `${it.year}|${it.title}`;
  if (photo) found[key] = { ...photo, query };
  console.log(`${n}/${items.length} ${it.year} ${query} → ${photo ? "찾음" : "없음"}`);
  await sleep(300);
}

fs.writeFileSync(OUT, JSON.stringify(found, null, 2), "utf8");
console.log(`item-photos.json: ${Object.keys(found).length}/${items.length}개 항목에 사진`);
