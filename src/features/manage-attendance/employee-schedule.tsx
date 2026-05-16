"use client";

import { useEffect, useMemo, useState } from "react";
import {
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Calendar as BigCalendar,
  Views,
  dateFnsLocalizer,
  type SlotInfo,
} from "react-big-calendar";
import {
  CalendarDays,
  Clock3,
  Settings2,
  Sparkles,
} from "lucide-react";
import { getEmployeeMonthSchedule } from "@/actions/schedule/schedule-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InlineLoadingState,
  ModuleLoadingState,
} from "@/components/loading/loading-states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSession } from "@/hooks/use-session";
import { TZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type EmployeeMonthScheduleDay = {
  date: string;
  shift: {
    id: number;
    code: string;
    name: string;
    colorHex?: string | null;
    isDayOff?: boolean;
    startMinutes: number;
    endMinutes: number;
    spansMidnight: boolean;
    breakStartMinutes: number | null;
    breakEndMinutes: number | null;
    breakMinutesUnpaid: number;
    paidHoursPerDay: string;
    notes: string | null;
  } | null;
  source: "override" | "weekly_schedule" | "none";
  leave: {
    requestId: string | null;
    leaveType: "VACATION" | "SICK" | "PERSONAL" | "EMERGENCY" | "UNPAID";
    isPaidLeave: boolean;
  } | null;
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
};

type ScheduleCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: EmployeeMonthScheduleDay;
};

type CalendarEventRendererProps = {
  event: ScheduleCalendarEvent;
};

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const getNowInTz = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

const toIsoDate = (date: Date) => {
  const safeDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
  );
  return safeDate.toLocaleDateString("en-CA", { timeZone: TZ });
};

const parseIsoDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const minutesToDate = (baseDate: Date, minutes: number) => {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date;
};

const formatMinutes = (minutes: number | null | undefined) => {
  if (minutes == null) return "—";
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const formatLongDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const sourceLabelMap: Record<EmployeeMonthScheduleDay["source"], string> = {
  override: "Manual override",
  weekly_schedule: "Weekly schedule",
  none: "No source",
};

const leaveTypeLabelMap: Record<
  NonNullable<EmployeeMonthScheduleDay["leave"]>["leaveType"],
  string
> = {
  VACATION: "Vacation leave",
  SICK: "Sick leave",
  PERSONAL: "Personal leave",
  EMERGENCY: "Emergency leave",
  UNPAID: "Unpaid leave",
};

const shiftCalendarStyle = (shift?: EmployeeMonthScheduleDay["shift"] | null) =>
  shift?.colorHex
    ? {
        borderColor: shift.colorHex,
        backgroundColor: `${shift.colorHex}1A`,
        color: shift.colorHex,
      }
    : undefined;

const monthNameFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: TZ,
  month: "long",
});

const buildYearOptions = (centerYear: number, span = 5) =>
  Array.from({ length: span * 2 + 1 }, (_, index) => centerYear - span + index);

const monthOptions = Array.from({ length: 12 }, (_, monthIndex) => ({
  value: String(monthIndex),
  label: monthNameFormatter.format(new Date(2026, monthIndex, 1)),
}));

const sourceBadgeClassName = (source: EmployeeMonthScheduleDay["source"]) =>
  source === "override"
    ? "employee-schedule-status-badge--override"
    : "employee-schedule-status-badge--neutral";

