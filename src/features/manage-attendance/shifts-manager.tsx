"use client";

import {
  createShift,
  deleteShift as deleteShiftAction,
  listShifts,
  updateShift,
} from "@/actions/schedule/shifts-action";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { RefreshCcw, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";

type ShiftRow = {
  id: number;
  code: string;
  name: string;
  colorHex?: string | null;
  isDayOff?: boolean;
  startMinutes: number;
  endMinutes: number;
  spansMidnight: boolean;
  breakStartMinutes?: number | null;
  breakEndMinutes?: number | null;
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

const minutesToInput = (minutes: number | null | undefined) => {
  if (minutes == null) return "";
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const inputToMinutes = (value?: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const computeDerived = (
  startTime: string,
  endTime: string,
  spansMidnight: boolean,
  breakStartTime?: string,
  breakEndTime?: string
) => {
  const start = inputToMinutes(startTime);
  const end = inputToMinutes(endTime);
  if (start == null || end == null)
    return { breakMinutes: 0, paidHours: 0, totalMinutes: 0 };

  let totalMinutes =
    spansMidnight && end <= start ? end + 24 * 60 - start : end - start;
  if (totalMinutes < 0) totalMinutes = 0;

  const bStart = inputToMinutes(breakStartTime);
  const bEnd = inputToMinutes(breakEndTime);
  let breakMinutes = 0;
  if (bStart != null && bEnd != null) {
    let endVal = bEnd;
    if (spansMidnight && bEnd <= bStart) {
      endVal += 24 * 60;
    }
    breakMinutes = Math.max(0, Math.min(totalMinutes, endVal - bStart));
  }

  const paidHours =
    totalMinutes > 0
      ? Number(((totalMinutes - breakMinutes) / 60).toFixed(2))
      : 0;

  return { breakMinutes, paidHours, totalMinutes };
};

export function ShiftsManager() {
  const toast = useToast();
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [isDayOff, setIsDayOff] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakStartTime, setBreakStartTime] = useState("");
  const [breakEndTime, setBreakEndTime] = useState("");
  const [spansMidnight, setSpansMidnight] = useState(false);
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
    breakStartTime: "",
    breakEndTime: "",
    spansMidnight: false,
    colorHex: "",
    isDayOff: false,
    notes: "",
  });
  const hasDayOffShift = useMemo(
    () => rows.some((row) => row.isDayOff),
    [rows],
  );

  const derivedCreate = isDayOff
    ? { breakMinutes: 0, paidHours: 0, totalMinutes: 0 }
    : computeDerived(
        startTime,
        endTime,
        spansMidnight,
        breakStartTime,
        breakEndTime,
      );
  const derivedEdit = editForm.isDayOff
    ? { breakMinutes: 0, paidHours: 0, totalMinutes: 0 }
    : computeDerived(
        editForm.startTime,
        editForm.endTime,
        editForm.spansMidnight,
        editForm.breakStartTime,
        editForm.breakEndTime,
      );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listShifts();
      if (!result.success) {
        throw new Error(result.error || "Failed to load shifts");
      }
      setRows(result.data ?? []);
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
    setColorHex("");
    setIsDayOff(false);
    setStartTime("09:00");
    setEndTime("18:00");
    setBreakStartTime("");
    setBreakEndTime("");
    setSpansMidnight(false);
    setNotes("");
    setFormError(null);
  };

  const handleSave = async () => {
    if (!isDayOff && (!code.trim() || !name.trim())) {
      setFormError("Code and name are required");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        code,
        name,
        colorHex,
        isDayOff,
        startTime,
        endTime,
        breakStartTime,
        breakEndTime,
        spansMidnight,
        notes,
      };
      const result = await createShift(payload);
      if (!result.success) {
        throw new Error(result.error || "Failed to save shift");
      }
      resetForm();
      await load();
      toast.success("Shift created successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save shift";
      setFormError(message);
      toast.error("Failed to save shift.", {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: ShiftRow) => {
    setEditingId(row.id);
    setEditForm({
      code: row.code,
      name: row.name,
      colorHex: row.colorHex ?? "",
      isDayOff: Boolean(row.isDayOff),
      startTime: minutesToInput(row.startMinutes),
      endTime: minutesToInput(row.endMinutes),
      breakStartTime: minutesToInput(row.breakStartMinutes ?? null),
      breakEndTime: minutesToInput(row.breakEndMinutes ?? null),
      spansMidnight: row.spansMidnight,
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
      breakStartTime: "",
      breakEndTime: "",
      spansMidnight: false,
      colorHex: "",
      isDayOff: false,
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
    if (!editForm.isDayOff && (!editForm.code.trim() || !editForm.name.trim())) {
      setEditError("Code and name are required");
      return;
    }
    try {
      setEditSaving(true);
      setEditError(null);
      const result = await updateShift({
        id: editingId,
        ...editForm,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update shift");
      }
      resetEdit();
      await load();
      toast.success("Shift updated successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update shift";
      setEditError(message);
      toast.error("Failed to update shift.", {
        description: message,
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteShift = async (id: number) => {
    try {
      const result = await deleteShiftAction(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to archive shift");
      }
      if (editingId === id) resetEdit();
      await load();
      toast.success("Shift archived successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to archive shift";
      setError(message);
      setEditError(message);
      toast.error("Failed to archive shift.", {
        description: message,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Available Shifts</CardTitle>
            <p className="text-sm text-muted-foreground">
              View all shifts you can assign or use in patterns.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            aria-label="Reload"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <TableLoadingState label="Loading shifts" columns={7} rows={4} />
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
                    <TableHead className="w-[18%]">Break window</TableHead>
                    <TableHead className="w-[12%]">Paid hours</TableHead>
                    <TableHead className="w-[12%]">Type</TableHead>
                    <TableHead className="w-[18%]">Notes</TableHead>
                    <TableHead className="w-[8%] text-right">Color</TableHead>
                    <TableHead className="w-[14%] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {minutesToTime(row.startMinutes)} -{" "}
                        {minutesToTime(row.endMinutes)}
                        {row.spansMidnight && (
                          <Badge variant="outline" className="ml-2">
                            Next day
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.breakStartMinutes != null &&
                        row.breakEndMinutes != null ? (
                          <div className="space-y-0.5">
                            <div>
                              {minutesToTime(row.breakStartMinutes)} –{" "}
                              {minutesToTime(row.breakEndMinutes)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Unpaid {row.breakMinutesUnpaid} mins
                            </div>
                          </div>
                        ) : (
                          `${row.breakMinutesUnpaid} mins`
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.paidHoursPerDay} hrs
                      </TableCell>
                      <TableCell>
                        {row.isDayOff ? (
                          <Badge>Day Off</Badge>
                        ) : (
                          <Badge variant="outline">Work</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.colorHex ? (
                          <div
                            className="ml-auto h-6 w-10 rounded border"
                            style={{ backgroundColor: row.colorHex }}
                          />
                        ) : (
                          "—"
                        )}
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
                            onClick={async () => handleDeleteShift(row.id)}
                          >
                            <Trash2 className="h-4 w-4" /> Archive
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
          <p className="text-sm text-muted-foreground">
            Define reusable shift, optional color, or singleton Day Off shift.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DAY-9-6"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Day Shift"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <ColorPicker value={colorHex} onChange={setColorHex} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex items-center gap-2">
                <input
                  id="create-is-day-off-shift"
                  type="checkbox"
                  checked={isDayOff}
                  disabled={hasDayOffShift}
                  onChange={(e) => setIsDayOff(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="create-is-day-off-shift" className="text-sm text-muted-foreground">
                  Mark as singleton Day Off shift
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start time</label>
              <Input
                type="time"
                value={startTime}
                disabled={isDayOff}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End time</label>
              <Input
                type="time"
                value={endTime}
                disabled={isDayOff}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Break start</label>
              <Input
                type="time"
                value={breakStartTime}
                disabled={isDayOff}
                onChange={(e) => setBreakStartTime(e.target.value)}
                placeholder="14:00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Break end</label>
              <Input
                type="time"
                value={breakEndTime}
                disabled={isDayOff}
                onChange={(e) => setBreakEndTime(e.target.value)}
                placeholder="15:00"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="text-sm text-muted-foreground">
                Unpaid break:{" "}
                <span className="font-medium text-foreground">
                  {derivedCreate.breakMinutes} mins
                </span>{" "}
                • Paid hours per day:{" "}
                <span className="font-medium text-foreground">
                  {derivedCreate.paidHours}
                </span>{" "}
                (auto-calculated)
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Spans midnight</label>
              <div className="flex items-center gap-2">
                <input
                  id="spans-midnight-shift"
                  type="checkbox"
                  checked={spansMidnight}
                  disabled={isDayOff}
                  onChange={(e) => setSpansMidnight(e.target.checked)}
                  className="h-4 w-4"
                />
                <label
                  htmlFor="spans-midnight-shift"
                  className="text-sm text-muted-foreground"
                >
                  Ends next day
                </label>
              </div>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <p className="text-xs text-muted-foreground">
            {hasDayOffShift
              ? "Day Off shift already exists. Edit/archive that one if you need to change it."
              : "No Day Off shift yet. Use checkbox above to create one."}
          </p>
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
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="DAY-9-6"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Day Shift"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <ColorPicker
                value={editForm.colorHex}
                onChange={(value) =>
                  setEditForm((f) => ({ ...f, colorHex: value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-is-day-off-shift"
                  type="checkbox"
                  checked={editForm.isDayOff}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      isDayOff: e.target.checked,
                      startTime: e.target.checked ? "00:00" : f.startTime,
                      endTime: e.target.checked ? "00:00" : f.endTime,
                      breakStartTime: e.target.checked ? "" : f.breakStartTime,
                      breakEndTime: e.target.checked ? "" : f.breakEndTime,
                      spansMidnight: e.target.checked ? false : f.spansMidnight,
                    }))
                  }
                  className="h-4 w-4"
                />
                <label htmlFor="edit-is-day-off-shift" className="text-sm text-muted-foreground">
                  Mark as singleton Day Off shift
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start time</label>
              <Input
                type="time"
                value={editForm.startTime}
                disabled={editForm.isDayOff}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, startTime: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End time</label>
              <Input
                type="time"
                value={editForm.endTime}
                disabled={editForm.isDayOff}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, endTime: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Break start</label>
              <Input
                type="time"
                value={editForm.breakStartTime}
                disabled={editForm.isDayOff}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, breakStartTime: e.target.value }))
                }
                placeholder="14:00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Break end</label>
              <Input
                type="time"
                value={editForm.breakEndTime}
                disabled={editForm.isDayOff}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, breakEndTime: e.target.value }))
                }
                placeholder="15:00"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="text-sm text-muted-foreground">
                Unpaid break:{" "}
                <span className="font-medium text-foreground">
                  {derivedEdit.breakMinutes} mins
                </span>{" "}
                • Paid hours per day:{" "}
                <span className="font-medium text-foreground">
                  {derivedEdit.paidHours}
                </span>{" "}
                (auto-calculated)
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, notes: e.target.value }))
                }
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
                  disabled={editForm.isDayOff}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      spansMidnight: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                <label
                  htmlFor="edit-spans-midnight"
                  className="text-sm text-muted-foreground"
                >
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
                await handleDeleteShift(editingId);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Archive
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
