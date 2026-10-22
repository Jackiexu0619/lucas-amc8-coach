from pathlib import Path
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=p.read_text(encoding='utf-8')
if 'coach_v064.js' in s:
 print('v0.6.4 已安装，无需重复执行');raise SystemExit(0)
assert 'archive_official_v1' in s,'未发现已安装的真题题库'
assert s.count('</body>')==1 and s.count('</style>')==1,'页面结构与预期不符'
# Core inline script defines globals and calls async initialization. External module runs before async data fetch completes.
s=s.replace('</body>','<script src="coach_v064.js"></script>\n</body>')
s=s.replace('>v0.6.3.3</span>','>v0.6.4</span>').replace('>v0.6.3.4</span>','>v0.6.4</span>')
s=s.replace('<title>Lucas AMC8 Coach v0.6.3.4</title>','<title>Lucas AMC8 Coach v0.6.4</title>')
p.write_text(s,encoding='utf-8')
print('已添加 v0.6.4 模块与可见版本号')
