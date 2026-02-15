import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import UploadPaper from "./pages/UploadPaper";
import Submissions from "./pages/Submissions";
import Review from "./pages/Review";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Department from "./pages/Department";
import Subjects from "./pages/Subjects";
import { applyStoredAccent } from "./lib/theme";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    applyStoredAccent();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/upload" element={<UploadPaper />} />
              <Route path="/submissions" element={<Submissions />} />
              <Route path="/review" element={<Review />} />
              {/* Placeholder routes */}
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/department" element={<Department />} />
              <Route path="/hod/alerts" element={<Dashboard />} />
              <Route path="/approved" element={<Dashboard />} />
              <Route path="/calendar" element={<Dashboard />} />
              <Route path="/exam-cell/sessions" element={<Dashboard />} />
              <Route path="/exam-cell/alerts" element={<Dashboard />} />
              <Route path="/inbox" element={<Dashboard />} />
              <Route path="/archive" element={<Dashboard />} />
              <Route path="/admin/users" element={<Dashboard />} />
              <Route path="/admin/departments" element={<Dashboard />} />
              <Route path="/admin/audit" element={<Dashboard />} />
              <Route path="/admin/broadcasts" element={<Dashboard />} />
              <Route path="/admin/security" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Profile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
