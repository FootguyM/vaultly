#!/usr/bin/env python3
"""Inline index.html + styles.css + app.js into one self-contained page.

Used for the hosted Artifact build, which must be a single file with no
<html>/<head>/<body> wrapper (the host supplies those).
"""
import re, pathlib, sys

root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text()
css  = (root / 'styles.css').read_text()
js   = (root / 'app.js').read_text()

body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = body.replace('<script src="app.js"></script>', '')

# Google Fonts stylesheet is allowed by the artifact CSP; @import keeps it in <style>.
font = '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");\n'

out = (
    '<title>Vaultly</title>\n'
    '<style>\n' + font + css + '\n</style>\n'
    + body.strip() + '\n'
    '<script>\n' + js + '\n</script>\n'
)
dest = root / 'dist' / 'vaultly.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(out)
print('wrote', dest, len(out), 'bytes')
