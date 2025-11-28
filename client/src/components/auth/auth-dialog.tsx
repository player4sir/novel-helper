import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useLocation } from "wouter";

const loginSchema = z.object({
    username: z.string().min(1, "用户名不能为空"),
    password: z.string().min(1, "密码不能为空"),
});

const registerSchema = z.object({
    username: z.string().min(3, "用户名至少需要3个字符"),
    password: z.string().min(6, "密码至少需要6个字符"),
});

export function AuthDialog({
    children,
    defaultTab = "login"
}: {
    children: React.ReactNode;
    defaultTab?: "login" | "register"
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);
    const [, setLocation] = useLocation();

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setActiveTab(defaultTab);
        }
    };

    const handleSuccess = (user?: any) => {
        setIsOpen(false);
        // Check if user is admin
        if (user?.role === "admin") {
            setLocation("/admin");
        } else {
            setLocation("/app");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] bg-[#0a0a0f]/95 backdrop-blur-xl border border-purple-500/20 text-white shadow-2xl shadow-purple-900/20">
                <DialogHeader className="space-y-4">
                    <div className="flex items-center justify-center gap-2">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 blur opacity-50 group-hover:opacity-100 transition duration-500 rounded-lg"></div>
                            <div className="relative p-2 rounded-lg bg-[#0a0a0f] border border-white/10">
                                <BookOpen className="h-6 w-6 text-purple-400" />
                            </div>
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
                            Novel Helper
                        </span>
                    </div>

                    <DialogTitle className="text-2xl text-center text-white font-bold tracking-tight">
                        {activeTab === "login" ? "欢迎回来" : "开始创作"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-400 text-center text-base">
                        {activeTab === "login"
                            ? "登录继续您的创作"
                            : "创建账号，开启 AI 辅助创作之旅"}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/5 p-1 h-12">
                        <TabsTrigger
                            value="login"
                            className="h-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300"
                        >
                            登录
                        </TabsTrigger>
                        <TabsTrigger
                            value="register"
                            className="h-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300"
                        >
                            注册
                        </TabsTrigger>
                    </TabsList>

                    <AnimatePresence mode="wait">
                        <TabsContent value="login" asChild>
                            <motion.div
                                key="login"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <LoginForm onSuccess={handleSuccess} />
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="register" asChild>
                            <motion.div
                                key="register"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <RegisterForm onSuccess={handleSuccess} />
                            </motion.div>
                        </TabsContent>
                    </AnimatePresence>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function LoginForm({ onSuccess }: { onSuccess: (user?: any) => void }) {
    const { loginMutation } = useAuth();
    const form = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    const onSubmit = async (data: z.infer<typeof loginSchema>) => {
        const user = await loginMutation.mutateAsync(data);
        onSuccess(user);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-gray-300">用户名</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="输入你的用户名"
                                    {...field}
                                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20 transition-all"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-gray-300">密码</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="输入你的密码"
                                    {...field}
                                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20 transition-all"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white border-0 mt-6 shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)] transition-all hover:scale-[1.02]"
                    disabled={loginMutation.isPending}
                >
                    {loginMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            登录中...
                        </>
                    ) : (
                        "登录"
                    )}
                </Button>
            </form>
        </Form>
    );
}

function RegisterForm({ onSuccess }: { onSuccess: (user?: any) => void }) {
    const { registerMutation } = useAuth();
    const form = useForm({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    const onSubmit = async (data: z.infer<typeof registerSchema>) => {
        const user = await registerMutation.mutateAsync(data);
        onSuccess(user);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-gray-300">用户名</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="选择一个用户名"
                                    {...field}
                                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20 transition-all"
                                />
                            </FormControl>
                            <p className="text-xs text-gray-500">至少 3 个字符</p>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-gray-300">密码</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="创建一个安全的密码"
                                    {...field}
                                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20 transition-all"
                                />
                            </FormControl>
                            <p className="text-xs text-gray-500">至少 6 个字符</p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white border-0 mt-6 shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)] transition-all hover:scale-[1.02]"
                    disabled={registerMutation.isPending}
                >
                    {registerMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            注册中...
                        </>
                    ) : (
                        "创建账号"
                    )}
                </Button>

                <p className="text-center text-xs text-gray-500 mt-4">
                    注册即表示您同意我们的服务条款
                </p>
            </form>
        </Form>
    );
}
