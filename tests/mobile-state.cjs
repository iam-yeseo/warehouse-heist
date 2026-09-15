const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('dist/game.js', 'utf8');
function extract(name) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf('\n  }', start) + 4;
  assert(start >= 0 && end > start, `Missing ${name}`);
  return source.slice(start, end);
}
const node = () => ({style:{}, dataset:{}, children:[], classList:{toggle(){}}, replaceChildren(){this.children=[]}, append(n){this.children.push(n)}, setAttribute(){}});
const ui = Object.fromEntries(['hud','stageNumber','stageName','stageProgress','timeLeft','lives','boostGauge','boostLabel','boostStatus','boostButton'].map(id=>[id,node()]));
const context = vm.createContext({assert, ui, document:{querySelector:node, createElement:node}, window:{devicePixelRatio:2}, ctx:{}, canvas:{getBoundingClientRect:()=>({width:390,height:540})}});
vm.runInContext(`
let IS_MOBILE_PORTRAIT=true, IS_COMPACT_VIEW=true, W=1280, H=720, GROUND_Y=605;
const portraitQuery={matches:true}, compactQuery={matches:true};
const VEHICLE_FRAME_RATIO=(1870/8)/(841/6), STAGE_SECONDS=30;
let state='paused', stageIndex=0, stageElapsed=0, lives=3, renderedLives=-1, renderedGauge='';
let boostReady=false, boostTime=0, safeTime=0;
const stages=[{name:'도심 추격'}], paths={ui:''}, obstacles=[], effects=[];
${extract('createPlayer')}
${extract('resizeGame')}
${extract('playerHitbox')}
${extract('updateHud')}
${extract('backgroundLayout')}
function togglePause(){state='paused'}
let player=createPlayer();
resizeGame();
assert.equal(W,1080);
assert.equal(player.w,180);
assert.equal(player.y+player.h,GROUND_Y);
const mobileHitbox=playerHitbox();
player.y-=120;
obstacles.push({x:500,y:GROUND_Y-60,baseY:GROUND_Y-60});
const relativeX=obstacles[0].x-player.x;
portraitQuery.matches=false;
resizeGame();
assert.equal(player.w,226);
assert.equal(player.y+player.h,GROUND_Y-120);
assert.equal(obstacles[0].x-player.x,relativeX);
assert.equal(obstacles[0].y,GROUND_Y-60);
assert(playerHitbox().w>mobileHitbox.w);
portraitQuery.matches=true;
resizeGame();
assert.equal(player.w,180);
assert.equal(player.y+player.h,GROUND_Y-120);
const backdrop=backgroundLayout();
assert.equal(backdrop.height,900);
assert(Math.abs(backdrop.top + GROUND_Y * backdrop.height / H - GROUND_Y)<.001);
IS_MOBILE_PORTRAIT=false;assert.equal(backgroundLayout().height,H);assert.equal(backgroundLayout().top,0);
for (const [elapsed,seconds] of [[0,'30'],[15,'15'],[30,'0'],[31,'0']]) {
  stageElapsed=elapsed;updateHud();assert.equal(ui.timeLeft.textContent,seconds);
}
state='playing';boostReady=true;updateHud();assert.equal(ui.boostButton.disabled,false);
boostReady=false;updateHud();assert.equal(ui.boostButton.disabled,true);
`,context);
console.log('PASS: mobile camera, scaled hitbox, airborne rotation, obstacle alignment, background scale/road anchor, remaining time, boost state');
