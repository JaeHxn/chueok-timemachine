// generate-sitemap.mjs: 1950~2026 전체 연도 및 대표 콘텐츠 사이트맵 XML 생성
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://chueok-timemachine.pages.dev';
const TODAY = new Date().toISOString().split('T')[0];

// 연도 범위: 1950 ~ 2026
const YEARS = [];
for (let y = 1950; y <= 2026; y++) {
  YEARS.push(y);
}

// 8대 카테고리
const CATEGORIES = [
  '음악', 'TV·영화', '먹거리', '패션', '놀이·문구', '가전·기술', '사건·생활상', '유행어·풍속'
];

// 사진 데이터 로드 (킬러 아이템 URL 추출)
let photoItems = [];
try {
  const photoPath = path.resolve(__dirname, '../src/item-photos.json');
  if (fs.existsSync(photoPath)) {
    const raw = JSON.parse(fs.readFileSync(photoPath, 'utf8'));
    photoItems = Object.keys(raw);
  }
} catch (e) {
  console.warn('item-photos.json 로드 건너뜀:', e.message);
}

const urls = [];

// 1. 루트 홈페이지
urls.push({
  loc: `${BASE_URL}/`,
  lastmod: TODAY,
  changefreq: 'daily',
  priority: '1.0'
});

// 2. 77개 전체 연도 (1950 ~ 2026)
for (const year of YEARS) {
  // 대표 연대(1970, 1980, 1990, 2000, 2002 등)는 가중치 0.8, 나머지는 0.7
  const isMilestone = [1970, 1974, 1980, 1982, 1988, 1990, 1993, 1997, 1998, 2000, 2002, 2010, 2020].includes(year);
  urls.push({
    loc: `${BASE_URL}/#/${year}`,
    lastmod: TODAY,
    changefreq: 'weekly',
    priority: isMilestone ? '0.8' : '0.7'
  });
}

// 3. 8대 카테고리 페이지
for (const cat of CATEGORIES) {
  urls.push({
    loc: `${BASE_URL}/#/cat/${encodeURIComponent(cat)}`,
    lastmod: TODAY,
    changefreq: 'weekly',
    priority: '0.6'
  });
}

// 4. 대표 사진 아이템 (상위 183개)
for (const title of photoItems) {
  urls.push({
    loc: `${BASE_URL}/#/item/${encodeURIComponent(title)}`,
    lastmod: TODAY,
    changefreq: 'monthly',
    priority: '0.5'
  });
}

// XML 생성
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

const pubDir = path.resolve(__dirname, '../public');
fs.mkdirSync(pubDir, { recursive: true });
fs.writeFileSync(path.join(pubDir, 'sitemap.xml'), sitemapXml, 'utf8');

console.log(`sitemap.xml 생성 완료: 총 ${urls.length}개 URL (연도 77개, 카테고리 8개, 사진 아이템 ${photoItems.length}개)`);
