#!/usr/bin/env python3
"""Build Brain_Reflexo.html with CSS/JS inlined.

Important: use callable replacements with re.sub so JS string escapes
like \\n are not turned into real newlines (which breaks the file).
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
index = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
js = (root / 'app.js').read_text(encoding='utf-8')
safe_js = js.replace('</script', '<\\/script').replace('</SCRIPT', '<\\/SCRIPT')

html = index
html = re.sub(
    r'<link rel="stylesheet" href="style\.css[^"]*">',
    lambda _m: f'<style>\n{css}\n</style>',
    html,
    count=1,
)
html = re.sub(
    r'<script src="app\.js[^"]*"></script>[\s\S]*?</html>\s*$',
    lambda _m: f'<script>\n{safe_js}\n</script>\n</body>\n</html>\n',
    html,
    count=1,
)
html = re.sub(
    r'<title>([^<]*)</title>',
    r'<title>\1 (iPhone / Offline)</title>',
    html,
    count=1,
)

out = root / 'Brain_Reflexo.html'
out.write_text(html, encoding='utf-8')
print('Wrote', out, '(' + str(out.stat().st_size) + ' bytes)')
