'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=__dirname;
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.css':'text/css'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent((req.url||'/').split('?')[0]);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
  });
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const dialogs=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575,null,{timeout:60000});
    const answers=await page.evaluate(()=>{
      const questions=ARCHIVE_BANK.filter(q=>q.year===2000&&q.problem_number>=13).slice(0,3);
      S.attempts=[];S.daily_sessions=[];
      S.daily_plan={date:today(),question_ids:questions.map(q=>q.id),
        paper_id:dailyPaperIdFromIds(questions.map(q=>q.id)),submitted:false};
      renderPractice();show('practice');
      return questions.map(q=>q.answer);
    });
    assert.equal(await page.locator('[id^="daily_hint_"]').count(),3,'each daily question needs explicit hint evidence');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,
      'the new hint controls must not create mobile horizontal overflow');
    for(let i=0;i<3;i++){
      await page.locator('#daily_ans_'+i).selectOption(answers[i]);
      await page.locator('#daily_sec_'+i).fill('90');
    }
    await page.locator('#daily_hint_0').selectOption('1');
    await page.locator('#daily_hint_1').selectOption('2');
    await page.getByRole('button',{name:'提交这3题的成绩'}).click();
    assert.ok(dialogs.some(x=>x.includes('提示')),'missing hint selection must block submission');
    assert.equal(await page.evaluate(()=>S.attempts.length),0,'validation must not write partial attempts');
    await page.locator('#daily_hint_2').selectOption('0');
    await page.getByRole('button',{name:'提交这3题的成绩'}).click();
    await page.waitForFunction(()=>S.daily_plan?.submitted===true);
    const result=await page.evaluate(()=>{
      const ids=S.daily_plan.question_ids;
      return {rows:S.attempts.filter(a=>ids.includes(a.question_id)).map(a=>({
        question_id:a.question_id,correct:a.correct,guessed:a.guessed,hint_level:a.hint_level,
        independent:a.independent,source:a.source})),
        sessions:S.daily_sessions.length,submitted:S.daily_plan.submitted,
        mockHistoryCount:S.mock_history.length,mockDetailCount:(S.mock_detail_history||[]).length};
    });
    assert.deepEqual(result.rows.map(x=>x.hint_level),[1,2,0]);
    assert.deepEqual(result.rows.map(x=>x.independent),[false,false,true]);
    assert.ok(result.rows.every(x=>x.correct&&x.source==='paper_daily'));
    assert.equal(result.sessions,1);
    assert.equal(result.submitted,true);
    assert.equal(result.mockDetailCount,0,'weekend mock results are untouched');
    assert.match(await page.locator('#report').innerText(),/独立正确 1\/3/,
      'the learning report must count only the unassisted answer as independent');
    const historical=await page.evaluate(()=>{
      const q=qById(S.daily_plan.question_ids[0]);
      const key=skillKey(q),mastery={};
      for(const hint of [1,2,undefined,null,'0',-1,3,99]){
        S.skill_state[key]={mastery:.5};
        const attempt={correct:true,guessed:false};
        if(hint!==undefined)attempt.hint_level=hint;
        updateSkill(q,attempt);
        mastery[String(hint)]=S.skill_state[key].mastery;
      }
      const labels=[];
      for(const hints of [[1,2,3],[99,null,'0']]){
        S.attempts=S.daily_plan.question_ids.map((id,i)=>({question_id:id,date:today(),
          source:'paper_daily',correct:true,guessed:false,hint_level:hints[i]}));
        S.daily_sessions=[{date:today(),source:'paper_daily',paper_id:'isolated-history',
          question_ids:S.daily_plan.question_ids,question_count:3,correct:3}];
        const before=JSON.stringify(S.attempts);
        document.getElementById('dailyReviewHistory')?.remove();
        renderDailyReviewIntoReport();
        labels.push({statuses:[...document.querySelectorAll('#dailyReviewHistory strong')].map(x=>x.textContent),
          text:document.getElementById('dailyReviewHistory').textContent,
          attemptsUnchanged:JSON.stringify(S.attempts)===before});
      }
      return {mastery,labels};
    });
    assert.equal(historical.mastery['1'],.54);
    assert.equal(historical.mastery['2'],.54);
    for(const hint of ['undefined','null','0','-1','3','99']){
      assert.equal(historical.mastery[hint],.5,'invalid hint must not increase mastery: '+hint);
    }
    assert.deepEqual(historical.labels[0].statuses,['提示后答对','提示后答对','正确（独立性待核对）']);
    assert.deepEqual(historical.labels[1].statuses,[
      '正确（独立性待核对）','正确（独立性待核对）','正确（独立性待核对）']);
    assert.ok(historical.labels.every(x=>x.attemptsUnchanged));
    assert.doesNotMatch(historical.labels[0].text,/提示级别 3/);
    assert.doesNotMatch(historical.labels[1].text,/提示级别 99/);
    assert.deepEqual(errors,[]);
    console.log('PASS: isolated browser blocks partial submission, saves hint levels 1/2/0, and counts only one independent answer without changing weekend mock results.');
  }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1});
