import { HandHeart, CheckCircle2 } from "lucide-react";
import { Card, KeelArchBanner, PageHeader } from "@sezsec/ui";
import { KhidmatFormClient } from "./khidmat-form-client";

export default function PublicKhidmatPage() {
  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <PageHeader
        eyebrow="Khidmat-ul-Mumineen"
        title="Invite Shabab Ul Eidiz Zahabi for Khidmat"
        subtitle="Request disciplined jaman serving & venue khidmat for your family or community occasion."
      />

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="space-y-5 p-6 sm:p-8 lg:col-span-5">
          <KeelArchBanner
            arabicTitle="خدمة المؤمنين"
            subtitle="Orderly Ikraam & Zero-Israaf Service"
          />
          <div className="space-y-3 text-sm leading-relaxed text-[#4A3B36]">
            <p>
              Members of Shabab Ul Eidiz Zahabi Secunderabad volunteer to assist
              Mumineen families during Nikah, Misaaq, Ruqsat, Bismillah, and
              Shukar Niyaz jaman gatherings at Jamaat Khana halls.
            </p>
            <div className="space-y-2.5 pt-2">
              {[
                "Submit your request at least 5–7 days prior to the occasion.",
                "Ensure Jamaat Hall Booking & Raza formalities are completed first.",
                "Our Floor Coordinator will reach out on WhatsApp to confirm expected thaals & hall assignment.",
              ].map((pt) => (
                <div key={pt} className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2A6041]" />
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-4 text-xs text-[#6A1B1B]">
            <div className="flex items-center gap-2 font-bold">
              <HandHeart className="h-4 w-4" />
              <span>Fi-Sabilillah Khidmat</span>
            </div>
            <p className="mt-1 text-[#5E4F4A]">
              All SEZ volunteer khidmat is rendered purely fi-sabilillah for the
              ikraam of Mumineen.
            </p>
          </div>
        </Card>

        <Card doubleFrame className="p-6 sm:p-8 lg:col-span-7">
          <KhidmatFormClient />
        </Card>
      </div>
    </div>
  );
}
