import { connection } from "next/server";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { fetchBridgeInventory, getPublicJamateventsUrl } from "@sezsec/bridge";
import { requireServerSession } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { InventoryViewerClient } from "./inventory-viewer-client";

export default async function StoreInventoryBridgePage() {
  await connection();
  const user = await requireServerSession();
  const inventoryRes = await fetchBridgeInventory()
    .then((items) => ({ items, offline: false }))
    .catch(() => ({ items: [], offline: true }));
  const items = inventoryRes.items;
  const bridgeOffline = inventoryRes.offline;
  const eventsUrl = getPublicJamateventsUrl();

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Internal Server-to-Server Bridge (:3333)"
        title="Jamaat Vessel Store & Assets"
        subtitle="Real-time stock levels of thaals, kunali, sarkari sets, and utensils from Jamaat Events & Store."
        actions={
          user.role === "ADMIN" || user.role === "MANAGER" ? (
            <a
              href={`${eventsUrl}/inventory`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="brass"
                size="sm"
                icon={<ExternalLink className="h-3.5 w-3.5" />}
              >
                Manage Issue / Return on Store App
              </Button>
            </a>
          ) : undefined
        }
      />

      {bridgeOffline ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#D9A94E] bg-[#FDF8EC] px-4 py-3.5 text-sm text-[#5A3F0D]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B87A14]" />
          <div>
            <p className="font-semibold">
              Jamaat Events &amp; Store service (Port 3333) is currently
              offline.
            </p>
            <p className="mt-0.5 text-xs opacity-90">
              Ensure <code>sezinv</code> is running on port 3333 to inspect live
              vessel inventory stock.
            </p>
          </div>
        </div>
      ) : null}

      <InventoryViewerClient items={items} />
    </div>
  );
}
