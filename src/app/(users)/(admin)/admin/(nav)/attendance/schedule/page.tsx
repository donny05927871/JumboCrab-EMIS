"use client";

import { ScheduleBoard } from "@/components/dasboard/manage-attendance/schedule-board";

export default function AttendanceSchedulePage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Shift Schedule</h1>
        <p className="text-sm text-muted-foreground">
          View daily shift schedule and manage weekly assignments or overrides.
        </p>
      </div>
      <ScheduleBoard />
    </div>
  );
}
