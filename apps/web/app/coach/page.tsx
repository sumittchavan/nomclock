"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  COACH_STARTERS, buildCoachContext, localDateKey, localHour, localRange, optionToItem, slotForHour, sumMeals,
  type ChatTurn, type CoachOption, type MealWithStatus,
} from "@nutrisnap/shared";
import { api } from "@/lib/supabase";
import { useSession } from "@/lib/session";

const KIND_LABEL: Record<CoachOption["kind"], string> = {
  original: "As you'd usually order it",
  smarter: "Same thing, lighter",
  swap: "Swap",
  healthy: "Healthiest pick",
};

function OptionRow({ o, onLog }: { o: CoachOption; onLog: (o: CoachOption) => Promise<void> }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  return (
    <li className={`opt opt-${o.kind}`}>
      <div className="opt-main">
        <span className="opt-kind small">{KIND_LABEL[o.kind] ?? o.kind}</span>
        <b>{o.name}</b>
        <span className="small soft">{o.why}</span>
        <span className="small soft num">P {Math.round(o.protein)} g · C {Math.round(o.carbs)} g · F {Math.round(o.fat)} g{o.sugar ? ` · sugar ${Math.round(o.sugar)} g` : ""}</span>
      </div>
      <div className="opt-side">
        <span className="num opt-kcal">~{Math.round(o.kcal)}<span className="small soft"> kcal</span></span>
        <button
          className="btn ghost small" disabled={state !== "idle"} aria-live="polite"
          onClick={async () => { setState("busy"); await onLog(o); setState("done"); }}
        >{state === "done" ? "Logged" : state === "busy" ? "Logging…" : "Log this"}</button>
      </div>
    </li>
  );
}

export default function CoachPage() {
  const { profile, targets } = useSession();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [meals, setMeals] = useState<MealWithStatus[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tz = profile?.timezone ?? "UTC";

  const loadToday = useCallback(async () => {
    if (!profile) return;
    const today = localDateKey(new Date(), tz);
    const [from, to] = localRange(today, today, tz);
    setMeals(await api.listMeals(from, to));
  }, [profile, tz]);

  useEffect(() => {
    if (!profile) return;
    loadToday();
    api.chatHistory().then(setTurns);
  }, [profile, loadToday]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);

  if (!profile || !targets) return null;
  const totals = sumMeals(meals);
  const left = Math.round(targets.nutrients.kcal - totals.kcal);

  const send = async (msg: string) => {
    const message = msg.trim();
    if (!message || sending) return;
    setText("");
    setSending(true);
    const now = new Date().toISOString();
    setTurns((t) => [...t,
      { id: `u-${now}`, role: "user", content: message, createdAt: now },
      { id: `p-${now}`, role: "assistant", content: "", createdAt: now, pending: true },
    ]);
    try {
      const reply = await api.sendChat(message, buildCoachContext(profile, targets, meals));
      setTurns((t) => t.map((x) => (x.id === `p-${now}` ? { ...x, pending: false, content: reply.message, options: reply.options, tip: reply.tip } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === `p-${now}` ? { ...x, pending: false, error: true, content: e instanceof Error ? e.message : "Something went wrong." } : x)));
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const logOption = async (o: CoachOption) => {
    const now = new Date();
    await api.logManualItem({ userId: profile.id, eatenAt: now, slot: slotForHour(localHour(now, tz)), item: optionToItem(o) });
    await loadToday();
  };

  const clear = async () => {
    if (!confirm("Clear your conversation with the coach?")) return;
    await api.clearChat();
    setTurns([]);
  };

  return (
    <div className="coach-page">
      <div className="day-head" style={{ marginBottom: 8 }}>
        <div>
          <h1>Coach</h1>
          <p className="soft">
            Ask before you order. Today: <span className="num"><b style={{ color: "var(--ink)" }}>{Math.round(totals.kcal).toLocaleString()}</b> of {targets.nutrients.kcal.toLocaleString()} kcal</span>,{" "}
            {left >= 0 ? `${left.toLocaleString()} left` : `${Math.abs(left).toLocaleString()} over`}.
          </p>
        </div>
        {turns.length > 0 && <button className="btn ghost small" onClick={clear}>Clear chat</button>}
      </div>

      <div className="chat" aria-live="polite">
        {turns.length === 0 && (
          <div className="chat-empty">
            <p className="soft">Tell the coach what you're craving or about to order. It knows what you've eaten today and how much room is left.</p>
            <div className="starters">
              {COACH_STARTERS.map((s) => <button key={s} className="btn ghost small" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {turns.map((t) => t.role === "user" ? (
          <div key={t.id} className="msg-user"><p>{t.content}</p></div>
        ) : (
          <div key={t.id} className="msg-coach">
            {t.pending ? <p className="soft typing">Thinking about your options<span>.</span><span>.</span><span>.</span></p> : (
              <>
                <p className={t.error ? "error" : undefined}>{t.content}</p>
                {!!t.options?.length && (
                  <ul className="opts">{t.options.map((o, i) => <OptionRow key={i} o={o} onLog={logOption} />)}</ul>
                )}
                {t.tip && <p className="tip"><b>Next time:</b> {t.tip}</p>}
              </>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label className="sr" htmlFor="coach-input">Message the coach</label>
        <textarea
          id="coach-input" ref={inputRef} rows={1} value={text} maxLength={1500}
          placeholder="e.g. I'm at Starbucks and want a mocha"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
        />
        <button className="btn" disabled={!text.trim() || sending}>Send</button>
      </form>
      <p className="small soft" style={{ marginTop: 8 }}>Calories for menu items are estimates. General guidance, not medical advice.</p>
    </div>
  );
}
