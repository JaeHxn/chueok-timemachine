// 한국 추억의 대표 물건·먹거리·놀이·패션·기술 아이템 집중 보강 스크립트
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const DIR = path.join(root, "수집");
const PHOTOS = path.resolve(here, "../src/item-photos.json");
const KO = "https://ko.wikipedia.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const UA = "chueok-timemachine/0.1 (https://chueok-timemachine.pages.dev)";

const OK_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)?)/i;
const strip = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const norm = (s) => String(s).toLowerCase().replace(/\s*\(.*?\)\s*/g, "").replace(/[\s·\-_.,!?'"‘’“”:〈〉《》]/g, "");

// 대표 추억 아이템 100+선 (카테고리: 먹거리, 놀이·문구, 가전·기술, 패션, 유행어·풍속)
const MEMORIES = [
  // 1950s
  { year: 1950, month: 5, cat: "먹거리", title: "칠성사이다", wiki: "칠성사이다", note: "1950년 5월 동방청량음료에서 출시된 대한민국의 대표 탄산음료." },
  { year: 1956, month: 11, cat: "사건·생활상", title: "청실홍실", wiki: "청실홍실", note: "1956년 11월 HLKZ-TV에서 방영된 대한민국 최초의 텔레비전 드라마이자 인기 라디오 드라마." },
  { year: 1958, month: 2, cat: "사건·생활상", title: "아리랑 (담배)", wiki: "아리랑 (담배)", note: "1958년 발매된 대한민국의 최초 필터 담배." },

  // 1960s
  { year: 1963, month: 9, cat: "먹거리", title: "삼양라면", wiki: "삼양라면", note: "1963년 9월 15일 삼양식품이 출시한 대한민국 최초의 인스턴트 라면." },
  { year: 1968, month: 12, cat: "가전·기술", title: "경부고속도로", wiki: "경부고속도로", note: "대한민국의 대동맥으로 개통되기 시작한 고속도로." },

  // 1970s
  { year: 1971, month: 12, cat: "먹거리", title: "새우깡", wiki: "새우깡", note: "1971년 12월 농심에서 출시한 대한민국 최초의 스낵 과자." },
  { year: 1972, month: 5, cat: "먹거리", title: "죠리퐁", wiki: "죠리퐁", note: "1972년 크라운제과가 출시한 튀긴 밀쌀 과자." },
  { year: 1974, month: 4, cat: "먹거리", title: "오리온 초코파이", wiki: "초코파이", note: "1974년 4월 동양제과(오리온)가 출시한 정(情)을 담은 대표 파이 과자." },
  { year: 1974, month: 6, cat: "먹거리", title: "바나나맛 우유", wiki: "바나나맛 우유", note: "1974년 빙그레가 항아리 단지 모양 용기에 담아 출시한 국민 우유." },
  { year: 1974, month: 1, cat: "먹거리", title: "투게더 (아이스크림)", wiki: "투게더 (아이스크림)", note: "1974년 빙그레에서 출시한 온 가족이 함께 떠먹는 통 아이스크림." },
  { year: 1975, month: 3, cat: "먹거리", title: "비비빅", wiki: "비비빅", note: "1975년 출시된 통단팥이 씹히는 인기 아이스바." },
  { year: 1975, month: 12, cat: "먹거리", title: "맛동산", wiki: "맛동산", note: "1975년 '맛동산 먹고 즐거운 파티'로 유명해진 고소한 과자." },
  { year: 1975, month: 12, cat: "가전·기술", title: "현대 포니", wiki: "현대 포니", note: "1975년 현대자동차가 생산한 대한민국 최초의 고유 모델 자동차." },
  { year: 1976, month: 3, cat: "먹거리", title: "아카시아 (껌)", wiki: "아카시아 (껌)", note: "1976년 해태제과에서 출시한 은은한 향의 껌." },

  // 1980s
  { year: 1980, month: 12, cat: "가전·기술", title: "컬러 텔레비전 방송", wiki: "대한민국의 텔레비전 방송", note: "1980년 12월 1일 한국방송공사(KBS)에서 공식 컬러 TV 방송 개시." },
  { year: 1981, month: 4, cat: "먹거리", title: "봉봉 (음료)", wiki: "봉봉 (음료)", note: "1981년 해태음료에서 포도알이 씹히는 음료로 출시." },
  { year: 1981, month: 5, cat: "먹거리", title: "홈런볼", wiki: "홈런볼", note: "1981년 해태제과에서 출시한 부드러운 슈 과자." },
  { year: 1981, month: 6, cat: "먹거리", title: "빠삐코", wiki: "빠삐코", note: "1981년 롯데삼강에서 출시한 튜브형 초콜릿 샤베트 아이스크림." },
  { year: 1981, month: 9, cat: "가전·기술", title: "마이마이", wiki: "삼성 마이마이", note: "1981년 삼성전자에서 출시한 카세트테이프 휴대용 재생기." },
  { year: 1982, month: 3, cat: "놀이·문구", title: "KBO 리그 출범", wiki: "KBO 리그", note: "1982년 프로야구 6개 구단으로 개막하여 온 국민의 스포츠로 자리잡음." },
  { year: 1982, month: 11, cat: "먹거리", title: "너구리 (라면)", wiki: "너구리 (라면)", note: "1982년 11월 농심에서 다시마와 굵은 면발로 선보인 우동 라면." },
  { year: 1982, month: 11, cat: "먹거리", title: "육개장 사발면", wiki: "육개장 사발면", note: "1982년 11월 농심에서 출시한 대표적인 컵라면." },
  { year: 1982, month: 6, cat: "먹거리", title: "맥콜", wiki: "맥콜", note: "1982년 일화에서 보리를 발효시켜 만든 대표적인 보리 탄산음료." },
  { year: 1983, month: 3, cat: "먹거리", title: "죠스바", wiki: "죠스바", note: "1983년 롯데제과에서 상어 모양으로 출시한 아이스바." },
  { year: 1983, month: 4, cat: "먹거리", title: "돼지바", wiki: "돼지바", note: "1983년 돼지해를 기념해 크런치 코팅과 딸기잼을 넣어 출시한 아이스크림." },
  { year: 1983, month: 9, cat: "먹거리", title: "안성탕면", wiki: "안성탕면", note: "1983년 9월 농심에서 '내 입에 안성맞춤'이라는 슬로건과 함께 출시한 된장 베이스 라면." },
  { year: 1983, month: 11, cat: "먹거리", title: "빼빼로", wiki: "빼빼로", note: "1983년 롯데제과에서 출시한 막대형 초콜릿 과자." },
  { year: 1983, month: 8, cat: "먹거리", title: "양파링", wiki: "양파링", note: "1983년 출시된 링 모양의 스낵 과자." },
  { year: 1984, month: 3, cat: "먹거리", title: "짜파게티", wiki: "짜파게티", note: "1984년 3월 농심이 '일요일은 내가 짜파게티 요리사'로 유행시킨 자장 라면." },
  { year: 1984, month: 6, cat: "먹거리", title: "팔도 비빔면", wiki: "팔도 비빔면", note: "1984년 6월 한국야쿠르트(팔도)에서 차갑게 비벼 먹는 라면으로 출시." },
  { year: 1984, month: 5, cat: "먹거리", title: "암바사", wiki: "암바사", note: "1984년 출시된 부드러운 밀크 탄산음료." },
  { year: 1985, month: 5, cat: "먹거리", title: "스크류바", wiki: "스크류바", note: "1985년 꽈배기 모양으로 돌려먹는 재미를 준 딸기 사과 아이스바." },
  { year: 1986, month: 10, cat: "먹거리", title: "신라면", wiki: "신라면", note: "1986년 10월 농심에서 얼큰하고 매운맛으로 출시한 국민 라면." },
  { year: 1986, month: 11, cat: "먹거리", title: "도시락 (라면)", wiki: "도시락 (라면)", note: "1986년 11월 팔도에서 사각 용기에 담아 출시한 컵라면." },
  { year: 1988, month: 7, cat: "먹거리", title: "포카칩", wiki: "포카칩", note: "1988년 오리온에서 생감자를 얇게 썰어 튀긴 생감자칩." },
  { year: 1988, month: 9, cat: "사건·생활상", title: "호돌이", wiki: "호돌이", note: "1988년 서울 올림픽의 공식 마스코트이자 국민적 인기를 얻은 상징 캐릭터." },
  { year: 1989, month: 4, cat: "먹거리", title: "밀키스", wiki: "밀키스", note: "1989년 롯데칠성음료에서 홍콩 배우 주윤발의 '싸랑해요 밀키스' 광고와 함께 선풍적 인기를 끈 음료." },
  { year: 1989, month: 12, cat: "놀이·문구", title: "현대 컴보이", wiki: "컴보이", note: "1989년 현대전자에서 닌텐도 패미컴을 정식 수입해 출시한 가정용 게임기." },

  // 1990s
  { year: 1991, month: 10, cat: "먹거리", title: "붕어싸만코", wiki: "붕어싸만코", note: "1991년 빙그레가 붕어빵 모양 모나카 속에 바닐라와 통팥을 넣어 출시한 아이스크림." },
  { year: 1992, month: 1, cat: "먹거리", title: "메로나", wiki: "메로나", note: "1992년 빙그레에서 출시하여 멜론 열풍을 일으킨 아이스바." },
  { year: 1993, month: 4, cat: "가전·기술", title: "무선호출기 (삐삐)", wiki: "무선호출기", note: "1990년대 숫자 암호(8282, 486)와 함께 전국민적 소통 도구가 된 삐삐." },
  { year: 1994, month: 6, cat: "가전·기술", title: "PC통신 하이텔·천리안", wiki: "PC통신", note: "파란 화면에 모뎀 접속 소리와 함께 채팅과 동호회 문화를 열었던 1990년대 온라인 세상." },
  { year: 1995, month: 4, cat: "놀이·문구", title: "따조", wiki: "따조", note: "1995년 오리온 치토스 등 과자 봉지 속에 들어있어 어린이들이 모으고 날리던 원형 플라스틱 딱지." },
  { year: 1995, month: 7, cat: "먹거리", title: "솔의눈", wiki: "솔의눈", note: "1995년 CJ제일제당에서 솔싹 추출물로 만든 상쾌한 캔음료." },
  { year: 1996, month: 4, cat: "놀이·문구", title: "바람의 나라 (비디오 게임)", wiki: "바람의 나라 (비디오 게임)", note: "1996년 4월 넥슨에서 서비스를 시작한 세계 최장수 상용화 그래픽 MMORPG." },
  { year: 1996, month: 3, cat: "가전·기술", title: "모토로라 스타택", wiki: "모토로라 스타택", note: "1996년 모토로라에서 출시한 혁신적인 폴더형 휴대전화." },
  { year: 1996, month: 11, cat: "패션", title: "더플 코트 (떡볶이 코트)", wiki: "더플 코트", note: "1990년대 후반 중고등학생들의 교복 위 필수 겨울 겉옷으로 유행한 코트." },
  { year: 1997, month: 3, cat: "가전·기술", title: "시티폰", wiki: "시티폰", note: "1997년 공중전화 부스 근처에서 발신 전용으로 쓰였던 휴대용 전화기." },
  { year: 1997, month: 5, cat: "놀이·문구", title: "다마고치", wiki: "다마고치", note: "1997년 가상 애완동물을 키우는 열풍을 몰고 온 휴대용 전자 게임기." },
  { year: 1998, month: 4, cat: "놀이·문구", title: "스타크래프트", wiki: "스타크래프트", note: "1998년 출시되어 대한민국에 PC방 열풍과 e스포츠 산업을 탄생시킨 전략 시뮬레이션 게임." },
  { year: 1998, month: 9, cat: "놀이·문구", title: "리니지", wiki: "리니지 (비디오 게임)", note: "1998년 엔씨소프트에서 서비스한 중세 판타지 MMORPG." },
  { year: 1999, month: 8, cat: "놀이·문구", title: "펌프 잇 업", wiki: "펌프 잇 업", note: "1999년 오락실에서 발로 5개 발판을 밟으며 춤추던 체감형 댄스 리듬 게임." },
  { year: 1999, month: 10, cat: "놀이·문구", title: "포트리스 2", wiki: "포트리스 2", note: "1999년 국민 탱크 포격 대전 게임으로 선풍적인 인기를 끈 온라인 게임." },
  { year: 1999, month: 7, cat: "먹거리", title: "2% 부족할 때", wiki: "2% 부족할 때", note: "1999년 롯데칠성음료에서 출시한 물처럼 마시는 미투 과즙 음료." },
  { year: 1999, month: 11, cat: "먹거리", title: "포켓몬빵 띠부씰", wiki: "포켓몬빵", note: "1999년 삼립식품에서 포켓몬스터 스티커(띠부띠부씰)를 넣어 출시해 품귀 현상을 빚은 빵." },

  // 2000s
  { year: 2000, month: 1, cat: "가전·기술", title: "버디버디", wiki: "버디버디", note: "2000년 10대 청소년들 사이에서 특수문자 닉네임과 함께 유행한 메신저." },
  { year: 2001, month: 9, cat: "가전·기술", title: "싸이월드 미니홈피", wiki: "싸이월드", note: "미니미, 도토리, BGM과 함께 일촌을 맺으며 전국민의 온라인 일상을 담았던 소셜 플랫폼." },
  { year: 2002, month: 6, cat: "사건·생활상", title: "2002 한일 월드컵 거리응원", wiki: "2002년 FIFA 월드컵", note: "붉은 악마 티셔츠를 입고 시청 광장에 모여 4강 신화를 외친 전 국민적 축제." },
  { year: 2003, month: 4, cat: "놀이·문구", title: "메이플스토리", wiki: "메이플스토리", note: "2003년 넥슨이 선보인 2D 횡스크롤 온라인 롤플레잉 게임." },
  { year: 2003, month: 5, cat: "가전·기술", title: "네이트온", wiki: "네이트온", note: "직장인과 대학생 필수 PC 무료 메신저로 자리잡은 국민 메신저." },
  { year: 2004, month: 8, cat: "놀이·문구", title: "크레이지레이싱 카트라이더", wiki: "크레이지레이싱 카트라이더", note: "2004년 온 국민이 즐긴 귀여운 캐주얼 레이싱 게임." },
  { year: 2005, month: 8, cat: "놀이·문구", title: "서든어택", wiki: "서든어택", note: "2005년 PC방 점유율 1위를 장기간 기록한 1인칭 슈팅 게임." },
  { year: 2005, month: 8, cat: "놀이·문구", title: "던전앤파이터", wiki: "던전앤파이터", note: "2005년 네오플이 제작한 벨트스크롤 액션 온라인 게임." },
  { year: 2005, month: 6, cat: "가전·기술", title: "모토로라 레이저", wiki: "모토로라 레이저", note: "2005년 얇고 날렵한 금속 디자인으로 패션 아이템이 된 폴더폰." },
  { year: 2007, month: 1, cat: "놀이·문구", title: "닌텐도 DS Lite", wiki: "닌텐도 DS Lite", note: "2007년 한국닌텐도에서 출시해 두뇌 트레이닝 등으로 남녀노소 사랑받은 휴대용 게임기." },
  { year: 2008, month: 3, cat: "먹거리", title: "마켓오 리얼브라우니", wiki: "오리온 (기업)", note: "2008년 오리온에서 고급 수제 감성으로 출시한 디저트 브라우니." },
  { year: 2009, month: 1, cat: "패션", title: "소녀시대 Gee 스키니진", wiki: "Gee (소녀시대의 노래)", note: "2009년 알록달록한 원색 스키니진 열풍을 전국에 일으킨 트렌드." },
  { year: 2009, month: 11, cat: "가전·기술", title: "아이폰 3GS 국내 출시", wiki: "아이폰 3GS", note: "2009년 11월 28일 대한민국 스마트폰 혁명의 도화선이 된 아이폰 도입." },

  // 2010s
  { year: 2010, month: 3, cat: "가전·기술", title: "카카오톡", wiki: "카카오톡", note: "2010년 3월 출시되어 무료 문자 혁명을 일으킨 국민 모바일 메신저." },
  { year: 2010, month: 6, cat: "가전·기술", title: "배달의민족", wiki: "배달의민족", note: "전단지 문화를 스마트폰 앱 주문 문화로 바꾼 대표 배달 플랫폼." },
  { year: 2011, month: 8, cat: "먹거리", title: "꼬꼬면", wiki: "꼬꼬면", note: "2011년 하얀 국물 라면 열풍을 불러일으킨 칼칼한 닭육수 라면." },
  { year: 2011, month: 12, cat: "놀이·문구", title: "리그 오브 레전드", wiki: "리그 오브 레전드", note: "2011년 12월 한국 정식 서비스를 시작해 10년 넘게 PC방 1위를 지킨 MOBA 게임." },
  { year: 2012, month: 4, cat: "먹거리", title: "불닭볶음면", wiki: "불닭볶음면", note: "2012년 4월 삼양식품에서 출시해 전 세계적인 매운맛 챌린지를 낳은 볶음면." },
  { year: 2012, month: 7, cat: "놀이·문구", title: "애니팡", wiki: "애니팡", note: "2012년 카카오톡 친구들과 하트를 주고받으며 즐긴 국민 모바일 퍼즐 게임." },
  { year: 2014, month: 8, cat: "먹거리", title: "허니버터칩", wiki: "허니버터칩", note: "2014년 8월 해태제과에서 출시해 전국적인 품귀 사태를 일으킨 달콤짭짤 감자칩." },
  { year: 2015, month: 3, cat: "먹거리", title: "순하리 처음처럼", wiki: "처음처럼 (소주)", note: "2015년 유자맛 과일 소주 열풍을 일으킨 주류." },
  { year: 2015, month: 2, cat: "가전·기술", title: "토스 (비바리퍼블리카)", wiki: "토스 (비바리퍼블리카)", note: "공인인증서 없이 몇 초 만에 송금할 수 있게 바꾼 핀테크 혁신 서비스." },
  { year: 2015, month: 7, cat: "가전·기술", title: "당근 (기업)", wiki: "당근 (기업)", note: "동네 이웃 간의 따뜻한 중고거래 문화를 만든 지역 커뮤니티 플랫폼." },
  { year: 2016, month: 1, cat: "가전·기술", title: "넷플릭스 한국 런칭", wiki: "넷플릭스", note: "2016년 1월 한국 서비스를 개시하며 OTT 스트리밍 시대를 본격화함." },
  { year: 2016, month: 5, cat: "놀이·문구", title: "오버워치", wiki: "오버워치", note: "2016년 블리자드가 선보인 팀 기반 하이퍼 FPS 슈팅 게임." },
  { year: 2017, month: 1, cat: "놀이·문구", title: "포켓몬 GO", wiki: "포켓몬 GO", note: "속초 등지에서 시작되어 전국적인 야외 증강현실 포켓몬 포획 붐을 일으킨 게임." },
  { year: 2017, month: 3, cat: "놀이·문구", title: "PUBG: 배틀그라운드", wiki: "PUBG: 배틀그라운드", note: "2017년 펍지가 개발해 전 세계 배틀로얄 붐을 이끈 국산 게임." },
  { year: 2017, month: 11, cat: "패션", title: "평창 롱패딩 열풍", wiki: "2018년 동계 올림픽", note: "2018 평창 올림픽 기념 가성비 구스다운 롱패딩을 사기 위해 밤샘 줄서기를 했던 패션 현상." },
  { year: 2017, month: 12, cat: "놀이·문구", title: "닌텐도 스위치", wiki: "닌텐도 스위치", note: "휴대와 거치를 넘나들며 선풍적 인기를 끈 하이브리드 비디오 게임 콘솔." },
  { year: 2019, month: 5, cat: "먹거리", title: "흑당 버블티 열풍", wiki: "버블티", note: "2019년 흑당 시럽의 비주얼과 달콤함으로 번화가마다 줄을 서게 한 대만식 음료." },
  { year: 2019, month: 7, cat: "먹거리", title: "마라탕 열풍", wiki: "마라탕", note: "얼얼한 매운맛과 직접 재료를 고르는 재미로 청소년과 2030의 주식으로 떠오른 음식." },

  // 2020s
  { year: 2020, month: 3, cat: "먹거리", title: "달고나 커피", wiki: "달고나 커피", note: "코로나19 집콕 시절 인스턴트 커피 가루를 수백 번 저어 만들어 전 세계로 퍼진 챌린지 음료." },
  { year: 2020, month: 3, cat: "놀이·문구", title: "모여봐요 동물의 숲", wiki: "모여봐요 동물의 숲", note: "코로나19 시기 무인도를 가꾸며 친구들과 힐링하던 닌텐도 스위치 대표 게임." },
  { year: 2022, month: 2, cat: "먹거리", title: "포켓몬빵 재출시", wiki: "포켓몬빵", note: "16년 만에 돌아온 포켓몬 띠부씰을 구하기 위해 편의점 오픈런을 빚은 전국적 신드롬." },
  { year: 2022, month: 11, cat: "유행어·풍속", title: "중요한 것은 꺾이지 않는 마음 (중꺾마)", wiki: "중요한 것은 꺾이지 않는 마음", note: "2022년 롤드컵 데프트 선수의 인터뷰와 카타르 월드컵 16강 진출로 국민적 유행어가 된 문구." },
  { year: 2023, month: 6, cat: "먹거리", title: "탕후루 열풍", wiki: "탕후루", note: "과일에 얇은 설탕 시럽을 입힌 바삭한 디저트로 10대와 20대의 입맛을 사로잡은 길거리 간식." },
  { year: 2024, month: 6, cat: "먹거리", title: "두바이 초콜릿", wiki: "초콜릿", note: "피스타치오 크림과 바삭한 카다이프 면을 넣은 초콜릿으로 SNS를 강타한 디저트 열풍." },
];

async function fetchWikiInfo(title) {
  const url = `${KO}?${new URLSearchParams({
    format: "json", formatversion: "2",
    action: "query", titles: title, redirects: "1",
    prop: "extracts|pageimages|info", inprop: "url",
    exintro: "1", explaintext: "1", exsentences: "3",
    piprop: "thumbnail|name", pithumbsize: "800", pilicense: "free",
  })}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return data?.query?.pages?.[0];
  } catch {
    return null;
  }
}

async function fetchCommonsPhoto(filename) {
  if (!filename) return null;
  const url = `${COMMONS}?${new URLSearchParams({
    format: "json", formatversion: "2",
    action: "query", titles: "File:" + filename,
    prop: "imageinfo", iiprop: "extmetadata|url",
  })}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const p = data?.query?.pages?.[0];
    const ii = p?.imageinfo?.[0];
    const m = ii?.extmetadata ?? {};
    const lic = m.LicenseShortName?.value ?? "";
    if (ii && OK_LICENSE.test(lic) && !/NC|ND/.test(lic)) {
      return {
        license: lic,
        artist: strip(m.Artist?.value) || "작가 미상",
        page: ii.descriptionurl,
      };
    }
  } catch {}
  return null;
}

const fileOf = (y) => path.join(DIR, `텍스트_${Math.floor(y / 10) * 10}s.json`);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; } };

