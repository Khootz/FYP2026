import { Flame, Apple, Utensils, Droplets } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { SmartWatchConnect } from "@/components/SmartWatchConnect";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { MealsStore, StoredMeal } from "@/lib/meals";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const baseStats = useMemo(
    () => ({
      calories: { consumed: 1450, goal: 2000 },
      protein: { consumed: 65, goal: 120 },
      carbs: { consumed: 180, goal: 250 },
      water: { consumed: 6, goal: 8 },
    }),
    [],
  );
  const [waterCups, setWaterCups] = useState(baseStats.water.consumed);
  const [lastWaterLog, setLastWaterLog] = useState<Date | null>(null);
  const [meals, setMeals] = useState<StoredMeal[]>(() => MealsStore.getAll());

  useEffect(() => {
    const unsubscribe = MealsStore.subscribe(setMeals);
    return () => unsubscribe();
  }, []);

  const recentMeals = meals.slice(0, 3);

  const handleLogMeal = () => {
    toast({
      title: "Launching camera",
      description: "Capture your meal to keep your log up to date.",
    });
    navigate("/camera");
  };

  const handleAddWater = () => {
    setWaterCups((prev) => {
      const next = Math.min(prev + 1, baseStats.water.goal + 4);
      if (next === prev) {
        toast({
          title: "Hydration goal met",
          description: "Great job! You’ve logged enough water for today.",
        });
        return prev;
      }
      setLastWaterLog(new Date());
      toast({
        title: "Water logged",
        description: `You're at ${next}/${baseStats.water.goal} cups today.`,
      });
      return next;
    });
  };

  const handleViewAllMeals = () => {
    toast({
      title: "Opening meal history",
      description: "Review every meal you've captured so far.",
    });
    navigate("/meals");
  };

  const waterProgress = Math.min((waterCups / baseStats.water.goal) * 100, 100);

  return (
    <div className="min-h-screen bg-background page-content">
      {/* Header with gradient */}
      <header className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground p-6 rounded-b-3xl shadow-elevated">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-1">NutriTrack</h1>
          <p className="text-sm opacity-90">Track your health journey</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Daily Goals Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Today's Progress</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Flame}
              label="Calories"
              value={baseStats.calories.consumed.toString()}
              unit={`/ ${baseStats.calories.goal} kcal`}
              progress={(baseStats.calories.consumed / baseStats.calories.goal) * 100}
              color="primary"
            />
            <StatCard
              icon={Apple}
              label="Protein"
              value={baseStats.protein.consumed.toString()}
              unit={`/ ${baseStats.protein.goal}g`}
              progress={(baseStats.protein.consumed / baseStats.protein.goal) * 100}
              color="secondary"
            />
            <StatCard
              icon={Utensils}
              label="Carbs"
              value={baseStats.carbs.consumed.toString()}
              unit={`/ ${baseStats.carbs.goal}g`}
              progress={(baseStats.carbs.consumed / baseStats.carbs.goal) * 100}
              color="accent"
            />
            <StatCard
              icon={Droplets}
              label="Water"
              value={waterCups.toString()}
              unit={`/ ${baseStats.water.goal} cups`}
              progress={waterProgress}
              color="success"
            />
          </div>
        </section>

        {/* Smart Watch Connection */}
        <SmartWatchConnect />

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
          <Card className="p-4 space-y-3">
            <div className="flex gap-3">
              <Button className="flex-1 h-12" variant="default" onClick={handleLogMeal}>
                Log Meal
              </Button>
              <Button
                className="flex-1 h-12"
                variant="outline"
                onClick={handleAddWater}
                disabled={waterCups >= baseStats.water.goal + 4}
              >
                Add Water
              </Button>
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Hydration logged: <span className="font-medium">{waterCups}</span>/
                {baseStats.water.goal} cups
              </span>
              <span>
                {lastWaterLog
                  ? `Last cup ${lastWaterLog.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "No water logged yet"}
              </span>
            </div>
          </Card>
        </section>

        {/* Recent Meals */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent Meals</h2>
            <Button variant="ghost" size="sm" onClick={handleViewAllMeals}>
              View All
            </Button>
          </div>
          {recentMeals.length === 0 ? (
            <Card className="p-4 text-center text-sm text-muted-foreground">
              No meals logged yet. Tap “Log Meal” to capture your first plate.
            </Card>
          ) : (
            <div className="space-y-2">
              {recentMeals.map((meal) => (
                <Card key={meal.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted">
                      <img
                        src={meal.previewDataUrl}
                        alt={meal.fileName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium truncate">
                        {meal.title || "Captured meal"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(meal.capturedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {meal.source === "camera" ? "Camera" : "Upload"}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Health Tip */}
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <h3 className="font-semibold mb-2 text-primary">💡 Health Tip</h3>
          <p className="text-sm text-muted-foreground">
            Stay hydrated! Drinking water before meals can help with portion control and digestion.
          </p>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
