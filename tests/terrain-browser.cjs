const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('dist/game.js','utf8').replaceAll('window.requestAnimationFrame(loop);','');
const instrumented = source.replace('  preload();', `
  window.terrainTest = {
    async scene(index, kind, contact=false) {
      await ensureStage(index);
      stageIndex=index; state='playing'; stageElapsed=0; lives=3; invulnerableTime=0; boostTime=0; speed=BASE_SPEED;
      nextObstacleIn=100; safeTime=0; boostReady=false; surfaceKind=''; effects=[]; player=createPlayer();
      const config=stages[index].obstacles.find(o=>o.kind===kind);
      obstacles=[{...config,x:contact ? player.x+player.w*.5-config.w*.5 : W*.28,y:GROUND_Y-config.h,baseY:GROUND_Y-config.h,hit:false,angle:0}];
      hideAllScreens(); ui.notice.classList.remove('is-visible'); updateHud(); draw();
    },
    snapshot:()=>({state,lives,speed,worldDistance,surfaceKind,boostTime,fallTime:player.fallTime,feet:player.y+player.h,ground:GROUND_Y,obstacles:obstacles.map(o=>({...o})),W,H}),
    step(dt){ update(dt); draw(); },
    jump(){queueJump();},
    boost(){boostReady=true;useBoost();},
    airborne(){player.y=GROUND_Y-player.h-130;player.jumps=1;},
    spawn(){obstacles=[];spawnedHazards=0;for(let i=0;i<6;i++)spawnObstacle();return obstacles.map(o=>({kind:o.kind,terrain:o.terrain,x:o.x,throwTime:thiefThrowTime}));}
  };
  preload();`);
(async()=>{
 const b=await chromium.launch({channel:'chrome'}); const report=[];
 try {
  for(const [width,height] of [[1440,900],[390,844],[844,390]]) {
   const p=await b.newPage({viewport:{width,height}});const errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/game.js?*',r=>r.fulfill({contentType:'application/javascript',body:instrumented}));
   await p.goto(process.env.HEIST_TEST_URL || 'http://localhost:4173');await p.locator('#introScreen.is-visible').waitFor();
   for(const [stage,kind] of [[0,'manhole'],[1,'gap'],[1,'puddle'],[2,'gap'],[2,'mud']]) {
    await p.evaluate(([s,k])=>terrainTest.scene(s,k),[stage,kind]);
    await p.screenshot({path:`/tmp/heist-terrain-${width}-${stage}-${kind}.png`});
    const before=await p.evaluate(()=>terrainTest.snapshot());
    await p.evaluate(()=>terrainTest.step(.02));
    const after=await p.evaluate(()=>terrainTest.snapshot());
    assert(Math.abs((before.obstacles[0].x-after.obstacles[0].x)-(after.worldDistance-before.worldDistance))<.001,'Road section must scroll with ground');
    assert(after.obstacles[0].w>=500);
    await p.evaluate(([s,k])=>terrainTest.scene(s,k,true),[stage,kind]);
    await p.evaluate(()=>terrainTest.step(.016));
    const hit=await p.evaluate(()=>terrainTest.snapshot());
    if(['gap','manhole'].includes(kind)) {
     assert.equal(hit.lives,2);assert(hit.fallTime>0);
     await p.evaluate(()=>terrainTest.step(.2));
     assert((await p.evaluate(()=>terrainTest.snapshot())).feet>hit.ground);
     await p.evaluate(()=>{for(let i=0;i<40;i++)terrainTest.step(.016)});
     const rescued=await p.evaluate(()=>terrainTest.snapshot());assert.equal(rescued.fallTime,0);assert.equal(rescued.lives,2);
    } else {assert.equal(hit.lives,3);assert.equal(hit.surfaceKind,kind)}
    await p.evaluate(([s,k])=>terrainTest.scene(s,k,true),[stage,kind]);
    await p.evaluate(()=>{terrainTest.airborne();terrainTest.step(.016)});
    const jumped=await p.evaluate(()=>terrainTest.snapshot());assert.equal(jumped.lives,3);assert.equal(jumped.surfaceKind,'');assert.equal(jumped.fallTime,0);
    await p.evaluate(([s,k])=>terrainTest.scene(s,k,true),[stage,kind]);
    await p.evaluate(()=>{terrainTest.boost();terrainTest.step(.016)});
    const boosted=await p.evaluate(()=>terrainTest.snapshot());assert.equal(boosted.lives,3);assert.equal(boosted.surfaceKind,'');assert.equal(boosted.obstacles.length,1);assert.equal(boosted.fallTime,0);
   }
   const spawns=await p.evaluate(()=>terrainTest.spawn());assert.equal(spawns.filter(o=>o.terrain).length,3);assert(spawns.every(o=>o.x>0));
   if(width===390){await p.evaluate(()=>terrainTest.scene(2,'gap',true));await p.evaluate(()=>terrainTest.step(.016));const prior=await p.evaluate(()=>terrainTest.snapshot());await p.setViewportSize({width:844,height:390});await p.waitForFunction(()=>terrainTest.snapshot().state==='paused');const rotated=await p.evaluate(()=>terrainTest.snapshot());assert.equal(rotated.fallTime,prior.fallTime);assert.equal(rotated.lives,prior.lives);assert(Math.abs((rotated.feet-rotated.ground)-(prior.feet-prior.ground))<.01)}
   assert.deepEqual(errors,[]);report.push({width,height,result:'terrain rendering, road speed, fall/rescue, jump, drag, boost, scheduling, rotation passed'});await p.close();
  }
  console.log(JSON.stringify(report,null,2));
 } finally {await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
