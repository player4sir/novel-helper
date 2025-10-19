import { Link, useLocation } from "wouter";
import {
  Home,
  BookOpen,
  Users,
  Globe,
  Lightbulb,
  Settings,
  BarChart3,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "项目概览", url: "/", icon: Home, testId: "link-dashboard" },
  { title: "创作工作台", url: "/write", icon: BookOpen, testId: "link-write" },
  { title: "大纲管理", url: "/outlines", icon: FileText, testId: "link-outlines" },
];

const settingsItems = [
  { title: "人物设定", url: "/characters", icon: Users, testId: "link-characters" },
  { title: "世界观", url: "/world", icon: Globe, testId: "link-world" },
  { title: "情节卡片", url: "/plots", icon: Lightbulb, testId: "link-plots" },
];

const toolsItems = [
  { title: "AI模型配置", url: "/ai-models", icon: Sparkles, testId: "link-ai-models" },
  { title: "提示词模板", url: "/templates", icon: FileText, testId: "link-templates" },
  { title: "数据统计", url: "/statistics", icon: BarChart3, testId: "link-statistics" },
  { title: "系统设置", url: "/settings", icon: Settings, testId: "link-settings" },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-base font-semibold">AI创作工作台</h2>
            <p className="text-xs text-muted-foreground">网络小说专业版</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>主要功能</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>设定管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>工具设置</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="text-xs text-muted-foreground text-center">
          番茄小说专业创作系统
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
