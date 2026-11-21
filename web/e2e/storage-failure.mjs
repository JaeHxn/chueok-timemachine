// Run against a local test server: node e2e/storage-failure.mjs http://127.0.0.1:5173/
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "http://127.0.0.1:5173/";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/$/.test(base)) throw new Error("Use a local test server only");
const env = { ...process.env, AGENT_BROWSER_SESSION: "storage-failure-test" };
const ab = (...args) => execFileSync("agent-browser", args, { encoding: "utf8", shell: true, env }).trim();
const js = (code) => {
  const result = ab("eval", JSON.stringify(`JSON.stringify((()=>{${code}})())`));
  return JSON.parse(JSON.parse(result.split("\n").filter(Boolean).pop()));
};
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  ab("open", `${base}#/1974`);
  await wait();
  js(`const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='chueok_user_posts'||k.startsWith('cmt_local_')||k.startsWith('react_state_'))throw new DOMException('full','QuotaExceededError');return original.call(this,k,v)};return 1`);

  js(`document.querySelector('.write-post-btn').click();return 1`); await wait();
  js(`const form=document.querySelector('.post-form-box');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const title=form.querySelector('input[placeholder^="예: 초등학교"]');set.call(title,'실패 검사 제목');title.dispatchEvent(new Event('input',{bubbles:true}));const text=form.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(text,'실패 검사 내용');text.dispatchEvent(new Event('input',{bubbles:true}));return 1`); await wait();
  js(`document.querySelector('.post-form-box').requestSubmit();return 1`); await wait();
  const post = js(`return {open:!!document.querySelector('.post-form-box'),title:document.querySelector('.post-form-box input[placeholder^="예: 초등학교"]')?.value,content:document.querySelector('.post-form-box textarea')?.value,toast:document.querySelector('.toast')?.textContent}`);
  assert(post.open && post.title === '실패 검사 제목' && post.content === '실패 검사 내용' && post.toast?.includes('저장하지 못'), `post ${JSON.stringify(post)}`);

  js(`document.querySelector('.post-btn-row .ghost').click();document.querySelector('.comment-toggle-btn').click();return 1`); await wait();
  js(`const input=document.querySelector('.comment-textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'보존할 댓글');input.dispatchEvent(new Event('input',{bubbles:true}));return 1`); await wait();
  js(`document.querySelector('.comment-form').requestSubmit();return 1`); await wait();
  const comment = js(`return {content:document.querySelector('.comment-textarea')?.value,toast:document.querySelector('.toast')?.textContent}`);
  assert(comment.content === '보존할 댓글' && comment.toast?.includes('저장하지 못'), `comment ${JSON.stringify(comment)}`);

  const pressedBefore = js(`return document.querySelector('.like-button').getAttribute('aria-pressed')`);
  js(`document.querySelector('.like-button').click();return 1`); await wait();
  const reaction = js(`return {pressed:document.querySelector('.like-button').getAttribute('aria-pressed'),toast:document.querySelector('.toast')?.textContent}`);
  assert(reaction.pressed === pressedBefore && reaction.toast?.includes('저장하지 못'), `reaction ${JSON.stringify(reaction)}`);
  console.log('PASS: 사연·댓글 저장 실패 시 입력 보존, 반응 저장 실패 시 상태 유지');
} finally {
  ab('close');
}
