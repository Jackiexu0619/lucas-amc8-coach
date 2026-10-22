#!/usr/bin/env python3
"""Apply image-based official bilingual AMC8 question bank to Lucas Coach v0.6.3.3.
Run against extracted original GitHub index.html, in folder with bank.js and assets/.
Does not touch Supabase or existing localStorage state.
"""
import pathlib, sys, shutil
p=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=p.read_text(encoding='utf-8'); original=s
if 'archive_official_v1' in s:raise SystemExit('已安装该补丁，无需重复执行')
def replace(old,new,label):
 global s
 if s.count(old)!=1:raise RuntimeError(f'{label}：源文件结构不同，找到 {s.count(old)} 处，已停止以防误改')
 s=s.replace(old,new)
# External JS exports window.AMC8_ARCHIVE_DATA, and an optional JSON fallback on Pages.
replace('</head>','<script src="official_bank.js"></script>\n</head>','载入题库')
archive_code=r'''
// ---------- archive_official_v1: image-preserving, bilingual source PDFs ----------
let ARCHIVE_BANK=[];
function archiveQuestion(r){
 const d=r.number<=8?1:r.number<=16?2:r.number<=21?3:4;
 // No unverified knowledge labels; 2015-18 classifications reused if available.
 const prior=(REAL_BANK||[]).find(q=>q.official&&q.year===r.year&&q.problem_number===r.number);
 const domain=prior?.domain||'misc';
 return {id:r.id,source:r.year+' AMC8 中英真题',year:r.year,problem_number:r.number,
   domain,skill:prior?.skill||'archive_unclassified_'+r.year+'_'+r.number,
   core_method:prior?.core_method||'archive_method_'+r.year+'_'+r.number,
   difficulty:d,answer:r.answer,choices:['A','B','C','D','E'],prompt:'原版中英双语题目图像',prompt_en:'',prompt_zh:'',
   archive_image:r.image,archive_height:r.height,official:true,active:true,quality_tier:'original_pdf',
   variant_group:'archive_'+r.year+'_'+r.number};
}
async function loadArchiveBank(){
 let rows=window.AMC8_ARCHIVE_DATA;
 if(!Array.isArray(rows)){let res=await fetch('official_bank.json',{cache:'no-cache'});if(!res.ok)throw Error('双语真题库文件缺失');rows=await res.json()}
 const ids=new Set(),good=[];
 for(const row of rows){if(!row.id||!row.image||!/^([ABCDE])$/.test(row.answer)||ids.has(row.id))continue;ids.add(row.id);good.push(archiveQuestion(row))}
 ARCHIVE_BANK=good;
 BANK=[...LEGACY_BANK,...REAL_BANK,...ARCHIVE_BANK];
 console.info('AMC8 双语PDF题库加载',ARCHIVE_BANK.length);
}
function refreshArchiveDaily(){
 const p=S.daily_plan;
 if(p?.date===today()&&p.submitted){alert('今日成绩已经提交，为保护记录不可重新组卷');return}
 if(!confirm('确定重新生成今日双语卷？原今日锁卷会被替换，但历史作答记录不会删除。'))return;
 delete S.daily_plan;saveStateLocal();renderAll();
}
function archivePaperPicker(){
 const years=[...new Set(ARCHIVE_BANK.map(q=>q.year))];
 const recent=new Set([...(S.printable_mock_ids||[]),...recentWeekendQuestionIds(4)]);
 let candidates=years.filter(y=>ARCHIVE_BANK.filter(q=>q.year===y).length===25&&!ARCHIVE_BANK.some(q=>q.year===y&&recent.has(q.id)));
 if(!candidates.length)candidates=years.filter(y=>ARCHIVE_BANK.filter(q=>q.year===y).length===25);
 if(!candidates.length)return null;
 const year=candidates[Math.floor(Math.random()*candidates.length)];
 return ARCHIVE_BANK.filter(q=>q.year===year).sort((a,b)=>a.problem_number-b.problem_number);
}
function buildArchiveMockCore(){
 if(!ARCHIVE_BANK.length)return false;
 const chosen=archivePaperPicker();
 if(!chosen){alert('双语真题库没有完整年份可组卷');return true}
 S.printable_mock_ids=chosen.map(q=>q.id); S.printable_mock_date=today();
 S.printable_mock_meta={engine:'official_bilingual_pdf_archive_v1',engine_version:ENGINE_VERSION,
  source_year:chosen[0].year,difficulty_by_position:[...EXAM_DIFFICULTY_BY_POSITION],
  constraints:{original_year_complete:true,answer_key_linked:true}};
 saveStateLocal(); renderAll();return true;
}
'''
replace('async function loadAuthenticBank(){',archive_code+'\nasync function loadAuthenticBank(){','题库载入')
replace('async function initV063(){await loadAuthenticBank();S=migrateState(S);',"async function initV063(){await loadAuthenticBank();try{await loadArchiveBank()}catch(e){console.error('双语真题库载入失败',e)}S=migrateState(S);",'启动流程')
replace('function questionPromptHtml(q){', '''function questionPromptHtml(q){
  if(q?.archive_image)return `<img class="archive-paper-img" src="${esc(q.archive_image)}" alt="${q.year} AMC8 Q${q.problem_number} 中英双语原题（包含选项和图形）">`;''','题干显示')
