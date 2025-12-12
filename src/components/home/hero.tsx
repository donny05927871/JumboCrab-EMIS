import { Button } from "@/components/ui/button";
import { ArrowUpRight, CirclePlay } from "lucide-react";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative isolate min-h-screen flex items-center justify-center overflow-hidden">
      <Image
        src="/hero-background.png"
        alt="Seafood spread at JumboCrab"
        fill
        priority
        sizes="100vw"
        className="object-cover -z-20"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/45 to-black/15"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-2/3 bg-gradient-to-r from-black/60 via-black/25 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-(--breakpoint-xl) w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 px-5 sm:px-8 pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
            Island grill & crab house
          </p>
          <h1 className="mt-4 sm:mt-6 max-w-[18ch] text-4xl sm:text-5xl lg:text-[3rem] xl:text-[3.4rem] font-semibold leading-[1.12]! tracking-[-0.045em] text-amber-100 mx-auto lg:mx-0">
            Fire-kissed crab feasts, born by the beach.
          </h1>
          <p className="mt-6 max-w-[62ch] sm:text-lg text-white/80 mx-auto lg:mx-0">
            Fresh catch lands at dawn, chilies hit the pan, and grills burn till
            the last round of calamansi spritz. Bring the crew, crack into saucy
            crab buckets, and stay for the smoky skewers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <Button
              size="lg"
              className="rounded-full bg-primary text-primary-foreground text-base shadow-lg shadow-primary/40 hover:bg-primary/90"
            >
              Book a table <ArrowUpRight className="h-5! w-5!" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full text-base border-white/30 bg-white/15 text-white shadow-none backdrop-blur"
            >
              <CirclePlay className="h-5! w-5!" /> View menu & drinks
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-white/70 lg:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              Open daily · 4 PM – 11 PM
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
              Alona Beach · Panglao
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
