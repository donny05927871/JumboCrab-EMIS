"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const totalMinutes = minutes % (24 * 60);
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    code: "",
    name: "",
    startTime: "09:00",
    endTime: "18:00",
    spansMidnight: false,
    breakMinutesUnpaid: 0,
    paidHoursPerDay: 0,
    notes: "",
  });

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

  const resetForm = () => {
    setCode("");
    setName("");
    setStartTime("09:00");
    setEndTime("18:00");
    setSpansMidnight(false);
    setBreakMinutesUnpaid(60);
    setPaidHoursPerDay(8);
    setNotes("");
    setFormError(null);
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      setFormError("Code and name are required");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        code,
        name,
        startTime,
        endTime,
        spansMidnight,
        breakMinutesUnpaid,
        paidHoursPerDay,
        notes,
      };
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save shift");
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: ShiftRow) => {
    setEditingId(row.id);
    setEditForm({
      code: row.code,
      name: row.name,
      startTime: minutesToTime(row.startMinutes),
      endTime: minutesToTime(row.endMinutes),
      spansMidnight: row.spansMidnight,
      breakMinutesUnpaid: row.breakMinutesUnpaid,
      paidHoursPerDay: Number(row.paidHoursPerDay),
      notes: row.notes || "",
    });
    setEditError(null);
    setEditOpen(true);
  };

  const resetEdit = () => {
    setEditingId(null);
    setEditForm({
      code: "",
      name: "",
      startTime: "09:00",
      endTime: "18:00",
      spansMidnight: false,
      breakMinutesUnpaid: 0,
      paidHoursPerDay: 0,
      notes: "",
    });
    setEditError(null);
    setEditOpen(false);
  };

  const saveEdit = async () => {
    if (!editingId) {
      setEditError("No shift selected");
      return;
    }
    if (!editForm.code.trim() || !editForm.name.trim()) {
      setEditError("Code and name are required");
      return;
    }
    try {
      setEditSaving(true);
      setEditError(null);
      const res = await fetch("/api/shifts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update shift");
      resetEdit();
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update shift");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteShift = async (id: number) => {
    await fetch(`/api/shifts?id=${id}`, { method: "DELETE" });
    if (editingId === id) resetEdit();
    await load();
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
                      <TableHead className="w-[14%]">Code</TableHead>
                      <TableHead className="w-[20%]">Name</TableHead>
                      <TableHead className="w-[20%]">Time</TableHead>
                      <TableHead className="w-[12%]">Break</TableHead>
                      <TableHead className="w-[12%]">Paid hours</TableHead>
                      <TableHead className="w-[18%]">Notes</TableHead>
                      <TableHead className="w-[14%] text-right">Actions</TableHead>
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
                        <TableCell className="text-right text-sm">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2 text-destructive"
                              onClick={async () => deleteShift(row.id)}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                          </div>
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
          <div className="flex justify-end gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Saving..." : "Create shift"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) resetEdit();
          else setEditOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit shift</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input
                value={editForm.code}
                onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="DAY-9-6"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Day Shift"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start time</label>
              <Input
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End time</label>
              <Input
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Unpaid break (minutes)</label>
              <Input
                type="number"
                min={0}
                value={editForm.breakMinutesUnpaid}
                onChange={(e) => setEditForm((f) => ({ ...f, breakMinutesUnpaid: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Paid hours per day</label>
              <Input
                type="number"
                min={0}
                step="0.25"
                value={editForm.paidHoursPerDay}
                onChange={(e) => setEditForm((f) => ({ ...f, paidHoursPerDay: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Spans midnight</label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-spans-midnight"
                  type="checkbox"
                  checked={editForm.spansMidnight}
                  onChange={(e) => setEditForm((f) => ({ ...f, spansMidnight: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor="edit-spans-midnight" className="text-sm text-muted-foreground">
                  Ends next day
                </label>
              </div>
            </div>
          </div>
          {editError && <p className="text-sm text-destructive">{editError}</p>}
          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              className="gap-2 text-destructive"
              disabled={editSaving || !editingId}
              onClick={async () => {
                if (!editingId) return;
                await deleteShift(editingId);
                resetEdit();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="ghost" onClick={resetEdit} disabled={editSaving}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
