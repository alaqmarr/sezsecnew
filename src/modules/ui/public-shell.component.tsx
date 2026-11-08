"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  UserPlus,
  X,
} from "lucide-react";
import { cn, formatIST, getMisriDate } from "@sezsec/shared";
import type { SessionUser } from "@sezsec/auth/auth.types";
import { FatimidRosette } from "./arabesque.component";
import { Button } from "./button.component";
import { IosSpinner } from "./ios-loader.component";
import { notify } from "./toast.helper";

const PUBLIC_NAV = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Calendar" },
  { href: "/menu", label: "Menu" },
  { href: "/our-events", label: "Blogs" },
  { href: "/khidmat", label: "Khidmat Invitation" },
] as const;

export function PublicShell({
  todayIso,
  user,
  children,
}: {
  todayIso: string;
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const misri = getMisriDate(todayIso);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      notify.info("Signed out");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Slim Heritage Hijri & Gregorian Date Strip */}
      <div className="w-full border-b border-[#4E1212] bg-[#4A1114] text-[#FAF7F2]">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs sm:px-6 lg:px-10 xl:px-14">
          <div className="flex flex-wrap items-center gap-2 text-[#F5DFB0]">
            <FatimidRosette size={12} className="text-[#E2BD75]" />
            <span className="font-medium tracking-wide text-[#FAF7F2]">
              {formatIST(todayIso, "EEEE, dd MMMM yyyy")}
            </span>
            <span className="opacity-45">•</span>
            <span>{misri.formattedEn}</span>
          </div>
          <span
            dir="rtl"
            className="font-arabic text-sm text-[#F5DFB0] sm:text-base"
          >
            {misri.formattedAr}
          </span>
        </div>
      </div>

      {/* Main Sticky Navigation Bar — Clean & Uncluttered */}
      <header className="sticky top-0 z-40 w-full border-b border-[#E5DDD0] bg-white/95 backdrop-blur-md">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10 xl:px-14">
          {/* Brand */}
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-no-bg.png"
              alt="Shabab Ul Eidiz Zahabi"
              className="h-10 w-10 shrink-0 rounded-xl border border-[#EAE2D6] bg-[#FBF6EB] object-contain p-1"
            />
            <div className="min-w-0">
              <span className="block truncate font-editorial text-lg font-bold leading-none text-[#231917] sm:text-xl">
                SEZ
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[#6A1B1B]">
                Secunderabad
              </span>
            </div>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            {PUBLIC_NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors whitespace-nowrap",
                    active
                      ? "bg-[#6A1B1B] text-[#FAF7F2]"
                      : "text-[#4A3B36] hover:bg-[#F3EFE6] hover:text-[#6A1B1B]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right CTA & Auth */}
          <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
            {user ? (
              <>
                <Link
                  href={user.role === "ADMIN" ? "/admin/accounts" : "/fees"}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<LayoutDashboard className="h-3.5 w-3.5" />}
                  >
                    {user.role === "ADMIN" ? "Admin Panel" : "My Access"}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  title="Sign out"
                >
                  {signingOut ? (
                    <IosSpinner size="xs" tone="maroon" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<LogIn className="h-3.5 w-3.5" />}
                >
                  Login
                </Button>
              </Link>
            )}

            <Link href="/join">
              <Button
                variant="primary"
                size="sm"
                icon={<UserPlus className="h-3.5 w-3.5" />}
              >
                Join Us
              </Button>
            </Link>
          </div>

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-xl border border-[#DCD2C2] bg-white p-2 text-[#231917] lg:hidden cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Menu */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[95] flex justify-end lg:hidden">
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-[#231917]/50 backdrop-blur-[2px]"
          />
          <div className="relative z-10 flex h-full w-76 max-w-[85vw] flex-col justify-between border-l border-[#D9C398] bg-[#FAF7F2] p-5 shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#E5DDD0] pb-3.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-no-bg.png"
                    alt="SEZ"
                    className="h-8 w-8 rounded-lg border border-[#EAE2D6] bg-white object-contain p-1"
                  />
                  <div>
                    <span className="block font-editorial text-base font-bold leading-none text-[#231917]">
                      SEZ
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-[#6A1B1B]">
                      Secunderabad
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-[#5E4F4A] hover:bg-[#EAE2D6] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {PUBLIC_NAV.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "bg-[#6A1B1B] text-[#FAF7F2]"
                          : "text-[#3D2E2A] hover:bg-[#EAE2D6]"
                      )}
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-2.5 border-t border-[#E5DDD0] pt-4">
              {user ? (
                <>
                  <Link
                    href={user.role === "ADMIN" ? "/admin/accounts" : "/fees"}
                    onClick={() => setMobileOpen(false)}
                    className="block"
                  >
                    <Button variant="secondary" className="w-full">
                      {user.role === "ADMIN" ? "Admin Panel" : "My Access"}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full"
                    loading={signingOut}
                    onClick={handleSignOut}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block"
                >
                  <Button variant="secondary" className="w-full">
                    Login
                  </Button>
                </Link>
              )}

              <Link
                href="/join"
                onClick={() => setMobileOpen(false)}
                className="block"
              >
                <Button variant="primary" className="w-full">
                  Join Committee
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content — Full Width */}
      <main className="w-full flex-1">{children}</main>

      {/* Heritage Footer — Matching sezsec.org Structure & Content */}
      <footer className="w-full border-t-2 border-[#B8924A] bg-[#2B0F14] text-[#EAE0D2]">
        <div className="grid w-full grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-12 lg:px-10 xl:px-14">
          {/* Column 1: Brand & Motto */}
          <div className="space-y-4 md:col-span-5">
            <div className="flex items-center gap-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-no-bg.png"
                alt="SEZ Logo"
                className="h-14 w-14 rounded-xl border border-[#B8924A]/40 bg-[#FAF7F2] object-contain p-1.5"
              />
              <div>
                <p dir="rtl" className="font-arabic text-base text-[#E2BD75]">
                  شباب العيد الذهبي • سکندرآباد
                </p>
                <h3 className="font-editorial text-2xl font-bold leading-tight text-[#FAF7F2]">
                  Shabab Ul Eidiz Zahabi
                </h3>
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[#CFC2B2]">
              We Always Try To Reform &amp; Develop into a visionary committee
              to Sincerity and a mission of Service before self.
            </p>
          </div>

          {/* Column 2: Navigation */}
          <div className="space-y-4 md:col-span-3">
            <h4 className="font-editorial text-xl font-bold tracking-wide text-[#E2BD75]">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-sm text-[#E0D5C5]">
              <li>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E2BD75]"
                >
                  <span className="text-[#E2BD75]">›</span> Home
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E2BD75]"
                >
                  <span className="text-[#E2BD75]">›</span> Calendar
                </Link>
              </li>
              <li>
                <Link
                  href="/menu"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E2BD75]"
                >
                  <span className="text-[#E2BD75]">›</span> Menu
                </Link>
              </li>
              <li>
                <Link
                  href="/our-events"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E2BD75]"
                >
                  <span className="text-[#E2BD75]">›</span> Our Events
                </Link>
              </li>
              <li>
                <Link
                  href="/khidmat"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E2BD75]"
                >
                  <span className="text-[#E2BD75]">›</span> Khidmat Invitation
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Connect */}
          <div className="space-y-4 md:col-span-4">
            <h4 className="font-editorial text-xl font-bold tracking-wide text-[#E2BD75]">
              Connect
            </h4>
            <div className="flex items-start gap-2.5 text-sm text-[#CFC2B2]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E2BD75]" />
              <span>
                Burhani Housing Society,
                <br />
                Trimulgherry, Secunderabad.
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <a
                href="mailto:sezsecbad@gmail.com"
                className="flex items-center gap-2 font-medium text-[#FAF7F2] transition-colors hover:text-[#E2BD75]"
              >
                <Mail className="h-4 w-4 text-[#E2BD75]" />
                <span>sezsecbad@gmail.com</span>
              </a>
              <a
                href="mailto:secsez@gmail.com"
                className="flex items-center gap-2 font-medium text-[#FAF7F2] transition-colors hover:text-[#E2BD75]"
              >
                <Mail className="h-4 w-4 text-[#E2BD75]" />
                <span>secsez@gmail.com</span>
              </a>
            </div>
            <div className="pt-2">
              <Link href="/join" className="inline-block w-full sm:w-auto">
                <Button variant="brass" className="w-full sm:w-auto px-6">
                  Join Committee
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-4 py-4 text-xs text-[#A8988B] sm:px-6 lg:px-10 xl:px-14">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              © {new Date().getFullYear()} Shabab Ul Eidiz Zahabi. All rights
              reserved.
            </span>
            <span>Secunderabad • Umoor Mawarid Bashariya</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
