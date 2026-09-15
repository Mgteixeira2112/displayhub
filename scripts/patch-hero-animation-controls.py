from pathlib import Path

path = Path('src/SmartScenesManager.tsx')
s = path.read_text()

old = '''                <div className="smart-hero-style-controls">\n                  <strong>Estilo</strong>'''
new = '''                <details className="smart-hero-text-section smart-hero-animation-section" open>\n                  <summary>Animações · Elemento 1 na frente</summary>\n                  <div className="smart-hero-style-controls">\n                  <strong>Estilo</strong>'''
if old not in s:
    raise SystemExit('style controls start not found')
s = s.replace(old, new, 1)

s = s.replace('''<input type="checkbox" checked={heroConfig.element1Enabled} onChange={(event) => updateHero('element1Enabled', event.target.checked)} />Elemento 1</label>''', '''<input type="checkbox" checked={heroConfig.element1Enabled} onChange={(event) => updateHero('element1Enabled', event.target.checked)} />Elemento 1 · Frente</label>''', 1)
s = s.replace('''<input type="checkbox" checked={heroConfig.element2Enabled} onChange={(event) => updateHero('element2Enabled', event.target.checked)} />Elemento 2</label>''', '''<input type="checkbox" checked={heroConfig.element2Enabled} onChange={(event) => updateHero('element2Enabled', event.target.checked)} />Elemento 2 · Meio</label>''', 1)
s = s.replace('''<input type="checkbox" checked={heroConfig.element3Enabled} onChange={(event) => updateHero('element3Enabled', event.target.checked)} />Elemento 3</label>''', '''<input type="checkbox" checked={heroConfig.element3Enabled} onChange={(event) => updateHero('element3Enabled', event.target.checked)} />Elemento 3 · Fundo</label>''', 1)

old_end = '''                  </div>\n                </div>\n                <div className="smart-scene-control-grid smart-scene-control-grid-three">'''
new_end = '''                  </div>\n                  </div>\n                </details>\n                <div className="smart-scene-control-grid smart-scene-control-grid-three">'''
if old_end not in s:
    raise SystemExit('style controls end not found')
s = s.replace(old_end, new_end, 1)

path.write_text(s)
