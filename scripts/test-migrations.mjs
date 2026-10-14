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
  insert into chat_messages(user_id, role, content) values ('${A}', 'user', 'craving a cappuccino');
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

check("other users' chat history is invisible", (await db.query("select count(*)::int c from chat_messages")).rows[0].c === 0);
check("clients can't write chat turns directly", await rejects(`insert into chat_messages(user_id, role, content) values ('${B}', 'assistant', 'fake')`));

await as(A);
check("own chat history is visible", (await db.query("select count(*)::int c from chat_messages")).rows[0].c === 1);
const totals = (await db.query("select day::text, kcal::int from daily_totals")).rows;
check("daily totals use the user's local date", totals.length === 1 && totals[0].day === "2026-10-14" && totals[0].kcal === 250);
check("can upload into own photo folder", !(await rejects(`insert into storage.objects(bucket_id, name) values ('meal-photos', '${A}/ok.jpg')`)));

await db.exec("reset role");
check("under-18 profiles are rejected", await rejects(`insert into auth.users values ('33333333-3333-3333-3333-333333333333');
  insert into profiles(id, birth_date, sex, height_cm, weight_kg) values ('33333333-3333-3333-3333-333333333333', '2015-01-01', 'male', 140, 40)`));

// ── feedback ──
await as(B);
check("users can submit feedback", !(await rejects(`insert into feedback(kind, area, title, details) values ('feature', 'coach', 'Barcode scanning', 'Scan packaged food')`)));
check("users can't set status, reply or visibility", await rejects(`insert into feedback(kind, title, status, is_public) values ('feature', 'Sneaky', 'done', true)`));
await as(A);
check("other users' feedback is invisible", (await db.query("select count(*)::int c from feedback")).rows[0].c === 0);
check("non-admins get nothing from the admin list", (await db.query("select count(*)::int c from admin_feedback()")).rows[0].c === 0);
check("non-admins can't triage", (await db.query("update feedback set status = 'done' returning id")).rows.length === 0);

await db.exec(`reset role; insert into admins values ('${A}')`);
await as(A);
check("admins see all feedback", (await db.query("select count(*)::int c from admin_feedback()")).rows[0].c === 1);
const fid = (await db.query("select id from admin_feedback()")).rows[0].id;
await db.exec(`update feedback set status = 'planned', admin_note = 'Coming in November', is_public = true where id = '${fid}'`);

await as(B);
const board = (await db.query("select * from ideas_board()")).rows;
check("published ideas appear on the board with the reply", board.length === 1 && board[0].status === "planned" && board[0].admin_note === "Coming in November");
check("the board never exposes who submitted", !("user_id" in board[0]));
check("users can't triage their own feedback", (await db.query("update feedback set status = 'done' returning id")).rows.length === 0);
check("users can upvote public ideas", !(await rejects(`insert into feedback_votes(feedback_id) values ('${fid}')`)));
check("one vote per user", await rejects(`insert into feedback_votes(feedback_id) values ('${fid}')`));
check("votes are counted on the board", (await db.query("select votes::int v, my_vote from ideas_board()")).rows[0].v === 1);
await db.exec(`reset role; insert into feedback(user_id, kind, title) values ('${A}', 'bug', 'Private bug')`);
const privId = (await db.query("select id from feedback where title = 'Private bug'")).rows[0].id;
await as(B);
check("can't vote on private feedback", await rejects(`insert into feedback_votes(feedback_id) values ('${privId}')`));
for (let i = 0; i < 9; i++) await db.exec(`insert into feedback(kind, title) values ('other', 'Idea number ${i}')`);
check("submissions are capped at 10 a day", await rejects(`insert into feedback(kind, title) values ('other', 'One too many')`));
await db.exec("reset role");

await db.exec(`delete from auth.users where id = '${A}'`);
check("deleting a user removes their meals", (await db.query("select count(*)::int c from meals")).rows[0].c === 0);
check("deleting a user removes their chat history", (await db.query("select count(*)::int c from chat_messages")).rows[0].c === 0);

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nAll database checks passed");