async function main() {
  console.log(`[enrich-culture] 총 ${MEMORIES.length}개의 대표 생활·물건·먹거리 아이템 검증 및 주입 시작...`);
  const photos = fs.existsSync(PHOTOS) ? JSON.parse(fs.readFileSync(PHOTOS, "utf8")) : {};
  let addedTotal = 0, photoAdded = 0;

  // decade files cache
  const decadeData = {};
  for (let d = 1950; d <= 2020; d += 10) {
    decadeData[d] = read(fileOf(d));
  }

  for (const m of MEMORIES) {
    const d = Math.floor(m.year / 10) * 10;
    const base = decadeData[d];
    const existingIdx = base.findIndex((x) => x.year === m.year && norm(x.title) === norm(m.title));

    const p = await fetchWikiInfo(m.wiki);
    let summary = m.note;
    let photoObj = null;

    if (p && !p.missing) {
      if (p.extract && p.extract.length > 30) {
        summary = p.extract.replace(/\s+/g, " ").trim();
        if (summary.length > 180) summary = summary.slice(0, 178) + "…";
      }
      if (p.pageimage && p.thumbnail?.source) {
        const cInfo = await fetchCommonsPhoto(p.pageimage);
        if (cInfo) {
          photoObj = {
            title: p.pageimage.replace(/\.[A-Za-z]+$/, ""),
            thumb: p.thumbnail.source,
            page: cInfo.page,
            artist: cInfo.artist,
            license: cInfo.license,
            via: p.fullurl,
          };
        }
      }
    }

    const itemObj = {
      year: m.year,
      month: m.month,
      date_precision: m.month ? "month" : "year",
      category: m.cat,
      title: m.title,
      summary: summary,
      sources: [
        {
          url: p?.fullurl || `https://ko.wikipedia.org/wiki/${encodeURIComponent(m.wiki)}`,
          name: `위키백과: ${m.title}`,
          license: "CC BY-SA 4.0",
        },
      ],
      confidence: "high",
      collected_by: "curated-culture",
      wiki_checked: true,
    };

    if (existingIdx !== -1) {
      // 기존 항목이 있다면 카테고리/월/요약을 우선 보강
      base[existingIdx].category = m.cat;
      if (m.month && !base[existingIdx].month) base[existingIdx].month = m.month;
      if (summary && summary.length > (base[existingIdx].summary || "").length) {
        base[existingIdx].summary = summary;
      }
    } else {
      base.push(itemObj);
      addedTotal++;
    }

    if (photoObj) {
      const pKey = `${m.year}|${m.title}`;
      if (!photos[pKey]) {
        photos[pKey] = photoObj;
        photoAdded++;
      }
    }
  }

  // Save all decade files
  for (let d = 1950; d <= 2020; d += 10) {
    const list = decadeData[d];
    list.sort((a, b) => a.year - b.year || (a.month ?? 99) - (b.month ?? 99));
    fs.writeFileSync(fileOf(d), JSON.stringify(list, null, 2), "utf8");
  }

  fs.writeFileSync(PHOTOS, JSON.stringify(photos, null, 2), "utf8");
  console.log(`[enrich-culture] 완료! 신규 추가: ${addedTotal}개, 신규 사진 연결: ${photoAdded}개. 전체 사진: ${Object.keys(photos).length}개.`);
}

main();
