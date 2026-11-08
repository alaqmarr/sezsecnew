"use client";

import React, { useMemo, useState } from "react";
import { BookOpen, Calendar, User } from "lucide-react";
import { Button, Card, Drawer, SearchInput } from "@sezsec/ui";

export interface ChronicleItem {
  id: string;
  title: string;
  content: string;
  author: string;
  publishedFormatted: string;
}

export function ChroniclesClient({
  items,
  initialOpenId,
}: {
  items: ChronicleItem[];
  initialOpenId?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(initialOpenId || null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q)
    );
  }, [items, query]);

  const selected = useMemo(
    () => items.find((i) => i.id === activeId) || null,
    [items, activeId]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search chronicles by title, author, or topic…"
          className="w-full sm:w-96"
        />
        <span className="text-xs font-semibold text-[#7B6B63]">
          {filtered.length} chronicle{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-editorial text-2xl font-bold text-[#231917]">
            No Chronicles Found
          </p>
          <p className="mt-1 text-sm text-[#5E4F4A]">
            Check back soon for new community reports and announcements.
          </p>
        </Card>
      ) : (
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const excerpt = item.content
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            return (
              <Card
                key={item.id}
                className="flex flex-col justify-between p-6 transition-colors hover:border-[#B8924A]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#8C7B73]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {item.publishedFormatted}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {item.author}
                    </span>
                  </div>
                  <h2 className="mt-2.5 font-editorial text-2xl font-bold text-[#231917]">
                    {item.title}
                  </h2>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-[#5E4F4A]">
                    {excerpt}
                  </p>
                </div>

                <div className="mt-5 border-t border-[#EAE2D6] pt-4">
                  <Button
                    size="sm"
                    variant="brass"
                    icon={<BookOpen className="h-3.5 w-3.5" />}
                    onClick={() => setActiveId(item.id)}
                  >
                    Read Full Chronicle
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setActiveId(null)}
        title={selected?.title || "Chronicle"}
        subtitle={
          selected
            ? `${selected.publishedFormatted} • By ${selected.author}`
            : undefined
        }
        widthClass="max-w-3xl"
      >
        {selected ? (
          <article
            className="chronicle-prose text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: selected.content }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
