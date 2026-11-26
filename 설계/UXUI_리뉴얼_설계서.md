# 추억 타임머신 — GoldenEraModal UX/UI 리뉴얼 설계서

## 1. 리뉴얼 배경 및 핵심 문제 진단

`GoldenEraModal.jsx`의 기존 스타일은 전역 `styles.css`의 `.sheet button` 규칙과 결합되면서 다음과 같은 심각한 시각적·접근성 결함이 발생하고 있었습니다.

1. **CSS 명시도(Specificity) 충돌로 인한 버튼 배경/텍스트 붕괴**:
   - `styles.css`의 `.sheet button` (`(0, 1, 1)`) 및 `.sheet button:hover` (`(0, 2, 1)`)가 모달 내부의 단일 클래스 버튼(`.golden-submit-btn`, `.quick-chip`, `.stage-tab-btn`, `.teleport-btn`, `.action-insta`, `.action-kakao` 등, `(0, 1, 0)`)을 덮어씀.
   - 특히 라이트 모드에서 `var(--control)`(`rgba(29,29,31,.045)`)이 적용되면서, 어두운 `#131c2e → #090e1a` 모달 배경 위에 **어두운 글씨(`#090e1a`, `#191919`)가 투명한 어두운 배경 위에 놓이는 저대비/비가시성 문제**가 발생.
2. **단계별 테마 컬러 명도 부족**:
   - 기존 `#60a5fa`(청춘), `#f472b6`(중고등) 색상이 반투명 탭 배경(`rgba(255,255,255,0.16)` over `#131c2e`) 위에서 WCAG AA 기준(`4.5:1`)에 소폭 미달(`4.02:1 ~ 4.15:1`).
3. **인스타 공유 CTA 버튼 그라디언트 끝단 대비 부족**:
   - 기존 `#ec4899 → #f43f5e → #f59e0b` 위 흰색 텍스트(`#ffffff`)는 주황 끝단(`#f59e0b`)에서 대비가 `2.15:1`로 낮았음.

---

## 2. UX/UI 컬러 시스템 및 대비(Contrast) 기준 (WCAG AA 4.5:1 이상 준수)

| UI 요소 | 배경색 | 전경색 / 보더 | 대비비(예상) | 비고 |
|---|---|---|---|---|
| 모달 컨테이너 (`.golden-era-box`) | `#131c2e → #090e1a` | `#f8fafc` / `#ffffff` | 16.2:1 ~ 16.8:1 | `color-scheme: dark` 명시 |
| 상단 뱃지 / 보조 라벨 | `rgba(251,191,36,0.16)` on `#131c2e` | `#fde047` | ~9.5:1 | 골드 포인트 |
| 연도 입력창 & 접미사 | `rgba(255,255,255,0.09)` on `#131c2e` | `#ffffff` / `#fde047` | > 11:1 | `::placeholder` 명시 |
| 연대 빠른 선택 칩 (기본/활성) | `rgba(255,255,255,0.12)` / `rgba(251,191,36,0.26)` | `#f8fafc` / `#fde047` | > 7.5:1 | 알약형 토글 명확화 |
| 탐험 시작 CTA (`.golden-submit-btn`) | `#fde047 → #f59e0b` | `#090e1a` | 9.4:1 ~ 14.7:1 | 어두운 텍스트 on 골드 |
| 3대 시절 테마 컬러 (초등/중고/청춘) | `rgba(255,255,255,0.16)` on `#131c2e` | `#fcd34d` / `#f9a8d4` / `#7dd3fc` | 5.8:1 ~ 7.3:1 | 알약 뱃지 내 `#0a0f1d`는 > 10:1 |
| 인스타 스토리 CTA (`.action-insta`) | `#be185d → #be123c → #b45309` | `#ffffff` | 5.0:1 ~ 6.4:1 | 전 구간 AA 이상 확보 |
| 카카오톡 공유 CTA (`.action-kakao`) | `#fee500` | `#191919` | 14.1:1 | 카카오 브랜드 규격 준수 |
| 보조 액션 (`.action-download/retry/close`) | `rgba(255,255,255,0.09~0.16)` | `#ffffff` / `#f1f5f9` | > 11:1 | 테두리 명도 상향 |

---

## 3. 사용자 중심 설계(UCD) 및 접근성 개선 사항

1. **CSS 스코핑을 통한 스타일 격리**:
   - 모든 내부 규칙을 `.golden-era-sheet .golden-era-box ...` (`(0, 2, 0)` ~ `(0, 4, 0)`)로 스코핑하여 전역 `.sheet button` (`(0, 1, 1)`)의 간섭을 원천 차단.
   - `.sheet.golden-era-sheet` (`(0, 2, 0)`)로 화면 중앙 정렬을 항상 보장.
2. **시니어 친화 효도 모드(`.app.hyodo`) 고대비·대화형 강화**:
   - 모달 폭(`620px`), 입력창(`2.6rem`), 닫기 버튼(`44×44px` 터치 타겟), 본문·설명 폰트(`1.1rem ~ 1.3rem`), 테두리 두께(`2px ~ 3px`)를 상향하고 본문 색상을 순백(`#ffffff`)으로 고정하여 저시력 사용자 가독성 극대화.
3. **키보드 및 스크린 리더 접근성**:
   - 모달 내 모든 버튼에 `:focus-visible` 골드 아웃라인(`2px solid #fde047`)을 적용.
   - 기존 E2E 테스트 셀렉터(`golden-era-sheet`, `golden-era-box`, `golden-modal-close`, `quick-chip`, `golden-submit-btn`, `stage-tab-btn`, `active-stage-card`, `action-insta`, `action-kakao`, `action-download`, `action-retry`, `action-close`)를 100% 유지.
