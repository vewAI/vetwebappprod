import { redirect } from "next/navigation";

// Minimal shim to preserve legacy static route while canonical route is
// served by the dynamic handler. Redirects to the dynamic case view.
export default function Page() {
  redirect("/case/1");
}
