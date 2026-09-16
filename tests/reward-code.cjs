const assert = require('node:assert/strict');

(async () => {
  const {generateRewardCode,splitRewardCode}=await import('../src/index.mjs');
  const generated=new Set();
  for(let index=0;index<10_000;index+=1) {
    const code=generateRewardCode();
    assert.match(code,/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    assert(!/[01OIL]/.test(code));
    assert.deepEqual(splitRewardCode(code),code.split('-'));
    assert(!generated.has(code),'Generated reward code collision in deterministic test batch');
    generated.add(code);
  }
  console.log('PASS: 10,000 secure reward codes match the allowed alphabet, grouping, and uniqueness sample');
})().catch(error=>{console.error(error);process.exitCode=1});
