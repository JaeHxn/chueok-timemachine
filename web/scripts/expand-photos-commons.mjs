import fs from 'node:fs';
import path from 'node:path';

const ITEMS_PATH = path.resolve('web/src/items.json');
const PHOTOS_PATH = path.resolve('web/src/item-photos.json');

const items = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf8'));
const photos = JSON.parse(fs.readFileSync(PHOTOS_PATH, 'utf8'));

const TARGET_DECADES = new Set([1950, 1960, 1970, 2000, 2010, 2020]);
const MAX_NEW_PER_DECADE = 15;
const addedPerDecade = { 1950: 0, 1960: 0, 1970: 0, 2000: 0, 2010: 0, 2020: 0 };

const ALLOWED_LICENSE_RE = /^(cc[- ]by|cc0|public domain|pd)/i;

async function searchCommons(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrsearch', query);
  url.searchParams.set('gsrlimit', '3');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|mime');
  url.searchParams.set('iiurlwidth', '800');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ChueokTimemachineBot/1.0 (https://chueok-timemachine.pages.dev/)' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    if (!info.mime?.startsWith('image/') || info.mime === 'image/svg+xml') continue;
    const meta = info.extmetadata || {};
    const license = (meta.LicenseShortName?.value || '').replace(/<[^>]+>/g, '').trim();
    if (!ALLOWED_LICENSE_RE.test(license)) continue;
    const artist = (meta.Artist?.value || 'Wikimedia Commons').replace(/<[^>]+>/g, '').trim().slice(0, 80);
    return {
      title: p.title.replace(/^File:/, ''),
      thumb: info.thumburl || info.url,
      page: info.descriptionurl,
      artist: artist || 'Wikimedia Commons',
      license,
      query
    };
  }
  return null;
}

const candidates = items.filter((it) => {
  const dec = Math.floor(it.year / 10) * 10;
  if (!TARGET_DECADES.has(dec)) return false;
  const key = `${it.year}|${it.title}`;
  return !photos[key];
});

console.log(`Found ${candidates.length} candidate items without photos in target decades.`);

let totalAdded = 0;
for (const it of candidates) {
  const dec = Math.floor(it.year / 10) * 10;
  if (addedPerDecade[dec] >= MAX_NEW_PER_DECADE) continue;

  const cleanTitle = it.title.replace(/\([^)]*\)/g, '').trim();
  if (cleanTitle.length < 2) continue;

  try {
    const hit = await searchCommons(cleanTitle);
    if (hit) {
      const key = `${it.year}|${it.title}`;
      photos[key] = hit;
      addedPerDecade[dec]++;
      totalAdded++;
      console.log(`[+${dec}s] ${key} -> ${hit.license}`);
    }
  } catch (err) {
    // ignore transient network errors
  }
  await new Promise((r) => setTimeout(r, 150));
}

fs.writeFileSync(PHOTOS_PATH, JSON.stringify(photos, null, 2) + '\n', 'utf8');
console.log('Added per decade:', addedPerDecade);
console.log('Total added:', totalAdded, 'New total photos:', Object.keys(photos).length);
