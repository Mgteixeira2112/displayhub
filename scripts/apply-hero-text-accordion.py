from pathlib import Path
import re

manager = Path('src/SmartScenesManager.tsx')
s = manager.read_text()
pattern = re.compile(r'(?P<indent>\s*)<div className="smart-hero-text-control">\n(?P=indent)  <strong>(?P<title>Produto|Preço|Unidade|Complemento)</strong>\n(?P<body>.*?)(?P=indent)</div>', re.S)

count = 0

def repl(match):
    global count
    count += 1
    indent = match.group('indent')
    title = match.group('title')
    body = match.group('body')
    return (
        f'{indent}<details className="smart-hero-text-section">\n'
        f'{indent}  <summary>{title}</summary>\n'
        f'{indent}  <div className="smart-hero-text-control">\n'
        f'{body}'
        f'{indent}  </div>\n'
        f'{indent}</details>'
    )

s = pattern.sub(repl, s)
if count != 4:
    raise SystemExit(f'expected 4 Hero text controls, changed {count}')
manager.write_text(s)

css = Path('src/smart-scenes.css')
styles = css.read_text()
addition = '''\n.smart-hero-text-section{border:1px solid #e2e8f0;border-radius:9px;background:#fff;overflow:hidden}\n.smart-hero-text-section>summary{display:flex;align-items:center;justify-content:space-between;min-height:34px;padding:6px 10px;color:#334155;font-size:.66rem;font-weight:800;cursor:pointer;list-style:none;user-select:none}\n.smart-hero-text-section>summary::-webkit-details-marker{display:none}\n.smart-hero-text-section>summary:after{content:"⌄";color:#94a3b8;font-size:.72rem;transition:transform .16s ease}\n.smart-hero-text-section[open]>summary{border-bottom:1px solid #edf1f5;background:#f8fafc}\n.smart-hero-text-section[open]>summary:after{transform:rotate(180deg)}\n.smart-hero-text-section>.smart-hero-text-control{padding:10px}\n'''
if '.smart-hero-text-section{' in styles:
    raise SystemExit('accordion styles already present')
css.write_text(styles + addition)
