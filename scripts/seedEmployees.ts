import "dotenv/config";
import crypto from "crypto";
import {
  CIVIL_STATUS,
  CURRENT_STATUS,
  EMPLOYMENT_STATUS,
  GENDER,
  PrismaClient,
  Roles,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pathToFileURL } from "url";
import { seedContributionBrackets } from "./shared/contribution-brackets";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });
const DEFAULT_PASSWORD = "password";
const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MINUTES = 8 * 60;

type DepartmentName = "Kitchen" | "Dining" | "Cashier" | "Drivers";

type SeedEmployee = {
  employeeCode: string;
  username: string;
  email: string;
  role: Roles;
  firstName: string;
  lastName: string;
  departmentName: DepartmentName;
  positionName:
    | "Waiter"
    | "Chef"
    | "Cook"
    | "Driver"
    | "Cashier"
    | "Supervisor"
    | "Ops Manager";
  img: string;
};

const seededEmployees: SeedEmployee[] = [
  {
    employeeCode: "EMP-001",
    username: "manager.ops",
    email: "manager.ops@jumbocrab.local",
    role: Roles.Manager,
    firstName: "Morgan",
    lastName: "Santos",
    departmentName: "Dining",
    positionName: "Ops Manager",
    img: buildProfileImageUrl("Morgan", "Santos", "manager.ops"),
  },
  {
    employeeCode: "EMP-002",
    username: "supervisor.floor",
    email: "supervisor.floor@jumbocrab.local",
    role: Roles.Supervisor,
    firstName: "Alyssa",
    lastName: "Reyes",
    departmentName: "Dining",
    positionName: "Supervisor",
    img: buildProfileImageUrl("Alyssa", "Reyes", "supervisor.floor"),
  },
  {
    employeeCode: "EMP-003",
    username: "supervisor.kitchen",
    email: "supervisor.kitchen@jumbocrab.local",
    role: Roles.Supervisor,
    firstName: "Paolo",
    lastName: "Lim",
    departmentName: "Kitchen",
    positionName: "Supervisor",
    img: buildProfileImageUrl("Paolo", "Lim", "supervisor.kitchen"),
  },
  {
    employeeCode: "EMP-004",
    username: "waiter.vera",
    email: "waiter.vera@jumbocrab.local",
    role: Roles.Employee,
    firstName: "Vernon",
    lastName: "Bailey",
    departmentName: "Dining",
    positionName: "Waiter",
    img: buildProfileImageUrl("Vernon", "Bailey", "waiter.vera"),
  },
  {
    employeeCode: "EMP-005",
    username: "waiter.jessa",
    email: "waiter.jessa@jumbocrab.local",
    role: Roles.Employee,
    firstName: "Jessa",
    lastName: "Bautista",
    departmentName: "Dining",
    positionName: "Waiter",
    img: buildProfileImageUrl("Jessa", "Bautista", "waiter.jessa"),
  },
  {
    employeeCode: "EMP-006",
    username: "chef.whitney",
    email: "chef.whitney@jumbocrab.local",
    role: Roles.Employee,
    firstName: "Whitney",
    lastName: "Casper",
    departmentName: "Kitchen",
    positionName: "Chef",
    img: buildProfileImageUrl("Whitney", "Casper", "chef.whitney"),
  },
  {
    employeeCode: "EMP-007",
    username: "cook.sandra",
    email: "cook.sandra@jumbocrab.local",
    role: Roles.Employee,
    firstName: "Sandra",
    lastName: "Conroy",
    departmentName: "Kitchen",
    positionName: "Cook",
    img: buildProfileImageUrl("Sandra", "Conroy", "cook.sandra"),
  },
  {
    employeeCode: "EMP-008",
    username: "cashier.debbie",
    email: "cashier.debbie@jumbocrab.local",
    role: Roles.Employee,
    firstName: "Debbie",
    lastName: "Considine",
    departmentName: "Cashier",
    positionName: "Cashier",
    img: buildProfileImageUrl("Debbie", "Considine", "cashier.debbie"),
  },
  {
    employeeCode: "EMP-009",
    username: "driver.tamara",
    email: "driver.tamara@jumbocrab.local",
    role: Roles.Employee,
    firstName: "Tamara",
    lastName: "Corwin",
    departmentName: "Drivers",
    positionName: "Driver",
    img: buildProfileImageUrl("Tamara", "Corwin", "driver.tamara"),
  },
  {
    employeeCode: "EMP-010",
    username: "waiter.malcolm",
    email: "waiter.malcolm@jumbocrab.local",
    role: Roles.Employee,
    firstName: "Malcolm",
    lastName: "Deckow",
    departmentName: "Dining",
    positionName: "Waiter",
    img: buildProfileImageUrl("Malcolm", "Deckow", "waiter.malcolm"),
  },
];

