"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FEEDBACK_AREAS, FEEDBACK_KINDS, STATUS_LABEL,
  type FeedbackArea, type FeedbackItem, type FeedbackKind,
} from "@nomclock/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { prepareMealPhoto } from "@/lib/image";

type View = "suggest" | "board" | "mine";
const KIND_TEXT = Object.fromEntries(FEEDBACK_KINDS) as Record<FeedbackKind, string>;
const AREA_TEXT = Object.fromEntries(FEEDBACK_AREAS) as Record<FeedbackArea, string>;

function StatusTag({ s }: { s: FeedbackItem["status"] }) {
  return <span className={`tag status-${s}`}>{STATUS_LABEL[s]}</span>;
}

function SuggestForm({ onSent, initialArea }: { onSent: () => void; initialArea: FeedbackArea }) {
  const { profile } = useSession();
  const [kind, setKind] = useState<FeedbackKind>("feature");
  const [area, setArea] = useState<FeedbackArea>(initialArea);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const placeholder = {
    feature: "e.g. Scan barcodes on packaged food",
    improvement: "e.g. Let me edit the time of a meal",
    bug: "e.g. The calendar shows the wrong day after midnight",
    other: "What's on your mind?",
  }[kind];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true); setErr(null);
    try {
      const screenshot = file ? { data: await prepareMealPhoto(file, 1400), contentType: "image/jpeg" } : undefined;
      await api.feedback.submit({ userId: profile.id, kind, area, title, details, platform: "web", appVersion: process.env.NEXT_PUBLIC_APP_VERSION, screenshot });
      setTitle(""); setDetails(""); setFile(null);
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send your suggestion. Try again.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 18, maxWidth: 640 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small" style={{ fontWeight: 700, marginBottom: 8 }}>What kind of suggestion?</legend>
        <div className="seg" style={{ flexWrap: "wrap" }}>
          {FEEDBACK_KINDS.map(([k, l]) => (
            <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
      </fieldset>
      <label>Which part of the app?
        <select value={area} onChange={(e) => setArea(e.target.value as FeedbackArea)}>
          {FEEDBACK_AREAS.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
        </select>
      </label>
      <label>In a sentence
        <input required minLength={3} maxLength={120} value={title} placeholder={placeholder} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label><span>Details <span className="soft" style={{ fontWeight: 400 }}>optional</span></span>
        <textarea rows={5} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)}
          placeholder={kind === "bug" ? "What did you do, what did you expect, and what happened instead?" : "How would it work? What would it help you do?"} />
      </label>
      <label><span>Screenshot <span className="soft" style={{ fontWeight: 400 }}>optional</span></span>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {err && <p className="error" role="alert">{err}</p>}
      <div><button className="btn" disabled={busy || title.trim().length < 3}>{busy ? "Sending…" : "Send suggestion"}</button></div>
      <p className="small soft">Only the NomClock team sees your suggestion. If we add it to the public ideas board, your name isn't shown.</p>
    </form>
  );
}

function Board() {
  const [ideas, setIdeas] = useState<FeedbackItem[] | null>(null);
  const load = useCallback(() => api.feedback.board().then(setIdeas), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (i: FeedbackItem) => {
    setIdeas((xs) => xs?.map((x) => x.id === i.id ? { ...x, myVote: !x.myVote, votes: (x.votes ?? 0) + (x.myVote ? -1 : 1) } : x) ?? null);
    await api.feedback.vote(i.id, !i.myVote);
  };

  if (!ideas) return <p className="soft">Loading…</p>;
  if (!ideas.length) return <p className="soft">No ideas on the board yet. Suggest one and it may appear here.</p>;
  return (
    <ul className="ideas">
      {ideas.map((i) => (
        <li key={i.id} className="idea">
          <button className={`vote${i.myVote ? " on" : ""}`} aria-pressed={!!i.myVote} onClick={() => toggle(i)}
            aria-label={`${i.myVote ? "Remove your vote for" : "Vote for"} ${i.title}. ${i.votes} votes`}>
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden><path d="M7 1 13 9H1z" fill="currentColor" /></svg>
            <span className="num">{i.votes}</span>
          </button>
          <div style={{ display: "grid", gap: 4 }}>
            <h3>{i.title}</h3>
            {i.details && <p className="soft small">{i.details}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusTag s={i.status} />
              <span className="small soft">{AREA_TEXT[i.area]}</span>
              {i.mine && <span className="small soft">Your idea</span>}
            </div>
            {i.adminNote && <p className="reply small"><b>From the team:</b> {i.adminNote}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Mine({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  useEffect(() => { api.feedback.mine().then(setItems); }, [refreshKey]);
  if (!items) return <p className="soft">Loading…</p>;
  if (!items.length) return <p className="soft">You haven't sent any suggestions yet.</p>;
  return (
    <ul className="ideas">
      {items.map((i) => (
        <li key={i.id} className="idea mine-row">
          <div style={{ display: "grid", gap: 4 }}>
            <h3>{i.title}</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusTag s={i.status} />
              <span className="small soft">{KIND_TEXT[i.kind]}, {AREA_TEXT[i.area]}</span>
              <span className="small soft">{new Date(i.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              {i.isPublic && <span className="small soft">On the ideas board</span>}
            </div>
            {i.details && <p className="soft small">{i.details}</p>}
            {i.adminNote && <p className="reply small"><b>From the team:</b> {i.adminNote}</p>}
          </div>
          {i.status === "new" && (
            <button className="btn ghost small" onClick={async () => {
              if (!confirm("Withdraw this suggestion?")) return;
              await api.feedback.remove(i.id);
              setItems((xs) => xs?.filter((x) => x.id !== i.id) ?? null);
            }}>Withdraw</button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FeedbackInner() {
  const { profile } = useSession();
  const params = useSearchParams();
  const fromArea = (params.get("area") as FeedbackArea) ?? "other";
  const [view, setView] = useState<View>("suggest");
  const [sent, setSent] = useState(0);
  if (!profile) return null;

  return (
    <div style={{ display: "grid", gap: 22, maxWidth: 760 }}>
      <div>
        <h1>Ideas and feedback</h1>
        <p className="soft">Tell us what to add or change in NomClock, and vote on ideas from other people.</p>
      </div>
      <div className="seg" role="group" aria-label="Section">
        <button aria-pressed={view === "suggest"} onClick={() => setView("suggest")}>Suggest</button>
        <button aria-pressed={view === "board"} onClick={() => setView("board")}>Ideas board</button>
        <button aria-pressed={view === "mine"} onClick={() => setView("mine")}>Yours</button>
      </div>
      {sent > 0 && view === "suggest" && (
        <p role="status" className="sent">Thanks, your suggestion was sent. You can follow its status under Yours.</p>
      )}
      {view === "suggest" && <SuggestForm initialArea={FEEDBACK_AREAS.some(([a]) => a === fromArea) ? fromArea : "other"} onSent={() => setSent((n) => n + 1)} />}
      {view === "board" && <Board />}
      {view === "mine" && <Mine refreshKey={sent} />}
    </div>
  );
}

export default function FeedbackPage() {
  return <Suspense><FeedbackInner /></Suspense>;
}
