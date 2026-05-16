import { runSeedSmallWeeklyScheduleDataset } from "./seedEmployees";

async function main() {
  await runSeedSmallWeeklyScheduleDataset();
  console.log("Seeded weekly schedule dataset. Payroll-specific bimonthly sample removed in planner-first refactor.");
}

await main();
