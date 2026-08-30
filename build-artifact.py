#!/usr/bin/env python3
"""Inline index.html + styles.css + app.js into one self-contained page.

Used for the hosted Artifact build, which must be a single file with no
<html>/<head>/<body> wrapper (the host supplies those). The Google Fonts
stylesheet is carried over as an @import, which the artifact CSP allows.
"""
import re, pathlib

root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text()
css  = (root / 'styles.css').read_text()
js   = (root / 'app.js').read_text()

body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = body.replace('<script src="app.js"></script>', '')

# Carry the font request over from <head>, whatever families it names.
font = ''
m = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/[^"]+)"', html)
if m:
    font = '@import url("%s");\n' % m.group(1).replace('&amp;', '&')

title = re.search(r'<title>(.*?)</title>', html, re.S)
title = title.group(1).split('—')[0].strip() if title else 'Vaultly'

out = (
    '<title>' + title + '</title>\n'
    '<style>\n' + font + css + '\n</style>\n'
    + body.strip() + '\n'
    '<script>\n' + js + '\n</script>\n'
)
dest = root / 'dist' / 'vaultly.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(out)
print('wrote', dest, len(out), 'bytes')
