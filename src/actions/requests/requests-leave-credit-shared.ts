import {
  LeaveCreditLedgerEntryType,
  LeaveCreditResetRunType,
  Prisma,
} from "@prisma/client";
import type { LeaveCreditType } from "@prisma/client";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";

const LEAVE_CREDIT_TYPE_SICK: LeaveCreditType = "SICK";
const LEAVE_CREDIT_TYPE_SIL: LeaveCreditType = "SIL";

const DEFAULT_POLICY_CONFIG: Record<
  LeaveCreditType,
  { annualCredits: number; resetMonth: number; resetDay: number }
> = {
  [LEAVE_CREDIT_TYPE_SICK]: { annualCredits: 5, resetMonth: 1, resetDay: 1 },
  [LEAVE_CREDIT_TYPE_SIL]: { annualCredits: 5, resetMonth: 1, resetDay: 1 },
};

type RequestDbClient = Prisma.TransactionClient | typeof db;

export const ACTIVE_LEAVE_REQUEST_TYPES = ["SICK", "SIL", "UNPAID"] as const;
export const ACTIVE_LEAVE_CREDIT_TYPES = [
  LEAVE_CREDIT_TYPE_SICK,
  LEAVE_CREDIT_TYPE_SIL,
] as const;

export const toLeaveCreditType = (leaveType: string): LeaveCreditType | null => {
  if (leaveType === "SICK") return LEAVE_CREDIT_TYPE_SICK;
  if (leaveType === "SIL") return LEAVE_CREDIT_TYPE_SIL;
  return null;
};

