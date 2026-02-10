import { User, Target, TrendingUp, Settings, Bell, Shield, HelpCircle, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Profile = () => {
  const userProfile = {
    name: "Alex Chen",
    email: "alex.chen@example.com",
    joinDate: "Jan 2024",
    currentStreak: 12,
    totalMeals: 156,
    goals: {
      dailyCalories: 2000,
      protein: 120,
      carbs: 250,
      fats: 65,
    },
    stats: {
      weight: 70,
      height: 175,
      age: 25,
      activityLevel: "Moderate",
    },
  };

  const menuItems = [
    { icon: Target, label: "Daily Goals", description: "Customize your targets" },
    { icon: TrendingUp, label: "Progress & Insights", description: "View your journey" },
    { icon: Bell, label: "Notifications", description: "Manage alerts" },
    { icon: Shield, label: "Privacy & Security", description: "Control your data" },
    { icon: Settings, label: "Settings", description: "App preferences" },
    { icon: HelpCircle, label: "Help & Support", description: "Get assistance" },
  ];

  return (
    <div className="min-h-screen bg-background page-content">
      <header className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground p-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm opacity-90">Manage your account</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* User Info Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground text-xl font-bold">
                AC
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{userProfile.name}</h2>
              <p className="text-sm text-muted-foreground">{userProfile.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Member since {userProfile.joinDate}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{userProfile.currentStreak}</div>
              <div className="text-xs text-muted-foreground">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{userProfile.totalMeals}</div>
              <div className="text-xs text-muted-foreground">Meals Logged</div>
            </div>
            <div className="text-center">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Active
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">Status</div>
            </div>
          </div>
        </Card>

        {/* Health Stats */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Health Profile</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Weight</div>
              <div className="text-lg font-bold">{userProfile.stats.weight} kg</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Height</div>
              <div className="text-lg font-bold">{userProfile.stats.height} cm</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Age</div>
              <div className="text-lg font-bold">{userProfile.stats.age} years</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Activity</div>
              <div className="text-sm font-bold">{userProfile.stats.activityLevel}</div>
            </div>
          </div>
        </Card>

        {/* Daily Goals */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Daily Goals</h3>
            <Button variant="ghost" size="sm">Edit</Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Calories</span>
              <span className="font-medium">{userProfile.goals.dailyCalories} kcal</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Protein</span>
              <span className="font-medium">{userProfile.goals.protein}g</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Carbohydrates</span>
              <span className="font-medium">{userProfile.goals.carbs}g</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fats</span>
              <span className="font-medium">{userProfile.goals.fats}g</span>
            </div>
          </div>
        </Card>

        {/* Menu Options */}
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Card
              key={item.label}
              className="p-4 hover:shadow-soft transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{item.label}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </Card>
          ))}

          {/* Logout */}
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