const EmployeeScedule = () => {
  const { user, employee, loading, error } = useSession();
  const initialMonth = useMemo(() => {
    const now = getNowInTz();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const [viewedMonth, setViewedMonth] = useState<Date>(initialMonth);
  const currentMonthAnchor = useMemo(
    () => toIsoDate(viewedMonth),
    [viewedMonth],
  );
  const currentMonthLabel = useMemo(
    () =>
      viewedMonth.toLocaleDateString(undefined, {
        timeZone: TZ,
        month: "long",
        year: "numeric",
      }),
    [viewedMonth],
  );
  const yearOptions = useMemo(
    () => buildYearOptions(viewedMonth.getFullYear()),
    [viewedMonth],
  );
  const viewedMonthStart = useMemo(() => startOfMonth(viewedMonth), [viewedMonth]);
  const viewedMonthEnd = useMemo(() => endOfMonth(viewedMonth), [viewedMonth]);

  const [selectedDate, setSelectedDate] = useState<Date>(() => getNowInTz());
  const [days, setDays] = useState<EmployeeMonthScheduleDay[]>([]);
  const [todayDay, setTodayDay] = useState<EmployeeMonthScheduleDay | null>(
    null,
  );
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [hasLoadedMonth, setHasLoadedMonth] = useState(false);

  const todayKey = useMemo(() => toIsoDate(getNowInTz()), []);

  useEffect(() => {
    const employeeId = employee?.employeeId;
    if (!employeeId) {
      setDays([]);
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        setMonthLoading(true);
        setMonthError(null);
        const result = await getEmployeeMonthSchedule({
          employeeId,
          anchorDate: currentMonthAnchor,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to load schedule");
        }
        if (!mounted) return;
        setDays((result.days ?? []) as EmployeeMonthScheduleDay[]);
        setTodayDay(
          (result.todayDay ?? null) as EmployeeMonthScheduleDay | null,
        );
      } catch (err) {
        if (!mounted) return;
        setMonthError(
          err instanceof Error ? err.message : "Failed to load schedule",
        );
      } finally {
        if (mounted) {
          setMonthLoading(false);
          setHasLoadedMonth(true);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [employee?.employeeId, currentMonthAnchor]);

  useEffect(() => {
    if (isBefore(selectedDate, viewedMonthStart)) {
      setSelectedDate(viewedMonthStart);
      return;
    }
    if (isAfter(selectedDate, viewedMonthEnd)) {
      setSelectedDate(viewedMonthEnd);
    }
  }, [selectedDate, viewedMonthEnd, viewedMonthStart]);

  const daysByDate = useMemo(() => {
    const map = new Map<string, EmployeeMonthScheduleDay>();
    days.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [days]);

  const selectedDateKey = useMemo(
    () => toIsoDate(selectedDate),
    [selectedDate],
  );
  const selectedDay = daysByDate.get(selectedDateKey);
  const todaySchedule = daysByDate.get(todayKey) ?? todayDay ?? undefined;

  const DaySquareEvent = ({ event }: CalendarEventRendererProps) => {
    const day = event.resource;
    const shift = day.shift;
    const leave = day.leave;

    return (
      <div className="employee-day-event">
        <p className="employee-day-event-code">
          {leave ? "LEAVE" : (shift?.code ?? "No shift yet")}
        </p>
        <p className="employee-day-event-time hidden sm:block">
          {leave
            ? `${leave.isPaidLeave ? "Paid" : "Unpaid"} · ${leaveTypeLabelMap[leave.leaveType]}`
            : !shift
              ? ""
              : `${formatMinutes(day.scheduledStartMinutes)} - ${formatMinutes(
                  day.scheduledEndMinutes,
                )}`}
        </p>
      </div>
    );
  };

  const stats = useMemo(() => {
    const summary = {
      workDays: 0,
      dayOffDays: 0,
      leaveDays: 0,
      paidLeaveDays: 0,
      paidSickLeaveDays: 0,
      noShiftDays: 0,
      overrides: 0,
    };
    days.forEach((day) => {
      if (day.leave) {
        summary.leaveDays += 1;
        if (day.leave.isPaidLeave) {
          if (day.leave.leaveType === "SICK") {
            summary.paidSickLeaveDays += 1;
          } else {
            summary.paidLeaveDays += 1;
          }
        }
      } else if (day.shift?.isDayOff) {
        summary.dayOffDays += 1;
      } else if (day.shift) {
        summary.workDays += 1;
      } else {
        summary.noShiftDays += 1;
      }
      if (day.source === "override") {
        summary.overrides += 1;
      }
    });
    return summary;
  }, [days]);

  const calendarEvents = useMemo<ScheduleCalendarEvent[]>(
    () =>
      days.flatMap((day) => {
        const baseDate = parseIsoDate(day.date);
        if (!baseDate) return [];

        if (day.leave) {
          const leaveStart = new Date(baseDate);
          leaveStart.setHours(0, 0, 0, 0);
          const leaveEnd = new Date(leaveStart);
          leaveEnd.setDate(leaveEnd.getDate() + 1);

          return [
            {
              id: `${day.date}-leave`,
              title: `${leaveTypeLabelMap[day.leave.leaveType]} · ${day.leave.isPaidLeave ? "Paid" : "Unpaid"}`,
              start: leaveStart,
              end: leaveEnd,
              allDay: true,
              resource: day,
            },
          ];
        }

        if (
          day.shift &&
          day.scheduledStartMinutes != null &&
          day.scheduledEndMinutes != null
        ) {
          const start = minutesToDate(baseDate, day.scheduledStartMinutes);
          const end = minutesToDate(baseDate, day.scheduledEndMinutes);
          if (
            day.shift.spansMidnight ||
            day.scheduledEndMinutes <= day.scheduledStartMinutes
          ) {
            end.setDate(end.getDate() + 1);
          }
          return [
            {
              id: `${day.date}-${day.shift.id}`,
              title: `${day.shift.code} · ${formatMinutes(day.scheduledStartMinutes)} - ${formatMinutes(day.scheduledEndMinutes)}`,
              start,
              end,
              allDay: true,
              resource: day,
            },
          ];
        }

        const restStart = new Date(baseDate);
        restStart.setHours(0, 0, 0, 0);
        const restEnd = new Date(restStart);
        restEnd.setDate(restEnd.getDate() + 1);
        return [
          {
            id: `${day.date}-rest`,
            title: "Rest day",
            start: restStart,
            end: restEnd,
            allDay: true,
            resource: day,
          },
        ];
      }),
    [days],
  );

  const clampToViewedMonth = (date: Date) => {
    if (date < viewedMonthStart) return viewedMonthStart;
    if (date > viewedMonthEnd) return viewedMonthEnd;
    return date;
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    setSelectedDate(clampToViewedMonth(slotInfo.start));
  };

  if (loading) {
    return (
      <ModuleLoadingState
        title="Schedule"
        description="Loading your calendar, shift overlays, and schedule details."
      />
    );
  }
  if (error) return <div>Failed to load session</div>;
  if (!user) return <div>No session</div>;
  if (employee?.employeeId && !hasLoadedMonth && !monthError) {
    return (
      <ModuleLoadingState
        title="Schedule"
        description="Loading your calendar, shift overlays, and daily schedule details."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Employee Schedule
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-2xl font-semibold tracking-tight">
                {currentMonthLabel}
              </div>
              <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl shrink-0"
                    aria-label="Customize month"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[18rem] rounded-2xl p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Choose month</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg"
                        onClick={() => {
                          const now = getNowInTz();
                          setViewedMonth(
                            new Date(
                              now.getFullYear(),
                              now.getMonth(),
                              1,
                              12,
                              0,
                              0,
                              0,
                            ),
                          );
                          setMonthPickerOpen(false);
                        }}
                      >
                        Current month
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        value={String(viewedMonth.getMonth())}
                        onValueChange={(value) => {
                          const nextMonth = Number(value);
                          if (Number.isNaN(nextMonth)) return;
                          setViewedMonth(
                            new Date(
                              viewedMonth.getFullYear(),
                              nextMonth,
                              1,
                              12,
                              0,
                              0,
                              0,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder={currentMonthLabel} />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(viewedMonth.getFullYear())}
                        onValueChange={(value) => {
                          const nextYear = Number(value);
                          if (Number.isNaN(nextYear)) return;
                          setViewedMonth(
                            new Date(
                              nextYear,
                              viewedMonth.getMonth(),
                              1,
                              12,
                              0,
                              0,
                              0,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder={String(viewedMonth.getFullYear())} />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={String(year)}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xs text-muted-foreground">
              Use customize to switch months.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Work
              </p>
              <p className="mt-1 text-lg font-semibold leading-none">{stats.workDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Day Off
              </p>
              <p className="mt-1 text-lg font-semibold leading-none">{stats.dayOffDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Leave
              </p>
              <p className="mt-1 text-lg font-semibold leading-none">{stats.leaveDays}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Paid {stats.paidLeaveDays} · Sick {stats.paidSickLeaveDays}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                No shift yet
              </p>
              <p className="mt-1 text-lg font-semibold leading-none">{stats.noShiftDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Overrides
              </p>
              <p className="mt-1 text-lg font-semibold leading-none">{stats.overrides}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="order-2 min-w-0 border-border/60 bg-card/80 shadow-md backdrop-blur-sm md:order-1">
          <CardHeader className="space-y-2 border-b border-border/60 bg-muted/20">
            <div className="space-y-2">
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Schedule Calendar
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Month view with current-month schedule cards only.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="employee-schedule-calendar employee-schedule-calendar--modern h-[600px] w-full overflow-x-auto overflow-y-hidden rounded-2xl border sm:h-[700px] lg:h-[860px]">
              {/* CALENDAR UI */}
              <BigCalendar<ScheduleCalendarEvent>
                localizer={localizer}
                events={calendarEvents}
                date={viewedMonth}
                view={Views.MONTH}
                views={[Views.MONTH]}
                drilldownView={Views.MONTH}
                toolbar={false}
                selectable
                popup
                components={{
                  event: DaySquareEvent,
                }}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={(event) =>
                  setSelectedDate(clampToViewedMonth(event.start))
                }
                dayPropGetter={(date) => {
                  const dayKey = toIsoDate(date);
                  const dayInfo = daysByDate.get(dayKey);
                  return {
                    className: cn(
                      dayKey === selectedDateKey && "rbc-selected-day",
                      dayKey === todayKey && "rbc-focus-today",
                      dayInfo?.leave?.isPaidLeave && "rbc-paid-leave-day",
                      dayInfo?.leave &&
                        !dayInfo.leave.isPaidLeave &&
                        "rbc-unpaid-leave-day",
                    ),
                    style:
                      dayInfo?.shift?.colorHex && !dayInfo?.leave
                        ? {
                            backgroundColor: `${dayInfo.shift.colorHex}0D`,
                          }
                        : undefined,
                  };
                }}
                eventPropGetter={(event) => ({
                  className: cn(
                    event.resource.leave
                      ? "rbc-leave-event"
                      : event.resource.shift
                        ? "rbc-shift-event"
                        : "rbc-rest-event",
                    event.resource.leave?.isPaidLeave && "rbc-paid-leave-event",
                  ),
                  style:
                    event.resource.shift && !event.resource.leave
                      ? {
                          borderColor: event.resource.shift.colorHex ?? undefined,
                          backgroundColor: event.resource.shift.colorHex
                            ? `${event.resource.shift.colorHex}1A`
                            : undefined,
                          color: event.resource.shift.colorHex ?? undefined,
                        }
                      : undefined,
                })}
              />
            </div>

            {monthLoading && (
              <InlineLoadingState
                label="Loading month schedule"
                lines={2}
                className="border-border/60 bg-muted/10"
              />
            )}
            {monthError && (
              <p className="text-sm text-destructive">{monthError}</p>
            )}
          </CardContent>
        </Card>

        <div className="order-1 space-y-6 md:order-2">
          <Card className="border-border/60 bg-card shadow-md">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                Today&apos;s Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {monthLoading ? (
                <InlineLoadingState
                  label="Loading today's schedule"
                  lines={2}
                  className="border-border/60 bg-muted/10"
                />
              ) : monthError ? (
                <p className="text-sm text-destructive">{monthError}</p>
              ) : todaySchedule?.leave ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {formatLongDate(todaySchedule.date)}
                    </p>
                    <p className="text-xl font-semibold">
                      {leaveTypeLabelMap[todaySchedule.leave.leaveType]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {todaySchedule.leave.isPaidLeave
                        ? "Paid leave"
                        : "Unpaid leave"}
                      {todaySchedule.shift
                        ? ` · Scheduled ${formatMinutes(
                            todaySchedule.scheduledStartMinutes,
                          )} - ${formatMinutes(todaySchedule.scheduledEndMinutes)}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      // I keep this badge in the same color family as the leave event
                      // so the side panel reinforces the meaning already established in the calendar.
                      "employee-schedule-status-badge",
                      todaySchedule.leave.isPaidLeave
                        ? "employee-schedule-status-badge--paid-leave"
                        : "employee-schedule-status-badge--unpaid-leave",
                    )}
                  >
                    {todaySchedule.leave.isPaidLeave
                      ? "Paid leave"
                      : "Unpaid leave"}
                  </Badge>
                </>
              ) : !todaySchedule?.shift ? (
                <p className="text-sm text-muted-foreground">
                  No shift yet.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {formatLongDate(todaySchedule.date)}
                    </p>
                    <p className="text-xl font-semibold">
                      {todaySchedule.shift.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatMinutes(todaySchedule.scheduledStartMinutes)} -{" "}
                      {formatMinutes(todaySchedule.scheduledEndMinutes)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    style={shiftCalendarStyle(todaySchedule.shift)}
                    className={cn(
                      "employee-schedule-status-badge",
                      sourceBadgeClassName(todaySchedule.source),
                    )}
                  >
                    {todaySchedule.shift.code} · {sourceLabelMap[todaySchedule.source]}
                  </Badge>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Selected Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">
                {selectedDay ? formatLongDate(selectedDay.date) : "No date selected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedDay?.leave
                  ? `${leaveTypeLabelMap[selectedDay.leave.leaveType]} · ${selectedDay.leave.isPaidLeave ? "Paid" : "Unpaid"}`
                  : selectedDay?.shift
                    ? `${selectedDay.shift.name} · ${formatMinutes(
                        selectedDay.scheduledStartMinutes,
                      )} - ${formatMinutes(selectedDay.scheduledEndMinutes)}`
                    : "No shift yet"}
              </p>
              {selectedDay?.shift ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" style={shiftCalendarStyle(selectedDay.shift)}>
                    {selectedDay.shift.code}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "employee-schedule-status-badge",
                      sourceBadgeClassName(selectedDay.source),
                    )}
                  >
                    {sourceLabelMap[selectedDay.source]}
                  </Badge>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeScedule;
