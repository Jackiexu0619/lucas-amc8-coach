/* v0.6.4 offline staging: preserves specific skills without fabricating legacy mastery */
(function(root){'use strict';
const LEGACY=new Set(['因数与倍数','余数与整除','质因数分解与因数个数','排列与空位法','分类计数与容斥','递推与路径','概率与补集','面积与面积比','相似三角形','坐标变换','比例与行程','代数方程','数列与周期','数据与平均数','逻辑推理','其他']);
const EXACT={
'年龄差与年龄关系':'代数方程','小数与取整':null,'整数运算与最值':null,
'单价乘法':'代数方程','分数比较':null,'加权平均':'数据与平均数',
'总量与差量':'代数方程','通分计算时间':null,'总量分拆':'代数方程',
'分情况计数':'分类计数与容斥','奇偶次幂符号':'余数与整除',
'近似计算与取整':null,'评分约束':'代数方程','连乘消去':null,
'数位构造':'余数与整除','质数结构':'质因数分解与因数个数',
'极值不等式':'代数方程','数位乘法':'余数与整除',
'数位最值':null,'单位贡献':'分类计数与容斥',
'数论·数位与回环数':'余数与整除','数论·分式连乘':null,
'数论·整数约束':'代数方程'
};
function legacy(q){
 const raw=q.reviewed_skill||'';
 if(Object.prototype.hasOwnProperty.call(EXACT,raw))return EXACT[raw];
 const t=[raw,q.source_topic,q.reviewed_method].filter(Boolean).join(' ');
 if(/概率|随机|补集/.test(t))return '概率与补集';
 if(/空位法|插空法|排列|排队|字母排列/.test(t))return '排列与空位法';
 if(/容斥|集合|分类计数|排列组合|乘法原理|鸽巢|选取|组合数/.test(t))return '分类计数与容斥';
 if(/因数个数|约数个数|质因数/.test(t))return '质因数分解与因数个数';
 if(/递推|路径数|台阶/.test(t))return '递推与路径';
 if(/余数|模运算|整除|最小公倍数/.test(t))return '余数与整除';
 if(/周期|数列|等差|斐波那契/.test(t))return '数列与周期';
 if(/坐标|旋转|轴对称|平移/.test(t))return '坐标变换';
 if(/相似三角形|相似比/.test(t))return '相似三角形';
 if(/面积|勾股|几何|周长|角度|正方形|圆|立体/.test(t))return '面积与面积比';
 if(/行程|速度|比例|百分比|百分数/.test(t))return '比例与行程';
 if(/平均数|中位数|统计|数据/.test(t))return '数据与平均数';
 if(/方程|设元|代数/.test(t))return '代数方程';
 if(/因数|除法|倍数/.test(t))return '因数与倍数';
 if(/逻辑|推理|排除/.test(t))return '逻辑推理';
 return null;
}
function validate(bank,archive){
 if(!Array.isArray(bank?.questions)||bank.questions.length!==575)throw Error('575 source records required');
 if(!Array.isArray(archive)||archive.length!==575)throw Error('575 archive records required');
 const byId=new Map(archive.map(q=>[q.id,q])); if(byId.size!==575)throw Error('duplicate archive id');
 const seen=new Set(),staged={},fine={},pending=[];
 for(const q of bank.questions){
  if(!q||!/^archive_\d{4}_\d{2}$/.test(q.id)||seen.has(q.id)||!byId.has(q.id))throw Error('invalid id: '+q?.id);
  seen.add(q.id);
  const a=byId.get(q.id);
  const year=+(q.id.match(/^archive_(\d{4})_/)[1]),number=+(q.id.slice(-2));
  if(Number(a.year)!==year||Number(a.problem_number??a.number)!==number)throw Error('year/number mismatch: '+q.id);
  if(q.quality_gate!=='pdf_explanation_reviewed'){pending.push(q.id);continue;}
  if(typeof q.reviewed_skill!=='string'||!q.reviewed_skill.trim()||typeof q.reviewed_method!=='string'||!q.reviewed_method.trim()||!Number.isInteger(+q.source_page)||+q.source_page<1||+q.source_page>231)throw Error('invalid review evidence: '+q.id);
  const compat=legacy(q);
  fine[q.id]={skill:q.reviewed_skill,method:q.reviewed_method,group_key:q.group_key||q.reviewed_skill,pdf_page:+q.source_page,status:'pdf_explanation_reviewed',independent_math_verified:false,legacy_skill:compat};
  // Do not add unsafe "其他" evidence to the legacy mastery aggregator.
  if(compat&&LEGACY.has(compat))staged[q.id]={skill:compat,status:'pdf_method_reviewed',source_skill:q.reviewed_skill,method:q.reviewed_method,pdf_page:+q.source_page,review_method:'pdf_explanation_only',independent_math_verified:false};
 }
 return {staged,fine,pending,counts:{total:seen.size,methodReviewed:Object.keys(fine).length,compatible:Object.keys(staged).length,unmapped:Object.keys(fine).length-Object.keys(staged).length,pending:pending.length}};
}
function mergePreservingParent(existing,staged){const out={...(existing||{})};let added=0,enriched=0;for(const [id,x] of Object.entries(staged)){if(!Object.prototype.hasOwnProperty.call(out,id)){out[id]=x;added++;continue;}const old=out[id];if(old&&old.status==='pdf_explanation_reviewed'&&!old.group_key&&x.group_key){out[id]={...old,group_key:x.group_key,method:old.method||x.method,pdf_page:old.pdf_page||x.pdf_page};enriched++;}}return {tags:out,added,enriched};}
async function importBank(){
 if(typeof S==='undefined'||typeof ARCHIVE_BANK==='undefined'||ARCHIVE_BANK.length!==575)return {applied:false,reason:'archive-not-ready'};
 const response=await fetch('coach_skill_bank.json',{cache:'no-store'});if(!response.ok)throw Error('bank fetch '+response.status);
 const checked=validate(await response.json(),ARCHIVE_BANK);
 const result=mergePreservingParent(S.v064_specific_skills,checked.fine);
 // Preserve the legacy reviewed tag map entirely: v0.6.4.x treats reviewed as mastery evidence.
 // PDF explanation review is not a parent-confirmed or independently verified tag.
 S.v064_specific_skills=result.tags;
 S.v064_skills_import_meta={schema:'pdf-reviewed-v4-safe',...checked.counts,added:result.added,enriched:result.enriched||0};
 if(typeof saveStateLocal==='function'&&(result.added||(result.enriched||0)>0))saveStateLocal(true);
 return {applied:true,...S.v064_skills_import_meta};
}
if(typeof module!=='undefined'&&module.exports)module.exports={legacy,validate,mergePreservingParent};
if(root){root.lucasAMC8ImportReviewedTagsV3=importBank;root.LucasAMC8SkillImport={legacy,validate,mergePreservingParent};}
})(typeof window==='undefined'?null:window);
