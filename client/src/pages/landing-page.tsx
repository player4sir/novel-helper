import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Check, Sparkles, BookOpen, Zap, Shield, Globe, ArrowRight, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { PaymentDialog } from "@/components/payment/payment-dialog";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1
    }
};

export default function LandingPage() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    const handleNavigate = (path: string) => {
        setIsExiting(true);
        setTimeout(() => setLocation(path), 400);
    };

    // if (user) {
    //     setLocation("/app");
    //     return null;
    // }

    const [paymentOpen, setPaymentOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<{ id: string, amount: number, title: string } | null>(null);

    const handlePlanSelect = (planId: string, amount: number, title: string) => {
        setSelectedPlan({ id: planId, amount, title });
        setPaymentOpen(true);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 mb-4 inline-block">
                        <BookOpen className="h-12 w-12 text-white animate-pulse" />
                    </div>
                    <p className="text-white text-lg">加载中...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isExiting ? 0 : 1 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white overflow-hidden"
        >
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            {/* Header */}
            <header className="relative border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                            Novel Helper
                        </span>
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
                        <a href="#features" className="hover:text-purple-400 transition-colors">功能</a>
                        <a href="#pricing" className="hover:text-purple-400 transition-colors">价格</a>
                        <a href="#faq" className="hover:text-purple-400 transition-colors">常见问题</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        {user ? (
                            <Link href="/app">
                                <Button
                                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0"
                                >
                                    进入工作台
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <AuthDialog defaultTab="login">
                                    <Button
                                        variant="ghost"
                                        className="text-white hover:text-purple-400 hover:bg-white/5"
                                    >
                                        登录
                                    </Button>
                                </AuthDialog>
                                <AuthDialog defaultTab="register">
                                    <Button
                                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0"
                                    >
                                        免费开始
                                    </Button>
                                </AuthDialog>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="relative flex-1">
                {/* Hero Section */}
                <section className="relative py-32 md:py-40">
                    <motion.div
                        className="container mx-auto px-4 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium mb-8"
                        >
                            <Star className="h-4 w-4 text-yellow-400" />
                            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-semibold">
                                AI 驱动的新一代写作助手
                            </span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
                        >
                            <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                                让灵感不再流失
                            </span>
                            <br />
                            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                让创作更加自由
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
                            className="text-xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed"
                        >
                            Novel Helper 结合先进的大语言模型，为您提供从灵感构思、大纲设计到正文写作的全流程辅助。
                            专注于中文网文创作，懂你想要的每一个爽点。
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        >
                            <AuthDialog defaultTab="register">
                                <Button
                                    size="lg"
                                    className="h-14 px-8 text-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0 group"
                                >
                                    立即免费试用
                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </AuthDialog>
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-14 px-8 text-lg border-white/20 bg-white/5 backdrop-blur-md hover:bg-white/10 text-white"
                                asChild
                            >
                                <a href="#features">了解更多</a>
                            </Button>
                        </motion.div>
                    </motion.div>
                </section>

                {/* Features Section */}
                <section id="features" className="relative py-20 bg-gradient-to-b from-transparent to-black/20">
                    <div className="container mx-auto px-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                全能创作助手
                            </h2>
                            <p className="text-gray-400 text-lg">强大功能，助你创作无忧</p>
                        </motion.div>

                        <motion.div
                            className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={containerVariants}
                        >
                            <FeatureCard
                                icon={<BookOpen className="h-8 w-8" />}
                                title="智能大纲生成"
                                description="输入核心创意，一键生成完整的故事大纲、分卷剧情和细纲，逻辑严密，节奏紧凑。"
                                gradient="from-blue-500/20 to-cyan-500/20"
                                iconGradient="from-blue-500 to-cyan-500"
                            />
                            <FeatureCard
                                icon={<Sparkles className="h-8 w-8" />}
                                title="角色深度定制"
                                description="打造有血有肉的角色，自动生成性格、背景、动机和成长弧光，避免脸谱化。"
                                gradient="from-purple-500/20 to-pink-500/20"
                                iconGradient="from-purple-500 to-pink-500"
                            />
                            <FeatureCard
                                icon={<Globe className="h-8 w-8" />}
                                title="世界观构建"
                                description="辅助构建宏大的世界观，包括力量体系、地理势力、物品设定等，保持设定一致性。"
                                gradient="from-green-500/20 to-emerald-500/20"
                                iconGradient="from-green-500 to-emerald-500"
                            />
                            <FeatureCard
                                icon={<Zap className="h-8 w-8" />}
                                title="灵感扩写"
                                description="卡文了？输入一句话，AI 帮你扩写成一段精彩的描写，多种风格任你选择。"
                                gradient="from-yellow-500/20 to-orange-500/20"
                                iconGradient="from-yellow-500 to-orange-500"
                            />
                            <FeatureCard
                                icon={<Shield className="h-8 w-8" />}
                                title="私有化部署支持"
                                description="支持本地部署和私有模型接入，确保您的创意和数据绝对安全，完全掌控。"
                                gradient="from-red-500/20 to-rose-500/20"
                                iconGradient="from-red-500 to-rose-500"
                            />
                            <FeatureCard
                                icon={<Star className="h-8 w-8" />}
                                title="多模型切换"
                                description="无缝集成 GPT-4, Claude 3, DeepSeek 等主流模型，根据需求灵活选择最佳模型。"
                                gradient="from-indigo-500/20 to-blue-500/20"
                                iconGradient="from-indigo-500 to-blue-500"
                            />
                        </motion.div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="relative py-20">
                    <div className="container mx-auto px-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                简单透明的价格
                            </h2>
                            <p className="text-gray-400 text-lg">选择最适合您的创作计划</p>
                        </motion.div>

                        <motion.div
                            className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={containerVariants}
                        >
                            <PricingCard
                                title="免费版"
                                price="¥0"
                                period="/永久"
                                description="适合初学者体验 AI 辅助创作"
                                features={[
                                    "每日 5 次 AI 生成",
                                    "1 个活跃项目",
                                    "基础大纲生成",
                                    "标准模型支持",
                                    "社区支持"
                                ]}
                                buttonText="免费注册"
                                href="/auth?mode=register"
                                user={user}
                            />
                            <PricingCard
                                title="专业版"
                                price="¥39"
                                period="/月"
                                isPopular={true}
                                description="为严肃创作者打造的完整工具箱"
                                features={[
                                    "每日 100 次 AI 生成",
                                    "无限活跃项目",
                                    "高级大纲与世界观生成",
                                    "高级模型支持",
                                    "优先客服支持",
                                    "私有知识库 (RAG)"
                                ]}
                                buttonText="开始试用"
                                href="/auth?mode=register"
                                user={user}
                                onSelect={() => handlePlanSelect("pro_monthly", 3900, "专业版月卡")}
                            />
                            <PricingCard
                                title="团队版"
                                price="¥199"
                                period="/月"
                                description="适合工作室和团队协作"
                                features={[
                                    "无限 AI 生成",
                                    "团队协作与权限管理",
                                    "专属私有模型微调",
                                    "API 访问权限",
                                    "专属客户经理",
                                    "SLA 保障"
                                ]}
                                buttonText="联系我们"

                                href="mailto:sales@novelhelper.com"
                                user={user}
                            />
                        </motion.div>
                    </div>
                </section>
            </main>

            {selectedPlan && (
                <PaymentDialog
                    open={paymentOpen}
                    onOpenChange={setPaymentOpen}
                    planId={selectedPlan.id}
                    amount={selectedPlan.amount}
                    title={selectedPlan.title}
                />
            )}

            {/* Footer */}
            <footer className="relative border-t border-white/10 bg-black/20 backdrop-blur-xl py-12">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center gap-2 font-bold text-xl mb-4">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                    Novel Helper
                                </span>
                            </div>
                            <p className="text-sm text-gray-400">
                                赋能每一位创作者，让故事更精彩。
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold mb-4">产品</h3>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-purple-400 transition-colors">功能介绍</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">更新日志</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">价格方案</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold mb-4">资源</h3>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-purple-400 transition-colors">使用文档</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">写作教程</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">社区论坛</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold mb-4">法律</h3>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><a href="#" className="hover:text-purple-400 transition-colors">隐私政策</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">服务条款</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-gray-400">
                        © {new Date().getFullYear()} Novel Helper. All rights reserved.
                    </div>
                </div>
            </footer>
        </motion.div>
    );
}

function FeatureCard({
    icon,
    title,
    description,
    gradient,
    iconGradient
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    gradient: string;
    iconGradient: string;
}) {
    return (
        <motion.div variants={itemVariants} className="group">
            <Card className={`h-full bg-gradient-to-br ${gradient} backdrop-blur-xl border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20`}>
                <CardHeader>
                    <div className={`mb-4 p-3 rounded-xl bg-gradient-to-br ${iconGradient} w-fit`}>
                        {icon}
                    </div>
                    <CardTitle className="text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-blue-400 group-hover:bg-clip-text transition-all">
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-300 leading-relaxed">{description}</p>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function PricingCard({
    title,
    price,
    period,
    description,
    features,
    buttonText,
    href,
    isPopular,
    user,
    onSelect
}: {
    title: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    buttonText: string;
    href?: string;
    isPopular?: boolean;
    user?: any;
    onSelect?: () => void;
}) {
    const ButtonComponent = (
        <Button
            className={`w-full h-12 ${isPopular
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
            onClick={() => {
                if (href && href.startsWith("mailto:")) {
                    window.location.href = href;
                } else if (user && onSelect) {
                    onSelect();
                }
            }}
        >
            {buttonText}
        </Button>
    );

    return (
        <motion.div variants={itemVariants} className="h-full relative group">
            {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="px-4 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold rounded-full shadow-lg">
                        最受欢迎
                    </div>
                </div>
            )}
            <Card className={`h-full flex flex-col backdrop-blur-xl transition-all duration-300 ${isPopular
                ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/50 shadow-2xl shadow-purple-500/20 scale-105'
                : 'bg-white/5 border-white/10 hover:border-white/30 hover:scale-105'
                }`}>
                <CardHeader>
                    <CardTitle className="text-2xl text-white">{title}</CardTitle>
                    <div className="flex items-baseline gap-1 mt-4">
                        <span className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                            {price}
                        </span>
                        <span className="text-gray-400">{period}</span>
                    </div>
                    <CardDescription className="text-gray-300 mt-2">{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm">
                        {features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <Check className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-gray-200">{feature}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
                <CardFooter>
                    {href?.startsWith("mailto:") || (user && onSelect) ? (
                        ButtonComponent
                    ) : (
                        <AuthDialog defaultTab="register">
                            {ButtonComponent}
                        </AuthDialog>
                    )}
                </CardFooter>
            </Card>
        </motion.div>
    );
}
