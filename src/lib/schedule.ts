import { db } from "./db";
import { getExpectedShiftForDate } from "./attendance";

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function getDailySchedule(date: Date) {
  const day = startOfDay(date);
  const employees = await db.employee.findMany({
    where: { isArchived: false },
    orderBy: { employeeCode: "asc" },
    select: {
      employeeId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
  });

  const entries = await Promise.all(
    employees.map(async (emp) => {
      const expected = await getExpectedShiftForDate(emp.employeeId, day);
      return {
        employee: emp,
        shift: expected.shift,
        source: expected.source,
        scheduledStartMinutes: expected.scheduledStartMinutes,
        scheduledEndMinutes: expected.scheduledEndMinutes,
      };
    })
  );

  return entries;
}
