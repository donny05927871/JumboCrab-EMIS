-- CreateEnum
CREATE TYPE "GENDER" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CIVIL_STATUS" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EMPLOYMENT_STATUS" AS ENUM ('REGULAR', 'PROBATIONARY', 'TRAINING');

-- CreateEnum
CREATE TYPE "CURRENT_STATUS" AS ENUM ('ACTIVE', 'ON_LEAVE', 'VACATION', 'SICK_LEAVE');

-- CreateTable
CREATE TABLE "EmployeeInformation" (
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "birthdate" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "civilStatus" "CIVIL_STATUS" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "employeeCode" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "img" TEXT,
    "nationality" TEXT NOT NULL,
    "phone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sex" "GENDER" NOT NULL,
    "employmentStatus" "EMPLOYMENT_STATUS" NOT NULL,
    "currentStatus" "CURRENT_STATUS" NOT NULL,

    CONSTRAINT "EmployeeInformation_pkey" PRIMARY KEY ("employeeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeInformation_employeeCode_key" ON "EmployeeInformation"("employeeCode");
