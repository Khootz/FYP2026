import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Link2, Watch, ChevronLeft, ChevronRight, X } from "lucide-react";

interface HealthService {
  name: string;
  icon: string;
  color: string;
  connected: boolean;
}

const healthServices: HealthService[] = [
  { name: "Apple Fitness", icon: "❤️", color: "bg-red-500", connected: false },
  { name: "Google Fit", icon: "💙", color: "bg-blue-500", connected: false },
  { name: "Garmin Connect", icon: "🟢", color: "bg-teal-600", connected: false },
  { name: "Fitbit", icon: "⚡", color: "bg-emerald-500", connected: true },
  { name: "Strava", icon: "🏃", color: "bg-orange-500", connected: false },
  { name: "Samsung Health", icon: "💜", color: "bg-indigo-500", connected: false },
];

const watchBrands = [
  { name: "Fitbit", icon: "⚡" },
  { name: "Apple Watch", icon: "⌚" },
  { name: "Garmin", icon: "🏔️" },
];

export function SmartWatchConnect() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [services, setServices] = useState<HealthService[]>(healthServices);
  const [activeWatch, setActiveWatch] = useState(0);

  const handleToggleConnect = (index: number) => {
    setServices((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, connected: !s.connected } : s
      )
    );
  };

  const nextWatch = () =>
    setActiveWatch((prev) => (prev + 1) % watchBrands.length);
  const prevWatch = () =>
    setActiveWatch((prev) => (prev - 1 + watchBrands.length) % watchBrands.length);

  return (
    <>
      <section>
        <h2 className="text-lg font-semibold mb-3">Smart Watch</h2>
        <Card className="relative overflow-hidden border-primary/20">
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 pointer-events-none" />

          <div className="relative p-5">
            <h3 className="text-xl font-bold text-center mb-2">
              Connect Your Smart Watch
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-5 px-2">
              Sync your fitness data from popular health platforms to get
              comprehensive insights into your wellness journey
            </p>

            {/* Watch carousel */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={prevWatch}
                className="p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground"
                aria-label="Previous watch"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-2 transition-all">
                <span className="text-4xl">{watchBrands[activeWatch].icon}</span>
                <span className="text-sm font-medium text-primary">
                  {watchBrands[activeWatch].name}
                </span>
              </div>

              <button
                onClick={nextWatch}
                className="p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground"
                aria-label="Next watch"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dots indicator */}
            <div className="flex justify-center gap-1.5 mb-5">
              {watchBrands.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveWatch(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === activeWatch
                      ? "bg-primary w-4"
                      : "bg-muted-foreground/30"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Connect button */}
            <Button
              className="w-full h-12 gap-2 text-base font-semibold"
              onClick={() => setSheetOpen(true)}
            >
              <Link2 className="w-5 h-5" />
              Connect Services
            </Button>
          </div>
        </Card>
      </section>

      {/* Bottom sheet for managing health services */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-xl font-bold text-center">
              Manage Health Services
            </SheetTitle>
            <SheetDescription className="sr-only">
              Connect or disconnect your health tracking services
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
            {services.map((service, index) => (
              <button
                key={service.name}
                onClick={() => handleToggleConnect(index)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                {/* Service icon */}
                <div
                  className={`w-12 h-12 rounded-xl ${service.color} flex items-center justify-center text-xl shadow-md`}
                >
                  {service.icon}
                </div>

                {/* Service info */}
                <div className="flex-1 text-left">
                  <p className="font-semibold">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.connected ? "Connected" : "Tap to connect"}
                  </p>
                </div>

                {/* Status indicator */}
                {service.connected && (
                  <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
