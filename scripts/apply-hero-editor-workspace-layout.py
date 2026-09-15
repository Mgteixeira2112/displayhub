from pathlib import Path

manager = Path('src/SmartScenesManager.tsx')
s = manager.read_text()
old = '<form className="smart-scene-editor" onSubmit={saveScene}>'
new = '<form className={`smart-scene-editor${editorKind === \'hero\' ? \' is-hero-editor\' : \'\'}`} onSubmit={saveScene}>'
if old not in s:
    raise SystemExit('editor form marker not found')
s = s.replace(old, new, 1)

product_marker = '                <div className="smart-hero-text-control">\n                  <strong>Produto</strong>'
if product_marker not in s:
    raise SystemExit('product text control marker not found')
s = s.replace(product_marker, '                <div className="smart-hero-text-dock">\n' + product_marker, 1)

close_marker = '                </div>\n              </div>\n            )}\n            {editorKind !== \'hero\''
if close_marker not in s:
    raise SystemExit('hero editor closing marker not found')
s = s.replace(close_marker, '                </div>\n                </div>\n              </div>\n            )}\n            {editorKind !== \'hero\'', 1)
manager.write_text(s)

css = Path('src/smart-scenes.css')
s = css.read_text()
append = '''\n.smart-scene-editor.is-hero-editor{grid-template-columns:minmax(0,3fr) minmax(300px,1fr);align-items:start;column-gap:20px;row-gap:14px}.smart-scene-editor.is-hero-editor>.smart-scene-preview{grid-column:1;grid-row:1;min-width:0;position:sticky;top:12px}.smart-scene-editor.is-hero-editor>.smart-scene-editor-fields,.smart-scene-editor.is-hero-editor .smart-hero-editor-block{display:contents}.smart-scene-editor.is-hero-editor>.smart-scene-editor-fields>*{grid-column:2}.smart-scene-editor.is-hero-editor .smart-hero-editor-block>*{grid-column:2}.smart-scene-editor.is-hero-editor .smart-hero-text-dock{grid-column:1/-1!important;order:99;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.smart-scene-editor.is-hero-editor .smart-hero-text-dock .smart-hero-text-control{grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;align-items:end}.smart-scene-editor.is-hero-editor .smart-hero-text-dock .smart-hero-text-control>strong{grid-column:1/-1;padding-bottom:3px;border-bottom:1px solid #eef2f7}.smart-scene-editor.is-hero-editor .smart-scene-editor-actions{position:sticky;bottom:8px;z-index:3;padding:8px;border:1px solid #e2e8f0;border-radius:10px;background:rgba(255,255,255,.96);box-shadow:0 8px 20px rgba(15,23,42,.06)}@media(max-width:1100px){.smart-scene-editor.is-hero-editor{grid-template-columns:minmax(0,2fr) minmax(280px,1fr)}.smart-scene-editor.is-hero-editor .smart-hero-text-dock{grid-template-columns:1fr 1fr}.smart-scene-editor.is-hero-editor .smart-hero-text-dock .smart-hero-text-control{grid-template-columns:1fr 1fr}}@media(max-width:820px){.smart-scene-editor.is-hero-editor{grid-template-columns:1fr}.smart-scene-editor.is-hero-editor>.smart-scene-preview,.smart-scene-editor.is-hero-editor>.smart-scene-editor-fields>*,.smart-scene-editor.is-hero-editor .smart-hero-editor-block>*,.smart-scene-editor.is-hero-editor .smart-hero-text-dock{grid-column:1/-1!important}.smart-scene-editor.is-hero-editor>.smart-scene-preview{position:relative;top:auto;grid-row:auto}.smart-scene-editor.is-hero-editor .smart-hero-text-dock{grid-template-columns:1fr}.smart-scene-editor.is-hero-editor .smart-scene-editor-actions{position:static}}\n'''
if '.smart-scene-editor.is-hero-editor{' in s:
    raise SystemExit('hero workspace layout already present')
css.write_text(s + append)
'''

Path('src/smart-scenes.css').write_text(s)
