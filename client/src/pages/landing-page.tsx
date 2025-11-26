import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Check, Sparkles, BookOpen, Zap, Shield, Globe } from "lucide-react";
import { motion } from "framer-motion";

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

    if (user) {
        setLocation("/app");
        return null;
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl text-primary">
                        <BookOpen className="h-6 w-6" />
                        <span>Novel Helper</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                        <a href="#features" className="hover:text-primary transition-colors">功能</a>
                        <a href="#pricing" className="hover:text-primary transition-colors">价格</a>
                        <a href="#faq" className="hover:text-primary transition-colors">常见问题</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link href="/auth">
                            <Button variant="ghost">登录</Button>
                        </Link>
                        <Link href="/auth?mode=register">
                            <Button>免费开始</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="py-20 md:py-32 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background -z-10" />
                    <motion.div
                        className="container mx-auto px-4 text-center"
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                    >
                        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                            <Sparkles className="h-4 w-4" />
                            <span>AI 驱动的新一代写作助手</span>
                        </motion.div>
                        <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                            让灵感不再流失<br />让创作更加自由
                        </motion.h1>
                        <motion.p variants={itemVariants} className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                            Novel Helper 结合先进的大语言模型，为您提供从灵感构思、大纲设计到正文写作的全流程辅助。
                            专注于中文网文创作，懂你想要的每一个爽点。
                        </motion.p>
                        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/auth?mode=register">
                                <Button size="lg" className="h-12 px-8 text-lg">
                                    立即免费试用 <Zap className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="#features">
                                <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                                    了解更多
                                </Button>
                            </Link>
                        </motion.div>
                    </motion.div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-20 bg-muted/30">
                    <div className="container mx-auto px-4">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-3xl font-bold text-center mb-12"
                        >
                            全能创作助手
                        </motion.h2>
                        <motion.div
                            className="grid md:grid-cols-3 gap-8"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={containerVariants}
                        >
                            <FeatureCard
                                icon={<BookOpen className="h-8 w-8 text-blue-500" />}
                                title="智能大纲生成"
                                description="输入核心创意，一键生成完整的故事大纲、分卷剧情和细纲，逻辑严密，节奏紧凑。"
                            />
                            <FeatureCard
                                icon={<Sparkles className="h-8 w-8 text-purple-500" />}
                                title="角色深度定制"
                                description="打造有血有肉的角色，自动生成性格、背景、动机和成长弧光，避免脸谱化。"
                            />
                            <FeatureCard
                                icon={<Globe className="h-8 w-8 text-green-500" />}
                                title="世界观构建"
                                description="辅助构建宏大的世界观，包括力量体系、地理势力、物品设定等，保持设定一致性。"
                            />
                            <FeatureCard
                                icon={<Zap className="h-8 w-8 text-yellow-500" />}
                                title="灵感扩写"
                                description="卡文了？输入一句话，AI 帮你扩写成一段精彩的描写，多种风格任你选择。"
                            />
                            <FeatureCard
                                icon={<Shield className="h-8 w-8 text-red-500" />}
                                title="私有化部署支持"
                                description="支持本地部署和私有模型接入，确保您的创意和数据绝对安全，完全掌控。"
                            />
                            <FeatureCard
                                icon={<Check className="h-8 w-8 text-cyan-500" />}
                                title="多模型切换"
                                description="无缝集成 GPT-4, Claude 3, DeepSeek 等主流模型，根据需求灵活选择最佳模型。"
                            />
                        </motion.div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="py-20">
                    <div className="container mx-auto px-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-12"
                        >
                            <h2 className="text-3xl font-bold mb-4">简单透明的价格</h2>
                            <p className="text-muted-foreground">选择最适合您的创作计划</p>
                        </motion.div>

                        <motion.div
                            className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
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
                                    "标准模型支持 (DeepSeek V3)",
                                    "社区支持"
                                ]}
                                buttonText="免费注册"
                                href="/auth?mode=register"
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
                                    "高级模型支持 (GPT-4o, Claude 3.5)",
                                    "优先客服支持",
                                    "私有知识库 (RAG)"
                                ]}
                                buttonText="开始试用"
                                href="/auth?mode=register"
                                variant="default"
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
                                variant="outline"
                            />
                        </motion.div>
                    </div>
                </section>
            </main>

            <footer className="bg-muted py-12 border-t">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center gap-2 font-bold text-xl mb-4">
                                <BookOpen className="h-6 w-6" />
                                <span>Novel Helper</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                赋能每一位创作者，让故事更精彩。
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold mb-4">产品</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><a href="#" className="hover:text-foreground">功能介绍</a></li>
                                <li><a href="#" className="hover:text-foreground">更新日志</a></li>
                                <li><a href="#" className="hover:text-foreground">价格方案</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold mb-4">资源</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><a href="#" className="hover:text-foreground">使用文档</a></li>
                                <li><a href="#" className="hover:text-foreground">写作教程</a></li>
                                <li><a href="#" className="hover:text-foreground">社区论坛</a></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold mb-4">法律</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><a href="#" className="hover:text-foreground">隐私政策</a></li>
                                <li><a href="#" className="hover:text-foreground">服务条款</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Novel Helper. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <motion.div variants={itemVariants}>
            <Card className="border-none shadow-none bg-background/50 hover:bg-background transition-colors h-full">
                <CardHeader>
                    <div className="mb-4 p-3 rounded-lg bg-muted w-fit">{icon}</div>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">{description}</p>
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
    variant = "outline"
}: {
    title: string,
    price: string,
    period: string,
    description: string,
    features: string[],
    buttonText: string,
    href: string,
    isPopular?: boolean,
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | null | undefined
}) {
    return (
        <motion.div variants={itemVariants} className="h-full">
            <Card className={`flex flex-col relative h-full ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}>
                {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                        最受欢迎
                    </div>
                )}
                <CardHeader>
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-bold">{price}</span>
                        <span className="text-muted-foreground">{period}</span>
                    </div>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm">
                        {features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-primary shrink-0" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
                <CardFooter>
                    <Link href={href} className="w-full">
                        <Button className="w-full" variant={variant}>{buttonText}</Button>
                    </Link>
                </CardFooter>
            </Card>
        </motion.div>
    );
}
