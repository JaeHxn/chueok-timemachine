// 스팸, 비속어, 욕설, 음란, 사기/도박 자동 필터링 모듈
export const BAD_WORD_MESSAGE = "건전한 추억 공유 문화를 위해 부적절한 표현이나 광고성 단어가 포함된 사연은 등록할 수 없습니다.";

// 1. 단어 목록 (키워드 및 정규식)
const EXACT_OR_PREFIX_PATTERNS = [
  // 심한 욕설 및 비속어
  /씨[발빨바팔]/i,
  /쉬[발빨팔]/i,
  /싀[발빨팔]/i,
  /(?:^|[\s.,~!?])시[1일*^@#!_\-~]?[발빨팔](?![점고자택매])(?:$|[\s.,~!?]|놈|년|새끼|아|것|롬|련)/i,
  /개[새세색][끼기키]/i,
  /개[새세색]쉐[끼키]/i,
  /병[신쉰][놈년새끼]?/i,
  /븅[신쉰]/i,
  /좆[같나마밥]/i,
  /졷[같나마밥]/i,
  /존[나낟]/i,
  /지[랄럴]/i,
  /지[1일*^@#!_\-~]?[랄럴]/i,
  /미친[놈년새끼]/i,
  /엠[창생]/i,
  /앰[창생]/i,
  /느[금개]마/i,
  /니[애에][미비]/i,
  /걸레[년놈]/i,
  /보[슬징][치어]?/i,
  /자[지찌]/i,
  /보[지찌](?!(원|마|말|않|아|요|다|등))/i,
  /후장/i,
  /똥꼬충/i,
  /틀딱/i,
  /한남충/i,
  /김치녀/i,

  // 도박 / 불법 베팅
  /바카라/i,
  /사설[토프로]/i,
  /토토[사이트베팅샵놀이터]/i,
  /사설토토/i,
  /슬롯[머신게임]/i,
  /홀덤[펍포커]/i,
  /릴게임/i,
  /꽁머니/i,
  /안전놀이터/i,
  /먹튀[검증사이트]/i,

  // 성인 / 음란 / 성매매
  /조건만남/i,
  /성매매/i,
  /출장샵/i,
  /오피[걸방녀]/i,
  /립카페/i,
  /안마방/i,
  /폰섹/i,
  /야동/i,
  /야설/i,
  /성인용품/i,
  /원나잇/i,
  /섹스/i,
  /자위기구/i,
  /애인대행/i,

  // 스팸 / 피싱 / 사기 / 불법 금융
  /고수익보장/i,
  /수익률보장/i,
  /리딩방/i,
  /코인리딩/i,
  /문자알바/i,
  /계좌대여/i,
  /대포통장/i,
  /불법대출/i,
  /일수대출/i,
  /달돈대출/i,
  /급전대출/i,
  /텔레[그람그램]*[\s\-_.:@]*[a-zA-Z0-9_]{3,}/i,
  /카[톡카오]+[\s\-_.:@]*[아이디id]+[\s\-_.:@]*[a-zA-Z0-9_]{3,}/i,
  /라인[\s\-_.:@]*[아이디id]+[\s\-_.:@]*[a-zA-Z0-9_]{3,}/i,
];

// 2. 단독 초성 및 특수문자 욕설
const CHOSUNG_PATTERNS = [
  /(?:^|[\s.,~!?])(?:ㅆㅂ|ㅅㅂ|ㅄ|ㅂㅅ|ㅈㄴ|ㅈㄹ|ㅗ)(?:$|[\s.,~!?])/i,
];

// 3. 텍스트 정규화 검사 (공백 및 특수문자 제거 후 검사)
const NORMALIZED_KEYWORDS = [
  "씨발", "시발놈", "시발년", "시발새끼", "개새끼", "병신", "개색기", "개세끼",
  "존나", "좆같", "지랄", "엠창", "느금마", "니애미", "니애비", "미친놈", "미친년",
  "바카라", "사설토토", "토토사이트", "카지노사이트", "꽁머니", "먹튀검증", "안전놀이터",
  "조건만남", "출장샵", "립카페", "오피걸", "폰섹", "야동사이트",
  "고수익보장", "리딩방", "코인리딩", "문자알바", "불법대출", "대포통장"
];

export function containsBadWords(input) {
  if (!input || typeof input !== "string") return false;
  const raw = input.trim();
  if (!raw) return false;

  // 1. Chosung check
  for (const regex of CHOSUNG_PATTERNS) {
    if (regex.test(raw)) return true;
  }

  // 2. Regex check on original text
  for (const regex of EXACT_OR_PREFIX_PATTERNS) {
    if (regex.test(raw)) return true;
  }

  // 3. Check normalized string (strip spaces and symbols)
  const normalized = raw
    .replace(/[\s\-_.,~!?@#$%^&*()[\]{}|/\\:;'"`+=\u200B-\u200D\uFEFF]+/g, "")
    .toLowerCase();

  for (const kw of NORMALIZED_KEYWORDS) {
    if (normalized.includes(kw)) {
      return true;
    }
  }

  return false;
}

export function checkPostSafety({ title, content, author }) {
  if (containsBadWords(title)) return { safe: false, reason: "title" };
  if (containsBadWords(content)) return { safe: false, reason: "content" };
  if (containsBadWords(author)) return { safe: false, reason: "author" };
  return { safe: true };
}
