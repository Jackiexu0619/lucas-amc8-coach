/* Group the existing report panels without changing their data or renderers. */
(function(){
'use strict';
let selected='daily';
const categories=[['overview','学习总览'],['daily','每日专项'],['mock','周末模拟'],['review','复测计划']];
function mountSections(){
  const host=document.getElementById('report');if(!host)return;
  const existing=[...host.children];
  const nav=document.createElement('nav');nav.id='reportCategoryNav';nav.setAttribute('aria-label','学习报告分类');
  nav.setAttribute('role','tablist');
  const panels=new Map();
  for(const [key,label] of categories){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.id='reportTab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls','reportCategory-'+key);
    button.onclick=()=>activate(key);
    button.onkeydown=event=>{
      const index=categories.findIndex(([name])=>name===key);
      const next=event.key==='ArrowRight'?index+1:event.key==='ArrowLeft'?index-1:
        event.key==='Home'?0:event.key==='End'?categories.length-1:null;
      if(next===null)return;
      event.preventDefault();
      const target=categories[(next+categories.length)%categories.length][0];
      activate(target);document.getElementById('reportTab-'+target)?.focus();
    };
    nav.appendChild(button);
    const panel=document.createElement('section');panel.id='reportCategory-'+key;
    panel.className='report-category';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
    panels.set(key,panel);
  }
  host.replaceChildren(nav,...panels.values());
  for(const node of existing){
    const key=node.id==='latestMockLearningReport'||node.id==='mockAiExplain'?'mock':node.id==='dailyReviewHistory'?'daily':
      node.id==='officialReviewQueueReport'||node.id==='aiTransferQueueReport'?'review':'overview';
    panels.get(key).appendChild(node);
  }
  activate(selected);
}
function activate(key){
  if(!categories.some(([name])=>name===key))return;
  selected=key;
  const host=document.getElementById('report');if(!host)return;
  for(const [name] of categories){
    const button=host.querySelector('#reportTab-'+name),panel=host.querySelector('#reportCategory-'+name);
    if(!button||!panel)continue;
    button.setAttribute('aria-selected',String(name===key));button.tabIndex=name===key?0:-1;
    panel.hidden=name!==key;
  }
}
if(typeof renderReport==='function'){
  const previous=renderReport;
  renderReport=function(){const result=previous.apply(this,arguments);mountSections();return result;};
}
window.LucasAMC8ReportSections={activate};
})();
