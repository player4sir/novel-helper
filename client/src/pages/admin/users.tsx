import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Ban, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsers() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const limit = 10;
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: usersData, isLoading } = useQuery({
        queryKey: ["admin-users", page, limit],
        queryFn: async () => {
            const res = await fetch(`/api/admin/users?page=${page}&limit=${limit}`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        },
    });

    const toggleBanMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch(`/api/admin/users/${userId}/toggle-ban`, {
                method: "POST",
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to toggle ban");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            toast({
                title: "操作成功",
                description: "用户状态已更新",
            });
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "操作失败",
                description: error.message,
            });
        },
    });

    const users = usersData?.users || [];
    const pagination = usersData?.pagination || { total: 0, totalPages: 1 };

    // Client-side filtering for current page (optional, better to have server-side search)
    const filteredUsers = users.filter((user: any) =>
        user.username.toLowerCase().includes(search.toLowerCase())
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
                <h1 className="text-2xl font-bold text-white">用户管理</h1>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="搜索本页用户..."
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
                            <TableHead className="text-gray-400">ID</TableHead>
                            <TableHead className="text-gray-400">用户名</TableHead>
                            <TableHead className="text-gray-400">角色</TableHead>
                            <TableHead className="text-gray-400">订阅等级</TableHead>
                            <TableHead className="text-gray-400">项目数</TableHead>
                            <TableHead className="text-gray-400">注册时间</TableHead>
                            <TableHead className="text-right text-gray-400">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                                    暂无用户
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user: any) => (
                                <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-mono text-xs text-gray-500">
                                        {user.id.slice(0, 8)}...
                                    </TableCell>
                                    <TableCell className="font-medium text-white">
                                        {user.username}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={user.role === "admin" ? "default" : user.role === "banned" ? "destructive" : "secondary"}
                                            className="bg-white/10 hover:bg-white/20"
                                        >
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                                            {user.subscriptionTier}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-gray-400">
                                        {user.projectCount || 0}
                                    </TableCell>
                                    <TableCell className="text-gray-400">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {user.role !== "admin" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleBanMutation.mutate(user.id)}
                                                className={
                                                    user.role === "banned"
                                                        ? "text-green-400 hover:text-green-300 hover:bg-green-900/20"
                                                        : "text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                }
                                            >
                                                {user.role === "banned" ? (
                                                    <>
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        解封
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ban className="h-4 w-4 mr-1" />
                                                        封禁
                                                    </>
                                                )}
                                            </Button>
                                        )}
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
