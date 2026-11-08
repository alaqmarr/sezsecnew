import Link from "next/link";
import { connection } from "next/server";
import {
  Activity,
  ArrowRight,
  Building2,
  ClipboardList,
  GraduationCap,
  HandHeart,
  Handshake,
  Moon,
  Package,
  Scissors,
  Trophy,
  Utensils,
} from "lucide-react";
import { fetchBridgeMenu } from "@sezsec/bridge";
import { db } from "@sezsec/db";
import { Button, FatimidRosette } from "@sezsec/ui";
import { HomeBannerCarousel } from "./home-banner-carousel";
import { HomeMenuAlert } from "./home-menu-alert";

const KHIDMATS = [
  {
    title: "Jaman & Niyaz",
    icon: Utensils,
    description: "Serving community meals with dedication.",
  },
  {
    title: "Masjid Tanzeem",
    icon: Building2,
    description: "Maintaining cleanliness and order in the Masjid.",
  },
  {
    title: "10mi Raat Majlis",
    icon: Moon,
    description: "Organizing religiously significant gatherings.",
  },
  {
    title: "Jamaat Survey",
    icon: ClipboardList,
    description: "Door-to-door data collection for community welfare.",
  },
  {
    title: "FMB Khidmat",
    icon: Package,
    description: "Faiz al-Mawaid al-Burhaniyah distribution.",
  },
  {
    title: "Upliftment Projects",
    icon: HandHeart,
    description: "Initiatives to support underprivileged families.",
  },
  {
    title: "Qardan Hasana",
    icon: Handshake,
    description: "Interest-free benevolent loans.",
  },
  {
    title: "Medical",
    icon: Activity,
    description: "Healthcare support and medical camps.",
  },
  {
    title: "Zabihat",
    icon: Scissors,
    description: "Organizing systematic Zabihat services.",
  },
  {
    title: "Sports",
    icon: Trophy,
    description: "Community sports events and fitness activities.",
  },
  {
    title: "Minhat Talimiyah",
    icon: GraduationCap,
    description: "Educational grants and guidance.",
  },
] as const;

