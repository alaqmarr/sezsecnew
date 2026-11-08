"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Blocks,
  BookOpen,
  Calendar,
  CalendarCheck2,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  HandHeart,
  History,
  Image as ImageIcon,
  IndianRupee,
  Landmark,
  Layers,
  LogOut,
  Megaphone,
  Menu,
  Network,
  Package,
  Settings,
  ShieldCheck,
  UserCheck,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { cn, formatIST, getMisriDate, ROLE_LABELS } from "@sezsec/shared";
import type { NavModuleInfo, SessionUser } from "@sezsec/auth/auth.types";
import { Badge } from "./badge.component";
import { Button } from "./button.component";
import { IosSpinner } from "./ios-loader.component";
import { notify } from "./toast.helper";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Landmark,
  Wallet,
  CalendarCheck2,
  UserCheck,
  Layers,
  Users,
  UserCog,
  UserPlus,
  HandHeart,
  Image: ImageIcon,
  BookOpen,
  Megaphone,
  FileSpreadsheet,
  Blocks,
  ShieldCheck,
  Settings,
  Calendar,
  Utensils,
  IndianRupee,
  Package,
};

interface StaticNavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MEMBER_WORKSPACE_NAV: StaticNavLink[] = [
  { href: "/fees", label: "My Contributions & Fees", icon: Wallet },
  {
    href: "/admin/my-attendance-history",
    label: "My Attendance History",
    icon: History,
  },
  { href: "/admin/team", label: "Floor Hierarchy Tree", icon: Network },
  { href: "/profile", label: "My Profile & Security", icon: UserCircle },
];

const COMMUNITY_QUICK_NAV: StaticNavLink[] = [
  { href: "/events", label: "Miqaat Calendar", icon: Calendar },
  { href: "/menu", label: "Jaman Menu & Thaals", icon: Utensils },
  { href: "/inventory", label: "Jamaat Vessel Store", icon: Package },
];

