from pathlib import Path

path = Path('src/SmartScenesManager.tsx')
s = path.read_text()
replacements = {
    '<details className="smart-hero-text-section">\n                  <summary>Produto</summary>': '<details className="smart-hero-text-section" open>\n                  <summary>Produto · Fonte · Contorno · Sombra · Animação</summary>',
    '<details className="smart-hero-text-section">\n                  <summary>Preço</summary>': '<details className="smart-hero-text-section">\n                  <summary>Preço · Fonte · Contorno · Sombra · Animação</summary>',
    '<details className="smart-hero-text-section">\n                  <summary>Unidade</summary>': '<details className="smart-hero-text-section">\n                  <summary>Unidade · Fonte · Contorno · Sombra · Animação</summary>',
    '<details className="smart-hero-text-section">\n                  <summary>Complemento</summary>': '<details className="smart-hero-text-section">\n                  <summary>Complemento · Fonte · Contorno · Sombra · Animação</summary>',
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'pattern not found: {old}')
    s = s.replace(old, new, 1)
path.write_text(s)
