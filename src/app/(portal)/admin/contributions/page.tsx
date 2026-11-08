import { renderMemberFeesView } from "@/app/(portal)/fees/page";

export default async function LegacyContributionsAliasPage() {
  return renderMemberFeesView("PENDING");
}
