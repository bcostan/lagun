export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function formatCaptureWhen(createdAt: Date | string | null): string {
  if (!createdAt) return "";
  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function addDaysISO(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeekISO(today: string): string {
  const d = new Date(today + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function endOfWeekISO(today: string): string {
  const start = new Date(startOfWeekISO(today) + "T12:00:00");
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}
