"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCcw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type AttendanceRow = {
  id: string;
  workDate: string;
  status: string;
  scheduledStartMinutes?: number | null;
  scheduledEndMinutes?: number | null;
  actualInAt?: string | null;
  actualOutAt?: string | null;
  lateMinutes?: number | null;
  overtimeMinutesRaw?: number | null;
  breakMinutes?: number | null;
  breakCount?: number | null;
  expectedShiftName?: string | null;
  employeeId: string;
  employee?: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  } | null;
};

const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
};

const formatMinutesToTime = (minutes: number | null | undefined, asClock = true) => {
  if (minutes == null) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (asClock) return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  const parts = [];
  if (hrs) parts.push(`${hrs} hr${hrs === 1 ? "" : "s"}`);
  if (mins || !hrs) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
  return parts.join(" ");
};

const formatMinutesToClock12 = (minutes: number) => {
  const totalHours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hrs12 = ((totalHours + 11) % 12) + 1;
  const ampm = totalHours >= 12 ? "PM" : "AM";
  return `${hrs12.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${ampm}`;
};

export function DailyAttendance() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ start: date, end: date, includeAll: "true" });
      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load attendance");
      setRows(json?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return rows.filter((row) => {
      const empName = `${row.employee?.firstName || ""} ${row.employee?.lastName || ""}`
        .trim()
        .toLowerCase();
      const empCode = row.employee?.employeeCode?.toLowerCase() || "";
      const dept = row.employee?.department?.name?.toLowerCase() || "";
      const pos = row.employee?.position?.name?.toLowerCase() || "";
      const deptMatch = deptFilter ? row.employee?.department?.name === deptFilter : true;
      if (!deptMatch) return false;
      if (!term) return true;
      return (
        empName.includes(term) ||
        empCode.includes(term) ||
        dept.includes(term) ||
        pos.includes(term) ||
        row.status.toLowerCase().includes(term)
      );
    });
  }, [rows, filter, deptFilter]);

  const deptOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.employee?.department?.name) set.add(r.employee.department.name);
    });
    return Array.from(set).sort();
  }, [rows]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Daily Attendance</CardTitle>
          <p className="text-sm text-muted-foreground">
            View attendance for a single day.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button onClick={load} size="sm" className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Load
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search by name, code, department"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-72"
          />
          <div className="flex items-center gap-2">
            <select
              className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All departments</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setDate(todayISO())}>
              <RotateCcw className="h-4 w-4" /> Today
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading attendance...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                    <TableHead>Time in</TableHead>
                    <TableHead>Breaks</TableHead>
                    <TableHead>Time out</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Expected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={`${row.employeeId}-${row.workDate}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {row.employee?.firstName} {row.employee?.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.employee?.employeeCode} · {row.employee?.department?.name || "—"} ·{" "}
                          {row.employee?.position?.name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "PRESENT" ? "secondary" : "outline"}
                        className={cn(
                          "uppercase tracking-wide",
                          row.status === "ABSENT" && "border-destructive text-destructive",
                          row.status === "LATE" && "border-amber-500 text-amber-600"
                        )}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(row.actualInAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.breakMinutes != null
                        ? `${formatMinutesToTime(row.breakMinutes, false)}${row.breakCount ? ` (${row.breakCount}x)` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(row.actualOutAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lateMinutes != null ? formatMinutesToTime(row.lateMinutes, false) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.overtimeMinutesRaw != null ? formatMinutesToTime(row.overtimeMinutesRaw, false) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.scheduledStartMinutes != null && row.scheduledEndMinutes != null ? (
                        <div className="flex flex-col">
                          <span>
                            {formatMinutesToClock12(row.scheduledStartMinutes)} -{" "}
                            {formatMinutesToClock12(row.scheduledEndMinutes)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.expectedShiftName || "Expected shift"}
                          </span>
                        </div>
                      ) : row.expectedShiftName ? (
                        <span>{row.expectedShiftName}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