replace('function printChoices(q){return ',"function printChoices(q){if(q?.archive_image)return '';return ",'选项打印')
# Existing locked daily papers are unchanged until parent explicitly chooses regeneration.
replace('<button class=primary onclick=printDailyStudent()>打印今日3题学生卷</button>',
  '<button class=primary onclick=printDailyStudent()>打印今日3题学生卷</button><button onclick="refreshArchiveDaily()">重新生成今日双语卷</button>', '每日手动重选')

# Selected practice sheet uses only actual bilingual questions, without altering locked daily plan.
old='return REAL_BANK.filter(q=>q.problem_number>=13&&questionEligibleForDaily(q));'
replace(old,"return ARCHIVE_BANK.filter(q=>q.problem_number>=13&&questionEligibleForDaily(q));",'每日选题')
anchor='function buildPrintableMockCore(){'
if s.count(anchor)<1:raise RuntimeError('周末组卷函数缺失')
i=s.rfind(anchor)
s=s[:i]+s[i:].replace(anchor,"function buildPrintableMockCore(){\n  if(buildArchiveMockCore())return;\n  alert('请先检查双语真题库文件 official_bank.js 是否加载成功');return;",1)
# No empty three-line draft blocks. Save print height; enforce legibility with conditional page spill.
replace('''    <div class=work-lines><div class=work-line></div><div class=work-line></div><div class=work-line></div></div>
  </div>`).join('');''','''    <div class=work-lines><div class=work-line></div></div>
  </div>`).join('');''','每日草稿行')
css='''
/* archive_official_v1 - screenshot preserves diagrams and Chinese translations */
.archive-paper-img{width:100%;height:auto;display:block;max-width:780px;margin:5px 0}
@media print{
 @page{size:A4;margin:9mm}
 #printRoot .print-title{font-size:14pt;margin-bottom:2mm}
 #printRoot .print-sub{font-size:8.5pt;margin-bottom:2mm}
 #printRoot .print-meta{font-size:8.5pt;margin-bottom:2mm}
 #printRoot .print-q{margin-bottom:3mm;line-height:1.25;break-inside:avoid}
 #printRoot .print-q .en{font-weight:normal;line-height:1.25}
 #printRoot .archive-paper-img{max-width:100%;width:100%;max-height:none;margin:0 auto}
 #printRoot .work-lines{margin-top:1mm}
 #printRoot .work-line{height:3mm}
 #printRoot .print-footer{margin-top:2mm}
}
'''
replace('</style>',css+'</style>','打印 CSS')
# correct labeling: PDF graphics are copied verbatim, not translated by AI.
replace('<!-- BUILD: Lucas AMC8 Coach v0.6.3.3 / SYNC-CODE-FIX / 2026-10-21 -->','<!-- BUILD: Lucas AMC8 Coach v0.6.3.4 / archive_official_v1 -->','构建版本')
s=s.replace('<title>Lucas AMC8 Coach v0.6.3.3</title>','<title>Lucas AMC8 Coach v0.6.3.4</title>')
# Preserve exact HTML, JS keys, and cloud functions; verify file artifacts exist.
assert 'const SYNC_CODE_KEY' in s and 'amc8-sync' in s
assert (p.parent/'official_bank.js').exists() and (p.parent/'assets').exists(), 'official_bank.js/assets 文件缺失'
backup=p.with_name(p.name+'.v0633.backup')
backup.write_text(original,encoding='utf-8');p.write_text(s,encoding='utf-8')
print('SUCCESS',p,'backup:',backup,'archive count:',len(list((p.parent/'assets').glob('*.webp'))))
