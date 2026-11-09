import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentSessionUser } from "@sezsec/auth";
import { db } from "@sezsec/db";
import { FatimidRosette } from "@sezsec/ui";
import { LoginClientForm } from "./login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  await connection();
  const [session, userCount, params] = await Promise.all([
    getCurrentSessionUser(),
    db.user.count(),
    searchParams,
  ]);

  if (session) {
    redirect(
      params.callbackUrl ||
        (session.role === "ADMIN" ? "/admin/accounts" : "/fees")
    );
  }

  const canInitialSync = userCount === 0;

  return (
    <div className="flex min-h-screen w-full flex-col justify-between px-4 py-6 sm:px-8 lg:px-12">
      <div className="flex w-full items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#5E4F4A] hover:text-[#6A1B1B]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-no-bg.png"
            alt="SEZ Crest"
            className="h-9 w-9 rounded-xl border border-[#D9C398] bg-white object-contain p-1"
          />
          <span>← Return to Public Portal</span>
        </Link>
        <span
          dir="rtl"
          className="font-arabic text-lg text-[#6A1B1B] sm:text-xl"
        >
          شباب العيد الذهبي • سکندرآباد
        </span>
      </div>

      <div className="my-8 grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-12 xl:gap-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D9C398] bg-[#FBF6EB] px-3.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#6A1B1B]">
            <FatimidRosette size={13} />
            <span>Secunderabad Jamaat • Member Workspace</span>
          </div>
          <h1 className="font-editorial text-4xl font-bold leading-tight text-[#231917] sm:text-5xl">
            Shabab Ul Eidiz Zahabi Members, Finance &amp; Khidmat Portal
          </h1>
          <p className="text-base leading-relaxed text-[#5E4F4A]">
            Sign in with your 8-digit ITS number or committee username to view
            monthly contributions, scan &amp; pay event funds, review floor
            hierarchy, and mark live miqaat attendance.
          </p>

          <div className="grid grid-cols-1 gap-6 border-t border-[#E5DDD0] pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
                Contributions
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#5E4F4A]">
                Monthly ledger, event funds &amp; instant UPI QR receipts.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
                Live Attendance
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#5E4F4A]">
                Floor-wise roll call synchronized with Jamaat Miqaats.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
                Jaman &amp; Halls
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#5E4F4A]">
                Real-time hall thaal counts &amp; store vessel visibility.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <LoginClientForm
            callbackUrl={params.callbackUrl}
            canInitialSync={canInitialSync}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DDD0] pt-4 text-xs text-[#8C7B73]">
        <span>Shabab Ul Eidiz Zahabi • Secunderabad Jamaat</span>
        <span>Not yet a member? Apply via Join SEZ on the public portal.</span>
      </div>
    </div>
  );
}
