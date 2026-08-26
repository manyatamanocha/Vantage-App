import { redirect } from "next/navigation";

// The Solve section has no landing page of its own — "/solve" only exists
// as a Back-button/nav target (see components/back-button.tsx and
// components/nav-links.tsx, both of which treat "/solve" as the section
// root); the real entry point has always been "/solve/new".
export default function SolveSectionRoot() {
  redirect("/solve/new");
}
