import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, CreditCard, DollarSign, Loader2 } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

export default function AdminDashboard() {
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["admin-stats"],
        queryFn: async () => {
            const res = await fetch("/api/admin/stats");
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json();
        },
    });

    const { data: recentUsersData, isLoading: usersLoading } = useQuery({
        queryKey: ["admin-users"],
        queryFn: async () => {
            const res = await fetch("/api/admin/users?limit=5");
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        },
    });

    const recentUsers = recentUsersData?.users;

    const { data: recentPaymentsData, isLoading: paymentsLoading } = useQuery({
        queryKey: ["admin-payments"],
        queryFn: async () => {
            const res = await fetch("/api/admin/payments?limit=5");
            if (!res.ok) throw new Error("Failed to fetch payments");
            return res.json();
        },
    });

    const recentPayments = recentPaymentsData?.payments;

    if (statsLoading || usersLoading || paymentsLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-white/5 border-white/10 text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">总用户数</CardTitle>
                        <Users className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">+12% 较上月</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">总项目数</CardTitle>
                        <BookOpen className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">+24% 较上月</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">活跃订阅</CardTitle>
                        <CreditCard className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">+5% 较上月</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">总收入</CardTitle>
                        <DollarSign className="h-4 w-4 text-yellow-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">¥{(stats?.totalRevenue / 100).toFixed(2) || "0.00"}</div>
                        <p className="text-xs text-gray-500 mt-1">+18% 较上月</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-1">
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white">Revenue Trend (30 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats?.revenueTrend}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `¥${value / 100}`}
                                    />
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                        labelStyle={{ color: '#fff' }}
                                        formatter={(value: number) => [`¥${(value / 100).toFixed(2)}`, 'Revenue']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#8884d8"
                                        fillOpacity={1}
                                        fill="url(#colorRevenue)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Users */}
                <Card className="col-span-4 bg-white/5 border-white/10 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>最新用户</span>
                            <a href="/admin/users" className="text-sm text-purple-400 hover:text-purple-300">查看全部 &rarr;</a>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableHead className="text-gray-400">用户名</TableHead>
                                    <TableHead className="text-gray-400">角色</TableHead>
                                    <TableHead className="text-gray-400">订阅</TableHead>
                                    <TableHead className="text-gray-400">注册时间</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentUsers?.slice(0, 5).map((user: any) => (
                                    <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                                        <TableCell className="font-medium">{user.username}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === "admin" ? "default" : "secondary"} className="bg-white/10 hover:bg-white/20">
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                                                {user.subscriptionTier}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-400">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Recent Payments */}
                <Card className="col-span-3 bg-white/5 border-white/10 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>最近交易</span>
                            <a href="/admin/subscriptions" className="text-sm text-purple-400 hover:text-purple-300">查看全部 &rarr;</a>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {recentPayments?.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">暂无交易记录</div>
                            ) : (
                                recentPayments?.map((payment: any) => (
                                    <div key={payment.id} className="flex items-center">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none text-white">
                                                {payment.username}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(payment.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="ml-auto font-medium text-green-400">
                                            +¥{(payment.amount / 100).toFixed(2)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
