import { Calendar, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { MealsStore, StoredMeal } from "@/lib/meals";
import { useEffect, useMemo, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { useNavigate } from "react-router-dom";

type GroupedMeals = {
  label: string;
  meals: StoredMeal[];
};

const formatDateLabel = (date: Date) => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d, yyyy");
};

const Meals = () => {
  const navigate = useNavigate();
  const [meals, setMeals] = useState<StoredMeal[]>(() => MealsStore.getAll());

  useEffect(() => {
    const unsubscribe = MealsStore.subscribe(setMeals);
    return () => unsubscribe();
  }, []);

  const groupedMeals = useMemo<GroupedMeals[]>(() => {
    const map = new Map<string, StoredMeal[]>();
    meals.forEach((meal) => {
      const date = new Date(meal.capturedAt);
      const label = formatDateLabel(date);
      const list = map.get(label) ?? [];
      list.push(meal);
      map.set(label, list);
    });

    return Array.from(map.entries()).map(([label, grouped]) => ({
      label,
      meals: grouped.sort((a, b) => b.capturedAt - a.capturedAt),
    }));
  }, [meals]);

  const totalMeals = meals.length;
  const cameraCount = meals.filter((meal) => meal.source === "camera").length;
  const uploadCount = meals.filter((meal) => meal.source === "upload").length;
  const lastMealTime = meals[0]
    ? format(new Date(meals[0].capturedAt), "MMM d, h:mm a")
    : "—";

  return (
    <div className="min-h-screen bg-background page-content">
      <header className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground p-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold">Meal History</h1>
          <p className="text-sm opacity-90">Track your nutritional intake</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Capture Summary</h2>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              {totalMeals > 0 ? "Active" : "Get started"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{totalMeals}</div>
              <div className="text-xs text-muted-foreground">Meals Logged</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-secondary">{cameraCount}</div>
              <div className="text-xs text-muted-foreground">Camera</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{uploadCount}</div>
              <div className="text-xs text-muted-foreground">Uploads</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Last capture: <span className="font-medium">{lastMealTime}</span>
          </p>
        </Card>

        {groupedMeals.length === 0 ? (
          <Card className="p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              No meals logged yet. When your wearable detects an eating gesture, we’ll prompt you to snap your plate.
            </p>
            <Button onClick={() => navigate("/camera")}>Log a meal now</Button>
          </Card>
        ) : (
          groupedMeals.map((day) => (
            <section key={day.label}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {day.label}
              </h3>
              <div className="space-y-3">
                {day.meals.map((meal) => (
                  <Card key={meal.id} className="p-3 hover:shadow-soft transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={meal.previewDataUrl}
                          alt={meal.fileName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <h4 className="font-medium truncate">
                          {meal.title || "Captured meal"}
                        </h4>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {meal.source}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(meal.capturedAt), "h:mm a")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 truncate">
                          {meal.fileName}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Meals;
