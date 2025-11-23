import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/write" component={Write} />
      <Route path="/outlines" component={Outlines} />
      <Route path="/characters" component={Characters} />
      <Route path="/world" component={WorldSettings} />
      <Route path="/plots" component={PlotCards} />
      <Route path="/ai-models" component={AIModels} />
      <Route path="/templates" component={PromptTemplates} />

      <Route path="/statistics" component={Statistics} />

      <Route path="/generation-logs" component={GenerationLogs} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
