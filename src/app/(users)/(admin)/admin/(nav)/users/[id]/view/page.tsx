"use client";

import React from "react"; // Add this import
import { Button } from "@/components/ui/button";
import { Pencil, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { User } from "@/lib/validations/users";
import { getUserById } from "@/actions/users-action";
import { Card } from "@/components/ui/card";
import type { Employee } from "@/lib/validations/employees";

// Extend the User type to include employee
interface UserWithEmployee extends User {
  employee?: (Omit<Employee, "isEnded"> & { isEnded: boolean | null }) | null;
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error in UserViewPage:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600">
          Something went wrong. Please try again later.
        </div>
      );
    }
    return this.props.children;
  }
}

function UserViewPageContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const [user, setUser] = useState<UserWithEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const params = await paramsPromise;
        const userId = params?.id;

        if (!userId) {
          throw new Error("No user ID provided");
        }

        const { data, error: fetchError } = await getUserById(userId);

        if (fetchError || !data) {
          throw new Error(fetchError || "Failed to load user");
        }

        setUser(data);
      } catch (err) {
        console.error("Error loading user:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load user data"
        );
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [paramsPromise]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-4 bg-red-50 rounded-md">
        <p className="text-red-600">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 py-10 px-5 md:px-20">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium">View User</h3>
            <p className="text-sm text-muted-foreground">View user details</p>
          </div>
          {user?.userId && (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/admin/users/${user.userId}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
        </div>

        <Card className="rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">User Details</h1>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Username</h2>
              <p className="text-muted-foreground">{user.username || "N/A"}</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Email</h2>
              <p className="text-muted-foreground">{user.email || "N/A"}</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Role</h2>
              <p className="text-muted-foreground">{user.role || "N/A"}</p>
            </div>

            {user.employee && (
              <div className="mt-6 pt-6 border-t">
                <h2 className="text-xl font-semibold mb-4">
                  Employee Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Full Name</h3>
                    <p className="text-muted-foreground">
                      {`${user.employee.firstName} ${user.employee.lastName}`.trim() ||
                        "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Employee Code</h3>
                    <p className="text-muted-foreground">
                      {user.employee.employeeCode || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Position</h3>
                    <p className="text-muted-foreground">
                      {user.employee.position || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Department</h3>
                    <p className="text-muted-foreground">
                      {user.employee.department || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Employment Status</h3>
                    <p className="text-muted-foreground">
                      {user.employee.employmentStatus || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Start Date</h3>
                    <p className="text-muted-foreground">
                      {user.employee.startDate
                        ? new Date(user.employee.startDate).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

export default function UserViewPage({ params }: { params: { id: string } }) {
  const paramsPromise = Promise.resolve(params);
  return <UserViewPageContent paramsPromise={paramsPromise} />;
}