function dateAtNoonUtc(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function nowInManila() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}

function startOfManilaDay(date: Date) {
  const tzMs = date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000;
  const tzDate = new Date(tzMs);
  const startMs = Date.UTC(
    tzDate.getUTCFullYear(),
    tzDate.getUTCMonth(),
    tzDate.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return new Date(startMs - TZ_OFFSET_MINUTES * 60 * 1000);
}

function startOfManilaWeek(date: Date) {
  const dayStart = startOfManilaDay(date);
  const weekday = new Date(dayStart.getTime() + TZ_OFFSET_MINUTES * 60 * 1000).getUTCDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  return new Date(dayStart.getTime() + diffToMonday * DAY_MS);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function buildProfileImageUrl(firstName: string, lastName: string, username: string) {
  const seed = encodeURIComponent(`${firstName} ${lastName} ${username}`);
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=f97316,e2e8f0,cbd5e1`;
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, dk) => {
      if (err) reject(err);
      else resolve(dk as Buffer);
    });
  });
  return { salt, hash: derivedKey.toString("hex") };
}

async function resetDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const quotedTables = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`);
}

async function seedDepartmentsAndPositions() {
  const departments = await Promise.all(
    [
      { name: "Kitchen", description: "Kitchen operations" },
      { name: "Dining", description: "Dining room operations" },
      { name: "Cashier", description: "Cash handling and front counter" },
      { name: "Drivers", description: "Delivery and transport" },
    ].map((department) =>
      prisma.department.create({
        data: department,
      }),
    ),
  );

  const departmentMap = Object.fromEntries(
    departments.map((department) => [department.name as DepartmentName, department.departmentId]),
  ) as Record<DepartmentName, string>;

  const positions = await Promise.all([
    prisma.position.create({
      data: { name: "Waiter", departmentId: departmentMap.Dining, dailyRate: "650", hourlyRate: "81.25", monthlyRate: "16900" },
    }),
    prisma.position.create({
      data: { name: "Chef", departmentId: departmentMap.Kitchen, dailyRate: "900", hourlyRate: "112.50", monthlyRate: "23400" },
    }),
    prisma.position.create({
      data: { name: "Cook", departmentId: departmentMap.Kitchen, dailyRate: "700", hourlyRate: "87.50", monthlyRate: "18200" },
    }),
    prisma.position.create({
      data: { name: "Driver", departmentId: departmentMap.Drivers, dailyRate: "700", hourlyRate: "87.50", monthlyRate: "18200" },
    }),
    prisma.position.create({
      data: { name: "Cashier", departmentId: departmentMap.Cashier, dailyRate: "680", hourlyRate: "85.00", monthlyRate: "17680" },
    }),
    prisma.position.create({
      data: { name: "Supervisor", departmentId: departmentMap.Dining, dailyRate: "950", hourlyRate: "118.75", monthlyRate: "24700" },
    }),
    prisma.position.create({
      data: { name: "Ops Manager", departmentId: departmentMap.Dining, dailyRate: "1300", hourlyRate: "162.50", monthlyRate: "33800" },
    }),
  ]);

  const positionMap = Object.fromEntries(
    positions.map((position) => [position.name, position.positionId]),
  ) as Record<SeedEmployee["positionName"], string>;

  return { departmentMap, positionMap };
}

async function seedShifts() {
  const shifts = await Promise.all([
    prisma.shift.create({
      data: {
        code: "AM",
        name: "Morning",
        colorHex: "#F97316",
        isDayOff: false,
        startMinutes: 6 * 60,
        endMinutes: 14 * 60,
        spansMidnight: false,
        breakStartMinutes: 10 * 60,
        breakEndMinutes: 10 * 60 + 30,
        breakMinutesUnpaid: 30,
        paidHoursPerDay: "7.50",
      },
    }),
    prisma.shift.create({
      data: {
        code: "PM",
        name: "Afternoon",
        colorHex: "#0EA5E9",
        isDayOff: false,
        startMinutes: 14 * 60,
        endMinutes: 22 * 60,
        spansMidnight: false,
        breakStartMinutes: 18 * 60,
        breakEndMinutes: 18 * 60 + 30,
        breakMinutesUnpaid: 30,
        paidHoursPerDay: "7.50",
      },
    }),
    prisma.shift.create({
      data: {
        code: "MID",
        name: "Mid Shift",
        colorHex: "#22C55E",
        isDayOff: false,
        startMinutes: 10 * 60,
        endMinutes: 18 * 60,
        spansMidnight: false,
        breakStartMinutes: 14 * 60,
        breakEndMinutes: 14 * 60 + 30,
        breakMinutesUnpaid: 30,
        paidHoursPerDay: "7.50",
      },
    }),
    prisma.shift.create({
      data: {
        code: "OFF",
        name: "Day Off",
        colorHex: "#94A3B8",
        isDayOff: true,
        startMinutes: 0,
        endMinutes: 0,
        spansMidnight: false,
        breakMinutesUnpaid: 0,
        paidHoursPerDay: "0.00",
      },
    }),
  ]);

  return Object.fromEntries(shifts.map((shift) => [shift.code, shift.id])) as Record<
    "AM" | "PM" | "MID" | "OFF",
    number
  >;
}

async function seedUsersAndEmployees(org: Awaited<ReturnType<typeof seedDepartmentsAndPositions>>) {
  const weekAnchor = startOfManilaWeek(nowInManila());
  const created: Array<{ employeeId: string; positionName: SeedEmployee["positionName"] }> = [];

  for (let index = 0; index < seededEmployees.length; index += 1) {
    const seed = seededEmployees[index];
    const { hash, salt } = await hashPassword(DEFAULT_PASSWORD);
    const user = await prisma.user.create({
      data: {
        username: seed.username,
        email: seed.email,
        password: hash,
        salt,
        role: seed.role,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        employeeCode: seed.employeeCode,
        firstName: seed.firstName,
        lastName: seed.lastName,
        sex: index % 2 === 0 ? GENDER.MALE : GENDER.FEMALE,
        civilStatus: CIVIL_STATUS.SINGLE,
        nationality: "Filipino",
        birthdate: dateAtNoonUtc(1990 + index, index % 12, 5 + index),
        img: seed.img,
        startDate: addDays(weekAnchor, -90 - index),
        employmentStatus: EMPLOYMENT_STATUS.REGULAR,
        currentStatus: CURRENT_STATUS.ACTIVE,
        email: seed.email,
        phone: `0917${String(1000000 + index).padStart(7, "0")}`,
        address: `Purok ${index + 1}, Panglao, Bohol`,
        city: "Panglao",
        state: "Bohol",
        postalCode: "6340",
        country: "Philippines",
        userId: user.userId,
        departmentId: org.departmentMap[seed.departmentName],
        positionId: org.positionMap[seed.positionName],
      },
    });

    created.push({ employeeId: employee.employeeId, positionName: seed.positionName });
  }

  return created;
}

async function seedWeeklySchedules(
  employees: Awaited<ReturnType<typeof seedUsersAndEmployees>>,
  shiftIds: Awaited<ReturnType<typeof seedShifts>>,
) {
  const currentWeek = startOfManilaWeek(nowInManila());
  const previousWeek = addDays(currentWeek, -7);

  const planForPosition = (positionName: SeedEmployee["positionName"], alternate: boolean) => {
    if (positionName === "Ops Manager") {
      return {
        monShiftId: shiftIds.AM,
        tueShiftId: shiftIds.AM,
        wedShiftId: shiftIds.AM,
        thuShiftId: shiftIds.AM,
        friShiftId: shiftIds.AM,
        satShiftId: shiftIds.MID,
        sunShiftId: shiftIds.OFF,
      };
    }
    if (positionName === "Supervisor") {
      return {
        monShiftId: alternate ? shiftIds.PM : shiftIds.AM,
        tueShiftId: alternate ? shiftIds.PM : shiftIds.AM,
        wedShiftId: alternate ? shiftIds.PM : shiftIds.AM,
        thuShiftId: alternate ? shiftIds.PM : shiftIds.AM,
        friShiftId: alternate ? shiftIds.PM : shiftIds.AM,
        satShiftId: shiftIds.MID,
        sunShiftId: shiftIds.OFF,
      };
    }
    if (positionName === "Driver") {
      return {
        monShiftId: shiftIds.MID,
        tueShiftId: shiftIds.MID,
        wedShiftId: shiftIds.MID,
        thuShiftId: shiftIds.MID,
        friShiftId: shiftIds.MID,
        satShiftId: alternate ? shiftIds.PM : shiftIds.AM,
        sunShiftId: shiftIds.OFF,
      };
    }
    return {
      monShiftId: alternate ? shiftIds.PM : shiftIds.AM,
      tueShiftId: alternate ? shiftIds.PM : shiftIds.AM,
      wedShiftId: alternate ? shiftIds.PM : shiftIds.AM,
      thuShiftId: alternate ? shiftIds.PM : shiftIds.AM,
      friShiftId: alternate ? shiftIds.PM : shiftIds.AM,
      satShiftId: alternate ? shiftIds.AM : shiftIds.PM,
      sunShiftId: shiftIds.OFF,
    };
  };

  for (const [index, employee] of employees.entries()) {
    await prisma.weeklySchedule.create({
      data: {
        employeeId: employee.employeeId,
        weekStart: previousWeek,
        ...planForPosition(employee.positionName, index % 2 === 0),
      },
    });

    await prisma.weeklySchedule.create({
      data: {
        employeeId: employee.employeeId,
        weekStart: currentWeek,
        ...planForPosition(employee.positionName, index % 2 !== 0),
      },
    });
  }
}

export async function seedSmallWeeklyScheduleDataset() {
  await resetDatabase();
  await seedContributionBrackets(prisma, {
    sssEffectiveFrom: dateAtNoonUtc(2025, 0, 1),
    philHealthEffectiveFrom: dateAtNoonUtc(2024, 0, 1),
    pagIbigEffectiveFrom: dateAtNoonUtc(2024, 0, 1),
    withholdingEffectiveFrom: dateAtNoonUtc(2023, 0, 1),
  });
  const org = await seedDepartmentsAndPositions();
  const shiftIds = await seedShifts();
  const employees = await seedUsersAndEmployees(org);
  await seedWeeklySchedules(employees, shiftIds);
}

export async function runSeedSmallWeeklyScheduleDataset() {
  try {
    await seedSmallWeeklyScheduleDataset();
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await runSeedSmallWeeklyScheduleDataset();
  console.log("Seeded 10-user weekly schedule dataset.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
