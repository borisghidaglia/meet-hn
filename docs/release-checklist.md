# Release checklist: Next.js 16 + speed work + sign-up resolve + city migration

All four ship together, from branch `city-nearby`. Order matters: **deploy the
code first, then migrate the data.** The new code serves both the old and the
migrated data. The old code can't serve the migrated data, because it doesn't
know about `REDIRECT` items, so old links would 404.

Run every command from the repo root on the machine that holds the local
pipeline files. These files are gitignored: `cityNominatimCache.jsonl`,
`cityVerification.json` and `citySnapshot.json`. Without them the dry run
refetches about 3,800 Nominatim responses at 1 request per second.

```bash
T=CityUserTable-prod-2024-09-21-1-restored-2024-10-8   # the live table (.env.local points to an analysis copy)
STAMP=$(date -u +%Y-%m-%dT%H-%M)
```

AWS credentials for the live table (us-east-1) must be in the shell.
`DYNAMODB_ENDPOINT` must be unset (the commands below use `env -u`).

## 1. Before

- [ ] Local checks pass: `npx tsc --noEmit`, `npm run test-unit -- run` (94
      tests), `npx eslint .` (0 errors). Then run Playwright against a local
      build: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> npx playwright test --project=chromium`.
- [ ] Vercel project: Node.js 20.9 or later (Next 16 requirement).
- [ ] Fresh on-demand backup, then wait for `AVAILABLE`:
  ```bash
  aws dynamodb create-backup --region us-east-1 --table-name "$T" --backup-name "pre-city-migration-$STAMP"
  aws dynamodb list-backups --region us-east-1 --table-name "$T" \
    --query 'BackupSummaries[-1].[BackupName,BackupStatus,BackupArn]'
  aws dynamodb describe-continuous-backups --region us-east-1 --table-name "$T" \
    --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus'
  # optional, if PITR is DISABLED:
  aws dynamodb update-continuous-backups --region us-east-1 --table-name "$T" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
  ```
- [ ] Pick a quiet hour. There is no sign-up freeze switch, and none is needed:
      the apply works from a fresh scan and uses conditional writes. A sign-up
      that lands mid-apply is picked up on a re-run.

## 2. Deploy

- [ ] Note the current production deployment in the Vercel dashboard. It is the
      instant-rollback target.
- [ ] Merge and push:
  ```bash
  git checkout main && git merge --ff-only city-nearby && git push origin main
  ```
- [ ] Wait for the production deployment to go green. Run `scripts/smokeCheck.sh`.
      Before the migration the old ids still serve pages and R175905 is a 404.
      That is expected.

## 3. Migrate

- [ ] Dry run (read-only; it refuses any write):
  ```bash
  env -u DYNAMODB_ENDPOINT npm run script scripts/migrateCityIdentity.ts -- --table="$T"
  ```
  Compare with the 2026-11-12 dry run: 1,021 CITY puts, 2,177 user moves,
  1,542 REDIRECTs (506 HN-bio), 1,036 deletes, 13 proven merges, 0 human
  merges, "invariants: all hold". Only new sign-ups should move these numbers.
  Stop if anything else changed.
- [ ] Apply. Do not pass `--include-human-merges`:
  ```bash
  env -u DYNAMODB_ENDPOINT npm run script scripts/migrateCityIdentity.ts -- --table="$T" --apply --confirm="$T"
  ```
  Note the printed `journal → ./migrations/journal-<stamp>.json`. It contains
  usernames, so keep it local.
- [ ] Re-run the dry run. It must show 0 operations.
- [ ] Revalidate. Pages keep serving the old data until you do (checked locally):
  ```bash
  npm run script scripts/revalidateTags.ts -- cities city redirects users   # prints "Done"
  ```

## 4. Smoke checks

- [ ] `scripts/smokeCheck.sh https://meet.hn` matches the expectations at the top
      of the script. Load each URL twice if needed: the first hit after a
      revalidate can serve the stale copy while it refreshes.
- [ ] In a browser: the home map shows markers with tooltips, and a click opens
      the city page. The sign-up search for "Toulouse" offers Toulouse, and the
      generated text reads `meet.hn/city/R35738/Toulouse`. The 👋 autofill works
      for an existing user. `/delete` and `/feedback` load.
- [ ] A New York page shows "nearby" and "also in this region" sections.
- [ ] Performance against the baseline (`docs/perf/before-2026-11-12.md`), once
      the smoke checks have warmed the pages (about 10 minutes, read-only):
  ```bash
  node scripts/measurePerf.mjs --phase=after --compare=docs/perf/before-2026-11-12.json
  ```

## 5. Rollback (in this order; stop when fixed)

1. **Data only** (the new code also serves the old data; tested locally, and the
   table came back identical):
   ```bash
   env -u DYNAMODB_ENDPOINT npm run script scripts/migrateCityIdentity.ts -- --table="$T" \
     --rollback=./migrations/journal-<stamp>.json --confirm="$T"
   npm run script scripts/revalidateTags.ts -- cities city redirects users
   ```
2. **Code.** In Vercel, use Instant Rollback to the deployment noted in step 2.
   Do the data rollback first: the old code can't read the migrated data.
   Then fix forward on a branch:
   `git revert -m 1 <merge-sha>` (or `git revert <first>^..<last>` after a
   fast-forward).
3. **Last resort: restore the backup.** This creates a new table, so the app
   must be pointed at it:
   ```bash
   aws dynamodb restore-table-from-backup --region us-east-1 \
     --target-table-name "$T-restored-$STAMP" --backup-arn <arn from list-backups>
   ```
   Then set `DYNAMODB_TABLE` in the Vercel production env to the new table and
   redeploy. Sign-ups made after the backup are lost.
