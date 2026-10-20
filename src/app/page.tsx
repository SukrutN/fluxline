import Hero from "@/components/Hero";
import LineSection from "@/components/LineSection";
import Stations from "@/components/Stations";
import LedgerSection from "@/components/LedgerSection";
import UnitSection from "@/components/UnitSection";

export default function Home() {
  return (
    <main>
      <Hero />
      <LineSection />
      <Stations />
      <LedgerSection />
      <UnitSection />
    </main>
  );
}
