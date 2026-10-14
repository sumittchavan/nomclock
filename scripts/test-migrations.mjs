// Applies every migration to an in-memory Postgres (PGlite) with minimal stubs of
// Supabase's auth and storage schemas, then checks that row-level security keeps
// users' data apart. Run: node scripts/test-migrations.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "supabase", "migrations");
const db = new PGlite();
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failures++; };
const rejects = async (sql) => { try { await db.exec(sql); return false; } catch { return true; } };

await db.exec(`
  create role authenticated; create role anon;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
  create table storage.buckets(id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
`);

for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  console.log(`applied ${f}`);
}
await db.exec(`grant usage on schema public, storage to authenticated;
  grant all on all tables in schema public to authenticated; grant all on storage.objects to authenticated;`);

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const MEAL = "aaaaaaaa-0000-0000-0000-000000000001";
await db.exec(`
  insert into auth.users values ('${A}'), ('${B}');
  insert into profiles(id, birth_date, sex, height_cm, weight_kg, timezone) values
    ('${A}', '1990-01-01', 'male', 175, 80, 'America/Vancouver'),
    ('${B}', '1985-01-01', 'female', 160, 60, 'America/Toronto');
  insert into meals(id, user_id, eaten_at) values ('${MEAL}', '${A}', '2026-10-15T05:00:00Z');
  insert into meal_items(meal_id, user_id, name, portion_grams, nutrients) values ('${MEAL}', '${A}', 'dal', 200, '{"kcal":250,"protein":14}');
  insert into storage.objects(bucket_id, name) values ('meal-photos', '${A}/${MEAL}.jpg');
`);

const as = (uid) => db.exec(`set role authenticated; select set_config('request.jwt.sub', '${uid}', false);`);

await as(B);
check("other users' meals are invisible", (await db.query("select count(*)::int c from meals")).rows[0].c === 0);
check("other users' items are invisible", (await db.query("select count(*)::int c from meal_items")).rows[0].c === 0);
check("other users' daily totals are invisible", (await db.query("select count(*)::int c from daily_totals")).rows[0].c === 0);
check("other users' profiles are invisible", (await db.query("select count(*)::int c from profiles")).rows[0].c === 1);
check("other users' photos are invisible", (await db.query("select count(*)::int c from storage.objects")).rows[0].c === 0);
check("can't add items to someone else's meal", await rejects(`insert into meal_items(meal_id, user_id, name, portion_grams) values ('${MEAL}', '${B}', 'x', 1)`));
check("can't upload into someone else's photo folder", await rejects(`insert into storage.objects(bucket_id, name) values ('meal-photos', '${A}/evil.jpg')`));
check("can't create a meal as someone else", await rejects(`insert into meals(user_id) values ('${A}')`));

await as(A);
const totals = (await db.query("select day::text, kcal::int from daily_totals")).rows;
check("daily totals use the user's local date", totals.length === 1 && totals[0].day === "2026-10-14" && totals[0].kcal === 250);
check("can upload into own photo folder", !(await rejects(`insert into storage.objects(bucket_id, name) values ('meal-photos', '${A}/ok.jpg')`)));

await db.exec("reset role");
check("under-18 profiles are rejected", await rejects(`insert into auth.users values ('33333333-3333-3333-3333-333333333333');
  insert into profiles(id, birth_date, sex, height_cm, weight_kg) values ('33333333-3333-3333-3333-333333333333', '2015-01-01', 'male', 140, 40)`));

await db.exec(`delete from auth.users where id = '${A}'`);
check("deleting a user removes their meals", (await db.query("select count(*)::int c from meals")).rows[0].c === 0);

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nAll database checks passed");
