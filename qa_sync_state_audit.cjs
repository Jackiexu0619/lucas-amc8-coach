const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

async function run() {
  const {buildDiff, exportAudit, verifyAudit} = await import('./scripts/amc8_sync_state_audit.mjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'amc8-audit-'));
  const root = path.join(temp, 'private');
  const script = path.join(__dirname, 'scripts', 'amc8_sync_state_audit.mjs');
  const q = 'archive_2002_20';
  const base = {question_id:q, source:'paper_daily', paper_question_index:1,
    correct:false, result_status:'unable', guessed:false, hint_level:0, duration_sec:null};
  const row = (n, revision, attempts, daily, mocks) => ({
    sync_hash:n.repeat(64), revision, created_at:`2026-10-${n==='a'?'21':'27'}T10:00:00Z`,
    updated_at:'2026-10-27T11:00:00Z',
    payload:{attempts, daily_sessions:daily, mock_detail_history:mocks}});
  const records = [
    row('a',49,[{...base,date:'2026-10-26',paper_id:'D-26'},
      {...base,question_id:'archive_2000_16',date:'2026-10-26',paper_id:'D-26',selected_answer:'C',correct:true,result_status:'correct'}],
      [{paper_id:'D-26'}], [{paper_id:'M-1'}]),
    row('b',1,[{...base,date:'2026-10-27',paper_id:'D-27'},
      {...base,question_id:'archive_2000_16',date:'2026-10-27',paper_id:'D-27',selected_answer:'B',correct:false,result_status:'wrong'}],
      [{paper_id:'D-27'}], [])
  ];
  const diff = buildDiff(records);
  assert.equal(diff.candidate_count,2);
  const missing = diff.candidates.find(x=>x.question_id===q);
  assert.equal(missing.match_basis,'same_question_only');
  assert.equal(missing.duplicate_decision,'undetermined');
  assert(missing.missing_fields.some(x=>x.field==='selected_answer'&&x.side==='both'));
  assert(!missing.consistent_fields.includes('selected_answer'));
  const changed = diff.candidates.find(x=>x.question_id==='archive_2000_16');
  assert(changed.different_fields.some(x=>x.field==='selected_answer'));
  assert(changed.different_fields.some(x=>x.field==='result_status'));
  const sameIdentity=buildDiff([records[0],{
    ...records[1], payload:{...records[1].payload,attempts:[
      {...records[0].payload.attempts[0]}]}
  }]).candidates[0];
  assert.equal(sameIdentity.match_basis,'same_question_date_paper_and_position');
  assert.equal(sameIdentity.duplicate_decision,'undetermined');

  // A forbidden fetch would fail if the offline tool unexpectedly gained a network path.
  global.fetch=()=>{throw Error('unexpected production request')};
  const first=await exportAudit(records,root,new Date('2026-10-28T00:00:00Z'));
  assert.deepEqual(first.manifest.counts,[
    {attempts:2,daily_sessions:1,mock_detail_history:1},
    {attempts:2,daily_sessions:1,mock_detail_history:0}]);
  assert.deepEqual(await verifyAudit(first.dir),first.manifest);
  const second=await exportAudit(records,root,new Date('2026-10-28T00:00:00Z'));
  assert.notEqual(first.dir,second.dir,'old snapshot must not be overwritten');
  assert.equal(fs.existsSync(path.join(first.dir,'snapshot.json')),true);
  await assert.rejects(exportAudit(records,__dirname),/outside the Git workspace/);

  const bad = path.join(temp,'bad.json');
  fs.writeFileSync(bad,JSON.stringify([records[0]]));
  const failed=spawnSync(process.execPath,[script,'export','--input',bad,'--out-root',root],{encoding:'utf8'});
  assert.notEqual(failed.status,0);
  assert.match(failed.stderr,/BACKUP_FAILED/);
  assert(!failed.stdout.includes('BACKUP_VERIFIED'));
  await assert.rejects(exportAudit([{...records[0],payload:{attempts:{}}},records[1]],root),/Invalid attempts/);

  const snap=path.join(first.dir,'snapshot.json');
  const original=fs.readFileSync(snap,'utf8');
  fs.writeFileSync(snap,original.replace('D-26','D-XX'));
  await assert.rejects(verifyAudit(first.dir),/checksum/);
  fs.writeFileSync(snap,original);
  const difference=path.join(first.dir,'diff.json'), originalDiff=fs.readFileSync(difference,'utf8');
  fs.writeFileSync(difference,originalDiff.replace('same_question_only','tampered_question'));
  await assert.rejects(verifyAudit(first.dir),/Difference report checksum/);
  fs.writeFileSync(difference,originalDiff);
  console.log('PASS: two revisions, counts, cross-day/paper ambiguity, both missing, answer/result difference, checksums, no overwrite, no network, malformed input');
  console.log('Synthetic test directory:',temp);
}
run().catch(e=>{console.error(e);process.exitCode=1});
