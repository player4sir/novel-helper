import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useRoute } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
    const { user, loginMutation, registerMutation } = useAuth();
    const [, setLocation] = useLocation();

    useEffect(() => {
        if (user) {
            setLocation("/");
        }
    }, [user, setLocation]);

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            <div className="flex items-center justify-center p-8">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>欢迎使用 Novel Helper</CardTitle>
                        <CardDescription>
                            专业的 AI 辅助小说创作工具，让创作更简单
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="login" onValueChange={(v) => setLocation(v === "login" ? "/auth" : "/auth?mode=register")}>
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="login">登录</TabsTrigger>
                                <TabsTrigger value="register">注册</TabsTrigger>
                            </TabsList>

                            <AnimatePresence mode="wait">
                                <TabsContent value="login" asChild>
                                    <motion.div
                                        key="login"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <LoginForm />
                                    </motion.div>
                                </TabsContent>

                                <TabsContent value="register" asChild>
                                    <motion.div
                                        key="register"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <RegisterForm />
                                    </motion.div>
                                </TabsContent>
                            </AnimatePresence>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
            <div className="hidden lg:flex flex-col justify-center p-12 bg-slate-900 text-white">
                <motion.div
                    className="max-w-xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    <h1 className="text-4xl font-bold mb-6">释放你的创作潜能</h1>
                    <p className="text-lg text-slate-300 mb-8">
                        Novel Helper 结合了先进的 AI 技术与专业的写作理论，为你提供从灵感构思到大纲生成、角色塑造再到正文写作的全流程辅助。
                    </p>
                    <div className="grid grid-cols-2 gap-6">
                        <Feature
                            title="智能大纲"
                            description="一键生成结构严谨的故事大纲，支持多级细化"
                            delay={0.3}
                        />
                        <Feature
                            title="角色工坊"
                            description="深度塑造立体角色，自动生成人物关系网"
                            delay={0.4}
                        />
                        <Feature
                            title="世界观构建"
                            description="辅助建立宏大的世界背景与力量体系"
                            delay={0.5}
                        />
                        <Feature
                            title="灵感助手"
                            description="卡文时的得力助手，提供无限创意火花"
                            delay={0.6}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function Feature({ title, description, delay }: { title: string; description: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.5 }}
        >
            <h3 className="font-semibold mb-2 text-blue-400">{title}</h3>
            <p className="text-sm text-slate-400">{description}</p>
        </motion.div>
    );
}

function LoginForm() {
    const { loginMutation } = useAuth();
    const form = useForm({
        resolver: zodResolver(insertUserSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))}
                className="space-y-4"
            >
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>用户名</FormLabel>
                            <FormControl>
                                <Input {...field} />
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
                            <FormLabel>密码</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                >
                    {loginMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    登录
                </Button>
            </form>
        </Form>
    );
}

function RegisterForm() {
    const { registerMutation } = useAuth();
    const form = useForm({
        resolver: zodResolver(insertUserSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))}
                className="space-y-4"
            >
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>用户名</FormLabel>
                            <FormControl>
                                <Input {...field} />
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
                            <FormLabel>密码</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="w-full"
                    disabled={registerMutation.isPending}
                >
                    {registerMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    注册
                </Button>
            </form>
        </Form>
    );
}
