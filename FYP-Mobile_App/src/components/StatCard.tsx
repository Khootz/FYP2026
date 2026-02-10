import { LucideIcon } from "lucide-react";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  progress?: number;
  color?: "primary" | "secondary" | "accent" | "success";
}

export const StatCard = ({
  icon: Icon,
  label,
  value,
  unit,
  progress,
  color = "primary",
}: StatCardProps) => {
  const colorClasses = {
    primary: "text-primary bg-primary/10",
    secondary: "text-secondary bg-secondary/10",
    accent: "text-accent bg-accent/10",
    success: "text-success bg-success/10",
  };

  return (
    <Card className="p-4 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-lg", colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{unit}</div>
        </div>
      </div>
      <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
      {progress !== undefined && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              color === "primary" && "bg-primary",
              color === "secondary" && "bg-secondary",
              color === "accent" && "bg-accent",
              color === "success" && "bg-success"
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
};