const buildPolicyDate = (year: number, month: number, day: number) =>
  startOfZonedDay(new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+08:00`));

export const getLeaveCreditCycleWindow = (input: {
  resetMonth: number;
  resetDay: number;
  referenceDate: Date;
}) => {
  const reference = startOfZonedDay(input.referenceDate);
  const referenceYear = Number(
    reference.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4),
  );
  const candidate = buildPolicyDate(referenceYear, input.resetMonth, input.resetDay);
  const cycleStart =
    candidate.getTime() <= reference.getTime()
      ? candidate
      : buildPolicyDate(referenceYear - 1, input.resetMonth, input.resetDay);
  const cycleEnd = buildPolicyDate(
    Number(
      cycleStart.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4),
    ) + 1,
    input.resetMonth,
    input.resetDay,
  );

  return { cycleStart, cycleEnd };
};

export const ensureLeaveCreditPolicies = async (client: RequestDbClient) => {
  await Promise.all(
    ACTIVE_LEAVE_CREDIT_TYPES.map((leaveType) =>
      client.leaveCreditPolicy.upsert({
        where: { leaveType },
        update: {},
        create: {
          leaveType,
          annualCredits: DEFAULT_POLICY_CONFIG[leaveType].annualCredits,
          resetMonth: DEFAULT_POLICY_CONFIG[leaveType].resetMonth,
          resetDay: DEFAULT_POLICY_CONFIG[leaveType].resetDay,
        },
      }),
    ),
  );

  return client.leaveCreditPolicy.findMany({
    where: { leaveType: { in: [...ACTIVE_LEAVE_CREDIT_TYPES] } },
    orderBy: { leaveType: "asc" },
  });
};

export const ensureEmployeeLeaveCreditGrant = async (input: {
  client: RequestDbClient;
  employeeId: string;
  employeeStartDate: Date;
  leaveType: LeaveCreditType;
  referenceDate: Date;
  createdByUserId?: string | null;
}) => {
  const policies = await ensureLeaveCreditPolicies(input.client);
  const policy = policies.find((row) => row.leaveType === input.leaveType);
  if (!policy) {
    throw new Error(`Leave credit policy missing for ${input.leaveType}.`);
  }

  const { cycleStart } = getLeaveCreditCycleWindow({
    resetMonth: policy.resetMonth,
    resetDay: policy.resetDay,
    referenceDate: input.referenceDate,
  });

  const existing = await input.client.employeeLeaveCreditLedger.findFirst({
    where: {
      employeeId: input.employeeId,
      leaveType: input.leaveType,
      cycleStartDate: cycleStart,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  if (existing) {
    return { policy, cycleStart, balance: existing.balanceAfter };
  }

  const effectiveDate =
    startOfZonedDay(input.employeeStartDate).getTime() > cycleStart.getTime()
      ? startOfZonedDay(input.employeeStartDate)
      : cycleStart;

  const created = await input.client.employeeLeaveCreditLedger.create({
    data: {
      employeeId: input.employeeId,
      leaveType: input.leaveType,
      entryType: LeaveCreditLedgerEntryType.GRANT,
      amount: policy.annualCredits,
      balanceBefore: 0,
      balanceAfter: policy.annualCredits,
      effectiveDate,
      cycleStartDate: cycleStart,
      notes: "Current-cycle starting grant",
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  return { policy, cycleStart, balance: created.balanceAfter };
};

export const getEmployeeLeaveCredits = async (input: {
  client?: RequestDbClient;
  employeeId: string;
  employeeStartDate: Date;
  referenceDate?: Date;
  createdByUserId?: string | null;
}) => {
  const client = input.client ?? db;
  const referenceDate = input.referenceDate ?? new Date();

  const states = await Promise.all(
    ACTIVE_LEAVE_CREDIT_TYPES.map(async (leaveType) => {
      const ensured = await ensureEmployeeLeaveCreditGrant({
        client,
        employeeId: input.employeeId,
        employeeStartDate: input.employeeStartDate,
        leaveType,
        referenceDate,
        createdByUserId: input.createdByUserId,
      });

      return {
        leaveType,
        annualCredits: ensured.policy.annualCredits,
        cycleStartDate: ensured.cycleStart,
        balance: ensured.balance,
        resetMonth: ensured.policy.resetMonth,
        resetDay: ensured.policy.resetDay,
      };
    }),
  );

  return {
    sick: states.find((row) => row.leaveType === LEAVE_CREDIT_TYPE_SICK)!,
    sil: states.find((row) => row.leaveType === LEAVE_CREDIT_TYPE_SIL)!,
  };
};

export const consumeEmployeeLeaveCredits = async (input: {
  client: RequestDbClient;
  employeeId: string;
  employeeStartDate: Date;
  leaveType: LeaveCreditType;
  days: number;
  effectiveDate: Date;
  leaveRequestId: string;
  createdByUserId?: string | null;
}) => {
  const current = await ensureEmployeeLeaveCreditGrant({
    client: input.client,
    employeeId: input.employeeId,
    employeeStartDate: input.employeeStartDate,
    leaveType: input.leaveType,
    referenceDate: input.effectiveDate,
    createdByUserId: input.createdByUserId,
  });

  if (current.balance < input.days) {
    throw new Error(`Not enough ${input.leaveType} credits remaining.`);
  }

  return input.client.employeeLeaveCreditLedger.create({
    data: {
      employeeId: input.employeeId,
      leaveType: input.leaveType,
      entryType: LeaveCreditLedgerEntryType.USAGE,
      amount: -input.days,
      balanceBefore: current.balance,
      balanceAfter: current.balance - input.days,
      effectiveDate: startOfZonedDay(input.effectiveDate),
      cycleStartDate: current.cycleStart,
      leaveRequestId: input.leaveRequestId,
      notes: `Approved ${input.leaveType} leave request`,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
};

export const runLeaveCreditResetForType = async (input: {
  client?: RequestDbClient;
  leaveType: LeaveCreditType;
  effectiveDate?: Date;
  initiatedByUserId?: string | null;
  notes?: string | null;
  runType?: LeaveCreditResetRunType;
}) => {
  const client = input.client ?? db;
  const effectiveDate = startOfZonedDay(input.effectiveDate ?? new Date());
  const policies = await ensureLeaveCreditPolicies(client);
  const policy = policies.find((row) => row.leaveType === input.leaveType);
  if (!policy) {
    throw new Error(`Leave credit policy missing for ${input.leaveType}.`);
  }

  const { cycleStart, cycleEnd } = getLeaveCreditCycleWindow({
    resetMonth: policy.resetMonth,
    resetDay: policy.resetDay,
    referenceDate: effectiveDate,
  });

  const existingRun = await client.leaveCreditResetRun.findFirst({
    where: {
      policyId: policy.id,
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
    },
    select: { id: true },
  });
  if (existingRun) {
    return existingRun;
  }

  const employees = await client.employee.findMany({
    where: {
      isArchived: false,
      startDate: { lte: effectiveDate },
    },
    select: {
      employeeId: true,
      startDate: true,
    },
    orderBy: { employeeCode: "asc" },
  });

  const run = await client.leaveCreditResetRun.create({
    data: {
      policyId: policy.id,
      leaveType: input.leaveType,
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
      effectiveDate,
      annualCredits: policy.annualCredits,
      employeeCount: employees.length,
      initiatedByUserId: input.initiatedByUserId ?? null,
      notes: input.notes ?? null,
      runType: input.runType ?? LeaveCreditResetRunType.MANUAL,
    },
  });

  for (const employee of employees) {
    const existingLedger = await client.employeeLeaveCreditLedger.findFirst({
      where: {
        employeeId: employee.employeeId,
        leaveType: input.leaveType,
        cycleStartDate: cycleStart,
      },
      select: { id: true },
    });
    if (existingLedger) continue;

    await client.employeeLeaveCreditLedger.create({
      data: {
        employeeId: employee.employeeId,
        leaveType: input.leaveType,
        entryType: LeaveCreditLedgerEntryType.RESET,
        amount: policy.annualCredits,
        balanceBefore: 0,
        balanceAfter: policy.annualCredits,
        effectiveDate:
          startOfZonedDay(employee.startDate).getTime() > effectiveDate.getTime()
            ? startOfZonedDay(employee.startDate)
            : effectiveDate,
        cycleStartDate: cycleStart,
        resetRunId: run.id,
        notes: "Annual leave credit reset",
        createdByUserId: input.initiatedByUserId ?? null,
      },
    });
  }

  return run;
};
