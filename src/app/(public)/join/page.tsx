import { Card, KeelArchBanner, PageHeader } from "@sezsec/ui";
import { JoinFormClient } from "./join-form-client";

export default function PublicJoinPage() {
  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <PageHeader
        eyebrow="Membership Application"
        title="Join Shabab Ul Eidiz Zahabi, Secunderabad"
        subtitle="Apply to serve in Secunderabad Jamaat's Shabab committee under Umoor Mawarid Bashariya."
      />

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="space-y-4 p-6 sm:p-8 lg:col-span-4">
          <KeelArchBanner
            arabicTitle="شباب العيد الذهبي"
            subtitle="Brotherhood • Discipline • Khidmat"
          />
          <h2 className="font-editorial text-2xl font-bold text-[#231917]">
            Eligibility &amp; Commitment
          </h2>
          <p className="text-xs leading-relaxed text-[#5E4F4A]">
            Membership is open to Mumineen brothers of Secunderabad Jamaat with
            a valid 8-digit ITS number who wish to participate actively in
            Miqaat intezam, floor jaman khidmat, and community welfare.
          </p>
          <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-4 text-xs text-[#3D2E2A] space-y-1.5">
            <p className="font-bold text-[#6A1B1B]">What happens after applying?</p>
            <p>
              1. Your application enters the SEZ Secretariat review queue.
            </p>
            <p>
              2. Upon approval, your 8-digit ITS account is provisioned and
              assigned to a Floor Head.
            </p>
          </div>
        </Card>

        <Card doubleFrame className="p-6 sm:p-8 lg:col-span-8">
          <JoinFormClient />
        </Card>
      </div>
    </div>
  );
}
