/* Lucas AMC8 Coach: release round 2 additive integration, not an auto-deployer. */
(function(){'use strict';
const ID='amc8-release2-panel';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function diagnosticDue(state,now){
 const rows=(Array.isArray(state?.mock_history)?state.mock_history:[]).filter(x=>x&&(/真题诊断/.test(String(x.kind||''))||x.paper_type==='diagnostic'||x.kind==='diagnostic')&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||'')));
 const last=rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
 if(!last)return {due:true,last:null,reason:'尚无明确标记为真题诊断的记录；历史普通模拟不自动算作诊断'};
 const nowMs=Date.parse(now+'T00:00:00Z'),lastMs=Date.parse(last.date+'T00:00:00Z');
 if(!Number.isFinite(nowMs)||!Number.isFinite(lastMs))return {due:null,last:last.date,reason:'日期无法解析'};
 const elapsed=Math.floor((nowMs-lastMs)/86400000);
 return {due:elapsed>=28,last:last.date,days:elapsed,remaining:Math.max(0,28-elapsed),reason:elapsed>=28?'距上次真题诊断已满28天':'距离下次28天诊断尚有'+Math.max(0,28-elapsed)+'天'};
}
async function inspect(host){
 const state=host.state(),archive=host.archive();
 if(!Array.isArray(archive)||archive.length!==575)throw Error('双语真题库尚未加载完整（需要575题）');
 const response=await host.fetch('coach_skill_bank.json',{cache:'no-store'});
 if(!response.ok)throw Error('575题标签文件读取失败：'+response.status);
 if(!host.validator||typeof host.validator.validate!=='function')throw Error('题库审核器未加载');
 const check=host.validator.validate(await response.json(),archive);
 const existing=state.v064_specific_skills||{};
 return {check,existingTags:Object.keys(existing).length,missing:Object.keys(check.fine).filter(id=>!Object.prototype.hasOwnProperty.call(existing,id)).length,
  attempted:(state.attempts||[]).length,trueAttempted:(state.true_attempts||[]).length,
  diagnostic:diagnosticDue(state,host.today()),lock:state.printable_mock_ids?.length===25,lockDate:state.printable_mock_date||null};
}
function init(){if(document.getElementById(ID))return;
 const root=document.createElement('section');root.id=ID;
 root.innerHTML=`<style>#${ID}{max-width:980px;margin:18px auto;padding:16px;border:1px solid #bfcfdf;background:#fff;border-radius:12px;font:14px/1.65 system-ui;color:#23334c}#${ID} button{margin:4px;padding:7px 12px;border:0;border-radius:7px;background:#e4eefc;cursor:pointer}#${ID} .r2warn{color:#9a5800}#${ID} small{display:block;color:#677a90}</style><h3>知识点与四周诊断</h3><small>页面只读取现有成绩；只有手动点击“导入”才新增 PDF 解法核对标签（不代表独立数学验算）。不会重组已锁定试卷，也不会导入研发成绩。</small><p class="r2status" aria-live="polite">正在核对题库……</p><p class="r2notice" aria-live="polite"></p><button type="button" data-r2="check">刷新检查</button><button type="button" data-r2="import">导入PDF方法资料（不计能力分）</button><button type="button" data-r2="research">展开研发试卷</button><div class="r2diag"></div>`;
 (document.querySelector('main')||document.body).appendChild(root);
 const host={state:()=>S,archive:()=>ARCHIVE_BANK,fetch:(...args)=>fetch(...args),validator:window.LucasAMC8SkillImport,today:()=>today()};
 async function refresh(){try{const o=await inspect(host);root.querySelector('.r2status').innerHTML=`题库：575 道｜PDF 解法核对：${o.check.counts.methodReviewed}｜旧能力兼容：${o.check.counts.compatible}｜可新增细分标签：${o.missing}｜历史训练：${o.attempted+o.trueAttempted} 条（含可能重复记录）`;
 root.querySelector('.r2diag').innerHTML=`<p><b>四周真题诊断：</b>${esc(o.diagnostic.reason)}${o.diagnostic.last?'（上次：'+esc(o.diagnostic.last)+'）':''}</p><p class="r2warn">${o.lock?'已存在锁定试卷（'+esc(o.lockDate)+'），本模块不会覆盖。':'当前未发现25题锁定卷。'} 诊断需在原有周末页面选择“完整年份诊断”；此处只提示，不替你自动切换或重组。</p>`;
 return o;
 }catch(e){root.querySelector('.r2status').textContent='无法验证：'+e.message;return null;}}
 let importing=false;
 root.addEventListener('click',async e=>{const op=e.target.closest('[data-r2]')?.dataset.r2;if(!op)return;
 if(op==='check'){await refresh();return;}
 if(op==='research'){const p=document.getElementById('amc8-research-weekend-panel');if(p){p.scrollIntoView({behavior:'smooth'});return}root.querySelector('.r2status').textContent='研发试卷面板未启用；正式成绩不受影响。';return;}
 if(op==='import'){if(importing)return;importing=true;const button=root.querySelector('[data-r2="import"]');button.disabled=true;try{const o=await refresh();if(!o||!o.missing)return;
 if(!confirm(`将新增 ${o.missing} 条 PDF 方法资料（不会写入旧能力评分标签）。不会覆盖人工标签、锁卷或成绩。确定继续吗？`))return;
 try{const result=await window.lucasAMC8ImportReviewedTagsV3();if(!result.applied)throw Error(result.reason);
 // Only a deliberate user-triggered import writes state; cloud sync remains under host's existing controls.
 if(typeof saveStateLocal==='function'&&result.added)saveStateLocal();await refresh();root.querySelector('.r2notice').textContent=`已新增 ${result.added} 条细分方法资料（不计能力分），未覆盖人工审核标签。云端保存状态请以原有同步页面显示为准。`;}
 catch(err){root.querySelector('.r2notice').textContent='导入失败：'+err.message;}
 }finally{importing=false;button.disabled=false;}
 }});
 // Initial authentic-bank load is async. Retry a bounded number of times without mutating state.
 let retry=0;
 async function startup(){const result=await refresh();if(!result&&retry++<20)setTimeout(startup,500);}
 startup();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AMC8Release2={diagnosticDue,inspect};
})();
