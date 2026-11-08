import "dotenv/config";
import {
  fetchBridgeHalls,
  syncInboundBridgeHalls,
} from "../src/modules/bridge/bridge.module";
import {
  db,
  getDatabaseHealth,
  sqliteAdapterFactory,
  withWriteLock,
} from "../src/modules/db/db.module";
import { syncInitialPortalDataIfEmpty } from "../src/modules/migration/migration.module";
import {
  DEFAULT_SEZSEC_MODULES,
  EVENT_CHARGES_MODULE_ID,
} from "../src/modules/rbac/rbac.constants";

async function main() {
  console.log("── Sanctioning SEZSEC Portal SQLite Database ──");
  const health = await getDatabaseHealth();
  console.log(`  • Database file : ${health.filePath}`);
  console.log(`  • Journal mode  : ${health.pragmas.journalMode}`);
  console.log(`  • Foreign keys  : ${health.pragmas.foreignKeys ? "ON" : "OFF"}`);

  if (health.pragmas.journalMode.toLowerCase() !== "wal") {
    throw new Error(
      `Expected SQLite journal_mode=WAL, got ${health.pragmas.journalMode}`
    );
  }
  if (!health.pragmas.foreignKeys) {
    throw new Error("Expected SQLite foreign_keys=ON");
  }

  await withWriteLock(async () => {
    for (const mod of DEFAULT_SEZSEC_MODULES) {
      const existingById = await db.module.findUnique({
        where: { id: mod.id },
        include: { links: true },
      });
      const existingByName = await db.module.findUnique({
        where: { name: mod.name },
      });

      if (!existingById && !existingByName) {
        await db.module.create({
          data: {
            id: mod.id,
            name: mod.name,
            description: mod.description,
            icon: mod.icon,
            links: {
              create: mod.links.map((l) => ({
                path: l.path,
                label: l.label,
                order: l.order,
              })),
            },
          },
        });
      } else if (
        existingById &&
        existingById.links.length === 0 &&
        mod.links.length > 0
      ) {
        await db.moduleLink.createMany({
          data: mod.links.map((l) => ({
            moduleId: existingById.id,
            path: l.path,
            label: l.label,
            order: l.order,
          })),
        });
      }
    }

    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      await db.userModuleAccess.upsert({
        where: {
          userId_moduleId: {
            userId: admin.id,
            moduleId: EVENT_CHARGES_MODULE_ID,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          moduleId: EVENT_CHARGES_MODULE_ID,
        },
      });
    }
  });

  const forceInventorySync =
    process.argv.includes("--sync-inventory") ||
    process.argv.includes("--force-sync");
  const existingUsers = await db.user.count();

  if (existingUsers === 0 || forceInventorySync) {
    console.log("  • Syncing portal data from Inventory App (sezinv)...");
    try {
      const syncRes = await syncInitialPortalDataIfEmpty({
        force: forceInventorySync,
      });
      if (syncRes.synced) {
        console.log(`  • Sync source   : ${syncRes.sourceLabel}`);
        console.log(
          `  • Imported ${syncRes.totalImported} records (${syncRes.usersSynced} users) in ${syncRes.durationMs}ms`
        );
      } else {
        console.log("  • Local users already present; skipping initial sync.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  • [WARN] Inventory App sync deferred: ${msg}`);
    }
  } else {
    try {
      const halls = await fetchBridgeHalls();
      if (halls.length > 0) {
        const hallRes = await syncInboundBridgeHalls(halls);
        if (hallRes.syncedCount > 0) {
          console.log(
            `  • Provisioned ${hallRes.syncedCount} new hall permission module(s) from Inventory App`
          );
        }
      }
    } catch {
      // Loopback bridge optional during offline schema maintenance
    }
  }

  sqliteAdapterFactory.checkpointWalPassive();

  const [userCount, moduleCount] = await Promise.all([
    db.user.count(),
    db.module.count(),
  ]);
  console.log(`  • Modules ready : ${moduleCount}`);
  console.log(`  • Users present : ${userCount}`);
  console.log("── Database sanction complete ──");
}

main()
  .catch((err) => {
    console.error("[sanction-db] Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect().catch(() => null);
  });
