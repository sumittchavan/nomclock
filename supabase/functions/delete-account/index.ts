// Permanently deletes the calling user's account, data and photos (PIPEDA right to withdraw consent).
import { adminClient, cors, userFromRequest } from "../_shared/env.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const caller = await userFromRequest(req);
  if (!caller) return new Response("unauthorized", { status: 401, headers: cors });
  const { user } = caller;
  const admin = adminClient();

  // Remove every meal photo (<uid>/…) and feedback screenshot (<uid>/feedback/…), then
  // the auth user; table rows cascade. Listings include sub-folders as entries without
  // an id, so only real files (with an id) are removed.
  for (const prefix of [user.id, `${user.id}/feedback`]) {
    for (let page = 0; page < 1000; page++) {
      const { data: entries, error: listErr } = await admin.storage.from("meal-photos").list(prefix, { limit: 1000 });
      if (listErr) return new Response(JSON.stringify({ error: "couldn't list photos" }), { status: 500, headers: cors });
      const files = (entries ?? []).filter((f) => f.id);
      if (!files.length) break;
      const { error: rmErr } = await admin.storage.from("meal-photos").remove(files.map((f) => `${prefix}/${f.name}`));
      if (rmErr) return new Response(JSON.stringify({ error: "couldn't delete photos" }), { status: 500, headers: cors });
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ deleted: true }), { headers: { ...cors, "Content-Type": "application/json" } });
});
