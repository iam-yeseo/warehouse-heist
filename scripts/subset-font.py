"""Requires fonttools and brotli. Regenerate after changing visible copy."""
from pathlib import Path
from fontTools import subset
root = Path(__file__).resolve().parents[1]
text = ''.join((root / name).read_text() for name in ['dist/index.html', 'dist/game.js', 'dist/style.css'])
text += ''.join(chr(i) for i in range(32, 127))
options = subset.Options()
options.flavor = 'woff2'
font = subset.load_font(str(root / 'game/resource/fonts/DOSGothic.ttf'), options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
subset.save_font(font, str(root / 'dist/assets/game/fonts/DOSGothic.woff2'), options)
