import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button, Card } from "@sezsec/ui";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-12">
      <Card doubleFrame className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-editorial text-3xl font-bold text-[#231917]">
          Restricted Workspace Section
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5E4F4A]">
          Your member account does not currently have module access for this
          administrative section. Contact a SEZ Administrator if you need access
          assigned.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/fees">
            <Button variant="primary">Go to My Member Hub</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Public Home</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
