import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, CreditCard, Settings, LogOut, Home } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [location] = useLocation();
    const { logoutMutation } = useAuth();

    const navItems = [
        { href: "/admin", icon: LayoutDashboard, label: "概览" },
        { href: "/admin/users", icon: Users, label: "用户管理" },
        { href: "/admin/subscriptions", icon: CreditCard, label: "订阅管理" },
        { href: "/admin/settings", icon: Settings, label: "系统设置" },
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl flex flex-col">
                <div className="p-6 border-b border-white/10">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        Admin Portal
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = location === item.href;
                        return (
                            <Link key={item.href} href={item.href}>
                                <a
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                        ? "bg-purple-600/20 text-purple-400 border border-purple-500/20"
                                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                                        }`}
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.label}</span>
                                </a>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10 space-y-2">
                    <Link href="/app">
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-gray-400 hover:text-white hover:bg-white/5"
                        >
                            <Home className="h-5 w-5 mr-2" />
                            返回应用
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={() => logoutMutation.mutate()}
                    >
                        <LogOut className="h-5 w-5 mr-2" />
                        退出登录
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/20 backdrop-blur-xl sticky top-0 z-10">
                    <h2 className="text-lg font-medium text-gray-200">
                        {navItems.find((i) => i.href === location)?.label || "Dashboard"}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-400">
                            管理员模式
                        </div>
                        <div className="h-8 w-8 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold">
                            A
                        </div>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
