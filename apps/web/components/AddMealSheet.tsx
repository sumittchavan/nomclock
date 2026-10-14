"use client";
import { useEffect, useRef, useState } from "react";
import { localHour, slotForHour, type MealSlot } from "@nutrisnap/shared";
import { api } from "@/lib/supabase";
import { prepareMealPhoto } from "@/lib/image";
import { useSession } from "@/lib/session";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddMealSheet({ defaultTime, onClose, onLogged }: {
  defaultTime: Date;
  onClose: () => void;
  onLogged: (mealId: string) => void;
}) {
  const { profile } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [when, setWhen] = useState(toLocalInput(defaultTime));
  const [slot, setSlot] = useState<MealSlot>(slotForHour(localHour(defaultTime, profile?.timezone ?? "UTC")));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const submit = async () => {
    if (!file || !profile) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await prepareMealPhoto(file);
      const res = await api.logPhotoMeal({ userId: profile.id, photo, contentType: "image/jpeg", eatenAt: new Date(when), slot, note: note.trim() || undefined });
      onLogged(res.mealId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this meal. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-title" tabIndex={-1} ref={dialogRef}>
        <h2 id="add-title">Add a meal</h2>
        <div
          className="drop" role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        >
          {preview ? <img src={preview} alt="Selected meal" /> : (
            <>
              <b>Take or choose a photo</b>
              <span className="soft small">Get the whole plate in frame. Location data is removed before upload.</span>
            </>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div className="form-grid">
          <label>When
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label>Meal
            <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
        </div>
        <label><span>Anything the photo won't show? <span className="soft" style={{ fontWeight: 400 }}>(optional)</span></span>
          <input placeholder="e.g. cooked in ghee, 2 rotis, no sugar in chai" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn" onClick={submit} disabled={!file || busy}>{busy ? "Reading your plate…" : "Log meal"}</button>
        </div>
      </div>
    </div>
  );
}
