"use client";

import { useAuth } from "@/features/auth/services/authService";
import { Alert } from "@/features/navigation/components/alert";

export function YearGroupRequiredAlert({ className }: { className?: string }) {
  const { role, yearGroupId, profileLoading } = useAuth();

  if (profileLoading || role !== "student" || yearGroupId) {
    return null;
  }

  return (
    <Alert
      variant="warning"
      title="Year group not selected"
      message="You have not selected a year group. You must assign yourself to a year group before you can take any case simulations."
      linkHref="/select-year-group"
      linkText="Select year group"
      className={className}
    />
  );
}
