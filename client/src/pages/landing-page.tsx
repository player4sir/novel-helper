import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Check, Sparkles, BookOpen, Zap, Shield, Globe, ArrowRight, Star, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    const [paymentOpen, setPaymentOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<{ id: string, amount: number, title: string } | null>(null);

    const handlePlanSelect = (planId: string, amount: number, title: string) => {
        setSelectedPlan({ id: planId, amount, title });
        setPaymentOpen(true);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 animate-pulse"></div>
                        <div className="relative p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 mb-4 inline-block">
                            <BookOpen className="h-12 w-12 text-purple-400 animate-pulse" />
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isExiting ? 0 : 1 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden selection:bg-purple-500/30"
        >
            {/* Cosmic Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-900/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
                <div className="absolute top-[20%] right-[20%] w-[30vw] h-[30vw] bg-cyan-900/5 rounded-full blur-[100px]"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            {/* Header */}
            <header className="fixed w-full top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0a0a0f]/60">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 blur opacity-50 group-hover:opacity-100 transition duration-500 rounded-lg"></div>
                            <div className="relative p-2 rounded-lg bg-[#0a0a0f] border border-white/10">
                                <BookOpen className="h-5 w-5 text-purple-400" />
                            </div>
                        </div>
                        <span className="bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
                            Novel Helper
                        </span>
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <a href="#features" className="hover:text-white transition-colors">功能</a>
                        <a href="#pricing" className="hover:text-white transition-colors">价格</a>
                        <a href="#faq" className="hover:text-white transition-colors">常见问题</a>
                    </nav>

                    <div className="hidden md:flex items-center gap-4">
                        {user ? (
                            <Link href="/app">
                                <Button className="bg-white text-black hover:bg-gray-200 border-0 font-medium">
                                    进入工作台
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <AuthDialog defaultTab="login">
                                    <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">
                                        登录
                                    </Button>
                                </AuthDialog>
                                <AuthDialog defaultTab="register">
                                    <Button className="bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)]">
                                        免费开始
                                    </Button>
                                </AuthDialog>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-gray-400 hover:text-white"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Nav */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="md:hidden border-t border-white/5 bg-[#0a0a0f]"
                        >
                            <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
                                <a href="#features" className="text-gray-400 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>功能</a>
                                <a href="#pricing" className="text-gray-400 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>价格</a>
                                <a href="#faq" className="text-gray-400 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>常见问题</a>
                                <div className="h-px bg-white/5 my-2"></div>
                                {user ? (
                                    <Link href="/app">
                                        <Button className="w-full bg-white text-black hover:bg-gray-200">进入工作台</Button>
                                    </Link>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <AuthDialog defaultTab="login">
                                            <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-white">登录</Button>
                                        </AuthDialog>
                                        <AuthDialog defaultTab="register">
                                            <Button className="w-full bg-purple-600 hover:bg-purple-700">免费开始</Button>
                                        </AuthDialog>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            <main className="relative z-10 pt-16">
                {/* Hero Section */}
                <section className="relative py-32 md:py-48 lg:py-56 overflow-hidden">
                    <motion.div
                        className="container mx-auto px-4 text-center relative z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs md:text-sm font-medium mb-8 text-purple-300"
                        >
                            <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
                            <span>AI 驱动的新一代写作助手</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.8 }}
                            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1]"
                        >
                            <span className="block text-white drop-shadow-2xl">
                                让灵感
                            </span>
                            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
                                不再流失
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.6 }}
                            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed"
                        >
                            Novel Helper 结合先进的大语言模型，为您提供从灵感构思、大纲设计到正文写作的全流程辅助。
                            专注于中文网文创作，懂你想要的每一个爽点。
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 0.6 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        >
                            <AuthDialog defaultTab="register">
                                <Button
                                    size="lg"
                                    className="h-14 px-8 text-lg bg-white text-black hover:bg-gray-200 border-0 rounded-full font-semibold transition-transform hover:scale-105"
                                >
                                    立即免费试用
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </AuthDialog>
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-14 px-8 text-lg border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-sm"
                                asChild
                            >
                                <a href="#features">了解更多</a>
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Hero Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none"></div>
                </section>

                {/* Features Section */}
                <section id="features" className="relative py-32 bg-[#0a0a0f]">
                    <div className="container mx-auto px-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-20"
                        >
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                                全能创作助手
                            </h2>
                            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                                每一个功能都为创作者精心打磨，让你的故事更具吸引力
                            </p>
                        </motion.div>

                        <motion.div
                            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={containerVariants}
                        >
                            <FeatureCard
                                icon={<BookOpen className="h-6 w-6" />}
                                title="智能大纲生成"
                                description="输入核心创意，一键生成完整的故事大纲、分卷剧情和细纲，逻辑严密，节奏紧凑。"
                                color="blue"
                            />
                            <FeatureCard
                                icon={<Sparkles className="h-6 w-6" />}
                                title="角色深度定制"
                                description="打造有血有肉的角色，自动生成性格、背景、动机和成长弧光，避免脸谱化。"
                                color="purple"
                            />
                            <FeatureCard
                                icon={<Globe className="h-6 w-6" />}
                                title="世界观构建"
                                description="辅助构建宏大的世界观，包括力量体系、地理势力、物品设定等，保持设定一致性。"
                                color="green"
                            />
                            <FeatureCard
                                icon={<Zap className="h-6 w-6" />}
                                title="灵感扩写"
                                description="卡文了？输入一句话，AI 帮你扩写成一段精彩的描写，多种风格任你选择。"
                                color="yellow"
                            />
                            <FeatureCard
                                icon={<Shield className="h-6 w-6" />}
                                title="私有化部署支持"
                                description="支持本地部署和私有模型接入，确保您的创意和数据绝对安全，完全掌控。"
                                color="red"
                            />
                            <FeatureCard
                                icon={<Star className="h-6 w-6" />}
                                title="多模型切换"
                                description="无缝集成 GPT-4, Claude 3, DeepSeek 等主流模型，根据需求灵活选择最佳模型。"
                                color="indigo"
                            />
                        </motion.div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="relative py-32 border-t border-white/5">
                    <div className="container mx-auto px-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-20"
                        >
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                                简单透明的价格
                            </h2>
                            <p className="text-gray-400 text-lg">
                                选择最适合您的创作计划
                            </p>
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
            <footer className="relative border-t border-white/5 bg-[#050507] py-16">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-12 mb-12">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center gap-2 font-bold text-xl mb-6">
                                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                                    <BookOpen className="h-5 w-5 text-purple-400" />
                                </div>
                                <span className="text-white">Novel Helper</span>
                            </div>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                赋能每一位创作者，让故事更精彩。<br />
                                专注于中文网文创作的 AI 助手。
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold text-white mb-6">产品</h3>
                            <ul className="space-y-4 text-sm text-gray-500">
                                <li><a href="#" className="hover:text-purple-400 transition-colors">功能介绍</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">更新日志</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">价格方案</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold text-white mb-6">资源</h3>
                            <ul className="space-y-4 text-sm text-gray-500">
                                <li><a href="#" className="hover:text-purple-400 transition-colors">使用文档</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">写作教程</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">社区论坛</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold text-white mb-6">法律</h3>
                            <ul className="space-y-4 text-sm text-gray-500">
                                <li><a href="#" className="hover:text-purple-400 transition-colors">隐私政策</a></li>
                                <li><a href="#" className="hover:text-purple-400 transition-colors">服务条款</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-white/5 text-center text-sm text-gray-600">
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
    color
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    color: "blue" | "purple" | "green" | "yellow" | "red" | "indigo";
}) {
    const colorStyles = {
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20 group-hover:border-blue-500/50",
        purple: "text-purple-400 bg-purple-500/10 border-purple-500/20 group-hover:border-purple-500/50",
        green: "text-green-400 bg-green-500/10 border-green-500/20 group-hover:border-green-500/50",
        yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20 group-hover:border-yellow-500/50",
        red: "text-red-400 bg-red-500/10 border-red-500/20 group-hover:border-red-500/50",
        indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20 group-hover:border-indigo-500/50",
    };

    return (
        <motion.div variants={itemVariants} className="group h-full">
            <div className="h-full p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-1">
                <div className={`mb-6 p-3 rounded-xl w-fit ${colorStyles[color].split(" ").slice(1).join(" ")} transition-colors`}>
                    <div className={colorStyles[color].split(" ")[0]}>
                        {icon}
                    </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">
                    {title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                    {description}
                </p>
            </div>
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
            className={`w-full h-12 rounded-xl font-medium transition-all ${isPopular
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20 border-0'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
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
                    <div className="px-4 py-1 bg-purple-600 text-white text-xs font-bold rounded-full shadow-lg shadow-purple-900/50 border border-purple-400/20">
                        最受欢迎
                    </div>
                </div>
            )}
            <div className={`h-full flex flex-col p-8 rounded-3xl transition-all duration-300 ${isPopular
                ? 'bg-gradient-to-b from-purple-900/20 to-blue-900/10 border border-purple-500/30 shadow-2xl shadow-purple-900/10'
                : 'bg-white/[0.02] border border-white/5 hover:border-white/10'
                }`}>
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-gray-400 min-h-[40px]">{description}</p>
                </div>

                <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-4xl font-bold text-white">
                        {price}
                    </span>
                    <span className="text-gray-500">{period}</span>
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                    {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                            <div className={`mt-0.5 p-0.5 rounded-full ${isPopular ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-400'}`}>
                                <Check className="h-3 w-3" />
                            </div>
                            <span className="text-gray-300">{feature}</span>
                        </li>
                    ))}
                </ul>

                <div>
                    {href?.startsWith("mailto:") || (user && onSelect) ? (
                        ButtonComponent
                    ) : (
                        <AuthDialog defaultTab="register">
                            {ButtonComponent}
                        </AuthDialog>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

