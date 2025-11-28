import { useQuery } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function AdminSubscriptions() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const limit = 10;

    const { data: paymentsData, isLoading } = useQuery({
        queryKey: ["admin-payments", page, limit],
        queryFn: async () => {
            const res = await fetch(`/api/admin/payments?page=${page}&limit=${limit}`);
            if (!res.ok) throw new Error("Failed to fetch payments");
            return res.json();
        },
    });

    const payments = paymentsData?.payments || [];
    const pagination = paymentsData?.pagination || { total: 0, totalPages: 1 };

    const filteredPayments = payments.filter((payment: any) =>
        payment.username?.toLowerCase().includes(search.toLowerCase()) ||
        payment.id.toLowerCase().includes(search.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">订阅与支付管理</h1>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="搜索本页交易..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 bg-white/5 border-white/10 text-white"
                    />
                </div>
            </div>

            <div className="rounded-md border border-white/10 bg-white/5">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-gray-400">订单 ID</TableHead>
                            <TableHead className="text-gray-400">用户</TableHead>
                            <TableHead className="text-gray-400">金额</TableHead>
                            <TableHead className="text-gray-400">状态</TableHead>
                            <TableHead className="text-gray-400">支付时间</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPayments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                    暂无交易记录
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPayments.map((payment: any) => (
                                <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-mono text-xs text-gray-500">
                                        {payment.id}
                                    </TableCell>
                                    <TableCell className="font-medium text-white">
                                        {payment.username || "Unknown"}
                                    </TableCell>
                                    <TableCell className="text-green-400 font-medium">
                                        ¥{(payment.amount / 100).toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={payment.status === "paid" ? "default" : "secondary"}
                                            className={
                                                payment.status === "paid"
                                                    ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                    : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                            }
                                        >
                                            {payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-gray-400">
                                        {new Date(payment.createdAt).toLocaleDateString()} {new Date(payment.createdAt).toLocaleTimeString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-gray-400">
                    显示 {((page - 1) * limit) + 1} 到 {Math.min(page * limit, pagination.total)} 条，共 {pagination.total} 条
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        上一页
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                        下一页
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
