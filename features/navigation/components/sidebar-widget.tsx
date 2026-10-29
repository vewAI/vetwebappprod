import Link from "next/link";

/**
 * Adapted from TailAdmin React SidebarWidget (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
export function SidebarWidget() {
  return (
    <div className="mx-auto w-full max-w-60 rounded-2xl bg-gray-50 px-4 py-5 text-center dark:bg-white/[0.03]">
      <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">VewAI</h3>
      <p className="mb-4 text-theme-sm text-gray-500 dark:text-gray-400">
        VEWAI helps veterinary learners develop communication skills through realistic roleplay, structured
        feedback and repeat practice.
      </p>
      <Link
        href="/"
        className="flex items-center justify-center rounded-lg bg-brand-500 p-3 text-theme-sm font-medium text-white hover:bg-brand-600"
      >
        Learn More
      </Link>
    </div>
  );
}
