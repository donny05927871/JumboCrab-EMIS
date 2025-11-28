"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, CalendarClock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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

const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const formatMinutes = (minutes: number | null) => {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export function ScheduleBoard() {
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [shifts, setShifts] = useState<ShiftLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignPatternId, setAssignPatternId] = useState("");
  const [assignEffective, setAssignEffective] = useState(todayISO());
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [overrideEmployeeId, setOverrideEmployeeId] = useState("");
  const [overrideShiftId, setOverrideShiftId] = useState<string>("");
  const [overrideDate, setOverrideDate] = useState(todayISO());
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const overrideSource = "MANUAL";

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

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/schedule?date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load schedule");
      setEntries(json?.schedule ?? []);
      setPatterns(json?.patterns ?? []);
      setShifts(json?.shifts ?? []);
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

  const patternLabel = (p: Pattern) => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const first = days
      .map((d) => (p as any)[`${d}Shift`] as ShiftLite | undefined | null)
      .find((s) => s);
    return `${p.name}${first ? ` • ${first.name}` : ""}`;
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
      return;
    }
    try {
      setOverrideSaving(true);
      setOverrideError(null);
      const res = await fetch("/api/schedule/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: overrideEmployeeId,
          shiftId: overrideShiftId ? Number(overrideShiftId) : null,
          workDate: overrideDate,
          source: overrideSource,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save override");
      await load();
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : "Failed to save override");
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
      // reset fields
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
              <Input
                type="date"
                value={assignEffective}
                onChange={(e) => setAssignEffective(e.target.value)}
                className="w-full"
              />
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Set Daily Override</CardTitle>
          <p className="text-sm text-muted-foreground">
            Override a single day with a specific shift or rest day.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
                className="w-full"
              />
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
    </div>
  );
}
