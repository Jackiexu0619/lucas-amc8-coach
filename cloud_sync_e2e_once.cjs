'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomBytes, createHash } = require('node:crypto');

const config = fs.readFileSync('cloud_config.js', 'utf8');
const url = config.match(/\burl:\s*"([^"]+)"/)?.[1]?.replace(/\/+$/, '');
const key = config.match(/\bpublishableKey:\s*"([^"]+)"/)?.[1];
assert.ok(url && key, 'public Supabase browser config must be present');

const endpoint = url + '/functions/v1/amc8-sync';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = Array.from(randomBytes(40), b => alphabet[b % alphabet.length]).join('');
const syncHash = createHash('sha256').update(code).digest('hex');

// Print only the database key needed for post-test cleanup, never the sync code.
console.log('SYNC_HASH_FOR_CLEANUP=' + syncHash);

async function request(action, extra = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, sync_code: code, ...extra })
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { status: response.status, body };
}

(async () => {
  const ping = await request('ping');
  assert.equal(ping.status, 200, 'edge function ping should return HTTP 200');
  assert.equal(ping.body.ok, true, 'edge function ping should return ok=true');

  const payload1 = {
    qa_marker: 'AMC8_SYNC_ROUNDTRIP_TEST_ONLY',
    schema_version: 1,
    nested: { score: 3, attempts: [{ question: 'Q17', result: 'test-only' }] }
  };
  const push1 = await request('push', { payload: payload1, base_revision: 0, force: false });
  assert.equal(push1.status, 200, 'first upload should succeed');
  assert.equal(push1.body.ok, true);
  assert.equal(Number(push1.body.revision), 1, 'first upload should create revision 1');

  const pull1 = await request('pull');
  assert.equal(pull1.status, 200, 'download after first upload should succeed');
  assert.equal(pull1.body.exists, true);
  assert.equal(Number(pull1.body.revision), 1);
  assert.deepStrictEqual(pull1.body.payload, payload1, 'downloaded JSON must equal uploaded JSON');

  const conflict = await request('push', {
    payload: { qa_marker: 'MUST_NOT_OVERWRITE' },
    base_revision: 0,
    force: false
  });
  assert.equal(conflict.status, 409, 'stale revision must be rejected');
  assert.equal(conflict.body.error, 'revision_conflict');

  const pullAfterConflict = await request('pull');
  assert.equal(Number(pullAfterConflict.body.revision), 1, 'conflict must not advance revision');
  assert.deepStrictEqual(pullAfterConflict.body.payload, payload1, 'conflict must not overwrite cloud data');

  const payload2 = {
    qa_marker: 'AMC8_SYNC_ROUNDTRIP_TEST_ONLY',
    schema_version: 2,
    nested: { score: 4, attempts: [{ question: 'Q17', result: 'updated-test-only' }] }
  };
  const push2 = await request('push', { payload: payload2, base_revision: 1, force: false });
  assert.equal(push2.status, 200, 'upload using the current revision should succeed');
  assert.equal(Number(push2.body.revision), 2, 'second upload should advance to revision 2');

  const pull2 = await request('pull');
  assert.equal(pull2.status, 200);
  assert.equal(Number(pull2.body.revision), 2);
  assert.deepStrictEqual(pull2.body.payload, payload2, 'second downloaded JSON must equal the updated payload');

  console.log('PASS: live Supabase Edge Function ping, upload, download, exact JSON round-trip, stale-revision conflict protection, update, and second download.');
})().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
