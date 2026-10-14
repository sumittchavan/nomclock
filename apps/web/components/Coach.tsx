import type { Suggestion } from "@nomclock/shared";

export function Coach({ suggestions }: { suggestions: Suggestion[] }) {
  if (!suggestions.length) return <p className="soft">Log a meal to get suggestions.</p>;
  return (
    <ul className="coach">
      {suggestions.map((s, i) => (
        <li key={i} className={s.severity}>
          <span className="dot" aria-hidden />
          <div>
            <h3>{s.title}</h3>
            <p className="soft">{s.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
