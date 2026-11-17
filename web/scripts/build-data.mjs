// 수집 JSON(텍스트_*.json)을 사이트용 src/items.json으로 변환한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const files = fs.readdirSync(path.join(root, "수집")).filter((f) => /^텍스트_\d{4}s\.json$/.test(f)).map((f) => "수집/" + f);

// 설계서 분류표 8개
const RULES = [
  [/음악|라디오|노래|가요/, "음악"],
  [/영화|TV|방송|연극|드라마/, "TV·영화"],
  [/먹거리|음료|식품|과자|라면|간식/, "먹거리"],
  [/패션|미용|복장|머리/, "패션"],
  [/놀이|장난감|문구|학교|만화|오락/, "놀이·문구"],
  [/가전|기술|교통|자동차|통신/, "가전·기술"],
  [/사건|사회|생활|정치|경제|전쟁/, "사건·생활상"],
  [/유행어|풍속|신조어/, "유행어·풍속"],
];
const mapCat = (c) => (RULES.find(([re]) => re.test(c || ""))?.[1]) ?? "사건·생활상";

const items = [];
let hidden = 0;
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  for (const x of arr) {
    if (!x.year || !x.title) continue; // 메모 행 제외
    if (!(x.sources || []).some((s) => s.url)) { hidden++; continue; } // 출처 없는 항목은 검수 전이라 공개하지 않음
    items.push({
      year: x.year,
      month: x.month ?? null,
      precision: x.date_precision || "year",
      cat: mapCat(x.category),
      title: x.title,
      summary: x.summary || "",
      sources: (x.sources || []).filter((s) => s.url),
      confidence: x.confidence || "low",
    });
  }
}
items.sort((a, b) => a.year - b.year || (a.month ?? 99) - (b.month ?? 99));

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/items.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(items, null, 2), "utf8");
console.log(`items.json: ${items.length}개 공개 · 출처 없어 비공개 ${hidden}개`);
