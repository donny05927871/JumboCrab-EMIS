"use client";

import React from "react";
import { Button, buttonVariants } from "./button";
import { type VariantProps } from "class-variance-authority";
import { signOut } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignOutButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onClick" | "variant"
    >,
    VariantProps<typeof buttonVariants> {
  showIcon?: boolean;
  children?: React.ReactNode;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
}

const SignOutButton = React.forwardRef<HTMLButtonElement, SignOutButtonProps>(
  (
    { className, variant = "ghost", showIcon = true, children, ...props },
    ref
  ) => {
    const router = useRouter();

    const handleSignOut = async () => {
      try {
        await signOut();
        router.push("/");
        router.refresh();
      } catch (error) {
        console.error("Error signing out:", error);
      }
    };

    return (
      <Button
        ref={ref}
        onClick={handleSignOut}
        variant={variant}
        className={cn("flex items-center gap-2", className)}
        {...props}
      >
        {showIcon && <LogOut className="h-4 w-4" />}
        {children || "Sign Out"}
      </Button>
    );
  }
);

SignOutButton.displayName = "SignOutButton";

export { SignOutButton };
