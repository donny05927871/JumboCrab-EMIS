import type { Shift } from "@prisma/client";

type ShiftRecord = Pick<
  Shift,
  | "id"
  | "code"
  | "name"
  | "startMinutes"
  | "endMinutes"
  | "spansMidnight"
  | "breakStartMinutes"
  | "breakEndMinutes"
  | "breakMinutesUnpaid"
  | "paidHoursPerDay"
  | "notes"
  | "colorHex"
  | "isDayOff"
>;

const toStringOrZero = (value: unknown) => {
  if (value === null || typeof value === "undefined") return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return "0";
};

export type SerializedShift = {
  id: number;
  code: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  spansMidnight: boolean;
  breakStartMinutes: number | null;
  breakEndMinutes: number | null;
  breakMinutesUnpaid: number;
  paidHoursPerDay: string;
  notes: string | null;
  colorHex: string | null;
  isDayOff: boolean;
};

export function serializeShift(shift: ShiftRecord): SerializedShift;
export function serializeShift(
  shift: ShiftRecord | null
): SerializedShift | null;
export function serializeShift(shift: ShiftRecord | null) {
  if (!shift) return null;
  return {
    id: shift.id,
    code: shift.code,
    name: shift.name,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    spansMidnight: shift.spansMidnight,
    breakStartMinutes: shift.breakStartMinutes,
    breakEndMinutes: shift.breakEndMinutes,
    breakMinutesUnpaid: shift.breakMinutesUnpaid,
    paidHoursPerDay: toStringOrZero(shift.paidHoursPerDay),
    notes: shift.notes ?? null,
    colorHex: shift.colorHex ?? null,
    isDayOff: shift.isDayOff,
  };
}
