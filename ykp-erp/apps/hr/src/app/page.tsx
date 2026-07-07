import { redirect } from "next/navigation";

/**
 * Root entry. The actual UI lives under the (dashboard) route group so
 * we redirect to /attendance (the most-used surface) instead of rendering
 * a duplicate home page.
 */
export default function RootPage(): JSX.Element {
  redirect("/attendance");
}