import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { API_BASE_URL } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, CreditCard, Activity, Shield } from "lucide-react";
import { format } from "date-fns";
import { PaymentDialog } from "@/components/payment/payment-dialog";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Fetch Payment History
  const { data: payments = [], isLoading: isLoadingPayments } = useQuery<any[]>({
    queryKey: ["/api/user/payments"],
  });

  // Password Change Mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/api/user/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "密码修改成功",
        description: "下次登录请使用新密码。",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "修改失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "错误",
        description: "两次输入的新密码不一致",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (!user) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">用户中心</h1>
        <p className="text-muted-foreground mt-2">
          管理您的账户信息、订阅和安全设置
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="profile">个人资料</TabsTrigger>
          <TabsTrigger value="billing">订阅与账单</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">当前订阅</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {user.subscriptionTier || "Free"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.subscriptionTier === "pro"
                    ? "尊享版会员"
                    : "基础免费版"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">账户状态</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">正常</div>
                <p className="text-xs text-muted-foreground">
                  注册于 {format(new Date(user.createdAt || Date.now()), "yyyy-MM-dd")}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>安全设置</CardTitle>
              <CardDescription>修改您的登录密码</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="current">当前密码</Label>
                  <Input
                    id="current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new">新密码</Label>
                  <Input
                    id="new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">确认新密码</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  修改密码
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>订阅计划</CardTitle>
              <CardDescription>您当前的会员权益</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold capitalize">
                  {user.subscriptionTier || "Free"} Plan
                </h3>
                <p className="text-sm text-muted-foreground">
                  {user.subscriptionTier === "pro"
                    ? "您正在享受无限AI生成权益"
                    : "升级以解锁无限AI生成权益"}
                </p>
              </div>
              {user.subscriptionTier !== "pro" && (
                <Button onClick={() => setShowPaymentDialog(true)}>
                  升级会员
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>支付记录</CardTitle>
              <CardDescription>您的历史订单</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPayments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订单号</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead>方式</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          暂无支付记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments?.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">
                            {order.outTradeNo}
                          </TableCell>
                          <TableCell>
                            {format(new Date(order.createdAt), "yyyy-MM-dd HH:mm")}
                          </TableCell>
                          <TableCell>¥{(order.amount / 100).toFixed(2)}</TableCell>
                          <TableCell className="capitalize">
                            {order.paymentMethod}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                order.status === "success"
                                  ? "default" // "success" variant might not exist in default shadcn badge
                                  : order.status === "pending"
                                    ? "outline"
                                    : "destructive"
                              }
                              className={
                                order.status === "success" ? "bg-green-500 hover:bg-green-600" : ""
                              }
                            >
                              {order.status === "success"
                                ? "成功"
                                : order.status === "pending"
                                  ? "待支付"
                                  : "失败"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        planId="pro_monthly"
        amount={2900}
        title="专业版会员 (月付)"
      />
    </div>
  );
}
