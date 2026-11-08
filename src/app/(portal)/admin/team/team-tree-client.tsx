"use client";

import React, { useMemo, useState } from "react";
import { Crown, Layers, Shield, Users } from "lucide-react";
import { cn } from "@sezsec/shared";
import { Badge, Card, CardBody, CardHeader, SearchInput } from "@sezsec/ui";

interface FloorPerson {
  id: string;
  name: string | null;
  username: string;
  its: string | null;
  mobile: string | null;
}

interface FloorTreeData {
  id: string;
  name: string;
  heads: FloorPerson[];
  subHeads: FloorPerson[];
  members: FloorPerson[];
}

export function TeamTreeClient({
  floors,
  currentUserId,
}: {
  floors: FloorTreeData[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");

  const filteredFloors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return floors;
    const matchPerson = (p: FloorPerson) =>
      (p.name || "").toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      (p.its || "").toLowerCase().includes(q);
    return floors.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.heads.some(matchPerson) ||
        f.subHeads.some(matchPerson) ||
        f.members.some(matchPerson)
    );
  }, [floors, query]);

  const renderPersonChip = (
    p: FloorPerson,
    tier: "HEAD" | "SUBHEAD" | "MEMBER"
  ) => {
    const isMe = p.id === currentUserId;
    return (
      <div
        key={`${tier}-${p.id}`}
        className={cn(
          "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs",
          isMe
            ? "border-[#6A1B1B] bg-[#FBF6EB] ring-1 ring-[#6A1B1B]/20"
            : tier === "HEAD"
              ? "border-[#D9C398] bg-[#FBF6EB]/70"
              : tier === "SUBHEAD"
                ? "border-[#E5DDD0] bg-[#FAF7F2]"
                : "border-[#EAE2D6] bg-white"
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold text-[#231917]">
              {p.name || p.username}
            </span>
            {isMe ? <Badge tone="maroon">YOU</Badge> : null}
          </div>
          <p className="truncate text-[11px] text-[#7B6B63]">
            {p.its ? `ITS ${p.its}` : `@${p.username}`}
            {p.mobile ? ` • ${p.mobile}` : ""}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search floor name, member name, or ITS…"
          className="w-full sm:w-96"
        />
        <span className="text-xs font-semibold text-[#7B6B63]">
          {filteredFloors.length} floor team
          {filteredFloors.length === 1 ? "" : "s"}
        </span>
      </div>

      {filteredFloors.length === 0 ? (
        <Card className="p-10 text-center text-sm text-[#7B6B63]">
          No floor hierarchy groups match your search.
        </Card>
      ) : (
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredFloors.map((floor) => {
            const total =
              floor.heads.length + floor.subHeads.length + floor.members.length;
            return (
              <Card key={floor.id}>
                <CardHeader
                  icon={<Layers className="h-4 w-4" />}
                  title={floor.name}
                  subtitle={`${total} assigned committee brother(s)`}
                />
                <CardBody className="space-y-4">
                  {/* Heads */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                      <Crown className="h-3.5 w-3.5" />
                      <span>Floor Heads ({floor.heads.length})</span>
                    </div>
                    {floor.heads.length === 0 ? (
                      <p className="text-xs text-[#8C7B73]">None assigned</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {floor.heads.map((p) => renderPersonChip(p, "HEAD"))}
                      </div>
                    )}
                  </div>

                  {/* Sub-Heads */}
                  <div className="space-y-2 border-t border-[#EAE2D6] pt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8C6422]">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Floor Sub-Heads ({floor.subHeads.length})</span>
                    </div>
                    {floor.subHeads.length === 0 ? (
                      <p className="text-xs text-[#8C7B73]">None assigned</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {floor.subHeads.map((p) =>
                          renderPersonChip(p, "SUBHEAD")
                        )}
                      </div>
                    )}
                  </div>

                  {/* Members */}
                  <div className="space-y-2 border-t border-[#EAE2D6] pt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5E4F4A]">
                      <Users className="h-3.5 w-3.5" />
                      <span>Floor Members ({floor.members.length})</span>
                    </div>
                    {floor.members.length === 0 ? (
                      <p className="text-xs text-[#8C7B73]">None assigned</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {floor.members.map((p) => renderPersonChip(p, "MEMBER"))}
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
