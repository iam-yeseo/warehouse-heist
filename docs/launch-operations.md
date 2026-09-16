# 출시 운영 가이드

월 광고 클릭 10,000회 / Cloudflare Free 기준. 대시보드 신규 구현은 포함하지 않는다.

## 배포와 자동 처리

Node.js 22 이상에서 `npm ci`, `npm run check`, `npm run deploy:workers` 순서로 실행한다. 배포 명령은 additive D1 migration을 먼저 적용한다. 기존 코드·세션·시트 기록은 유지된다. 직접 `wrangler deploy`를 실행하는 별도 CI가 있다면 먼저 `wrangler d1 migrations apply warehouse-heist-rewards --remote`를 실행해야 한다.

- API: IP당 세션 생성 10회/분, POST 전체 60회/분. NAT/사내망에서는 여러 사람이 한 IP를 공유하므로 정상 사용자 429 증가 시 이 수치를 조정한다. 계정 내 rate-limit namespace `2026091701`, `2026091702`는 이 게임 전용으로 유지한다. 지역별 근사 제한이며 분산 공격 전체를 차단한다는 보장은 없다.
- 요청: 실제 8,192바이트 초과는 413, 잘못된 JSON은 400, 지원하지 않는 MIME은 415. 유효하지 않은 인증 정보는 DB 조회 전에 거절한다.
- 보상: D1에 먼저 저장하고 응답. Google Sheets는 매분 최대 10개를 순차 전송한다. 실패 시 최대 1시간까지 지수 백오프. 2분 lease 만료 후 크래시 작업도 복구한다. 시트의 순번 기준 upsert가 중복 행을 방지한다.
- 세션: 미완료 인증은 24시간 유효. 매시 정각에 7일 지난 미완료 세션 최대 100개만 삭제한다. 완료/보상 기록은 자동 삭제하지 않는다.
- 로그: `sheet_sync_failed`, `sheet_sync_not_configured`, `abandoned_sessions_cleaned`로 검색한다. 웹훅 응답 본문이나 Secret은 기록하지 않는다.
- 헤더: CSP는 Clarity, 기존 GA4 경로, 로컬 게임 리소스를 허용한다. 임의 inline script/object/frame embedding은 차단한다. 게임 UI의 style 변경을 위해 inline style은 허용한다.

Cron 설정 변경은 전파에 시간이 걸릴 수 있다. 배포 직후 pending이 잠시 남아 있는 것과 지속적인 실패를 구분한다.

## 운영자가 직접 결정/확인할 것

### 1. 사은품 지급 정책 — 광고 전 필수

서버 타이머와 IP 제한은 실제 플레이 또는 사람 1명임을 증명하지 않는다. 구매 주문에 동봉하는 현재 구조에서는 배송 담당자의 지급 대조가 필요하다.

1. 정상 결제 주문 1건당 사은품 1회인지, 고객당 1회인지 확정한다.
2. 기존 코드 시트의 A:G는 웹훅 관리 영역이므로 열/헤더를 이동하지 않는다.
3. 별도 지급관리 탭에 주문번호, 코드, 지급 여부, 처리일을 기록한다. 이미 사용한 코드와 주문번호를 확인한 후 지급한다.
4. 취소·환불·품절·추가 주문 처리 기준과 총 증정 수량을 배송 담당자에게 전달한다.

쇼핑몰 주문/결제 권한과 정책이 없는 상태에서 자동 지급 연동이나 수량 제한을 임의로 만들지 않는다. 실제 게임 클리어를 엄격히 증명하려면 서버 검증 게임 상태/리플레이 개발이 추가로 필요하다.

### 2. Clarity 실제 수집 확인

