import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Write from "@/pages/write";
import Outlines from "@/pages/outlines";
import Characters from "@/pages/characters";
import WorldSettings from "@/pages/world-settings";
import PlotCards from "@/pages/plot-cards";
import AIModels from "@/pages/ai-models";
import PromptTemplates from "@/pages/prompt-templates";
import Statistics from "@/pages/statistics";
import GenerationLogs from "@/pages/generation-logs";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Component {...rest} />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />

      {/* Protected Routes */}
      <Route path="/">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <Dashboard />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/write">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <Write />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/outlines">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <Outlines />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/characters">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <Characters />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/world">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <WorldSettings />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/plots">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <PlotCards />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/ai-models">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <AIModels />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/templates">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <PromptTemplates />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/statistics">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <Statistics />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/generation-logs">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <GenerationLogs />
          </AuthenticatedLayout>
        )} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={() => (
          <AuthenticatedLayout>
            <Settings />
          </AuthenticatedLayout>
        )} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
