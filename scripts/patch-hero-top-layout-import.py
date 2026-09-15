from pathlib import Path

path = Path('src/main.tsx')
s = path.read_text()
anchor = "import './campaigns-expanded-professional.css'\n"
addition = anchor + "import './smart-scenes-hero-top-layout.css'\n"
if "import './smart-scenes-hero-top-layout.css'" not in s:
    if anchor not in s:
        raise SystemExit('import anchor not found')
    s = s.replace(anchor, addition, 1)
path.write_text(s)
