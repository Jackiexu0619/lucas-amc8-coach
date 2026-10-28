#!/usr/bin/env node
// Offline audit of two JSONB rows exported by an authorized read-only query.
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, chmod, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fields = ['date', 'question_id', 'source', 'paper_id', 'paper_question_index',
  'selected_answer', 'correct', 'result_status', 'guessed', 'hint_level',
  'duration_sec', 'error_type', 'error_detail'];

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
const sha = value => createHash('sha256').update(value).digest('hex');
const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);
const optionalCount = (payload, key) => Object.hasOwn(payload, key) ? payload[key].length : null;
const present = (obj, key) => Object.hasOwn(obj, key) && obj[key] !== null && obj[key] !== '';

export function validateRecords(rows) {
  if (!Array.isArray(rows) || rows.length !== 2) throw Error('Expected exactly two complete archive rows');
  const hashes = new Set();
  for (const [i, row] of rows.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
      !/^[a-f0-9]{64}$/.test(row.sync_hash || '') || hashes.has(row.sync_hash) ||
      !Number.isSafeInteger(row.revision) || row.revision < 0 ||
      typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at)) ||
      typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at)) ||
      !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
      throw Error(`Invalid or incomplete archive row ${i + 1}`);
    }
    if (!Object.hasOwn(row.payload, 'attempts')) throw Error(`Missing attempts in archive row ${i + 1}`);
    if (!Array.isArray(row.payload.attempts)) throw Error(`Invalid attempts in archive row ${i + 1}`);
    for (const key of ['daily_sessions', 'mock_detail_history']) {
      if (Object.hasOwn(row.payload, key) && !Array.isArray(row.payload[key])) throw Error(`Invalid ${key} in archive row ${i + 1}`);
    }
    hashes.add(row.sync_hash);
  }
  return rows;
}

function compare(left, right) {
  const same = [], different = [], missing = [];
  for (const field of fields) {
    const a = present(left, field), b = present(right, field);
    if (!a || !b) {
      missing.push({field, side: !a && !b ? 'both' : !a ? 'archive_1' : 'archive_2'});
    } else if (canonical(left[field]) === canonical(right[field])) {
      same.push(field);
    } else {
      different.push({field, archive_1: left[field], archive_2: right[field]});
    }
  }
  return {same, different, missing};
}

export function buildDiff(rows) {
  validateRecords(rows);
  const [one, two] = rows.map(r => r.payload.attempts);
  const candidates = [];
  for (const [i, a] of one.entries()) for (const [j, b] of two.entries()) {
    if (!present(a, 'question_id') || a.question_id !== b.question_id) continue;
    const comparison = compare(a, b);
    const identity = ['date', 'paper_id', 'paper_question_index'].every(k =>
      present(a, k) && present(b, k) && canonical(a[k]) === canonical(b[k]));
    candidates.push({archive_1_attempt_index: i, archive_2_attempt_index: j,
      question_id: a.question_id,
      match_basis: identity ? 'same_question_date_paper_and_position' : 'same_question_only',
      consistent_fields: comparison.same, different_fields: comparison.different,
      missing_fields: comparison.missing,
      duplicate_decision: 'undetermined',
      reason_not_confirmed: identity
        ? 'Record identity matches, but correctness and all source fields still require human review.'
        : 'A question can be attempted more than once; differing dates or papers cannot prove duplicate submission.'});
  }
  return {schema_version: 1, archive_count: rows.length, candidate_count: candidates.length,
    candidates, policy: 'Preview only. No row is merged, deleted, or selected as authoritative.'};
}

function counts(row) {
  return {attempts: row.payload.attempts.length,
    daily_sessions: optionalCount(row.payload, 'daily_sessions'),
    mock_detail_history: optionalCount(row.payload, 'mock_detail_history')};
}

