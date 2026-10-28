# AMC8 sync-state read-only audit

`amc8_sync_state_audit.mjs` has no database or network client. It accepts a JSON
array of **exactly two complete** rows obtained through an authorized read-only
query against `public.amc8_sync_state`:

```sql
BEGIN READ ONLY;
SELECT sync_hash, payload, revision, created_at, updated_at
FROM public.amc8_sync_state ORDER BY created_at;
COMMIT;
```

The export must preserve the original `sync_hash` and complete JSONB `payload`.
`payload.attempts` is required and must be an array; missing or malformed data
fails before any backup directory is created. Older payloads may omit
`daily_sessions` or `mock_detail_history`; their manifest counts are `null`
(field missing), while an existing empty array has count `0`. A present value
of another type is rejected. No missing field is inserted into the snapshot.
Version 2 manifests use this missing-versus-empty distinction. A version 1
snapshot with an ambiguous zero count is retained unchanged but fails current
verification; export a new timestamped snapshot from the authorized source.
Never use a browser sync action, write RPC, or production data in CI. Place the
query result in a protected local JSON file outside the Git workspace; do not
paste it into an issue, PR, command argument, or log.

```powershell
node scripts/amc8_sync_state_audit.mjs export --input D:\CodexData\private-backups\AMC8\authorized-export.json --out-root D:\CodexData\private-backups\AMC8
node scripts/amc8_sync_state_audit.mjs verify D:\CodexData\private-backups\AMC8\<timestamp-directory>
node qa_sync_state_audit.cjs
```

The tool creates a new timestamped directory, with `snapshot.json` (complete
rows), `diff.json` (all cross-archive same-question candidates, no automatic
deduplication), and `manifest.json` (SHA-256 checksums for both files and counts). On Windows,
it restricts the new directory ACL to the current user and SYSTEM before
writing. Confirm protection of the input file separately. No real records go
into the repository.

Checksums use UTF-8 compact JSON with object keys sorted recursively and
array order preserved. `record_sha256` hashes each original row; the snapshot
file hash includes a single trailing newline and is stored in `manifest.json`.
Verification also matches the manifest's candidate and record counts, schema
version, export time, and per-record checksum list to the snapshot and diff.
This preserves all JSONB values and metadata, though PostgreSQL's original
JSONB text formatting is not recoverable.

This tool cannot restore data to Supabase. A later, separately reviewed recovery
must use the saved original rows, identify the intended `sync_hash`, compare the
current revision with the snapshot revision, and stop on a conflict. The
snapshot and difference preview do not decide which archive or attempt wins.
