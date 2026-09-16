// PLAYWRIGHT_MODULE can point at an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.HEIST_TEST_URL || 'http://localhost:4173';
const source = fs.readFileSync('dist/game.js', 'utf8');
// Test instrumentation is injected only into intercepted browser responses.
const instrumented = source.replace('  window.requestAnimationFrame(loop);\n  preload();', `
  window.testGame = {
    snapshot: () => ({state, stageIndex, stageElapsed, lives, recovered:[...recoveredProducts], x:player.x, y:player.y, ground:GROUND_Y, jumps:player.jumps, boostTime}),
    finishStage: () => { invulnerableTime = 100; for (let i=0; i<3001 && state==='playing'; i++) update(.01); },
    crash: () => { invulnerableTime=0; collide({hit:false}); updateHud(); },
    charge: () => {safeTime=10; boostReady=true; updateHud();}
  };
  window.requestAnimationFrame(loop);
  preload();`);

async function installRewardApiMock(page) {
  let lastStage = 0;
  const sessionId = '11111111-2222-4333-8444-555555555555';
  const claimToken = 'test-claim-token';
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const body = request.postDataJSON?.() || {};
    let response;
    if (request.method() === 'POST' && pathname === '/api/game-sessions') {
      lastStage=0;
      response = {ok:true,sessionId,claimToken};
    } else if (request.method() === 'POST' && /\/api\/game-sessions\/.+\/stages$/.test(pathname)) {
      assert.equal(body.claimToken,claimToken);
      assert.equal(body.stage,lastStage+1);
      lastStage=body.stage;
      response={ok:true,accepted:true,lastStage,completed:lastStage===3};
    } else if (request.method() === 'POST' && pathname === '/api/reward-codes') {
      assert.equal(lastStage,3);
      assert.equal(body.sessionId,sessionId);
      assert.equal(body.claimToken,claimToken);
      response={ok:true,code:'2ABC-3DEF-4GHJ',parts:['2ABC','3DEF','4GHJ'],existing:false,sheetSynced:true};
    } else {
      return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
}
(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const errors = [];
  const report = [];
  try {
    for (const [width,height] of [[1440,900],[390,844],[844,390]]) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900});
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {if(response.status()>=400) errors.push(`${response.status()} ${response.url()}`)});
      await installRewardApiMock(page);
      await page.route('**/game.js?*', route => route.fulfill({contentType:'application/javascript',body:instrumented}));
      await page.goto(base);
      await page.locator('#introScreen.is-visible').waitFor();
      const initial = await page.evaluate(() => performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.transferSize})));
      assert(!initial.some(r=>/stage-[23]|product-\d|\/rewards\//.test(r.url)), 'Later stages, products, and rewards must be lazy');
      const bytes = initial.reduce((n,r)=>n+r.bytes,0);
      assert(bytes<5_000_000, `Initial transfer ${bytes} exceeds 5 MB`);
      await page.click('#startButton');
      await page.waitForFunction(()=>window.testGame.snapshot().state==='playing');
      if(width===1440) assert.equal(await page.locator('.mobile-actions').isVisible(),false);
      if(width===390) {
        const box=await page.locator('canvas').boundingBox();
        assert(box.height>height*.6);
        const button=await page.locator('#jumpButton').boundingBox();
        assert(button.y>height*.75);
        await page.locator('#jumpButton').dispatchEvent('pointerdown');
      } else { await page.locator('canvas').click(); await page.keyboard.press('Space'); }
      assert.equal(await page.evaluate(()=>testGame.snapshot().jumps),1);
      await page.evaluate(()=>testGame.charge());
      if(width<900) await page.locator('#boostButton').dispatchEvent('pointerdown');
      else await page.keyboard.press('b');
      assert((await page.evaluate(()=>testGame.snapshot().boostTime))>0);
      if(width===390) {
        const before=await page.evaluate(()=>testGame.snapshot());
        await page.setViewportSize({width:844,height:390});
        await page.waitForFunction(()=>testGame.snapshot().state==='paused');
        const after=await page.evaluate(()=>testGame.snapshot());
        assert.equal(after.lives,before.lives);
        assert.equal(after.stageIndex,before.stageIndex);
        assert(after.stageElapsed>=before.stageElapsed && after.stageElapsed-before.stageElapsed<1);
        await page.setViewportSize({width,height});
        await page.click('#resumeButton');
      }
      await page.click('#soundButton');
      assert.equal(await page.locator('#soundButton').getAttribute('aria-pressed'),'true');
      for(let stage=1;stage<=3;stage++) {
        await page.evaluate(()=>testGame.finishStage());
        await page.locator('#stageClearScreen.is-visible').waitFor();
        const href=await page.locator('#productLink').getAttribute('href');
        assert(href.startsWith('https://www.callamedia.kr/'));
        assert(new URL(href).searchParams.get('utm_content').endsWith(`stage${stage}`));
        await page.locator('#productLink').evaluate(link=>link.addEventListener('click',e=>e.preventDefault(),{once:true}));
        await page.click('#productLink');
        assert.equal(await page.locator('#productImageLink').getAttribute('data-product-id'),await page.locator('#productLink').getAttribute('data-product-id'));
        if(stage===1) await page.screenshot({path:`/tmp/heist-clear-${width}.png`});
        await page.click('#nextStageButton');
        if(stage<3) await page.waitForFunction(()=>testGame.snapshot().state==='playing');
      }
      await page.locator('#victoryScreen.is-visible').waitFor();
      assert.equal(await page.locator('#victoryProducts a').count(),3);
      assert.equal(await page.locator('#rewardButton').isVisible(),true);
      await page.click('#rewardButton');
      await page.locator('#rewardScreen.is-visible').waitFor();
      await page.waitForFunction(()=>document.querySelector('#rewardCode').textContent==='2ABC-3DEF-4GHJ');
      assert.equal(await page.locator('.reward-gifts figure').count(),3);
      assert.equal(await page.locator('#rewardCopyButton').isEnabled(),true);
      assert.equal(await page.locator('#rewardSaveButton').isEnabled(),true);
      if(width===1440) {
        const [download]=await Promise.all([page.waitForEvent('download'),page.click('#rewardSaveButton')]);
        assert.match(download.suggestedFilename(),/^칼라미디어-사은품-2ABC-3DEF-4GHJ\.png$/);
        await download.saveAs('/tmp/heist-reward-card.png');
        assert(fs.statSync('/tmp/heist-reward-card.png').size>100_000,'Saved reward card must contain rendered images and code');
      }
      await page.screenshot({path:`/tmp/heist-reward-${width}.png`,fullPage:true});
      await page.click('#rewardCloseButton');
      await page.screenshot({path:`/tmp/heist-victory-${width}.png`});
      let events=await page.evaluate(()=>window.dataLayer.filter(e=>e.event).map(e=>e.event));
      assert.equal(events.filter(e=>e==='stage_clear').length,3);
      assert.equal(events.filter(e=>e==='product_click').length,3);
      assert.equal(events.filter(e=>e==='game_complete').length,1);
      await page.click('#victoryRetryButton');
      await page.waitForFunction(()=>testGame.snapshot().state==='playing');
      await page.evaluate(()=>{testGame.crash();testGame.crash();testGame.crash()});
      await page.locator('#gameOverScreen.is-visible').waitFor();
      assert.equal(await page.locator('#failedProducts a').count(),0);
      await page.click('#retryButton');
      await page.waitForFunction(()=>testGame.snapshot().state==='playing');
      await page.evaluate(()=>testGame.finishStage());
      await page.click('#nextStageButton');
      await page.waitForFunction(()=>testGame.snapshot().state==='playing');
      await page.evaluate(()=>{testGame.crash();testGame.crash();testGame.crash()});
      await page.locator('#gameOverScreen.is-visible').waitFor();
      assert.equal(await page.locator('#failedProducts a').count(),1);
      assert.equal(await page.locator('.mobile-actions').isVisible(),false);
      await page.screenshot({path:`/tmp/heist-failure-${width}.png`});
      await page.reload();
      await page.locator('#introScreen.is-visible').waitFor();
      assert((await page.locator('#recordSummary').textContent()).includes('탈환 성공'));
      assert.equal(await page.locator('#soundButton').getAttribute('aria-pressed'),'true');
      report.push({width,height,initialBytes:bytes,checks:'start, jump, boost, rotation, 3 stages, links, events, victory, reward code modal, failures, persistence'});
      await context.close();
    }
    // Retry failed initial image and unavailable next-stage images; reduced motion and blocked storage.
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})});
    let rejectHero=true, rejectStage=true;
    await installRewardApiMock(page);
    await page.route('**/hero-vehicle.webp?*',route=>rejectHero?route.abort():route.continue());
    await page.route('**/stage-2/**',route=>rejectStage?route.abort():route.continue());
    await page.route('**/game.js?*',route=>route.fulfill({contentType:'application/javascript',body:instrumented}));
    await page.goto(base);
    await page.locator('#loadingRetry:visible').waitFor();
    rejectHero=false;
    await page.click('#loadingRetry');
    await page.locator('#introScreen.is-visible').waitFor();
    await page.click('#startButton');
    await page.waitForFunction(()=>testGame.snapshot().state==='playing');
    await page.evaluate(()=>testGame.finishStage());
    await page.click('#nextStageButton');
    await page.waitForFunction(()=>testGame.snapshot().state==='stage-clear');
    assert.equal(await page.locator('#nextStageButton').isEnabled(),true);
    rejectStage=false;
    await page.click('#nextStageButton');
    await page.waitForFunction(()=>testGame.snapshot().state==='playing');
    assert.equal(await page.evaluate(()=>testGame.snapshot().stageIndex),1);
    await page.close();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({report,errors,retryAndStorage:'passed'},null,2));
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
