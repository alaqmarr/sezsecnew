import { connection } from "next/server";
import { db } from "@sezsec/db";
import { formatIST } from "@sezsec/shared";
import { PageHeader } from "@sezsec/ui";
import { ChroniclesClient } from "./chronicles-client";

export default async function PublicOurEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ read?: string }>;
}) {
  await connection();
  const [blogs, params] = await Promise.all([
    db.blog.findMany({
      orderBy: { publishedAt: "desc" },
    }),
    searchParams,
  ]);

  const items = blogs.map((b) => ({
    id: b.id,
    title: b.title,
    content: b.content,
    author: b.author,
    publishedFormatted: formatIST(b.publishedAt, "dd MMMM yyyy"),
  }));

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <PageHeader
        eyebrow="Community Chronicles"
        title="SEZ Reports, Miqaat Highlights & Reflections"
        subtitle="Stories of Khidmat, community drives, and Jamaat milestones across Secunderabad."
      />
      <ChroniclesClient items={items} initialOpenId={params.read} />
    </div>
  );
}
