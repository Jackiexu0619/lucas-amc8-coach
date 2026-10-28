const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');

async function run() {
  const {buildDiff, canonical, exportAudit, verifyAudit} = await import('./scripts/amc8_sync_state_audit.mjs');
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

  // Older payloads may omit these optional arrays. Null means absent; zero means present and empty.
  const optionalMissing=records.map((record,i)=>({
    ...record,payload:i===0
      ? {attempts:record.payload.attempts,mock_detail_history:[]}
      : {attempts:record.payload.attempts,daily_sessions:[]}
  }));
  const optionalExport=await exportAudit(optionalMissing,root,new Date('2026-10-28T00:00:00Z'));
  assert.deepEqual(optionalExport.manifest.counts,[
    {attempts:2,daily_sessions:null,mock_detail_history:0},
    {attempts:2,daily_sessions:0,mock_detail_history:null}]);
  assert.deepEqual(await verifyAudit(optionalExport.dir),optionalExport.manifest);
  assert.equal(optionalExport.manifest.schema_version,2);
  const legacy=path.join(temp,'legacy-ambiguous');
  fs.cpSync(optionalExport.dir,legacy,{recursive:true});
  const legacySnapshot=path.join(legacy,'snapshot.json');
  const legacySnapshotData=JSON.parse(fs.readFileSync(legacySnapshot,'utf8'));
  legacySnapshotData.schema_version=1;
  const legacySnapshotText=canonical(legacySnapshotData)+'\n';
  fs.writeFileSync(legacySnapshot,legacySnapshotText);
  const legacyManifest=path.join(legacy,'manifest.json');
  const legacyData=JSON.parse(fs.readFileSync(legacyManifest,'utf8'));
  legacyData.schema_version=1;
  legacyData.snapshot_sha256=createHash('sha256').update(legacySnapshotText).digest('hex');
  legacyData.counts[0].daily_sessions=0;
  legacyData.counts[1].mock_detail_history=0;
  fs.writeFileSync(legacyManifest,JSON.stringify(legacyData));
  const legacyCheck=spawnSync(process.execPath,[script,'verify',legacy],{encoding:'utf8'});
  assert.notEqual(legacyCheck.status,0);
  assert.match(legacyCheck.stderr,/Legacy manifest treats a missing field as zero/);
  assert(!legacyCheck.stdout.includes('BACKUP_VERIFIED'));
  assert.equal(fs.existsSync(path.join(first.dir,'snapshot.json')),true);

  const bad = path.join(temp,'bad.json');
  fs.writeFileSync(bad,JSON.stringify([records[0]]));
  const failed=spawnSync(process.execPath,[script,'export','--input',bad,'--out-root',root],{encoding:'utf8'});
  assert.notEqual(failed.status,0);
  assert.match(failed.stderr,/BACKUP_FAILED/);
  assert(!failed.stdout.includes('BACKUP_VERIFIED'));
  const absentAttempts=records.map((record,i)=>i===0?{
    ...record,payload:{daily_sessions:[],mock_detail_history:[]}
  }:record);
  fs.writeFileSync(bad,JSON.stringify(absentAttempts));
  const beforeFailedExport=fs.readdirSync(root).length;
  const missingAttempts=spawnSync(process.execPath,[script,'export','--input',bad,'--out-root',root],{encoding:'utf8'});
  assert.notEqual(missingAttempts.status,0);
  assert.match(missingAttempts.stderr,/BACKUP_FAILED: Missing attempts/);
  assert(!missingAttempts.stdout.includes('BACKUP_VERIFIED'));
  assert.equal(fs.readdirSync(root).length,beforeFailedExport,'invalid input must not create a snapshot');
  assert.equal(fs.existsSync(path.join(first.dir,'snapshot.json')),true,'old snapshot remains intact');
  await assert.rejects(Promise.resolve().then(()=>buildDiff(absentAttempts)),/Missing attempts/);
  await assert.rejects(exportAudit([{...records[0],payload:{attempts:{}}},records[1]],root),/Invalid attempts/);
  await assert.rejects(exportAudit([{...records[0],payload:{attempts:[],daily_sessions:null}},records[1]],root),/Invalid daily_sessions/);
  await assert.rejects(exportAudit([{...records[0],payload:{attempts:[],mock_detail_history:{}}},records[1]],root),/Invalid mock_detail_history/);

  const snap=path.join(first.dir,'snapshot.json');
  const original=fs.readFileSync(snap,'utf8');
  fs.writeFileSync(snap,original.replace('D-26','D-XX'));
  await assert.rejects(verifyAudit(first.dir),/checksum/);
  fs.writeFileSync(snap,original);
  const difference=path.join(first.dir,'diff.json'), originalDiff=fs.readFileSync(difference,'utf8');
  fs.writeFileSync(difference,originalDiff.replace('same_question_only','tampered_question'));
  await assert.rejects(verifyAudit(first.dir),/Difference report checksum/);
  fs.writeFileSync(difference,originalDiff);

  let tamperNumber=0;
  function checkManifestTamper(change, expected) {
    const dir=path.join(temp,`tampered-manifest-${++tamperNumber}`);
    fs.cpSync(first.dir,dir,{recursive:true});
    const target=path.join(dir,'manifest.json');
    const data=JSON.parse(fs.readFileSync(target,'utf8'));
    change(data,dir);
    fs.writeFileSync(target,JSON.stringify(data));
    const result=spawnSync(process.execPath,[script,'verify',dir],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,expected);
    assert(!result.stdout.includes('BACKUP_VERIFIED'));
  }
  checkManifestTamper(data=>{data.candidate_count++},/Manifest candidate count/);
  checkManifestTamper(data=>{data.record_count++},/Manifest record count/);
  checkManifestTamper(data=>{data.schema_version=1},/Manifest schema version/);
  checkManifestTamper(data=>{data.exported_at='2020-01-01T00:00:00Z'},/Manifest export time/);
  checkManifestTamper(data=>{data.record_sha256.pop()},/Manifest record checksum count/);
  checkManifestTamper(data=>{data.record_sha256='not-a-list'},/Manifest record checksum count/);
  checkManifestTamper((data,dir)=>{
    data.schema_version=99;
    const snapPath=path.join(dir,'snapshot.json');
    const snapData=JSON.parse(fs.readFileSync(snapPath,'utf8'));
    snapData.schema_version=99;
    fs.writeFileSync(snapPath,canonical(snapData)+'\n');
  },/Unsupported snapshot or manifest schema version/);
  assert.deepEqual(await verifyAudit(first.dir),first.manifest,'tampering copies must not alter the original snapshot');
  console.log('PASS: required attempts, optional field missing vs empty, manifest metadata checks, legacy rejection, checksums, no overwrite, no network, malformed input');
  console.log('Synthetic test directory:',temp);
}
run().catch(e=>{console.error(e);process.exitCode=1});
