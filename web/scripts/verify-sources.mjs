// 수집 파일의 출처 URL을 실제로 열어 확인한다.
// 열리지 않는 링크(4xx·5xx·DNS 오류)는 빼고, 출처가 0개가 되면 confidence를 low로 낮춘다.
// 결과는 수집 파일에 그대로 반영하고, 요약을 출력한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const files = fs.readdirSync(path.join(root, "수집")).filter((f) => /^텍스트_\d{4}s\.json$/.test(f));
const UA = "Mozilla/5.0 (chueok-timemachine link check; https://chueok-timemachine.pages.dev)";
const cache = new Map();

async function alive(url) {
  if (cache.has(url)) return cache.get(url);
  let ok = false;
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    // 403/429는 봇 차단일 수 있어 사람 브라우저에선 열린다 → 살아 있음으로 본다
    ok = r.ok || r.status === 403 || r.status === 429;
  } catch { ok = false; }
  cache.set(url, ok);
  return ok;
}

const summary = [];
for (const f of files) {
  const p = path.join(root, "수집", f);
  const arr = JSON.parse(fs.readFileSync(p, "utf8"));
  const urls = [...new Set(arr.flatMap((x) => (x.sources || []).map((s) => s.url)).filter(Boolean))];
  // 동시 8개씩
  for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i, i + 8).map(alive));
  let dead = 0, lowered = 0;
  for (const x of arr) {
    if (!x.year) continue;
    const before = (x.sources || []).length;
    x.sources = (x.sources || []).filter((s) => s.url && cache.get(s.url));
    dead += before - x.sources.length;
    if (x.sources.length === 0 && x.confidence !== "low") { x.confidence = "low"; lowered++; }
  }
  fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8");
  const items = arr.filter((x) => x.year);
  summary.push({ file: f, items: items.length, urls: urls.length, deadLinks: dead, noSource: items.filter((x) => !x.sources.length).length, lowered });
}
console.table(summary);
