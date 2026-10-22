from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
needle='<script src="coach_v064.js"></script>'
new='<script src="coach_v0641.js"></script>'
if s.count(new)==1:
    print('v0.6.4.1 module already installed');raise SystemExit(0)
assert s.count(needle)==1, 'Expected v0.6.4 base installation missing'
assert s.count('</body>')==1,'HTML body mismatch'
s=s.replace(needle,needle+'\n'+new)
s=s.replace('<title>Lucas AMC8 Coach v0.6.4</title>','<title>Lucas AMC8 Coach v0.6.4.1</title>')
s=s.replace('>v0.6.4</span>','>v0.6.4.1</span>')
p.write_text(s,encoding='utf-8')
print('Installed v0.6.4.1; no state, cloud, printing or archived assets edited.')