export function PortalShell({
  user,
  navModules,
  todayIso,
  bridgeReachable,
  eventsPortalPublicUrl,
  children,
}: {
  user: SessionUser;
  navModules: NavModuleInfo[];
  todayIso: string;
  bridgeReachable: boolean;
  eventsPortalPublicUrl: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const todayMisri = getMisriDate(todayIso);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      notify.info("Signed out", "You have been signed out safely.");
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  // Deduplicate module links by path so sidebar never repeats items
  const moduleNavItems: StaticNavLink[] = [];
  const seenPaths = new Set<string>(
    [...MEMBER_WORKSPACE_NAV, ...COMMUNITY_QUICK_NAV].map((i) => i.href)
  );

  for (const mod of navModules) {
    const IconComp = (mod.icon && ICON_MAP[mod.icon]) || Layers;
    for (const link of mod.links) {
      if (!link.path || link.path.includes("[") || seenPaths.has(link.path)) {
        continue;
      }
      seenPaths.add(link.path);
      moduleNavItems.push({
        href: link.path,
        label: link.label || mod.name,
        icon: IconComp,
      });
    }
  }

  function isLinkActive(href: string): boolean {
    if (pathname === href) return true;
    if (
      href === "/admin/attendance" &&
      pathname.startsWith("/admin/attendance-details")
    ) {
      return false;
    }
    if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
    return false;
  }

  const renderLinkList = (title: string, items: StaticNavLink[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C7B73]">
          {title}
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isLinkActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors",
                active
                  ? "bg-[#6A1B1B] text-[#FAF7F2] shadow-xs"
                  : "text-[#4A3B36] hover:bg-[#EAE2D6]/70 hover:text-[#231917]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-[#F5DFB0]" : "text-[#7B6B63]"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  };

  const renderSidebar = (showClose = false) => (
    <div className="flex h-full flex-col justify-between border-r border-[#E5DDD0] bg-[#FAF7F2]">
      <div className="space-y-5 overflow-y-auto p-3.5">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-[#D9C398] bg-white p-2.5 shadow-2xs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-no-bg.png"
              alt="SEZ Crest"
              className="h-9 w-9 shrink-0 rounded-xl border border-[#EAE2D6] bg-[#FBF6EB] object-contain p-0.5"
            />
            <div className="min-w-0">
              <p
                dir="rtl"
                className="font-arabic truncate text-sm leading-tight text-[#6A1B1B]"
              >
                شباب العيد الذهبي
              </p>
              <p className="truncate text-xs font-bold text-[#231917]">
                SEZ Members Portal
              </p>
            </div>
          </Link>
          {showClose ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
              className="shrink-0 rounded-xl border border-[#DCD2C2] bg-white p-2 text-[#5E4F4A] hover:bg-[#EAE2D6] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav className="space-y-5">
          {renderLinkList("My Member Hub", MEMBER_WORKSPACE_NAV)}
          {renderLinkList("Management & Khidmat", moduleNavItems)}
          {renderLinkList("Jamaat & Store", COMMUNITY_QUICK_NAV)}
        </nav>
      </div>

      <div className="space-y-2.5 border-t border-[#E5DDD0] bg-white/90 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-bold text-[#231917]">
                {user.name || user.username}
              </p>
              {user.its ? <Badge tone="brass">{user.its}</Badge> : null}
            </div>
            <p className="truncate text-[11px] text-[#7B6B63]">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={handleLogout}
            disabled={signingOut}
            title="Sign out"
          >
            {signingOut ? (
              <IosSpinner size="xs" tone="maroon" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Rail */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{renderSidebar(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[95] flex lg:hidden">
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-[#1B1210]/45 backdrop-blur-[1px]"
          />
          <div className="relative z-10 h-full w-72 max-w-[86vw]">
            {renderSidebar(true)}
          </div>
        </div>
      ) : null}

      {/* Full-Width Workspace Column — ZERO horizontal margin waste */}
      <div className="flex min-w-0 flex-1 flex-col w-full">
        <header className="sticky top-0 z-30 w-full border-b border-[#E5DDD0] bg-white/92 backdrop-blur-md">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="shrink-0 rounded-xl border border-[#DCD2C2] p-2 text-[#231917] lg:hidden cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm">
                <span className="font-semibold text-[#231917]">
                  {formatIST(todayIso, "EEEE, dd MMMM yyyy")}
                </span>
                <span className="hidden text-[#C5B397] sm:inline">•</span>
                <span className="text-[#6E5D55]">{todayMisri.formattedEn}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span
                dir="rtl"
                className="font-arabic hidden text-base text-[#6A1B1B] xl:inline"
              >
                {todayMisri.formattedAr}
              </span>

              <span
                title={
                  bridgeReachable
                    ? "Internal loopback connected to Jamaat Events (:3333)"
                    : "Jamaat Events (:3333) bridge offline"
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  bridgeReachable
                    ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#166534]"
                    : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    bridgeReachable ? "bg-[#16A34A]" : "bg-[#D97706]"
                  )}
                />
                <span className="hidden sm:inline">
                  Events Bridge {bridgeReachable ? "Live" : "Offline"}
                </span>
              </span>

              {user.role === "ADMIN" || user.role === "MANAGER" ? (
                <a
                  href={eventsPortalPublicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-[#DCD2C2] bg-[#FAF7F2] px-2.5 py-1 text-xs font-semibold text-[#3D2E2A] hover:border-[#B8924A] hover:bg-[#FBF6EB]"
                >
                  <span>Bookings App</span>
                  <ExternalLink className="h-3 w-3 text-[#8C7B73]" />
                </a>
              ) : null}

              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-xl border border-[#DCD2C2] bg-white px-2.5 py-1 text-xs font-semibold text-[#3D2E2A] hover:border-[#B8924A] hover:bg-[#FBF6EB]"
              >
                <Globe className="h-3.5 w-3.5 text-[#6A1B1B]" />
                <span>Public Site</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
