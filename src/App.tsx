import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { AskSavvyButton } from "@/components/AskSavvyButton";
import { MfaGate } from "@/components/MfaGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheck, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

// Route-level code splitting. Every page (and the dashboard shell) is fetched
// on demand, so the initial bundle carries only the providers and the router.
// A public visitor never downloads the dashboard — AppLayout, recharts, the AI
// panels, pdfjs — and a signed-in user never downloads the marketing pages.
const Landing = lazy(() => import("./pages/Landing"));
const Features = lazy(() => import("./pages/Features"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Chat = lazy(() => import("./pages/Chat"));

const Index = lazy(() => import("./pages/Index"));
const OnboardingOrg = lazy(() => import("./pages/OnboardingOrg"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Savings = lazy(() => import("./pages/Savings"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const MarketDataPage = lazy(() => import("./pages/MarketDataPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SystemStatus = lazy(() => import("./pages/SystemStatus"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminVerifyPage = lazy(() => import("./pages/AdminVerifyPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const CollaboratePage = lazy(() => import("./pages/CollaboratePage"));
const BriefingsPage = lazy(() => import("./pages/BriefingsPage"));
const AppLayout = lazy(() => import("@/components/layout/AppLayout"));

import { AdminGuard } from "./components/admin/AdminGuard";
import "./i18n";

/** Shown while a route's chunk is in flight. */
const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient();

const VerifyEmailGate = () => {
  const { user, signOut } = useAuth();
  const resend = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
    if (error) toast.error(error.message);
    else toast.success('Verification email sent.');
  };
  const refresh = async () => {
    const { data } = await supabase.auth.refreshSession();
    if (data?.user?.email_confirmed_at) toast.success('Email verified!');
    else toast.error('Still not verified — check your inbox.');
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <MailCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <span className="font-medium text-foreground">{user?.email}</span>.
            Click it to unlock your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full" onClick={refresh}><RefreshCw className="w-4 h-4 mr-2" /> I've verified — refresh</Button>
          <Button variant="outline" className="w-full" onClick={resend}>Resend verification email</Button>
          <Button variant="ghost" className="w-full" onClick={signOut}><LogOut className="w-4 h-4 mr-2" /> Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
};

const ProtectedDashboard = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Email verification gate — block dashboard until confirmed.
  // (Allow when provider is OAuth and email_confirmed_at is set automatically.)
  if (!user.email_confirmed_at) return <VerifyEmailGate />;

  return (
    <OrganizationProvider>
      <CurrencyProvider>
        <PreferencesProvider>
          <OrgGate />
        </PreferencesProvider>
      </CurrencyProvider>
    </OrganizationProvider>
  );
};

const OrgGate = () => {
  const { organization, loading } = useOrganization();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!organization) return <OnboardingOrg />;

  return (
    <MfaGate>
      <AppLayout>
        {/* Boundary sits inside the layout on purpose: switching dashboard
            pages swaps only the content area, so the sidebar keeps its
            collapse state and does not flash. */}
        <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<Index />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="savings" element={<Savings />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="market" element={<MarketDataPage />} />
        <Route path="ai-insights" element={<AIInsights />} />
        <Route path="finance-advisor" element={<Navigate to="/dashboard/ai-insights" replace />} />
        <Route path="portfolio-advisor" element={<Navigate to="/dashboard/ai-insights" replace />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="status" element={<SystemStatus />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="collaborate" element={<CollaboratePage />} />
        <Route path="briefings" element={<BriefingsPage />} />
        <Route path="admin/verify" element={<AdminVerifyPage />} />
        <Route path="admin" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
        <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </AppLayout>
    </MfaGate>
  );
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <AuthPage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/features" element={<Features />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/signup" element={<Navigate to="/auth" replace />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard/*" element={<ProtectedDashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <AskSavvyButton />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
