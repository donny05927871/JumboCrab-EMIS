"use server";

import { prisma } from "@/lib/prisma";
import { Employee, User } from "@prisma/client";

export async function getUsers(): Promise<{
  success: boolean;
  data: User[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, data: users, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}

export async function getUsersWithEmployeeAccount(): Promise<{
  success: boolean;
  data: (User & { employee: Employee | null })[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      include: {
        employee: true, // This will include the related employee data
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return {
      success: true,
      data: users,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching users with employee data:", error);
    return {
      success: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch users with employee data",
    };
  }
}
