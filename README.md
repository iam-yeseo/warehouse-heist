# 창고 탈환 작전

도둑을 추격해 창고에서 사라진 상품 세 개를 되찾는 8비트 횡스크롤 웹 게임입니다.

## 게임 방법

- `Space`, `W`, `↑`: 점프 및 더블점프
- `B`, `Shift`: 부스트 사용
- `P`, `Esc`: 일시정지
- 모바일 세로 화면에서는 왼쪽 부스트·오른쪽 점프 버튼을 사용합니다. 화면 회전 시 진행 상태를 유지하고 일시정지합니다.

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

- `npm run check`: JavaScript 문법과 Cloudflare 정적 에셋 배포 사전 검사.
- `node tests/game-browser.cjs`: 로컬 서버(기본 `http://localhost:4173`)와 Playwright 및 Chrome 필요. 기존 Playwright 경로는 `PLAYWRIGHT_MODULE`, 서버 주소는 `HEIST_TEST_URL`로 지정할 수 있습니다.
- 브라우저 검증은 1440×900, 390×844, 844×390에서 시작/점프/부스트, 3개 스테이지, 상품 링크·이벤트, 종료 화면, 실패·재시작, 저장, 세로↔가로 회전, 로딩 실패 재시도 및 저장소 차단을 확인합니다. 테스트용 상태 제어는 네트워크 응답에만 삽입되며 배포 코드에 포함되지 않습니다.
- 실제 iOS/Android 기기, 카카오 공유 캐시 갱신 및 외부 분석 수집은 별도 확인이 필요합니다.

## 1.6.0 도로 지형

- 도심의 열린 맨홀, 강변의 끊어진 도로·물웅덩이, 산길의 절벽·진흙길을 `terrain` 구간으로 분리합니다. 기존 리소스를 500~700px 너비의 도로 구간으로 합성하며, 절벽 중앙에서는 차선과 노면을 가리고 절벽 리소스를 그립니다.
- 지형은 차량·일반 장애물보다 먼저 그리며 노면과 동일한 속도로 이동합니다. 일반 물체와 지형을 번갈아 배치하고 넓은 구간 뒤에는 여유 간격을 둡니다.
- 맨홀·절벽은 바퀴 접점이 열린 부분에 닿을 때만 추락합니다. 점프로 피할 수 있고, 놓치면 생명 1개를 잃고 짧은 추락 후 복귀합니다. 부스트 중에는 지형을 없애지 않고 안전하게 통과합니다.
- 물웅덩이에서는 속도가 72%, 진흙길에서는 52%가 됩니다. 생명은 줄지 않으며 점프·부스트로 벗어나거나 구간을 지나면 원래 속도로 돌아갑니다. 속도계도 실제 감속을 표시합니다.
- `node tests/terrain-browser.cjs`로 지형 5종의 렌더링, 노면 속도 동기화, 추락/복귀, 점프, 감속, 부스트, 배치 간격과 회전을 검증합니다. Playwright 환경 설정은 기존 브라우저 테스트와 같습니다.
