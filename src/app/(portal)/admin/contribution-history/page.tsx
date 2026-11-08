import { renderMemberFeesView } from "@/app/(portal)/fees/page";

export default async function LegacyContributionHistoryAliasPage() {
  return renderMemberFeesView("HISTORY");
}
