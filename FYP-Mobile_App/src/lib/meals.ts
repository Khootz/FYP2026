export type StoredMeal = {
  id: string;
  capturedAt: number;
  source: "camera" | "upload";
  previewDataUrl: string;
  fileName: string;
  fileSize: number;
  title: string;
};

const STORAGE_KEY = "fyp_meals_v1";
type Listener = (meals: StoredMeal[]) => void;
const listeners = new Set<Listener>();

const safeParse = (raw: string | null): StoredMeal[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredMeal[];
    if (Array.isArray(parsed)) {
      return parsed.map((meal) => ({
        ...meal,
        id: meal.id ?? `${Date.now()}`,
        title: meal.title ?? "Captured meal",
      }));
    }
    return [];
  } catch {
    return [];
  }
};

const readMeals = (): StoredMeal[] => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const writeMeals = (meals: StoredMeal[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  listeners.forEach((listener) => listener(meals));
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      listeners.forEach((listener) => listener(readMeals()));
    }
  });
}

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const MealsStore = {
  getAll(): StoredMeal[] {
    return readMeals();
  },
  add(meal: Omit<StoredMeal, "id"> & { id?: string }) {
    const next: StoredMeal = { id: meal.id ?? createId(), ...meal };
    const meals = [next, ...readMeals()];
    writeMeals(meals);
  },
  clear() {
    writeMeals([]);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

