/* AI transfer staging bank independent QA. Run: node qa_ai_transfer_bank.cjs */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const bank=JSON.parse(fs.readFileSync('ai_transfer_bank_staging_v1.json','utf8'));
const f=n=>Array.from({length:n},(_,i)=>i+1).reduce((a,b)=>a*b,1);
const c=(n,k)=>Math.round(f(n)/(f(k)*f(n-k)));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const stair=n=>{let memo=new Map();const rec=(rem,prev2)=>rem===0?1:rem<0?0:memo.has(rem+':'+prev2)?memo.get(rem+':'+prev2):(()=>{let x=rec(rem-1,false)+(prev2?0:rec(rem-2,true));memo.set(rem+':'+prev2,x);return x})();return rec(n,false)};
function solve(q){
 const p=q.parameters;
 switch(q.method_group){
 case 'prime_factor_divisors': {let count=0;for(let i=1;i<=p.n;i++)if(p.n%i===0)count++;return count}
 case 'nonadjacent_distinct':return f(p.n)-2*f(p.n-1);
 case 'two_people_one_between':return 2*(p.n-2)*f(p.n-2);
 case 'stair_no_consecutive_two':return stair(p.steps);
 case 'probability_complement':return c(p.n,3)-c(p.n-2,3);
 case 'rotation_90_coordinates':return Math.abs(-p.y)+Math.abs(p.x);
 case 'union_multiples': {let count=0;for(let j=1;j<=p.n;j++)if(j%p.a===0||j%p.b===0)count++;return count}
 case 'rectangle_area_subtraction': {let total=0;for(let x=0;x<p.w;x++)for(let y=0;y<p.h;y++)if(!(x>=p.w-p.cutW&&y>=p.h-p.cutH))total++;return total}
 case 'arithmetic_sequence_sum': return Array.from({length:p.n},(_,i)=>p.a+i*p.d).reduce((a,b)=>a+b,0);
 case 'median_sorted_odd':return [...p.arr].sort((a,b)=>a-b)[Math.floor(p.arr.length/2)];
 default:throw Error('Unknown method: '+q.method_group);
 }
}
assert.equal(bank.deployment_gate,'STAGED_NOT_LIVE');
assert.equal(bank.questions.length,60);
assert.equal(new Set(bank.questions.map(q=>q.id)).size,60);
assert.equal(new Set(bank.questions.map(q=>q.question)).size,60);
for(const q of bank.questions){
 assert.equal(q.status,'staged_not_live');
 assert.equal(q.counts_for_exam_diagnostic,false);
 assert.equal(q.options.length,5);
 assert.equal(new Set(q.options).size,5);
 const expected=solve(q);
 assert.equal(expected,q.numeric_answer,q.id+' solver mismatch');
 assert.equal(q.options['ABCDE'.indexOf(q.answer)],String(expected),q.id+' answer option mismatch');
 assert.ok(q.solution.length>20,q.id+' missing solution');
}
console.log('PASS: 60 unique staged questions; independently recomputed numeric answers; 5 distinct options; explanations; official exam isolation.');
