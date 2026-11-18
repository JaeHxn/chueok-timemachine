// 전체 수집 현황 집계 및 수집/진행상황.md 갱신
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const DIR = path.join(root, "수집");
const PHOTOS = path.resolve(here, "../src/item-photos.json");
const TARGET = 100;
const YEARS = Array.from({ length: 77 }, (_, i) => 1950 + i);

const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return [];
  }
};
const verified = (x) => x.year && (x.sources || []).some((s) => s.url);

function main() {
  const c = Object.fromEntries(YEARS.map((y) => [y, 0]));
  const months = Object.fromEntries(YEARS.map((y) => [y, 0]));

  for (let d = 1950; d <= 2020; d += 10) {
    const file = path.join(DIR, `텍스트_${d}s.json`);
    for (const x of read(file)) {
      if (verified(x) && c[x.year] != null) {
        c[x.year]++;
        if (x.month) months[x.year]++;
      }
    }
  }

  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const totalMonths = Object.values(months).reduce((a, b) => a + b, 0);
  const done = YEARS.filter((y) => c[y] >= TARGET).length;
  const photos = fs.existsSync(PHOTOS) ? JSON.parse(fs.readFileSync(PHOTOS, "utf8")) : {};

  const rows = [];
  for (let d = 1950; d <= 2020; d += 10) {
    const ys = YEARS.filter((y) => y >= d && y < d + 10);
    const sum = ys.reduce((a, y) => a + c[y], 0);
    const mSum = ys.reduce((a, y) => a + months[y], 0);
    const min = Math.min(...ys.map((y) => c[y]));
    const max = Math.max(...ys.map((y) => c[y]));
    const achieve = ys.filter((y) => c[y] >= TARGET).length;
    rows.push(`| ${d}년대 | ${sum} | ${mSum} | ${min} | ${max} | ${achieve}/${ys.length} |`);
  }

  const now = new Date();
  const md = `# 수집 진행 상황 (자동 집계)

- 갱신: ${now.toLocaleString("ko-KR")}
- 목표: 연도당 출처 확인 ${TARGET}개 (연도당 최대 120개 수집)
- 상태: 연도별 수집·크롤링·파싱 진행 중 / 완료
- 전체 확인 항목: **${total}개** (월 배정: **${totalMonths}개**, 자유 라이선스 사진: **${Object.keys(photos).length}장**)
- 목표 달성 연도: **${done}/77**

| 연대 | 확인 항목 | 월 배정 | 연도 최소 | 연도 최대 | 목표 달성 연도 |
|---|---:|---:|---:|---:|---:|
${rows.join("\n")}
`;

  fs.writeFileSync(path.join(DIR, "진행상황.md"), md, "utf8");
  console.log(md);
}

main();
