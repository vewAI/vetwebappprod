/**
 * Adapted from TailAdmin React (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

const variantClasses = {
  success: {
    container: "border-success-500 bg-success-50 dark:border-success-500/30 dark:bg-success-500/15",
    icon: "text-success-500",
  },
  error: {
    container: "border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15",
    icon: "text-error-500",
  },
  warning: {
    container: "border-warning-500 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/15",
    icon: "text-warning-500",
  },
  info: {
    container: "border-blue-light-500 bg-blue-light-50 dark:border-blue-light-500/30 dark:bg-blue-light-500/15",
    icon: "text-blue-light-500",
  },
};

function WarningIcon() {
  return (
    <svg className="fill-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.45502 3.65526C10.6007 1.70825 13.3993 1.70825 14.545 3.65526L21.3904 15.2694C22.5122 17.1749 21.1383 19.5 18.8454 19.5H5.1546C2.8617 19.5 1.48778 17.1749 2.60961 15.2694L9.45502 3.65526ZM12 8.25C12.4142 8.25 12.75 8.58579 12.75 9V12.75C12.75 13.1642 12.4142 13.5 12 13.5C11.5858 13.5 11.25 13.1642 11.25 12.75V9C11.25 8.58579 11.5858 8.25 12 8.25ZM12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z"
        fill=""
      />
    </svg>
  );
}

export function Alert({
  variant,
  title,
  message,
  linkHref,
  linkText = "Learn more",
  className,
}: {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  linkHref?: string;
  linkText?: string;
  className?: string;
}) {
  const styles = variantClasses[variant];

  return (
    <div className={cn("rounded-xl border p-4", styles.container, className)}>
      <div className="flex items-start gap-3">
        <div className={cn("-mt-0.5", styles.icon)}>
          <WarningIcon />
        </div>
        <div>
          <h4 className="mb-1 text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
          {linkHref && (
            <Link
              href={linkHref}
              className="mt-3 inline-block text-sm font-medium text-gray-500 underline dark:text-gray-400"
            >
              {linkText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
