# 칼라몰 창고 털이 작전

도둑을 추격해 창고에서 사라진 상품 세 개를 되찾는 8비트 횡스크롤 웹 게임입니다.

## 게임 방법

- `Space`, `W`, `↑`: 점프 및 더블점프
- `B`, `Shift`: 부스트 사용
- `P`, `Esc`: 일시정지
- 모바일 세로 화면에서는 위쪽 남색 부스트·아래쪽 핑크색 점프 버튼을 사용합니다. 화면 회전 시 진행 상태를 유지하고 일시정지합니다.

충돌 없이 10초를 달리면 3초 동안 고속·무적 상태가 되는 부스트를 사용할 수 있습니다. 도심, 강변도로, 산속 스테이지를 각각 30초간 통과하면 무작위 상품 하나를 회수합니다. 회수 화면에서 상품명을 확인하고 해당 상품 페이지로 바로 이동할 수 있습니다.

## 실행

별도 설치 없이 `dist/index.html`을 정적 웹 서버로 열면 실행됩니다. 배포할 때는 `dist` 폴더 전체를 사용합니다.

## Cloudflare 배포

Node.js 20 이상에서 의존성을 설치한 뒤 원하는 배포 방식을 실행합니다.

```bash
npm install

# Workers Static Assets
npm run deploy:workers

# Cloudflare Pages
npm run deploy:pages
```

### Workers Builds 설정

- Build command: `npm run check`
- Deploy command: `npm run deploy:workers`

### Pages Git 연동 설정

- Framework preset: `None`
- Build command: 비워두기
- Build output directory: `dist`

`dist/_headers`는 Workers Static Assets와 Pages 양쪽에서 동일하게 적용됩니다.

## 1.8.0 최종 클리어 사은품

- 3개 스테이지를 모두 통과한 세션만 서버에서 사은품 코드를 발급합니다. 스테이지는 순서와 최소 플레이 시간을 확인하며, 브라우저에는 원본 인증 토큰 대신 일회성 세션 토큰만 전달합니다.
- 코드는 혼동하기 쉬운 `0`, `1`, `O`, `I`, `L`을 제외한 숫자·영문 대문자 12자리를 `XXXX-XXXX-XXXX` 형식으로 표시합니다. 요청서의 표시 형식과 시트 열(`난수 1`~`난수 3`)을 기준으로 세 그룹을 사용합니다.
- D1의 `reward_codes.code`와 `reward_codes.session_id`는 각각 고유합니다. 같은 클리어 세션에서 다시 요청하면 기존 코드를 돌려주며 새 코드를 중복 발급하지 않습니다.
- 최종 결과의 분홍색 `사은품 받기` 버튼은 스태프·사은품 3종(묶어바 케이블타이, 안전한 작업용 장갑, 카메라 뽀득뽀득 융)·주의사항·코드 복사·이미지 저장·칼라몰 이동 기능이 있는 안내창을 엽니다. 사은품 이미지는 안내창을 열 때만 내려받습니다.
- 원본 8비트 리소스는 `game/resource/rewards`, 웹 최적화본은 `dist/assets/game/rewards`에 있습니다.

### Google Sheets 기록 연동

1. `integrations/google-apps-script/reward-code-webhook.gs`를 대상 시트에 연결된 Apps Script 프로젝트의 `Code.gs`로 저장합니다.
2. 스크립트 속성 `WEBHOOK_SECRET`에 충분히 긴 임의 값을 설정합니다.
3. 실행 사용자는 소유자, 접근 권한은 `모든 사용자`인 웹 앱으로 배포합니다.
4. 같은 비밀 값과 배포 URL을 Worker Secret으로 저장합니다.

```bash
npx wrangler secret put SHEETS_WEBHOOK_SECRET
npx wrangler secret put SHEETS_WEBHOOK_URL
npx wrangler d1 migrations apply warehouse-heist-rewards --remote
```

웹훅은 `@OnlyCurrentDoc` 범위로 연결된 시트만 접근하고 대상 시트의 2행 헤더를 확인합니다. D1 순번을 기준으로 재시도 요청을 같은 행에 기록합니다. 코드 원본은 클라이언트가 아니라 D1에서 생성·보관하며 생성일과 생성시각은 한국 시간으로 나눠 기록합니다.


## 1.5.0 개선

- 세로 화면의 72%를 게임에 사용하고 조작 버튼을 하단에 배치했습니다.
- 회수 화면의 상품 이미지와 버튼, 성공·실패 화면의 상품 카드를 통해 쇼핑몰로 이동합니다. 기존 무작위 10종 중 3종 회수 규칙과 상품 URL 매핑을 유지합니다. 기존 링크 중 9종은 검색 결과이며 HDMI 광케이블은 상세 페이지입니다. 확정되지 않은 상품 상세번호·가격·쿠폰은 만들지 않았습니다.
- 링크마다 UTM을 붙이고 시스템 공유/링크 복사를 제공합니다. 전용 카카오 SDK는 사용하지 않습니다.
- 효과음 설정, 최대 회수 수, 클리어 여부와 최고 플레이 시간을 브라우저에 저장합니다. 저장소가 차단되어도 플레이할 수 있습니다.
- 초기에는 1스테이지와 공통 효과만 받고, 2·3스테이지는 시작 후 미리 받습니다. 해당 에셋이 준비되지 않으면 다음 스테이지 진입을 기다리며 실패 시 재시도할 수 있습니다.
- 초기 전송량은 Chrome의 새 브라우저 컨텍스트에서 약 4.6 MB입니다. 상품 이미지는 회수 후 로드됩니다. 큰 이미지는 WebP near-lossless 40, 작은 이미지는 무손실, 인트로는 WebP 품질 90입니다. 원본 해상도와 스프라이트 프레임 경계를 유지했습니다.
- 폰트는 실제 사용 글자를 포함한 WOFF2 약 8.5 KB로 줄였습니다. 텍스트 추가 시 `scripts/subset-font.py`를 다시 실행하세요 (`fonttools`, `brotli` 필요). 이미지 재생성은 `node scripts/optimize-assets.cjs` (`cwebp` 필요). 원본은 `game/resource`, 기존 가공 장애물 원본은 `game/optimized`에 있습니다.
- OG 공유 이미지(1200×630), 확대 허용, safe area, 모션 감소 설정을 적용했습니다.

