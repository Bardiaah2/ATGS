'use client';
import { TicketDetails } from "../../../lib/api";

type Props = {
  responses: TicketDetails["responses"];
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
};

export default function Chain({ responses }: Props) {
  if (!responses || responses.length === 0) {
    return null;
  }

  return (
    <section className="px-6 py-8 space-y-4">
      {responses.map((r, idx) => (
        <div
          key={`${r.ticket}-${r.created_at}-${idx}`}
          className="rounded-2xl border border-slate-200 shadow-sm p-4 bg-white"
        >
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Author: {r.author_name ?? "Unknown"}</span>
            <span>{formatDate(r.created_at)}</span>
          </div>
          <p className="mt-2 text-slate-900">{r.message}</p>
        </div>
      ))}
    </section>
  );
}
