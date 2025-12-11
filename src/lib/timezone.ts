export const TZ = "Asia/Manila";
export const TZ_OFFSET_MINUTES = 8 * 60; // UTC+8, no DST in Manila

const toTzStartMs = (date: Date) => {
  const utcMs = date.getTime();
  const tzMs = utcMs + TZ_OFFSET_MINUTES * 60 * 1000;
  const tzDate = new Date(tzMs);
  const startTzMs = Date.UTC(tzDate.getUTCFullYear(), tzDate.getUTCMonth(), tzDate.getUTCDate(), 0, 0, 0);
  return startTzMs - TZ_OFFSET_MINUTES * 60 * 1000;
};

export const zonedNow = () => new Date();

export const startOfZonedDay = (date: Date) => new Date(toTzStartMs(date));

export const endOfZonedDay = (date: Date) => {
  const start = startOfZonedDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
};

export const formatZonedTime = (value?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...opts,
  });
};

export const formatZonedDate = (value?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...opts,
  });
};