function secureDirectory(dir) {
  if (process.platform !== 'win32') return;
  const who = spawnSync('whoami', ['/user', '/fo', 'csv', '/nh'], {encoding: 'utf8'});
  const sid = who.stdout?.match(/S-1-5-[0-9-]+/)?.[0];
  if (who.status !== 0 || !sid) throw Error('Cannot determine Windows user SID for backup ACL');
  const acl = spawnSync('icacls', [dir, '/inheritance:r', '/grant:r',
    `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], {encoding: 'utf8'});
  if (acl.status !== 0) throw Error('Cannot secure backup directory ACL');
}

export async function exportAudit(rows, outRoot, now = new Date()) {
  validateRecords(rows);
  const root = path.resolve(outRoot);
  if (inside(repoRoot.toLowerCase(), root.toLowerCase())) throw Error('Backup root must be outside the Git workspace');
  await mkdir(root, {recursive: true, mode: 0o700});
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const dir = path.join(root, `${stamp}-${randomBytes(4).toString('hex')}`);
  await mkdir(dir, {mode: 0o700});
  await chmod(dir, 0o700);
  secureDirectory(dir);
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const snapshot = {schema_version: 2, exported_at: now.toISOString(), record_count: 2,
    serialization: 'UTF-8 canonical JSON: object keys sorted recursively, array order preserved, compact JSON, one trailing newline',
    records: ordered.map(row => ({...row, record_sha256: sha(canonical(row))}))};
  const snapshotText = canonical(snapshot) + '\n';
  const diff = buildDiff(ordered);
  const diffText = canonical(diff) + '\n';
  const manifest = {schema_version: 2, exported_at: snapshot.exported_at,
    snapshot_sha256: sha(snapshotText), diff_sha256: sha(diffText),
    record_sha256: snapshot.records.map(r => r.record_sha256),
    record_count: 2, counts: ordered.map(counts), candidate_count: diff.candidate_count};
  for (const [name, data] of [['snapshot.json', snapshotText],
    ['diff.json', diffText], ['manifest.json', canonical(manifest) + '\n']]) {
    await writeFile(path.join(dir, name), data, {encoding: 'utf8', flag: 'wx', mode: 0o600});
    await chmod(path.join(dir, name), 0o600);
  }
  return {dir, manifest};
}

export async function verifyAudit(dir) {
  const [snapshotText, diffText, manifestText] = await Promise.all([
    readFile(path.join(dir, 'snapshot.json'), 'utf8'),
    readFile(path.join(dir, 'diff.json'), 'utf8'),
    readFile(path.join(dir, 'manifest.json'), 'utf8')]);
  const snapshot = JSON.parse(snapshotText), manifest = JSON.parse(manifestText);
  if (sha(snapshotText) !== manifest.snapshot_sha256 ||
    snapshotText !== canonical(snapshot) + '\n') throw Error('Snapshot checksum or canonical serialization mismatch');
  if (sha(diffText) !== manifest.diff_sha256 ||
    diffText !== canonical(JSON.parse(diffText)) + '\n') throw Error('Difference report checksum mismatch');
  validateRecords(snapshot.records);
  if (snapshot.records.some((row, i) => {
    const {record_sha256, ...original} = row;
    return sha(canonical(original)) !== record_sha256 || record_sha256 !== manifest.record_sha256[i];
  })) throw Error('Archive row checksum mismatch');
  if (diffText !== canonical(buildDiff(snapshot.records)) + '\n') throw Error('Difference report does not match archive rows');
  if (manifest.schema_version < 2 && snapshot.records.some((row, i) =>
    ['daily_sessions', 'mock_detail_history'].some(key =>
      !Object.hasOwn(row.payload, key) && manifest.counts?.[i]?.[key] === 0))) {
    throw Error('Legacy manifest treats a missing field as zero; create a new snapshot without overwriting this one');
  }
  if (canonical(snapshot.records.map(counts)) !== canonical(manifest.counts)) throw Error('Manifest counts do not match archive rows');
  if ((await stat(path.join(dir, 'diff.json'))).size === 0) throw Error('Missing difference report');
  return manifest;
}

async function main(args) {
  const command = args[0];
  if (command === 'export' && args[1] === '--input' && args[3] === '--out-root' && args.length === 5) {
    const rows = JSON.parse(await readFile(args[2], 'utf8'));
    const result = await exportAudit(rows, args[4]);
    await verifyAudit(result.dir);
    console.log(JSON.stringify({status: 'BACKUP_VERIFIED', directory: result.dir,
      snapshot_sha256: result.manifest.snapshot_sha256, record_sha256: result.manifest.record_sha256,
      counts: result.manifest.counts, candidate_count: result.manifest.candidate_count}));
  } else if (command === 'verify' && args[1] && args.length === 2) {
    const manifest = await verifyAudit(args[1]);
    console.log(JSON.stringify({status: 'BACKUP_VERIFIED', snapshot_sha256: manifest.snapshot_sha256,
      record_sha256: manifest.record_sha256, counts: manifest.counts, candidate_count: manifest.candidate_count}));
  } else throw Error('Usage: export --input <authorized-read-only-export.json> --out-root <private-dir> | verify <snapshot-dir>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(err => {console.error(`BACKUP_FAILED: ${err.message}`); process.exitCode = 1;});
}
