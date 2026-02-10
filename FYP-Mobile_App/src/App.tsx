import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Camera from "./pages/Camera";
import Meals from "./pages/Meals";
import Restaurants from "./pages/Restaurants";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import NotificationBridge from "./components/NotificationBridge";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NotificationBridge />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/meals" element={<Meals />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
