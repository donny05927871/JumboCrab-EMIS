"use client";

import { useEffect, useState } from "react";
import { TZ } from "@/lib/timezone";

export type AttendanceRow = {
  id: string;
  workDate: string;
  status: string;
  scheduledStartMinutes?: number | null;
  scheduledEndMinutes?: number | null;
  actualInAt?: string | null;
  actualOutAt?: string | null;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  overtimeMinutesRaw?: number | null;
  breakMinutes?: number | null;
  breakCount?: number | null;
  punchesCount?: number | null;
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

export type PunchRow = {
  id: string;
  punchType: string;
  punchTime: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  } | null;
};

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

export function useAttendanceState(initialDate = todayISO()) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [date, setDate] = useState(initialDate);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setPunchError(null);
      setLockMessage(null);
      const params = new URLSearchParams({
        start: date,
        end: date,
        includeAll: "true",
      });
      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load attendance");
      setRows(json?.data ?? []);
      const punchRes = await fetch(`/api/attendance/punches?start=${date}`);
      const punchJson = await punchRes.json();
      if (!punchRes.ok) throw new Error(punchJson?.error || "Failed to load punches");
      setPunches(punchJson?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
      setPunchError(err instanceof Error ? err.message : "Failed to load punches");
      setPunches([]);
    } finally {
      setLoading(false);
    }
  };

  const lockDay = async () => {
    try {
      setLockLoading(true);
      setLockMessage(null);
      const res = await fetch("/api/attendance/auto-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to lock attendance");
      setLockMessage(
        `Locked ${json?.lockedCount ?? 0} attendance row(s) for ${date}.`
      );
      await load();
    } catch (err) {
      setLockMessage(
        err instanceof Error ? err.message : "Failed to lock attendance"
      );
    } finally {
      setLockLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    rows,
    loading,
    error,
    punchError,
    date,
    punches,
    lockLoading,
    lockMessage,
    setDate,
    setPunchError,
    load,
    lockDay,
  };
}
