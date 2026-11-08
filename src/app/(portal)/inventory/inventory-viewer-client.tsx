"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Layers, Package } from "lucide-react";
import type { BridgeInventoryItem } from "@sezsec/bridge/bridge.types";
import { cn } from "@sezsec/shared";
import {
  Badge,
  Card,
  CardBody,
  SearchInput,
  StatTile,
} from "@sezsec/ui";

export function InventoryViewerClient({
  items,
}: {
  items: BridgeInventoryItem[];
}) {
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");

  const categories = useMemo(
    () => ["ALL", ...new Set(items.map((i) => i.category).filter(Boolean))],
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, category, query]);

  const totalUnits = items.reduce((s, i) => s + i.totalQuantity, 0);
  const availableUnits = items.reduce((s, i) => s + i.availableQuantity, 0);
  const issuedUnits = Math.max(0, totalUnits - availableUnits);

  return (
    <div className="space-y-6">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Vessel Categories"
          value={Math.max(0, categories.length - 1)}
          sublabel={`${items.length} distinct store items`}
          icon={<Layers className="h-5 w-5" />}
          tone="maroon"
        />
        <StatTile
          label="Total Store Stock"
          value={totalUnits.toLocaleString("en-IN")}
          sublabel="Registered vessel units"
          icon={<Package className="h-5 w-5" />}
          tone="brass"
        />
        <StatTile
          label="Available in Store"
          value={availableUnits.toLocaleString("en-IN")}
          sublabel="Ready for upcoming miqaats"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="sage"
        />
        <StatTile
          label="Currently Issued / Out"
          value={issuedUnits.toLocaleString("en-IN")}
          sublabel="Allocated to active events"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                category === cat
                  ? "border-[#6A1B1B] bg-[#6A1B1B] text-[#FAF7F2]"
                  : "border-[#DCD2C2] bg-white text-[#5E4F4A] hover:border-[#B8924A]"
              )}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search vessel or category…"
          className="w-full sm:w-80"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-[#7B6B63]">
          {items.length === 0
            ? "Store inventory is currently offline or empty on Jamaat Events (:3333)."
            : "No vessels match your search filter."}
        </Card>
      ) : (
        <Card>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] text-[11px] font-bold uppercase tracking-wider text-[#7B6B63]">
                  <th className="py-2.5 pr-4">Item Name</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Available</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 pl-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {filtered.map((item) => {
                  const ratio =
                    item.totalQuantity > 0
                      ? item.availableQuantity / item.totalQuantity
                      : 1;
                  return (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 font-bold text-[#231917]">
                        {item.name}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone="brass">{item.category}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#166534] tabular-nums">
                        {item.availableQuantity} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#5E4F4A] tabular-nums">
                        {item.totalQuantity} {item.unit}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <Badge
                          tone={
                            item.availableQuantity === 0
                              ? "danger"
                              : ratio < 0.35
                                ? "warning"
                                : "success"
                          }
                        >
                          {item.availableQuantity === 0
                            ? "All Issued"
                            : ratio < 0.35
                              ? "Low Stock"
                              : "In Stock"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
