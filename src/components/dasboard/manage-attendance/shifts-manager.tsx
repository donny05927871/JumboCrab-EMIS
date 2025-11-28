"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ShiftRow = {
  id: number;
  code: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  spansMidnight: boolean;
  breakMinutesUnpaid: number;
  paidHoursPerDay: string;
  notes?: string | null;
};

const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export function ShiftsManager() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [spansMidnight, setSpansMidnight] = useState(false);
  const [breakMinutesUnpaid, setBreakMinutesUnpaid] = useState(60);
  const [paidHoursPerDay, setPaidHoursPerDay] = useState(8);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/shifts");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load shifts");
      setRows(json?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!code.trim() || !name.trim()) {
      setFormError("Code and name are required");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          startTime,
          endTime,
          spansMidnight,
          breakMinutesUnpaid,
          paidHoursPerDay,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create shift");
      setCode("");
      setName("");
      setNotes("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create shift");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Available Shifts</CardTitle>
            <p className="text-sm text-muted-foreground">View all shifts you can assign or use in patterns.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={load} aria-label="Reload">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading shifts...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Paid hours</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {minutesToTime(row.startMinutes)} - {minutesToTime(row.endMinutes)}
                        {row.spansMidnight && <Badge variant="outline" className="ml-2">Next day</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.breakMinutesUnpaid} mins
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.paidHoursPerDay} hrs
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.notes || "—"}
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
          <CardTitle className="text-lg">Create Shift</CardTitle>
          <p className="text-sm text-muted-foreground">Define a reusable shift.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DAY-9-6" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Day Shift" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Unpaid break (minutes)</label>
              <Input
                type="number"
                min={0}
                value={breakMinutesUnpaid}
                onChange={(e) => setBreakMinutesUnpaid(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Paid hours per day</label>
              <Input
                type="number"
                min={0}
                step="0.25"
                value={paidHoursPerDay}
                onChange={(e) => setPaidHoursPerDay(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Spans midnight</label>
              <div className="flex items-center gap-2">
                <input
                  id="spans-midnight-shift"
                  type="checkbox"
                  checked={spansMidnight}
                  onChange={(e) => setSpansMidnight(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="spans-midnight-shift" className="text-sm text-muted-foreground">
                  Ends next day
                </label>
              </div>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Saving..." : "Create shift"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
