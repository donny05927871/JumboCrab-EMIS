"use client";

import { Card } from "@/components/ui/card";
import CreateUserForm from "@/components/dasboard/manage-users/users-create-form";

export default function AdminUserCreatePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Create New User</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new user account to the system
        </p>
      </div>

      <Card className="p-6">
        <CreateUserForm
          id=""
          firstName=""
          lastName=""
          employeeCode=""
          email={null}
        />
      </Card>
    </div>
  );
}