1. Microsoft Clarity에 로그인해 프로젝트 `yj7fm715n8`을 연다.
2. 실제 휴대폰으로 `https://heist.yeseo.im/`을 열고 게임을 진행한다.
3. Dashboard/Recordings에서 새 방문이 들어오는지 확인한다. 광고 차단기나 브라우저 추적 방지로 일부 세션이 누락될 수 있다.
4. Settings → Masking에서 필요한 마스킹 정책을 확인한다. 코드 영역은 HTML의 `data-clarity-mask="True"`로 가려져 있다.
5. 필요한 개인정보/동의 안내는 실제 광고 대상 지역과 서비스 운영 정책에 맞춰 확정한다. 코드 설치만으로 이 정책이 결정되지는 않는다.

### 3. 출고 담당자와 정상 코드 한 건 확인

1. 출시 도메인에서 실제 게임을 정상 완주하고 코드를 받는다.
2. 일반적으로 다음 Cron 주기 이후 시트에 같은 코드가 한 행으로 생기는지 확인한다. 지연되면 아래 SQL로 pending과 오류를 확인한다.
3. 배송 담당자가 그 코드를 보고 주문 요청사항과 대조할 수 있는지 확인한다. 시트 공유 범위는 담당자만 접근하도록 한다.
4. 미동기화여도 코드의 원장은 D1이다. 코드를 다시 발급하거나 기존 데이터를 지우지 말고 설정·실패 원인을 복구한다.

### 4. 출시일 사용량 확인

Cloudflare → Workers & Pages → warehouse-heist에서 Metrics/Logs/Triggers를 확인한다. D1 → warehouse-heist-rewards → Metrics에서 읽기·쓰기·용량을 확인한다.

무료 계정 전체 한도: Workers 100,000 요청/일, D1 쓰기 100,000행/일·읽기 5,000,000행/일. 인덱스와 유지보수 쓰기도 포함된다. 하루 사용량 50%에서는 추세를 확인하고 80%에서는 광고 속도 조절이나 Workers Paid 전환을 검토한다. 다른 프로젝트 사용량도 포함된다. UTC 자정(한국 오전 9시)에 일일 한도가 초기화된다.

로그의 429 증가가 봇인지 정상 공유망 사용자인지 구분한다. 유료 전환은 사용자가 결제 판단해야 하며, 분산 봇이나 시트 병목을 자동 해결하지 않는다.

## 운영 SQL (읽기 전용)

Cloudflare D1 콘솔 또는 `wrangler d1 execute warehouse-heist-rewards --remote --command "..."`로 실행한다.

```sql
SELECT sheet_sync_status, COUNT(*) AS count
FROM reward_codes GROUP BY sheet_sync_status;

SELECT id, sheet_sync_attempts, sheet_next_attempt_at, sheet_sync_error
FROM reward_codes WHERE sheet_sync_status = 'pending'
ORDER BY sheet_next_attempt_at LIMIT 20;

SELECT COUNT(*) AS issued_today FROM reward_codes
WHERE created_date = strftime('%Y-%m-%d', 'now', '+9 hours');
```

Secret 설정 문제가 있으면 Worker의 `SHEETS_WEBHOOK_URL`, `SHEETS_WEBHOOK_SECRET`과 Apps Script의 `WEBHOOK_SECRET`이 일치하는지 소유자가 확인한다. Secret 값을 채팅·GitHub·스크린샷에 공개하지 않는다. Apps Script는 기존 bound spreadsheet와 `시트1`의 2행 헤더를 사용한다. 값 복구 후 Cron이 자동 재시도한다.

## 남은 봇 방어 강화

IP 제한은 이번 코드에 포함된다. Turnstile 추가는 위젯뿐 아니라 프런트엔드 토큰 수명 관리와 서버 Siteverify의 hostname/action 검증까지 함께 적용해야 한다. Cloudflare의 브라우저 Challenge 규칙을 JSON API에 무작정 붙이면 게임 요청이 실패할 수 있으므로 피한다. Turnstile을 적용해도 실제 플레이 증명이나 주문당 중복 지급 방지는 별개다.

## 근거

- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking
