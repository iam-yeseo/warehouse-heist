const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('dist/game.js', 'utf8').replace('  window.requestAnimationFrame(loop);\n  preload();', `
  window.testReward = () => {
    state = 'victory';
    rewardSessionPromise = Promise.resolve({ok:true, sessionId:'test', claimToken:'test'});
    stageVerificationChain = Promise.resolve({ok:true});
    return openRewardModal();
  };
  window.requestAnimationFrame(loop);
  preload();`);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://*.clarity.ms/**', route => route.fulfill({ contentType: 'application/javascript', body: 'window.testClarityLoaded=true;' }));
    await page.route('**/game.js?*', route => route.fulfill({ contentType: 'application/javascript', body: source }));
    await page.route('**/assets/game/rewards/**', route => route.abort('failed'));
    await page.route('**/api/reward-codes', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, code: '2345-6789-ABCD', sheetSynced: false }) }));
    const response = await page.goto(process.env.HEIST_TEST_URL || 'http://localhost:4173');
    assert(response.headers()['content-security-policy']?.includes("object-src 'none'"));
    await page.waitForFunction(() => window.testClarityLoaded === true);
    await page.evaluate(() => window.testReward());
    assert.equal(await page.locator('#rewardCode').textContent(), '2345-6789-ABCD');
    assert.equal(await page.locator('#rewardCopyButton').isEnabled(), true);
    assert.equal(await page.locator('.reward-code-box').getAttribute('data-clarity-mask'), 'True');
    const download = page.waitForEvent('download');
    await page.locator('#rewardSaveButton').click();
    assert((await download).suggestedFilename().endsWith('.png'));
    assert.deepEqual(errors, []);
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.untrustedInlineRan=true';
      document.head.append(script);
    });
    assert.equal(await page.evaluate(() => window.untrustedInlineRan), undefined);
    console.log('PASS: broken reward images do not block code/download; Clarity bootstrap allowed; arbitrary inline script blocked by CSP; reward code masked');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
