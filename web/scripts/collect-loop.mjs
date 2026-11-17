// 연도당 출처 확인 항목 TARGET개를 채울 때까지 반복 수집한다.
// 라운드마다: 부족한 연대별로 Codex 병렬 수집 → 병합(중복 제외) → 위키백과 검증(enrich-wiki) → 집계
// 1분마다 진행 상황을 ~/.claude/status/board.json(터미널 상태줄)과 수집/진행상황.md 에 기록한다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const DIR = path.join(root, "수집");
const TMP = path.join(os.tmpdir(), "chueok-collect");
const BOARD = path.join(os.homedir(), ".claude", "status", "board.json");
const TARGET = Number(process.env.TARGET || 100);
const MAX_ROUNDS = Number(process.env.ROUNDS || 8);
const PER_YEAR_ASK = 25;
const YEARS = Array.from({ length: 77 }, (_, i) => 1950 + i);
fs.mkdirSync(TMP, { recursive: true });

const startedAt = new Date().toISOString();
let round = 0, phase = "준비", lastAdded = 0;

const fileOf = (dec) => path.join(DIR, `텍스트_${dec}s.json`);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; } };
const verified = (x) => x.year && (x.sources || []).some((s) => s.url);
function counts() {
  const c = Object.fromEntries(YEARS.map((y) => [y, 0]));
  for (let d = 1950; d <= 2020; d += 10) for (const x of read(fileOf(d))) if (verified(x) && c[x.year] != null) c[x.year]++;
  return c;
}

function report() {
  const c = counts();
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const done = YEARS.filter((y) => c[y] >= TARGET).length;
  const rows = [];
  for (let d = 1950; d <= 2020; d += 10) {
    const ys = YEARS.filter((y) => y >= d && y < d + 10);
    const sum = ys.reduce((a, y) => a + c[y], 0);
    rows.push(`| ${d}년대 | ${sum} | ${Math.min(...ys.map((y) => c[y]))} | ${Math.max(...ys.map((y) => c[y]))} | ${ys.filter((y) => c[y] >= TARGET).length}/${ys.length} |`);
  }
  const now = new Date();
  const md = `# 수집 진행 상황 (자동 갱신, 1분마다)\n\n- 갱신: ${now.toLocaleString("ko-KR")}\n- 목표: 연도당 출처 확인 ${TARGET}개\n- 라운드: ${round}/${MAX_ROUNDS} · 단계: ${phase} · 직전 라운드 추가: ${lastAdded}개\n- 전체 확인 항목: **${total}개** · 목표 달성 연도: **${done}/77**\n\n| 연대 | 확인 항목 | 연도 최소 | 연도 최대 | 목표 달성 연도 |\n|---|---|---|---|---|\n${rows.join("\n")}\n`;
  fs.writeFileSync(path.join(DIR, "진행상황.md"), md, "utf8");
  try {
    fs.mkdirSync(path.dirname(BOARD), { recursive: true });
    const running = phase !== "완료" && phase !== "중단";
    fs.writeFileSync(BOARD, JSON.stringify({
      updated: now.toISOString(), title: "추억 타임머신 자료 수집",
      tasks: [{ name: `연도당 ${TARGET}개 수집 · R${round} ${phase} · 확인 ${total}개 · 달성 ${done}/77`, owner: "Codex+스크립트",
        state: running ? "running" : "done", startedAt, ...(running ? {} : { endedAt: now.toISOString() }), note: `직전 추가 ${lastAdded}` }],
    }, null, 2), "utf8");
  } catch {}
  return { c, total, done };
}

function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { shell: false, ...opts });
    p.on("close", (code) => res(code));
    p.on("error", () => res(-1));
  });
}