export default async function PublicHomePage() {
  await connection();

  const [banners, todaysEvent] = await Promise.all([
    db.banner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    fetchBridgeMenu("today").catch(() => null),
  ]);

  const serializedBanners = banners.map((b) => ({
    id: b.id,
    imageUrl: b.imageUrl,
    href: b.href,
    countdownTarget: b.countdownTarget ? b.countdownTarget.toISOString() : null,
    countdownLabel: b.countdownLabel,
    x: b.x,
    y: b.y,
    countdownSize: b.countdownSize,
    countdownColor: b.countdownColor,
  }));

  return (
    <div className="flex w-full flex-col">
      {/* Today's Event / Menu Coupon Alert (Attached seamlessly under header when scheduled) */}
      {todaysEvent ? (
        <HomeMenuAlert
          title={todaysEvent.description || todaysEvent.name}
          menu={todaysEvent.menu || "Menu details available on request."}
          time={todaysEvent.occasionTime}
          thaalCount={todaysEvent.thaalCount}
          halls={todaysEvent.hall || []}
          hallCounts={todaysEvent.hallCounts}
          occasionDateIso={todaysEvent.occasionDate.toISOString()}
        />
      ) : null}

      {/* 1. Banner + Centered Hero Section */}
      <div className="w-full space-y-12 px-3 py-6 sm:space-y-16 sm:px-6 sm:py-10 lg:px-10 xl:px-14">
        {serializedBanners.length > 0 ? (
          <HomeBannerCarousel banners={serializedBanners} />
        ) : null}

        <section className="mx-auto flex w-full max-w-4xl flex-col items-center py-4 text-center sm:py-8">
          <p
            dir="rtl"
            className="font-arabic text-xl text-[#6A1B1B] sm:text-2xl"
          >
            شباب العيد الذهبي
          </p>

          <h1 className="mt-3 font-editorial text-5xl font-bold leading-[1.05] tracking-tight text-[#2B0F14] sm:text-7xl lg:text-8xl">
            Shabab Ul
            <br />
            Eidiz Zahabi
          </h1>

          <div className="mt-6 flex items-center justify-center gap-4">
            <span className="h-[1.5px] w-12 bg-[#B8924A]" />
            <span className="inline-flex items-center gap-2 font-editorial text-xl italic tracking-wide text-[#5E4F4A] sm:text-2xl">
              <FatimidRosette size={13} className="text-[#B8924A]" />
              <span>Secunderabad</span>
              <FatimidRosette size={13} className="text-[#B8924A]" />
            </span>
            <span className="h-[1.5px] w-12 bg-[#B8924A]" />
          </div>

          <p className="mt-7 max-w-2xl text-base font-medium leading-relaxed text-[#4E3F3A] sm:text-lg">
            &ldquo;We Always Try To Reform &amp; Develop into a visionary
            committee to Sincerity and a mission of Service before self.&rdquo;
          </p>

          <div className="mt-9">
            <Link href="/join">
              <Button
                variant="primary"
                size="lg"
                className="px-8 py-3.5 text-base shadow-sm"
              >
                <span>Join the Committee</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>

      {/* 2. Our Mission Section */}
      <section className="relative w-full overflow-hidden border-y border-[#B8924A]/40 bg-gradient-to-b from-[#451115] to-[#6A1B1B] px-4 py-20 text-[#FAF7F2] sm:px-8 sm:py-24 lg:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(#E2BD75 1px, transparent 1px), radial-gradient(#E2BD75 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundPosition: "0 0, 14px 14px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-4xl space-y-8 text-center">
          <div className="space-y-3">
            <h2 className="font-editorial text-4xl font-bold tracking-wide text-[#E2BD75] sm:text-5xl">
              Our Mission
            </h2>
            <div className="mx-auto h-0.5 w-20 rounded-full bg-[#E2BD75]" />
          </div>

          <div className="space-y-6 text-base leading-relaxed text-[#F5EFE6] sm:text-lg md:text-xl">
            <p>
              With Raza Mubarak of Dai-al-Mutlaq Dr. Syedna Mohammed
              Burhanuddin Saheb (R.A) &amp; Syedna Aali Qadar Mufaddal Saifuddin
              (TUS), We Shabab Ul Eidiz Zahabi-Secunderabad, Under Umoor Mawarid
              Bashariya Stand tall to Perform various khidmat in our community
              with immense pride.
            </p>
            <p>
              The word{" "}
              <span className="font-semibold text-[#E2BD75]">
                &lsquo;khidmat&rsquo;
              </span>
              , when translated literally, means &lsquo;service not governed by
              reward&rsquo;. The word &lsquo;Shabab&rsquo;, when translated
              literally, means &lsquo;youth&rsquo;. However, the concept of
              youth is not in age, but the youthful nature that everyone has
              within themselves.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Our Khidmats Section (Clean Open Grid — Zero Heavy Card Clutter) */}
      <section className="w-full bg-[#FAF7F2] px-4 py-20 sm:px-8 sm:py-24 lg:px-12 xl:px-16">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-editorial text-4xl font-bold tracking-wide text-[#2B0F14] sm:text-5xl">
            Our Khidmats
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-20 rounded-full bg-[#B8924A]" />
          <p className="mt-4 text-base text-[#5E4F4A] sm:text-lg">
            Services we perform with pride and dedication
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {KHIDMATS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group border-t border-[#DFD5C5] pt-6 transition-colors hover:border-[#B8924A]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DFC99B] bg-[#FBF6EB] text-[#6A1B1B] transition-colors group-hover:bg-[#6A1B1B] group-hover:text-[#F5DFB0]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-editorial text-2xl font-bold text-[#231917] group-hover:text-[#6A1B1B]">
                    {item.title}
                  </h3>
                </div>
                <p className="mt-2.5 pl-[54px] text-sm leading-relaxed text-[#5E4F4A]">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
