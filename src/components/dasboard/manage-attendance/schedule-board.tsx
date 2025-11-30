"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCcw, CalendarClock, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TZ } from "@/lib/timezone";
import { DateRange } from "react-day-picker";

type EmployeeLite = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: { name: string | null } | null;
  position?: { name: string | null } | null;
};

type ShiftLite = {
  id: number;
  code: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  spansMidnight?: boolean;
  breakMinutesUnpaid?: number | null;
  paidHoursPerDay?: number | null;
  notes?: string | null;
};

type Pattern = {
  id: string;
  code: string;
  name: string;
  sunShiftId: number | null;
  monShiftId: number | null;
  tueShiftId: number | null;
  wedShiftId: number | null;
  thuShiftId: number | null;
  friShiftId: number | null;
  satShiftId: number | null;
  sunShift?: ShiftLite | null;
  monShift?: ShiftLite | null;
  tueShift?: ShiftLite | null;
  wedShift?: ShiftLite | null;
  thuShift?: ShiftLite | null;
  friShift?: ShiftLite | null;
  satShift?: ShiftLite | null;
};

type ScheduleEntry = {
  employee: EmployeeLite;
  shift: ShiftLite | null;
  source: "override" | "pattern" | "none";
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
};

type OverrideRow = {
  id: string;
  workDate: string;
  source: string;
  note?: string | null;
  employee: EmployeeLite;
  shift: ShiftLite | null;
};

type ScheduleBoardProps = {
  mode?: "full" | "overrides" | "patterns";
};

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const formatMinutes = (minutes: number | null) => {
  if (minutes == null) return "—";
  const total = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const minutesToTimeInput = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const formatDateDisplay = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
};

const normalizeShift = (s: any): ShiftLite => ({
  id: s.id,
  code: s.code,
  name: s.name,
  startMinutes: s.startMinutes,
  endMinutes: s.endMinutes,
  spansMidnight: Boolean(s.spansMidnight),
  breakMinutesUnpaid: typeof s.breakMinutesUnpaid === "number" ? s.breakMinutesUnpaid : 0,
  paidHoursPerDay:
    s.paidHoursPerDay != null
      ? typeof s.paidHoursPerDay === "number"
        ? s.paidHoursPerDay
        : Number(s.paidHoursPerDay)
      : 0,
  notes: s.notes ?? "",
});

const normalizePattern = (p: any): Pattern => ({
  id: p.id,
  code: p.code,
  name: p.name,
  sunShiftId: p.sunShiftId ?? null,
  monShiftId: p.monShiftId ?? null,
  tueShiftId: p.tueShiftId ?? null,
  wedShiftId: p.wedShiftId ?? null,
  thuShiftId: p.thuShiftId ?? null,
  friShiftId: p.friShiftId ?? null,
  satShiftId: p.satShiftId ?? null,
  sunShift: p.sunShift ? normalizeShift(p.sunShift) : null,
  monShift: p.monShift ? normalizeShift(p.monShift) : null,
  tueShift: p.tueShift ? normalizeShift(p.tueShift) : null,
  wedShift: p.wedShift ? normalizeShift(p.wedShift) : null,
  thuShift: p.thuShift ? normalizeShift(p.thuShift) : null,
  friShift: p.friShift ? normalizeShift(p.friShift) : null,
  satShift: p.satShift ? normalizeShift(p.satShift) : null,
});

const normalizeOverride = (o: any): OverrideRow => ({
  id: o.id,
  workDate: o.workDate,
  source: o.source,
  note: o.note ?? "",
  employee: o.employee,
  shift: o.shift ? normalizeShift(o.shift) : null,
});

const toDateInputValue = (value: string) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

const formatRangeLabel = (range: DateRange) => {
  const fmt = (d?: Date) =>
    d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ }) : "";
  return range?.from ? `${fmt(range.from)}${range.to ? ` → ${fmt(range.to)}` : ""}` : "Pick dates";
};