function prompt(dec, needYears, exclude) {
  return `한국 ${needYears.join(", ")}년에 대중에게 유행·화제였던 노래, 영화, TV 프로그램, 먹거리·과자·음료, 패션, 장난감·놀이·문구, 가전·기술 제품, 게임, 스포츠 스타·경기, 사건, 유행어를 추가로 수집한다.
각 연도 ${PER_YEAR_ASK}개 이상 새로 찾아라. 아래 "이미 있는 목록"과 같은 것은 제외.
각 항목에 반드시 실제로 존재하는 한국어 위키백과 문서 URL(https://ko.wikipedia.org/wiki/...)을 출처로 붙여라. 그 문서에 해당 연도가 나와야 한다. 위키백과 문서가 없으면 그 항목은 넣지 말 것. 지어내지 말 것.
title은 위키백과 문서 제목과 같은 이름을 쓴다.
category: 음악, TV·영화, 먹거리, 패션, 놀이·문구, 가전·기술, 사건·생활상, 유행어·풍속 중 하나.
출력: 설명 없이 JSON 배열만. 원소: {"year":int,"month":int|null,"date_precision":"month|year|approx","category":"...","title":"...","summary":"1~2문장 직접 요약","sources":[{"url":"...","name":"위키백과: 문서명","license":"CC BY-SA 4.0"}],"confidence":"high|medium"}
이미 있는 목록: ${exclude.join(" / ")}`;
}

async function codexJob(dec, needYears) {
  const exclude = read(fileOf(dec)).filter((x) => x.year).map((x) => `${x.year}:${x.title}`);
  const pf = path.join(TMP, `p${dec}.txt`), of = path.join(TMP, `o${dec}.json`);
  fs.writeFileSync(pf, prompt(dec, needYears, exclude), "utf8");
  const env = { ...process.env }; delete env.OPENAI_API_KEY; // 구독 인증만 사용
  // 프롬프트는 표준 입력으로 전달("-"), 결과는 표준 출력에서 받는다
  await new Promise((res) => {
    const p = spawn("codex", ["exec", "--skip-git-repo-check", "-s", "read-only", "-"], { shell: true, env });
    const out = fs.createWriteStream(of);
    p.stdout.pipe(out);
    p.stderr.resume();
    p.on("close", () => out.end(res));
    p.on("error", () => out.end(res));
    p.stdin.end(fs.readFileSync(pf, "utf8"));
  });
  return of;
}

function merge(dec, outFile) {
  let extra = [];
  try { const t = fs.readFileSync(outFile, "utf8"); extra = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)); } catch { return 0; }
  const base = read(fileOf(dec));
  const seen = new Set(base.filter((x) => x.year).map((x) => `${x.year}|${x.title}`));
  let add = 0;
  for (const x of extra) {
    if (!x?.year || !x?.title || x.year < dec || x.year > dec + 9) continue;
    const k = `${x.year}|${x.title}`;
    if (seen.has(k)) continue;
    seen.add(k); base.push(x); add++;
  }
  base.sort((a, b) => a.year - b.year || (a.month ?? 99) - (b.month ?? 99));
  fs.writeFileSync(fileOf(dec), JSON.stringify(base, null, 2), "utf8");
  return add;
}

const timer = setInterval(report, 60_000);
report();

// 이전에 띄워 둔 Codex 결과(m*.json)가 있으면 먼저 병합
const prevDir = process.env.PREV_DIR;
if (prevDir) for (let d = 1950; d <= 1990; d += 10) lastAdded += merge(d, path.join(prevDir, `m${d}.json`));

let stale = 0;
for (round = 1; round <= MAX_ROUNDS; round++) {
  const c = counts();
  const jobs = [];
  for (let d = 1950; d <= 2020; d += 10) {
    const need = YEARS.filter((y) => y >= d && y < d + 10 && c[y] < TARGET);
    if (need.length) jobs.push([d, need]);
  }
  if (!jobs.length) break;
  phase = `Codex 수집 ${jobs.length}개 병렬`; report();
  const outs = await Promise.all(jobs.map(([d, need]) => codexJob(d, need).then((o) => [d, o])));
  phase = "병합"; lastAdded = outs.reduce((a, [d, o]) => a + merge(d, o), 0); report();
  phase = "위키백과 검증"; report();
  await run(process.execPath, [path.join(here, "enrich-wiki.mjs")], { stdio: "ignore" });
  report();
  stale = lastAdded === 0 ? stale + 1 : 0;
  if (stale >= 2) { phase = "중단"; break; } // 두 라운드 연속 새 항목 없음
}
if (phase !== "중단") phase = "완료";
clearInterval(timer);
const f = report();
console.log(`끝: 확인 ${f.total}개, 목표 달성 ${f.done}/77, 라운드 ${Math.min(round, MAX_ROUNDS)}`);
