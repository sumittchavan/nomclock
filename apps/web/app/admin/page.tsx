"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FEEDBACK_AREAS, FEEDBACK_KINDS, STATUS_LABEL,
  type FeedbackArea, type FeedbackItem, type FeedbackKind, type FeedbackStatus,
} from "@nutrisnap/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";

const STATUSES = Object.keys(STATUS_LABEL) as FeedbackStatus[];
const KIND_TEXT = Object.fromEntries(FEEDBACK_KINDS) as Record<FeedbackKind, string>;
const AREA_TEXT = Object.fromEntries(FEEDBACK_AREAS) as Record<FeedbackArea, string>;

function Row({ item, onSaved }: { item: FeedbackItem; onSaved: (i: FeedbackItem) => void }) {
  const [open, setOpen] = useState(item.status === "new");
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.adminNote ?? "");
  const [pub, setPub] = useState(!!item.isPublic);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const dirty = status !== item.status || note !== (item.adminNote ?? "") || pub !== !!item.isPublic;

  const save = async () => {
    setBusy(true);
    await api.feedback.adminUpdate(item.id, { status, adminNote: note, isPublic: pub });
    setBusy(false);
    onSaved({ ...item, status, adminNote: note || null, isPublic: pub });
  };

  return (
    <li className="admin-row">
      <button className="admin-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`tag status-${item.status}`}>{STATUS_LABEL[item.status]}</span>
        <b>{item.title}</b>
        <span className="small soft">{KIND_TEXT[item.kind]}, {AREA_TEXT[item.area]}</span>
        <span className="small soft num" style={{ marginLeft: "auto" }}>{item.votes ? `${item.votes} vote${item.votes > 1 ? "s" : ""}` : ""}</span>
      </button>
      {open && (
        <div className="admin-body">
          {item.details ? <p style={{ whiteSpace: "pre-wrap" }}>{item.details}</p> : <p className="soft">No details given.</p>}
          <p className="small soft">
            {new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}, {item.platform ?? "unknown platform"}
            {item.appVersion ? `, v${item.appVersion}` : ""}. User {item.userId?.slice(0, 8)}.
          </p>
          {item.screenshotPath && (
            <div>{shot ? <a href={shot} target="_blank" rel="noreferrer"><img src={shot} alt="Screenshot attached to this suggestion" className="admin-shot" /></a>
              : <button className="btn ghost small" onClick={async () => setShot(await api.feedback.screenshotUrl(item.screenshotPath!))}>Show screenshot</button>}</div>
          )}
          <div className="form-grid">
            <label>Status
              <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label style={{ alignSelf: "end", display: "flex", gap: 10, alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} style={{ width: 20, height: 20 }} />
              Show on the public ideas board
            </label>
          </div>
          <label><span>Reply to the user <span className="soft" style={{ fontWeight: 400 }}>shown with the suggestion{pub ? " and on the board" : ""}</span></span>
            <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Thanks! This is planned for the November update." />
          </label>
          {pub && /\b(\S+@\S+|\d{3}[-\s]?\d{3}[-\s]?\d{4})\b/.test(item.title + " " + item.details) && (
            <p className="error small">This suggestion looks like it contains an email address or phone number. Edit it out before publishing.</p>
          )}
          <div><button className="btn" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
        </div>
      )}
    </li>
  );
}

export default function AdminPage() {
  const { profile } = useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filter, setFilter] = useState<FeedbackStatus | "all">("new");

  const load = useCallback(async () => setItems(await api.feedback.adminList()), []);
  useEffect(() => {
    if (!profile) return;
    api.feedback.isAdmin().then((ok) => { setAllowed(ok); if (ok) load(); });
  }, [profile, load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  if (!profile || allowed === null) return null;
  if (!allowed) return <div className="empty"><h1>Not available</h1><p className="soft">This page is for the NutriSnap team.</p></div>;

  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 900 }}>
      <div>
        <h1>Feedback</h1>
        <p className="soft">{counts.new ?? 0} new, {items.length} total. Most-voted public ideas are on the ideas board.</p>
      </div>
      <div className="seg" role="group" aria-label="Filter by status" style={{ flexWrap: "wrap" }}>
        {(["all", ...STATUSES] as const).map((s) => (
          <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {s === "all" ? "All" : STATUS_LABEL[s]} <span className="num">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className="ideas">
          {shown.map((i) => <Row key={i.id} item={i} onSaved={(u) => setItems((xs) => xs.map((x) => (x.id === u.id ? { ...x, ...u } : x)))} />)}
        </ul>
      ) : <p className="soft">Nothing here.</p>}
    </div>
  );
}
