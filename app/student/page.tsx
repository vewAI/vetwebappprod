import { redirect } from "next/navigation";

/**
 * Redirect /student to the main dashboard.
 * This route doesn't exist - students should use the main dashboard at /.
 */
export default function StudentRedirect() {
  redirect("/");
}
