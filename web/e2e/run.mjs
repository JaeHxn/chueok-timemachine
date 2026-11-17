// E2E: 실제 Chrome(agent-browser)으로 사용자 흐름을 재현한다.
// 사용: node e2e/run.mjs [URL]   (기본 http://localhost:4173/)
import { execFileSync } from "node:child_process";

const BASE = process.argv[2] || "http://localhost:4173/";
const ab = (...args) => execFileSync("agent-browser", args, { encoding: "utf8", shell: true }).trim();
const js = (code) => {
  const out = ab("eval", JSON.stringify(`JSON.stringify((()=>{${code}})())`));
  const line = out.split("\n").filter(Boolean).pop();
  return JSON.parse(JSON.parse(line));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
async function test(name, fn) {
  try { const note = await fn(); results.push({ name, ok: true, note: note ?? "" }); }
  catch (e) { results.push({ name, ok: false, note: e.message.split("\n")[0] }); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
async function nav(hash) { js(`location.hash=${JSON.stringify(hash)};return 1`); await wait(300); }

for (const vp of [{ name: "데스크톱", w: 1280, h: 860 }, { name: "모바일", w: 375, h: 812 }]) {
  ab("open", BASE);
  ab("set", "viewport", String(vp.w), String(vp.h));
  ab("open", BASE + "#/");
  await wait(500);
  const P = `[${vp.name}] `;

  await test(P + "첫 화면: 안내·출생연도 입력·바로가기 표시", () => {
    const r = js(`return {lead:!!document.querySelector('.lead'),birth:!!document.querySelector('#birth'),chips:document.querySelectorAll('.chip').length}`);
    assert(r.lead && r.birth && r.chips > 0, JSON.stringify(r));
    return `바로가기 ${r.chips}개`;
  });

  await test(P + "바로가기 클릭 → 연도 화면·카드 즉시 표시", async () => {
    js(`document.querySelector('.chip[href="#/1974"]').click();return 1`); await wait(300);
    const r = js(`return {hash:location.hash,h2:document.querySelector('.year-head h2')?.textContent,cards:document.querySelectorAll('.card').length}`);
    assert(r.hash === "#/1974" && r.h2 === "1974" && r.cards > 0, JSON.stringify(r));
    return `카드 ${r.cards}개 (클릭 1번)`;
  });

  await test(P + "자료 있는 달 클릭 → 그달 카드만", async () => {
    const m = js(`const a=document.querySelector('a.moon.has');a.click();return a.getAttribute('href')`); await wait(300);
    const mon = Number(m.split("/")[2]);
    const r = js(`return [...document.querySelectorAll('.card .meta .tag:first-child')].map(t=>t.textContent)`);
    assert(r.length > 0 && r.every((t) => t.includes(`${mon}월`)), `${m} ${JSON.stringify(r)}`);
    return `${mon}월 ${r.length}개`;
  });

  await test(P + "자료 없는 달은 누를 수 없음", () => {
    const r = js(`return {dead:document.querySelectorAll('span.moon').length,deadLinks:document.querySelectorAll('span.moon a').length}`);
    assert(r.deadLinks === 0, JSON.stringify(r));
    return `비활성 달 ${r.dead}개`;
  });

  await test(P + "브라우저 뒤로가기 → 직전 화면", async () => {
    js(`history.back();return 1`); await wait(400);
    const h = js(`return location.hash`);
    assert(h === "#/1974", h);
  });

  await test(P + "분류 필터 → 해당 분류만", async () => {
    const c = js(`const b=document.querySelectorAll('.cats button')[1];b.click();return b.firstChild.textContent.trim()`); await wait(200);
    const r = js(`return [...document.querySelectorAll('.card .meta .tag:nth-child(2)')].map(t=>t.textContent)`);
    assert(r.length > 0 && r.every((t) => t === c), `${c} ${JSON.stringify(r)}`);
    return `${c} ${r.length}개`;
  });

  await test(P + "키보드 → 다음 연도", async () => {
    js(`document.activeElement?.blur();dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));return 1`); await wait(300);
    const h = js(`return location.hash`);
    assert(h === "#/1975", h);
  });

  await test(P + "공유 링크 주소로 직접 접속 → 그 화면", async () => {
    ab("open", BASE + "#/1953/7"); await wait(500);
    const r = js(`return {h2:document.querySelector('.year-head h2')?.textContent,cur:document.querySelector('.moon.on')?.textContent}`);
    assert(r.h2 === "1953" && r.cur?.startsWith("7월"), JSON.stringify(r));
  });

  await test(P + "자료 없는 해 → 안내 + 가까운 해 버튼", async () => {
    await nav("#/2010");
    const r = js(`const a=document.querySelector('.empty a');return {text:document.querySelector('.empty')?.textContent,href:a?.getAttribute('href')}`);
    assert(r.text?.includes("준비 중") && r.href, JSON.stringify(r));
    return `→ ${r.href}`;
  });

  await test(P + "검색 '라면' → 결과 → 클릭 이동", async () => {
    js(`const i=document.querySelector('.search');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,'라면');i.dispatchEvent(new Event('input',{bubbles:true}));return 1`); await wait(300);
    const n = js(`return document.querySelectorAll('.result-list a').length`);
    assert(n > 0, "결과 0건");
    const href = js(`const a=document.querySelector('.result-list a');a.click();return a.getAttribute('href')`); await wait(300);
    const r = js(`return {hash:location.hash,search:document.querySelector('.search').value}`);
    assert(r.hash === href && r.search === "", JSON.stringify(r));
    return `${n}건`;
  });

  await test(P + "출생연도 입력 → 그 해로 이동", async () => {
    await nav("#/");
    js(`const i=document.querySelector('#birth');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,'1965');i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.birth').requestSubmit();return 1`); await wait(300);
    const h = js(`return location.hash`);
    assert(h === "#/1965", h);
  });

  await test(P + "잘못된 출생연도 → 안내 문구", async () => {
    await nav("#/");
    js(`const i=document.querySelector('#birth');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,'1800');i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.birth').requestSubmit();return 1`); await wait(200);
    const r = js(`return {hash:location.hash,toast:document.querySelector('.toast')?.textContent}`);
    assert(r.hash === "#/" && r.toast, JSON.stringify(r));
  });

  await test(P + "공유 시트: 열기 → 카드 주소 → 복사 피드백 → 닫기", async () => {
    await nav("#/1974");
    js(`document.querySelector('.share-btn').click();return 1`); await wait(200);
    const open = js(`return !!document.querySelector('.sheet')`);
    assert(open, "시트 안 열림");
    js(`[...document.querySelectorAll('.sheet button')].find(b=>b.textContent==='링크 복사').click();return 1`); await wait(300);
    const t = js(`return document.querySelector('.toast')?.textContent||''`);
    assert(t.length > 0, "복사 피드백 없음");
    js(`[...document.querySelectorAll('.sheet button')].find(b=>b.textContent==='닫기').click();return 1`); await wait(200);
    assert(!js(`return !!document.querySelector('.sheet')`), "닫히지 않음");
    return t;
  });

  await test(P + "가로 넘침 없음", () => {
    const r = js(`return {sw:document.documentElement.scrollWidth,iw:innerWidth}`);
    assert(r.sw <= r.iw + 1, JSON.stringify(r));
  });

  await test(P + "터치 대상 44px 이상 (연도·달·분류·공유)", () => {
    const r = js(`return [...document.querySelectorAll('.yb,a.moon,.cats button,.share-btn,.primary,.chip')].filter(e=>e.offsetParent).map(e=>{const b=e.getBoundingClientRect();return {c:e.className.split(' ')[0],h:Math.round(b.height),w:Math.round(b.width)}}).filter(x=>x.h<44||x.w<44)`);
    const kinds = [...new Set(r.map((x) => `${x.c}(${x.w}x${x.h})`))];
    assert(r.length === 0, "작은 대상: " + kinds.slice(0, 6).join(", "));
  });

  ab("screenshot", `e2e/shot-${vp.w}.png`);
}

ab("close");
const pass = results.filter((r) => r.ok).length;
console.log(`\n결과: ${pass}/${results.length} 통과\n`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.name}${r.note ? " | " + r.note : ""}`);
process.exit(pass === results.length ? 0 : 1);
