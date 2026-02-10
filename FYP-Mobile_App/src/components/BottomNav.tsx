import { Home, Camera, History, Store, User } from "lucide-react";
import { NavLink } from "./NavLink";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/camera", icon: Camera, label: "Scan" },
  { to: "/meals", icon: History, label: "Meals" },
  { to: "/restaurants", icon: Store, label: "Restaurants" },
  { to: "/profile", icon: User, label: "Profile" },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-elevated z-50 safe-area-bottom">
      <div className="w-full flex justify-around items-center h-16 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors min-w-0"
            activeClassName="text-primary"
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-transform flex-shrink-0",
                    isActive && "scale-110"
                  )}
                />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
