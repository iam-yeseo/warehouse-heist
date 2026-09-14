// Requires cwebp (libwebp). Originals remain in game/resource.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(source);
    else if (source.endsWith('.png')) {
      const relative = path.relative('game/resource', source).replace(/stage (\d)/g, 'stage-$1');
      const target = path.join('dist/assets/game', relative.replace(/\.png$/, '.webp'));
      fs.mkdirSync(path.dirname(target), {recursive:true});
      const optimized = path.join('game/optimized', relative);
      const input = fs.existsSync(optimized) ? optimized : source;
      const mode = relative === 'screens/intro.png' ? ['-q', '90'] : fs.statSync(input).size > 200000 ? ['-near_lossless', '40'] : ['-lossless'];
      execFileSync('cwebp', ['-quiet', ...mode, '-m', '6', input, '-o', target]);
    }
  }
}
walk('game/resource');
