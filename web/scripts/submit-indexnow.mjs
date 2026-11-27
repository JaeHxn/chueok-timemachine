// IndexNow URL 일괄 색인 요청 스크립트 (Bing, Naver/Daum 연동 지원, Yandex 등)
const HOST = 'chueok-timemachine.pages.dev';
const KEY = 'chueoktimemachine20261126indexnowkey';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const urlList = [
  `https://${HOST}/`,
  `https://${HOST}/llms.txt`,
  ...Array.from({ length: 77 }, (_, i) => `https://${HOST}/${1950 + i}`),
  ...['음악', 'TV·영화', '먹거리', '패션', '놀이·문구', '가전·기술', '사건·생활상', '유행어·풍속'].map(
    (c) => `https://${HOST}/cat/${encodeURIComponent(c)}`
  ),
];

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  }),
});

console.log('IndexNow status:', res.status, await res.text());
if (!res.ok) process.exit(1);