export function ScheduleBoard({ mode = "full" }: ScheduleBoardProps) {
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [shifts, setShifts] = useState<ShiftLite[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignPatternId, setAssignPatternId] = useState("");
  const [assignEffective, setAssignEffective] = useState(todayISO());
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [overrideEmployeeId, setOverrideEmployeeId] = useState("");
  const [overrideShiftId, setOverrideShiftId] = useState<string>("");
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const overrideSource = "MANUAL";
  const [overrideIsRange, setOverrideIsRange] = useState(false);
  const [overrideEndDate, setOverrideEndDate] = useState<string | null>(null);
  const [editingOverride, setEditingOverride] = useState<OverrideRow | null>(null);
  const [overrideEditOpen, setOverrideEditOpen] = useState(false);
  const [overridePickerOpen, setOverridePickerOpen] = useState(false);

  const [shiftCode, setShiftCode] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [shiftSpansMidnight, setShiftSpansMidnight] = useState(false);
  const [shiftBreak, setShiftBreak] = useState(60);
  const [shiftPaidHours, setShiftPaidHours] = useState(8);
  const [shiftNotes, setShiftNotes] = useState("");
  const [shiftSaving, setShiftSaving] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const [patternCode, setPatternCode] = useState("");
  const [patternName, setPatternName] = useState("");
  const [dayShifts, setDayShifts] = useState<Record<string, string>>({
    sunShiftId: "",
    monShiftId: "",
    tueShiftId: "",
    wedShiftId: "",
    thuShiftId: "",
    friShiftId: "",
    satShiftId: "",
  });
  const [patternSaving, setPatternSaving] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);

  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [shiftEdit, setShiftEdit] = useState<{
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    spansMidnight: boolean;
    breakMinutesUnpaid: number;
    paidHoursPerDay: number;
    notes: string;
  } | null>(null);
  const [shiftEditSaving, setShiftEditSaving] = useState(false);
  const [shiftEditError, setShiftEditError] = useState<string | null>(null);

  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [patternEdit, setPatternEdit] = useState<{
    code: string;
    name: string;
    dayShifts: Record<string, string>;
  } | null>(null);
  const [patternEditSaving, setPatternEditSaving] = useState(false);
  const [patternEditError, setPatternEditError] = useState<string | null>(null);
  const [patternEditOpen, setPatternEditOpen] = useState(false);

  const showSchedule = mode === "full";
  const showAssignPattern = mode !== "overrides";
  const showCreatePattern = mode !== "overrides";
  const showOverrideForm = mode !== "patterns";
  const showOverrideTables = mode !== "patterns";
  const showShifts = mode === "full";
  const showWeeklyPatterns = mode !== "overrides";

  const countDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
  };

  const overrideDaysCount =
    overrideIsRange && overrideEndDate ? countDays(overrideDate, overrideEndDate) : 1;

  const makeDate = (val?: string | null) => {
    if (!val) return undefined;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const selectedRange: DateRange = {
    from: makeDate(overrideDate),
    to: makeDate(overrideEndDate),
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setShiftEditError(null);
      setPatternEditError(null);
      const [scheduleRes, overrideRes] = await Promise.all([
        fetch(`/api/schedule?date=${date}`),
        fetch(`/api/schedule/override?start=${date}`),
      ]);
      const [scheduleJson, overrideJson] = await Promise.all([
        scheduleRes.json(),
        overrideRes.json(),
      ]);
      if (!scheduleRes.ok) throw new Error(scheduleJson?.error || "Failed to load schedule");
      if (!overrideRes.ok) throw new Error(overrideJson?.error || "Failed to load overrides");

      setEntries(
        (scheduleJson?.schedule ?? []).map((entry: any) => ({
          ...entry,
          shift: entry.shift ? normalizeShift(entry.shift) : null,
        }))
      );
      setPatterns((scheduleJson?.patterns ?? []).map(normalizePattern));
      setShifts((scheduleJson?.shifts ?? []).map(normalizeShift));
      setOverrides((overrideJson?.data ?? []).map(normalizeOverride));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employees = useMemo(() => entries.map((e) => e.employee), [entries]);
  const selectedDayKey = date;
  const overrideDayKey = (value: string) =>
    new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

  const overridesForDay = useMemo(
    () => overrides.filter((o) => overrideDayKey(o.workDate) === selectedDayKey),
    [overrides, selectedDayKey]
  );
  const upcomingOverrides = useMemo(
    () => overrides.filter((o) => overrideDayKey(o.workDate) > selectedDayKey),
    [overrides, selectedDayKey]
  );

  const patternLabel = (p: Pattern) => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const first = days
      .map((d) => (p as any)[`${d}Shift`] as ShiftLite | undefined | null)
      .find((s) => s);
    return `${p.name}${first ? ` • ${first.name}` : ""}`;
  };

  const formatShiftSummary = (shift: ShiftLite | null | undefined) =>
    shift ? `${shift.name} (${formatMinutes(shift.startMinutes)}-${formatMinutes(shift.endMinutes)})` : "Rest day";

  const startShiftEdit = (shift: ShiftLite) => {
    setEditingShiftId(shift.id);
    setShiftEdit({
      code: shift.code,
      name: shift.name,
      startTime: minutesToTimeInput(shift.startMinutes),
      endTime: minutesToTimeInput(shift.endMinutes),
      spansMidnight: Boolean(shift.spansMidnight),
      breakMinutesUnpaid: shift.breakMinutesUnpaid ?? 0,
      paidHoursPerDay: shift.paidHoursPerDay ?? 0,
      notes: shift.notes ?? "",
    });
    setShiftEditError(null);
  };

  const cancelShiftEdit = () => {
    setEditingShiftId(null);
    setShiftEdit(null);
    setShiftEditError(null);
  };

  const saveShiftEdit = async () => {
    if (!editingShiftId || !shiftEdit) return;
    try {
      setShiftEditSaving(true);
      setShiftEditError(null);
      const res = await fetch("/api/shifts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingShiftId,
          code: shiftEdit.code,
          name: shiftEdit.name,
          startTime: shiftEdit.startTime,
          endTime: shiftEdit.endTime,
          spansMidnight: shiftEdit.spansMidnight,
          breakMinutesUnpaid: shiftEdit.breakMinutesUnpaid,
          paidHoursPerDay: shiftEdit.paidHoursPerDay,
          notes: shiftEdit.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update shift");
      cancelShiftEdit();
      await load();
    } catch (err) {
      setShiftEditError(err instanceof Error ? err.message : "Failed to update shift");
    } finally {
      setShiftEditSaving(false);
    }
  };

  const startPatternEdit = (p: Pattern) => {
    setEditingPatternId(p.id);
    setPatternEdit({
      code: p.code,
      name: p.name,
      dayShifts: {
        sunShiftId: p.sunShiftId ? String(p.sunShiftId) : "",
        monShiftId: p.monShiftId ? String(p.monShiftId) : "",
        tueShiftId: p.tueShiftId ? String(p.tueShiftId) : "",
        wedShiftId: p.wedShiftId ? String(p.wedShiftId) : "",
        thuShiftId: p.thuShiftId ? String(p.thuShiftId) : "",
        friShiftId: p.friShiftId ? String(p.friShiftId) : "",
        satShiftId: p.satShiftId ? String(p.satShiftId) : "",
      },
    });
    setPatternEditError(null);
    setPatternEditOpen(true);
  };

  const cancelPatternEdit = () => {
    setEditingPatternId(null);
    setPatternEdit(null);
    setPatternEditError(null);
    setPatternEditOpen(false);
  };

  const savePatternEdit = async () => {
    if (!editingPatternId || !patternEdit) {
      setPatternEditError("No pattern selected");
      return;
    }
    if (!patternEdit.code.trim() || !patternEdit.name.trim()) {
      setPatternEditError("Code and name are required");
      return;
    }
    try {
      setPatternEditSaving(true);
      setPatternEditError(null);
      const payload: Record<string, any> = {
        id: editingPatternId,
        code: patternEdit.code.trim(),
        name: patternEdit.name.trim(),
      };
      Object.entries(patternEdit.dayShifts).forEach(([key, val]) => {
        payload[key] = val ? Number(val) : null;
      });
      const res = await fetch("/api/patterns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update pattern");
      cancelPatternEdit();
      await load();
    } catch (err) {
      setPatternEditError(err instanceof Error ? err.message : "Failed to update pattern");
    } finally {
      setPatternEditSaving(false);
    }
  };

  const deletePattern = async (id: string) => {
    try {
      await fetch(`/api/patterns?id=${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    } finally {
      if (editingPatternId === id) cancelPatternEdit();
      await load();
    }
  };

  const handleAssign = async () => {
    if (!assignEmployeeId || !assignPatternId) {
      setAssignError("Employee and pattern are required");
      return;
    }
    try {
      setAssignSaving(true);
      setAssignError(null);
      const res = await fetch("/api/schedule/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: assignEmployeeId,
          patternId: assignPatternId,
          effectiveDate: assignEffective,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to assign pattern");
      await load();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign pattern");
    } finally {
      setAssignSaving(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideEmployeeId) {
      setOverrideError("Employee is required");
      return false;
    }
    if (!overrideDate) {
      setOverrideError("Start date is required");
      return false;
    }
    if (overrideIsRange && !overrideEndDate) {
      setOverrideError("End date is required for a range");
      return false;
    }
    if (
      overrideIsRange &&
      overrideEndDate &&
      new Date(overrideEndDate) < new Date(overrideDate)
    ) {
      setOverrideError("End date must be on or after start date");
      return false;
    }
    try {
      setOverrideSaving(true);
      setOverrideError(null);
      const dates: string[] = (() => {
        if (!overrideIsRange || !overrideEndDate) return [overrideDate];
        const start = new Date(overrideDate);
        const end = new Date(overrideEndDate);
        const days: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          days.push(d.toISOString().slice(0, 10));
        }
        return days;
      })();

      for (const day of dates) {
        const res = await fetch("/api/schedule/override", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: overrideEmployeeId,
            shiftId: overrideShiftId ? Number(overrideShiftId) : null,
            workDate: day,
            source: overrideSource,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || `Failed to save override for ${day}`);
        }
      }
      await load();
      // Reset form after applying
      setOverrideEmployeeId("");
      setOverrideShiftId("");
      setOverrideDate("");
      setOverrideEndDate(null);
      setOverrideIsRange(false);
      return true;
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : "Failed to save override");
      return false;
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleCreatePattern = async () => {
    if (!patternCode.trim() || !patternName.trim()) {
      setPatternError("Code and name are required");
      return;
    }
    try {
      setPatternSaving(true);
      setPatternError(null);
      const payload: Record<string, any> = {
        code: patternCode,
        name: patternName,
      };
      Object.entries(dayShifts).forEach(([key, val]) => {
        payload[key] = val ? Number(val) : null;
      });
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create pattern");
      setPatternCode("");
      setPatternName("");
      setDayShifts({
        sunShiftId: "",
        monShiftId: "",
        tueShiftId: "",
        wedShiftId: "",
        thuShiftId: "",
        friShiftId: "",
        satShiftId: "",
      });
      await load();
    } catch (err) {
      setPatternError(err instanceof Error ? err.message : "Failed to create pattern");
    } finally {
      setPatternSaving(false);
    }
  };

  const handleCreateShift = async () => {
    if (!shiftCode.trim() || !shiftName.trim()) {
      setShiftError("Code and name are required");
      return;
    }
    try {
      setShiftSaving(true);
      setShiftError(null);
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: shiftCode,
          name: shiftName,
          startTime: shiftStart,
          endTime: shiftEnd,
          spansMidnight: shiftSpansMidnight,
          breakMinutesUnpaid: shiftBreak,
          paidHoursPerDay: shiftPaidHours,
          notes: shiftNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create shift");
      setShiftCode("");
      setShiftName("");
      setShiftNotes("");
      await load();
    } catch (err) {
      setShiftError(err instanceof Error ? err.message : "Failed to create shift");
    } finally {
      setShiftSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {showSchedule && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Daily Schedule</CardTitle>
              <p className="text-sm text-muted-foreground">
                Resolved shifts per employee for the selected date.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
              <Button size="sm" onClick={load}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Load
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading schedule...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees found.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.employee.employeeId}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {entry.employee.firstName} {entry.employee.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entry.employee.employeeCode} · {entry.employee.department?.name || "—"} ·{" "}
                              {entry.employee.position?.name || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.shift?.name || "Rest day"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.shift ? `${formatMinutes(entry.scheduledStartMinutes)} - ${formatMinutes(entry.scheduledEndMinutes)}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              entry.source === "override" && "border-primary text-primary",
                              entry.source === "none" && "border-muted-foreground/50 text-muted-foreground"
                            )}
                          >
                            {entry.source}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showAssignPattern && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Assign Weekly Pattern</CardTitle>
            <p className="text-sm text-muted-foreground">
              Set a weekly shift pattern effective from a start date.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pattern</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={assignPatternId}
                  onChange={(e) => setAssignPatternId(e.target.value)}
                >
                  <option value="">Select pattern</option>
                  {patterns.map((p) => (
                    <option key={p.id} value={p.id}>
                      {patternLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Effective date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>
                        {makeDate(assignEffective)
                          ? makeDate(assignEffective)?.toLocaleDateString("en-US", { timeZone: TZ })
                          : "Select date"}
                      </span>
                      <CalendarClock className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={makeDate(assignEffective)}
                      onSelect={(value) => {
                        if (!value) {
                          setAssignEffective("");
                          return;
                        }
                        setAssignEffective(value.toLocaleDateString("en-CA", { timeZone: TZ }));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {assignError && <p className="text-sm text-destructive">{assignError}</p>}
            <div className="flex justify-end">
              <Button onClick={handleAssign} disabled={assignSaving}>
                {assignSaving ? "Saving..." : "Assign pattern"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreatePattern && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Create Weekly Pattern</CardTitle>
            <p className="text-sm text-muted-foreground">Choose a shift for each day to reuse in assignments.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input value={patternCode} onChange={(e) => setPatternCode(e.target.value)} placeholder="PAT-WEEKDAY" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={patternName} onChange={(e) => setPatternName(e.target.value)} placeholder="Weekday Pattern" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                { key: "monShiftId", label: "Monday" },
                { key: "tueShiftId", label: "Tuesday" },
                { key: "wedShiftId", label: "Wednesday" },
                { key: "thuShiftId", label: "Thursday" },
                { key: "friShiftId", label: "Friday" },
                { key: "satShiftId", label: "Saturday" },
                { key: "sunShiftId", label: "Sunday" },
              ].map((d) => (
                <div className="space-y-2" key={d.key}>
                  <label className="text-sm font-medium">{d.label}</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={dayShifts[d.key]}
                    onChange={(e) => setDayShifts((prev) => ({ ...prev, [d.key]: e.target.value }))}
                  >
                    <option value="">Rest day</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatMinutes(s.startMinutes)} - {formatMinutes(s.endMinutes)})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {patternError && <p className="text-sm text-destructive">{patternError}</p>}
            <div className="flex justify-end">
              <Button onClick={handleCreatePattern} disabled={patternSaving} className="gap-2">
                <Plus className="h-4 w-4" />
                {patternSaving ? "Saving..." : "Create pattern"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showOverrideForm && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Set Override</CardTitle>
            <p className="text-sm text-muted-foreground">
              Apply a shift or rest day to one date or a range of dates.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={overrideEmployeeId}
                  onChange={(e) => setOverrideEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Shift</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={overrideShiftId}
                  onChange={(e) => setOverrideShiftId(e.target.value)}
                >
                  <option value="">Rest day (no shift)</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatMinutes(s.startMinutes)} - {formatMinutes(s.endMinutes)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Selected dates</p>
                    <p className="text-muted-foreground">
                      {formatRangeLabel(selectedRange)}{" "}
                      {overrideIsRange && overrideEndDate
                        ? `• ${overrideDaysCount} day${overrideDaysCount !== 1 ? "s" : ""}`
                        : "• single day"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOverrideDate("");
                        setOverrideEndDate(null);
                        setOverrideIsRange(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setOverridePickerOpen(true)}>
                      Open calendar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            {overrideError && <p className="text-sm text-destructive">{overrideError}</p>}
            <div className="flex justify-end">
              <Button onClick={handleOverride} disabled={overrideSaving} className="gap-2">
                <CalendarClock className="h-4 w-4" />
                {overrideSaving ? "Saving..." : "Save override"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showOverrideTables && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Overrides</CardTitle>
              <p className="text-sm text-muted-foreground">Current day overrides and upcoming ones.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={load} className="gap-2">
              <RefreshCcw className="h-4 w-4" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Overrides for selected date</p>
              {overridesForDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">No overrides for this date.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[24%] text-left">Employee</TableHead>
                        <TableHead className="w-[18%] text-left">Date</TableHead>
                        <TableHead className="w-[26%] text-left">Shift</TableHead>
                        <TableHead className="w-[16%] text-left">Source</TableHead>
                        <TableHead className="w-[16%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overridesForDay.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="w-[24%]">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {o.employee.firstName} {o.employee.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {o.employee.employeeCode} · {o.employee.department?.name || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-[18%] text-sm text-muted-foreground">
                            {formatDateDisplay(o.workDate)}
                          </TableCell>
                          <TableCell className="w-[26%] text-sm text-muted-foreground">
                            {formatShiftSummary(o.shift)}
                          </TableCell>
                          <TableCell className="w-[16%] text-sm text-muted-foreground">
                            <Badge variant="outline">{o.source}</Badge>
                          </TableCell>
                          <TableCell className="w-[16%] text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => {
                                  setOverrideEmployeeId(o.employee.employeeId);
                                  setOverrideShiftId(o.shift ? String(o.shift.id) : "");
                                  setOverrideDate(toDateInputValue(o.workDate));
                                  setOverrideIsRange(false);
                                  setOverrideEndDate(null);
                                  setEditingOverride(o);
                                  setOverrideEditOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 text-destructive"
                                onClick={async () => {
                                  await fetch(`/api/schedule/override?id=${o.id}`, {
                                    method: "DELETE",
                                  });
                                  await load();
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Upcoming overrides</p>
              {upcomingOverrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming overrides.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[24%] text-left">Employee</TableHead>
                        <TableHead className="w-[18%] text-left">Date</TableHead>
                        <TableHead className="w-[26%] text-left">Shift</TableHead>
                        <TableHead className="w-[16%] text-left">Source</TableHead>
                        <TableHead className="w-[16%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingOverrides.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="w-[24%]">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {o.employee.firstName} {o.employee.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">{o.employee.employeeCode}</span>
                            </div>
                          </TableCell>
                          <TableCell className="w-[18%] text-sm text-muted-foreground">
                            {formatDateDisplay(o.workDate)}
                          </TableCell>
                          <TableCell className="w-[26%] text-sm text-muted-foreground">
                            {formatShiftSummary(o.shift)}
                          </TableCell>
                          <TableCell className="w-[16%] text-sm text-muted-foreground">
                            <Badge variant="outline">{o.source}</Badge>
                          </TableCell>
                          <TableCell className="w-[16%] text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => {
                                  setOverrideEmployeeId(o.employee.employeeId);
                                  setOverrideShiftId(o.shift ? String(o.shift.id) : "");
                                  setOverrideDate(toDateInputValue(o.workDate));
                                  setOverrideIsRange(false);
                                  setOverrideEndDate(null);
                                  setEditingOverride(o);
                                  setOverrideEditOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 text-destructive"
                                onClick={async () => {
                                  await fetch(`/api/schedule/override?id=${o.id}`, {
                                    method: "DELETE",
                                  });
                                  await load();
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showShifts && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Shifts</CardTitle>
              <p className="text-sm text-muted-foreground">Edit existing shifts inline.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={load} className="gap-2">
              <RefreshCcw className="h-4 w-4" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shifts yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Break (min)</TableHead>
                      <TableHead>Paid hrs</TableHead>
                      <TableHead>Spans midnight</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift) => {
                      const isEditing = editingShiftId === shift.id;
                      return (
                        <TableRow key={shift.id}>
                          <TableCell className="text-sm">
                            {isEditing ? (
                              <Input
                                value={shiftEdit?.code ?? ""}
                                onChange={(e) => setShiftEdit((prev) => (prev ? { ...prev, code: e.target.value } : prev))}
                              />
                            ) : (
                              shift.code
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isEditing ? (
                              <Input
                                value={shiftEdit?.name ?? ""}
                                onChange={(e) => setShiftEdit((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                              />
                            ) : (
                              shift.name
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Input
                                  type="time"
                                  value={shiftEdit?.startTime ?? minutesToTimeInput(shift.startMinutes)}
                                  onChange={(e) =>
                                    setShiftEdit((prev) => (prev ? { ...prev, startTime: e.target.value } : prev))
                                  }
                                />
                                <Input
                                  type="time"
                                  value={shiftEdit?.endTime ?? minutesToTimeInput(shift.endMinutes)}
                                  onChange={(e) =>
                                    setShiftEdit((prev) => (prev ? { ...prev, endTime: e.target.value } : prev))
                                  }
                                />
                              </div>
                            ) : (
                              `${formatMinutes(shift.startMinutes)} - ${formatMinutes(shift.endMinutes)}`
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isEditing ? (
                              <Input
                                type="number"
                                min={0}
                                value={shiftEdit?.breakMinutesUnpaid ?? shift.breakMinutesUnpaid ?? 0}
                                onChange={(e) =>
                                  setShiftEdit((prev) =>
                                    prev ? { ...prev, breakMinutesUnpaid: Number(e.target.value) } : prev
                                  )
                                }
                              />
                            ) : (
                              shift.breakMinutesUnpaid ?? 0
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.25"
                                min={0}
                                value={shiftEdit?.paidHoursPerDay ?? shift.paidHoursPerDay ?? 0}
                                onChange={(e) =>
                                  setShiftEdit((prev) =>
                                    prev ? { ...prev, paidHoursPerDay: Number(e.target.value) } : prev
                                  )
                                }
                              />
                            ) : (
                              shift.paidHoursPerDay ?? 0
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={shiftEdit?.spansMidnight ?? false}
                                  onChange={(e) =>
                                    setShiftEdit((prev) =>
                                      prev ? { ...prev, spansMidnight: e.target.checked } : prev
                                    )
                                  }
                                  className="h-4 w-4"
                                />
                                <span className="text-xs text-muted-foreground">Ends next day</span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="uppercase">
                                {shift.spansMidnight ? "Yes" : "No"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={saveShiftEdit} disabled={shiftEditSaving} className="gap-1">
                                  <Check className="h-4 w-4" />
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelShiftEdit} className="gap-1">
                                  <X className="h-4 w-4" />
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" className="gap-2" onClick={() => startShiftEdit(shift)}>
                                  <Pencil className="h-4 w-4" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-2 text-destructive"
                                  onClick={async () => {
                                    await fetch(`/api/shifts?id=${shift.id}`, { method: "DELETE" });
                                    await load();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {shiftEditError && <p className="text-sm text-destructive">{shiftEditError}</p>}
          </CardContent>
        </Card>
      )}

      {showShifts && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Create Shift</CardTitle>
            <p className="text-sm text-muted-foreground">
              Define a shift with start/end times and break details.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input value={shiftCode} onChange={(e) => setShiftCode(e.target.value)} placeholder="DAY-9-6" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={shiftName} onChange={(e) => setShiftName(e.target.value)} placeholder="Day Shift" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start time</label>
                <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End time</label>
                <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unpaid break (minutes)</label>
                <Input
                  type="number"
                  min={0}
                  value={shiftBreak}
                  onChange={(e) => setShiftBreak(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Paid hours per day</label>
                <Input
                  type="number"
                  min={0}
                  step="0.25"
                  value={shiftPaidHours}
                  onChange={(e) => setShiftPaidHours(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Spans midnight</label>
                <div className="flex items-center gap-2">
                  <input
                    id="spans-midnight"
                    type="checkbox"
                    checked={shiftSpansMidnight}
                    onChange={(e) => setShiftSpansMidnight(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="spans-midnight" className="text-sm text-muted-foreground">
                    Ends the next day
                  </label>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <Input value={shiftNotes} onChange={(e) => setShiftNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            {shiftError && <p className="text-sm text-destructive">{shiftError}</p>}
            <div className="flex justify-end">
              <Button onClick={handleCreateShift} disabled={shiftSaving} className="gap-2">
                <Plus className="h-4 w-4" />
                {shiftSaving ? "Saving..." : "Create shift"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showWeeklyPatterns && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Weekly Patterns</CardTitle>
              <p className="text-sm text-muted-foreground">View and edit weekly patterns.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={load} className="gap-2">
              <RefreshCcw className="h-4 w-4" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patterns yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[10%]">Code</TableHead>
                      <TableHead className="w-[14%]">Name</TableHead>
                      <TableHead className="w-[8%]">Mon</TableHead>
                      <TableHead className="w-[8%]">Tue</TableHead>
                      <TableHead className="w-[8%]">Wed</TableHead>
                      <TableHead className="w-[8%]">Thu</TableHead>
                      <TableHead className="w-[8%]">Fri</TableHead>
                      <TableHead className="w-[8%]">Sat</TableHead>
                      <TableHead className="w-[8%]">Sun</TableHead>
                      <TableHead className="w-[16%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patterns.map((p) => {
                      const shiftLabel = (shiftId: number | null) => {
                        if (!shiftId) return "Rest day";
                        const s = shifts.find((sh) => sh.id === shiftId);
                        return s ? s.name : "Rest day";
                      };
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{p.code}</TableCell>
                          <TableCell className="text-sm">{p.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shiftLabel(p.monShiftId)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shiftLabel(p.tueShiftId)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shiftLabel(p.wedShiftId)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shiftLabel(p.thuShiftId)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shiftLabel(p.friShiftId)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shiftLabel(p.satShiftId)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shiftLabel(p.sunShiftId)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-destructive"
                                onClick={() => deletePattern(p.id)}
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </Button>
                              <Button size="sm" variant="ghost" className="gap-2" onClick={() => startPatternEdit(p)}>
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          {patternEditError && <p className="text-sm text-destructive">{patternEditError}</p>}
        </CardContent>
        </Card>
      )}

      <Dialog open={patternEditOpen} onOpenChange={(open) => (open ? setPatternEditOpen(true) : cancelPatternEdit())}>
        <DialogContent className="w-[95vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit weekly pattern</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={patternEdit?.code ?? ""}
                  onChange={(e) =>
                    setPatternEdit((prev) => (prev ? { ...prev, code: e.target.value } : prev))
                  }
                  placeholder="PAT-WEEKDAY"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={patternEdit?.name ?? ""}
                  onChange={(e) =>
                    setPatternEdit((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                  placeholder="Weekday Pattern"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                { key: "monShiftId", label: "Monday" },
                { key: "tueShiftId", label: "Tuesday" },
                { key: "wedShiftId", label: "Wednesday" },
                { key: "thuShiftId", label: "Thursday" },
                { key: "friShiftId", label: "Friday" },
                { key: "satShiftId", label: "Saturday" },
                { key: "sunShiftId", label: "Sunday" },
              ].map((d) => (
                <div className="space-y-2" key={d.key}>
                  <label className="text-sm font-medium">{d.label}</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={patternEdit?.dayShifts[d.key] ?? ""}
                    onChange={(e) =>
                      setPatternEdit((prev) =>
                        prev ? { ...prev, dayShifts: { ...prev.dayShifts, [d.key]: e.target.value } } : prev
                      )
                    }
                  >
                    <option value="">Rest day</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatMinutes(s.startMinutes)} - {formatMinutes(s.endMinutes)})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {patternEditError && <p className="text-sm text-destructive">{patternEditError}</p>}
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              className="gap-2 text-destructive"
              disabled={patternEditSaving || !editingPatternId}
              onClick={async () => {
                if (!editingPatternId) return;
                await deletePattern(editingPatternId);
                cancelPatternEdit();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="ghost" onClick={cancelPatternEdit} disabled={patternEditSaving}>
                Cancel
              </Button>
              <Button onClick={savePatternEdit} disabled={patternEditSaving || !patternEdit}>
                {patternEditSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overridePickerOpen}
        onOpenChange={(open) => setOverridePickerOpen(open)}
      >
        <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Pick override dates</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[75vh] overflow-y-auto">
            <div className="rounded-md border bg-background overflow-auto">
              <Calendar
                className="p-3 w-full min-w-[900px] max-w-[1100px] mx-auto"
                mode="range"
                numberOfMonths={2}
                showOutsideDays
                selected={selectedRange}
                onSelect={(value) => {
                  if (!value) {
                    setOverrideDate("");
                    setOverrideEndDate(null);
                    setOverrideIsRange(false);
                    return;
                  }
                  if (value.from) {
                    setOverrideDate(value.from.toLocaleDateString("en-CA", { timeZone: TZ }));
                  }
                  if (value.to) {
                    setOverrideEndDate(value.to.toLocaleDateString("en-CA", { timeZone: TZ }));
                    setOverrideIsRange(true);
                  } else {
                    setOverrideEndDate(null);
                    setOverrideIsRange(false);
                  }
                }}
                initialFocus
              />
            </div>
            <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
              <span>
                {selectedRange.from
                  ? selectedRange.from.toLocaleDateString("en-US", { timeZone: TZ })
                  : "Start"}{" "}
                →{" "}
                {selectedRange.to
                  ? selectedRange.to.toLocaleDateString("en-US", { timeZone: TZ })
                  : "End"}
              </span>
              <span>
                {overrideIsRange && overrideEndDate
                  ? `${overrideDaysCount} day${overrideDaysCount !== 1 ? "s" : ""}`
                  : "Single day"}
              </span>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <Button
              variant="ghost"
              onClick={() => {
                setOverrideDate("");
                setOverrideEndDate(null);
                setOverrideIsRange(false);
              }}
            >
              Clear selection
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOverridePickerOpen(false)}>
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overrideEditOpen}
        onOpenChange={(open) => {
          setOverrideEditOpen(open);
          if (!open) setEditingOverride(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit override</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-medium">
                {editingOverride?.employee.firstName} {editingOverride?.employee.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{editingOverride?.employee.employeeCode}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Shift</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={overrideShiftId}
                onChange={(e) => setOverrideShiftId(e.target.value)}
              >
                <option value="">Rest day (no shift)</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatMinutes(s.startMinutes)} - {formatMinutes(s.endMinutes)})
                  </option>
                ))}
              </select>
            </div>
            {overrideError && <p className="text-sm text-destructive">{overrideError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setOverrideEditOpen(false);
                setEditingOverride(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const ok = await handleOverride();
                if (ok) {
                  setOverrideEditOpen(false);
                  setEditingOverride(null);
                }
              }}
              disabled={overrideSaving}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              {overrideSaving ? "Saving..." : "Update override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
