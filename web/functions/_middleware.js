// Cloudflare Pages Functions _middleware.js
// 연도(/1988), 카테고리(/cat/음악), 아이템(/1974/포니), 검색(/search?q=...) 경로에
// 크롤러(구글·네이버·빙·카카오·AI)가 읽을 수 있도록 동적 SEO 메타태그와 canonical URL을 주입합니다.

const CATS = ['음악', 'TV·영화', '먹거리', '패션', '놀이·문구', '가전·기술', '사건·생활상', '유행어·풍속'];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMetaForPath(url) {
  const pathname = url.pathname.replace(/^\/+|\/+$/g, '');
  if (!pathname) return null;

  const parts = pathname.split('/').map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });

  if (parts[0] === 'search') {
    const q = (url.searchParams.get('q') || '').trim();
    const title = q ? `“${q}” 검색 결과 — 추억 타임머신` : '추억 검색 — 추억 타임머신';
    const desc = q
      ? `추억 타임머신에서 '${q}' 관련 1950~2026 대한민국 레트로 추억을 검색한 결과입니다.`
      : '1950~2026 대한민국 연도별 노래, 영화, 먹거리, 물건, 사건을 검색해 보세요.';
    const canonical = q ? `${url.origin}/search?q=${encodeURIComponent(q)}` : `${url.origin}/search`;
    return { title, desc, canonical };
  }

  if (parts[0] === 'cat' && parts[1] && CATS.includes(parts[1])) {
    const cat = parts[1];
    return {
      title: `${cat} 추억 모음 — 추억 타임머신`,
      desc: `1950년부터 2026년까지 대한민국 '${cat}' 분야의 대표 추억 아카이브를 한눈에 탐색하세요.`,
      canonical: `${url.origin}/cat/${encodeURIComponent(cat)}`,
    };
  }

  if (parts[0] === 'item' && parts[1]) {
    const item = parts.slice(1).join('/');
    return {
      title: `${item} — 추억 타임머신`,
      desc: `그 시절 우리가 사랑했던 '${item}'의 기록과 이야기를 추억 타임머신에서 확인하세요.`,
      canonical: `${url.origin}/item/${encodeURIComponent(item)}`,
    };
  }

  const y = Number(parts[0]);
  if (Number.isInteger(y) && y >= 1950 && y <= 2026) {
    const month = parts[1] && /^\d{1,2}$/.test(parts[1]) ? Number(parts[1]) : null;
    const item = parts.length >= 3 ? parts.slice(2).join('/') : (parts[1] && !month && parts[1] !== 'unknown' ? parts[1] : null);
    if (item) {
      return {
        title: `${y}년 '${item}' — 추억 타임머신`,
        desc: `${y}년 대한민국의 추억 '${item}'에 대한 상세 기록과 사연을 확인하세요.`,
        canonical: `${url.origin}/${y}/${encodeURIComponent(item)}`,
      };
    }
    const ymLabel = month && month >= 1 && month <= 12 ? `${y}년 ${month}월` : `${y}년`;
    return {
      title: `${ymLabel} 추억 아카이브 — 추억 타임머신`,
      desc: `${ymLabel} 대한민국에서 유행했던 노래, 영화, 과자, 물건, 사회 사건을 타임머신으로 다시 만나보세요.`,
      canonical: month ? `${url.origin}/${y}/${month}` : `${url.origin}/${y}`,
    };
  }

  return null;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const meta = buildMetaForPath(url);
  if (!meta) {
    return response;
  }

  const titleEsc = escapeHtml(meta.title);
  const descEsc = escapeHtml(meta.desc);
  const canonEsc = escapeHtml(meta.canonical);

  let html = await response.text();
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${titleEsc}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${descEsc}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonEsc}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${titleEsc}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${descEsc}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${canonEsc}" />`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
