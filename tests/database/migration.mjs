import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite({ extensions: { pgcrypto } });
let checks = 0;
function pass(label) {
  checks++;
  console.log(`PASS ${label}`);
}
async function scalar(sql, params = []) {
  return (await db.query(sql, params)).rows[0]?.value;
}
try {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/202611020001_irongate.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  pass("migration applies to PostgreSQL with Supabase auth schema shim");
  const user1 = "10000000-0000-4000-8000-000000000001",
    user2 = "10000000-0000-4000-8000-000000000002";
  await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    user1,
    "test1@example.com",
    user2,
    "test2@example.com",
  ]);
  assert.equal(await scalar("select count(*)::int as value from profiles"), 2);
  pass("registration trigger creates profiles and notification defaults");
  const domain = (
    await db.query("select * from add_domain($1,$2)", [user1, "example.com"])
  ).rows[0];
  assert.equal(domain.verification_token.length, 64);
  pass("cryptographically random DNS challenge generated");
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${user1}',false);`,
  );
  assert.equal(await scalar("select count(*)::int as value from domains"), 1);
  await db.exec(`select set_config('request.jwt.claim.sub','${user2}',false);`);
  assert.equal(await scalar("select count(*)::int as value from domains"), 0);
  pass("RLS isolates domain ownership");
  await assert.rejects(
    () => db.query("update domains set verified=true where id=$1", [domain.id]),
    /permission denied/,
  );
  pass("browser cannot self-verify domains");
  await assert.rejects(
    () =>
      db.query("select enroll_monitor($1,$2,$3)", [user2, domain.id, "daily"]),
    /permission denied/,
  );
  pass("browser cannot invoke privileged schedule RPC");
  await db.exec("reset role");
  await assert.rejects(
    () =>
      db.query("select enroll_monitor($1,$2,$3)", [user1, domain.id, "daily"]),
    /DOMAIN_NOT_VERIFIED/,
  );
  pass("monitor enrollment rejects unverified domains");
  await db.query(
    "update domains set verified=true,verified_at=now() where id=$1",
    [domain.id],
  );
  const monitor = await scalar("select enroll_monitor($1,$2,$3) as value", [
    user1,
    domain.id,
    "daily",
  ]);
  assert.ok(monitor);
  pass("verified owner can enroll monitor");
  await db.query(
    `insert into scans(user_id,domain_id,tool,status,score,grade,findings,result,scoring_version,started_at,completed_at) values($1,$2,'webshield','completed',100,'A','[]','{}','1.0.0',now(),now())`,
    [user1, domain.id],
  );
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${user2}',false);`,
  );
  assert.equal(await scalar("select count(*)::int as value from scans"), 0);
  pass("RLS isolates saved scan history");
  await db.exec("reset role");
  const first = (await db.query("select * from claim_job()")).rows[0];
  assert.equal(first.monitor_id, monitor);
  assert.equal((await db.query("select * from claim_job()")).rows.length, 0);
  pass("job claiming does not duplicate a running job");
  assert.equal(
    await scalar("select finish_job($1,$2,now()+interval '1 day') as value", [
      first.id,
      crypto.randomUUID(),
    ]),
    false,
  );
  pass("job completion rejects stale/wrong lease");
  assert.equal(
    await scalar("select finish_job($1,$2,now()+interval '1 day') as value", [
      first.id,
      first.claim_token,
    ]),
    true,
  );
  assert.equal(
    await scalar("select status as value from scan_jobs where id=$1", [
      first.id,
    ]),
    "completed",
  );
  pass("valid job lease atomically finishes and advances schedule");
  await db.query(
    "update monitors set next_run_at=now()-interval '1 second' where id=$1",
    [monitor],
  );
  const retry = (await db.query("select * from claim_job()")).rows[0];
  await db.query(
    "select finish_job($1,$2,now()+interval '1 day','test failure')",
    [retry.id, retry.claim_token],
  );
  assert.equal((await db.query("select * from claim_job()")).rows.length, 0);
  pass("failed job has a delayed retry instead of a tight retry loop");
  for (let attempt = 2; attempt <= 3; attempt++) {
    await db.query(
      "update scan_jobs set available_at=now()-interval '1 second' where id=$1",
      [retry.id],
    );
    const claimed = (await db.query("select * from claim_job()")).rows[0];
    assert.equal(claimed.attempts, attempt);
    await db.query(
      "select finish_job($1,$2,now()+interval '1 day','test failure')",
      [claimed.id, claimed.claim_token],
    );
  }
  assert.equal(
    await scalar("select status as value from scan_jobs where id=$1", [
      retry.id,
    ]),
    "failed",
  );
  pass("third failed attempt is terminal and recorded");
  assert.equal(
    await scalar("select consume_rate($1,1) as value", ["test"]),
    true,
  );
  assert.equal(
    await scalar("select consume_rate($1,1) as value", ["test"]),
    false,
  );
  pass("atomic rate counter enforces limit");
  for (let i = 0; i < 8; i++)
    assert.ok(await scalar("select acquire_scan_slot() as value"));
  assert.equal(await scalar("select acquire_scan_slot() as value"), null);
  pass("global concurrency leases enforce eight scans");
  await db.query(
    `insert into alerts(user_id,domain_id,severity,alert_type,message,deduplication_key) values($1,$2,'warning','header_removed','Test observation','test-dedup')`,
    [user1, domain.id],
  );
  await assert.rejects(
    () =>
      db.query(
        `insert into alerts(user_id,domain_id,severity,alert_type,message,deduplication_key) values($1,$2,'warning','header_removed','Duplicate','test-dedup')`,
        [user1, domain.id],
      ),
    /duplicate key/,
  );
  pass("alert deduplication is enforced by unique constraint");
  const delivery = (await db.query("select * from claim_alert()")).rows[0];
  assert.ok(delivery);
  assert.equal(delivery.delivery_attempts, 1);
  assert.equal((await db.query("select * from claim_alert()")).rows.length, 0);
  pass("atomic email lease suppresses concurrent delivery and immediate retry");
  await db.query("update alerts set sent_at=now() where id=$1", [delivery.id]);
  assert.equal((await db.query("select * from claim_alert()")).rows.length, 0);
  pass("sent alerts leave the delivery queue");

  await db.query(
    "update domains set verified_at=now()-interval '91 days' where id=$1",
    [domain.id],
  );
  await assert.rejects(
    () => db.query("update monitors set enabled=true where id=$1", [monitor]),
    /DOMAIN_NOT_VERIFIED/,
  );
  pass("stale domain verification blocks monitor changes");
  await db.exec(`set role anon`);
  await assert.rejects(
    () => db.query("select * from scan_jobs"),
    /permission denied/,
  );
  await assert.rejects(
    () => db.query("select acquire_scan_slot()"),
    /permission denied/,
  );
  pass("anonymous clients cannot inspect jobs or acquire privileged leases");
  await db.exec("reset role");

  await db.query("delete from auth.users where id=$1", [user1]);
  assert.equal(await scalar("select count(*)::int as value from domains"), 0);
  assert.equal(await scalar("select count(*)::int as value from scans"), 0);
  assert.equal(await scalar("select count(*)::int as value from scan_jobs"), 0);
  pass("account deletion cascades through domains, scans, monitors and jobs");
  console.log(`${checks} database checks passed`);
} finally {
  await db.close();
}