## 분석 연결

`dist/analytics-config.js`에 실제 `measurementId`(GA4) 또는 `containerId`(GTM)를 입력합니다. 두 값이 있으면 GTM을 우선합니다. 현재는 계정 ID가 없어 외부 분석 서버로 전송하지 않으며 `window.dataLayer`에 이벤트만 쌓입니다.

이벤트: `game_load`(loading_ms), `game_start`(device, orientation), `stage_clear`(stage, time_left, hearts), `game_over`(stage, recovered_count), `game_complete`(total_seconds), `product_click`(product_id, stage, placement), `shop_click`(stage, recovered_count).

GTM 사용 시 이 이벤트에 대한 맞춤 이벤트 트리거 및 GA4 이벤트 태그를 컨테이너에서 연결해야 합니다. 실제 수집 확인은 계정 연결 후 Realtime/DebugView에서 진행합니다. [GA4 이벤트 설정](https://developers.google.com/analytics/devguides/collection/ga4/events), [GTM 데이터 레이어](https://developers.google.com/tag-platform/tag-manager/datalayer).

## 검증

- `node tests/mobile-state.cjs`: 모바일 시야·충돌 영역, 회전 시 공중 높이와 장애물 위치 유지, 배경 축소·노면 정렬, 남은 시간과 부스트 상태 확인.
- `npm run check`: 프런트엔드·Worker 문법, 10,000개 난수의 형식·금지문자·표본 중복, Cloudflare 배포 사전 검사를 확인합니다.
- `node tests/game-browser.cjs`: 로컬 서버(기본 `http://localhost:4173`)와 Playwright 및 Chrome 필요. 기존 Playwright 경로는 `PLAYWRIGHT_MODULE`, 서버 주소는 `HEIST_TEST_URL`로 지정할 수 있습니다.
- 브라우저 검증은 1440×900, 390×844, 844×390에서 시작/점프/부스트, 3개 스테이지, 상품 링크·이벤트, 종료 화면, 사은품 코드 안내·이미지 저장, 실패·재시작, 저장, 세로↔가로 회전, 로딩 실패 재시도 및 저장소 차단을 확인합니다. 테스트용 상태 제어는 네트워크 응답에만 삽입되며 배포 코드에 포함되지 않습니다.
- 실제 iOS/Android 기기, 카카오 공유 캐시 갱신 및 외부 분석 수집은 별도 확인이 필요합니다.

## 1.6.0 도로 지형

- 도심의 열린 맨홀, 강변의 끊어진 도로·물웅덩이, 산길의 절벽·진흙길을 `terrain` 구간으로 분리합니다. 기존 리소스를 500~700px 너비의 도로 구간으로 합성하며, 절벽 중앙에서는 차선과 노면을 가리고 절벽 리소스를 그립니다.
- 지형은 차량·일반 장애물보다 먼저 그리며 노면과 동일한 속도로 이동합니다. 일반 물체와 지형을 번갈아 배치하고 넓은 구간 뒤에는 여유 간격을 둡니다.
- 맨홀·절벽은 바퀴 접점이 열린 부분에 닿을 때만 추락합니다. 점프로 피할 수 있고, 놓치면 생명 1개를 잃고 짧은 추락 후 복귀합니다. 부스트 중에는 지형을 없애지 않고 안전하게 통과합니다.
- 물웅덩이에서는 속도가 72%, 진흙길에서는 52%가 됩니다. 생명은 줄지 않으며 점프·부스트로 벗어나거나 구간을 지나면 원래 속도로 돌아갑니다. 속도계도 실제 감속을 표시합니다.
- `node tests/terrain-browser.cjs`로 지형 5종의 렌더링, 노면 속도 동기화, 추락/복귀, 점프, 감속, 부스트, 배치 간격과 회전을 검증합니다. Playwright 환경 설정은 기존 브라우저 테스트와 같습니다.

## 모바일 HUD와 조작 개선

- 상단 첫 줄에 스테이지·생명·부스트 충전 상태, 둘째 줄에 남은 시간을 표시합니다. 거리 표시는 제거했습니다.
- 하단 전체 너비의 부스트·점프 버튼을 두 줄로 배치하고 안전 영역을 확보합니다.
- 세로 화면의 도로 시야를 720에서 1080 논리 픽셀로 넓히고 두 차량을 180px로 줄입니다. 회전할 때 차량 크기와 충돌 영역을 함께 갱신하고 지면 기준 높이를 유지합니다.

- 모바일 배경은 높이 900 논리 픽셀 이내로 축소하고 도로를 기준으로 정렬합니다. 위쪽 하늘은 배경 상단 색으로 이어 채우며, 차량 크기와 충돌 판정은 유지합니다.
