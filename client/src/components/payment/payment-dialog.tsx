import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface PaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planId: string;
    amount: number; // in cents
    title: string;
}

export function PaymentDialog({ open, onOpenChange, planId, amount, title }: PaymentDialogProps) {
    const [provider, setProvider] = useState<"alipay" | "wechat">("alipay");
    const [orderId, setOrderId] = useState<string | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid" | "failed">("pending");
    const { toast } = useToast();

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setOrderId(null);
            setQrCode(null);
            setPaymentStatus("pending");
            setProvider("alipay");
        }
    }, [open]);

    const handleCreateOrder = async () => {
        try {
            setIsLoading(true);
            const res = await apiRequest("POST", "/api/payment/create", {
                amount,
                provider,
                planId,
                description: `Novel Helper - ${title}`,
            });
            const data = await res.json();
            setOrderId(data.orderId);
            setQrCode(data.qrCode);
        } catch (error) {
            toast({
                title: "创建订单失败",
                description: "请稍后重试",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Poll for status
    useQuery({
        queryKey: ["paymentStatus", orderId],
        queryFn: async () => {
            if (!orderId || paymentStatus === "paid") return null;
            const res = await apiRequest("GET", `/api/payment/status/${orderId}`);
            const data = await res.json();
            if (data.status === "paid") {
                setPaymentStatus("paid");
                toast({
                    title: "支付成功",
                    description: "感谢您的订阅！",
                });
                setTimeout(() => onOpenChange(false), 2000);
            }
            return data;
        },
        enabled: !!orderId && paymentStatus === "pending",
        refetchInterval: 2000,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-slate-950 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>订阅 {title}</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        支付金额: ¥{(amount / 100).toFixed(2)}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    {paymentStatus === "paid" ? (
                        <div className="flex flex-col items-center justify-center py-8 text-green-400">
                            <CheckCircle2 className="h-16 w-16 mb-4" />
                            <p className="text-xl font-bold">支付成功</p>
                        </div>
                    ) : !qrCode ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant={provider === "alipay" ? "default" : "outline"}
                                    onClick={() => setProvider("alipay")}
                                    className={`h-20 flex flex-col gap-2 ${provider === "alipay"
                                            ? "bg-blue-600 hover:bg-blue-700 border-transparent"
                                            : "bg-transparent border-white/20 hover:bg-white/5"
                                        }`}
                                >
                                    {/* Icons can be added here if available */}
                                    <span className="text-lg font-bold">支付宝</span>
                                    <span className="text-xs opacity-80">Alipay</span>
                                </Button>
                                <Button
                                    variant={provider === "wechat" ? "default" : "outline"}
                                    onClick={() => setProvider("wechat")}
                                    className={`h-20 flex flex-col gap-2 ${provider === "wechat"
                                            ? "bg-green-600 hover:bg-green-700 border-transparent"
                                            : "bg-transparent border-white/20 hover:bg-white/5"
                                        }`}
                                >
                                    <span className="text-lg font-bold">微信支付</span>
                                    <span className="text-xs opacity-80">WeChat Pay</span>
                                </Button>
                            </div>
                            <Button
                                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white h-12 text-lg border-0"
                                onClick={handleCreateOrder}
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "立即支付"}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="bg-white p-4 rounded-xl">
                                <QRCodeSVG value={qrCode} size={200} />
                            </div>
                            <p className="text-sm text-gray-400">
                                请使用{provider === "alipay" ? "支付宝" : "微信"}扫码支付
                            </p>
                            <Button
                                variant="ghost"
                                className="text-sm text-gray-400 hover:text-white"
                                onClick={() => {
                                    setQrCode(null);
                                    setOrderId(null);
                                }}
                            >
                                更换支付方式
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
