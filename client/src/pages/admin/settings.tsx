import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, Edit2, Save } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    const { data: settings, isLoading } = useQuery({
        queryKey: ["admin-settings"],
        queryFn: async () => {
            const res = await fetch("/api/admin/settings");
            if (!res.ok) throw new Error("Failed to fetch settings");
            return res.json();
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to save setting");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
            setIsDialogOpen(false);
            setEditingItem(null);
            toast({ title: "保存成功" });
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "保存失败", description: error.message });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (key: string) => {
            const res = await fetch(`/api/admin/settings/${key}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete setting");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
            toast({ title: "删除成功" });
        },
    });

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
                <h1 className="text-2xl font-bold text-white">系统设置</h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingItem(null)} className="bg-purple-600 hover:bg-purple-700">
                            <Plus className="h-4 w-4 mr-2" />
                            新增配置
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0a0f] border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>{editingItem ? "编辑配置" : "新增配置"}</DialogTitle>
                        </DialogHeader>
                        <SettingForm
                            initialData={editingItem}
                            onSubmit={(data) => saveMutation.mutate(data)}
                            isLoading={saveMutation.isPending}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border border-white/10 bg-white/5">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-gray-400">Key</TableHead>
                            <TableHead className="text-gray-400">Value (JSON)</TableHead>
                            <TableHead className="text-gray-400">描述</TableHead>
                            <TableHead className="text-gray-400">最后更新</TableHead>
                            <TableHead className="text-right text-gray-400">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {settings?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                    暂无系统配置
                                </TableCell>
                            </TableRow>
                        ) : (
                            settings?.map((item: any) => (
                                <TableRow key={item.key} className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-mono text-purple-400">{item.key}</TableCell>
                                    <TableCell className="font-mono text-xs max-w-[200px] truncate text-gray-300">
                                        {JSON.stringify(item.value)}
                                    </TableCell>
                                    <TableCell className="text-gray-400">{item.description}</TableCell>
                                    <TableCell className="text-gray-500 text-xs">
                                        {new Date(item.updatedAt).toLocaleDateString()} by {item.updatedBy}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setIsDialogOpen(true);
                                                }}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                onClick={() => {
                                                    if (confirm("确定要删除此配置吗？")) {
                                                        deleteMutation.mutate(item.key);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function SettingForm({ initialData, onSubmit, isLoading }: { initialData: any, onSubmit: (data: any) => void, isLoading: boolean }) {
    const [key, setKey] = useState(initialData?.key || "");
    const [value, setValue] = useState(initialData ? JSON.stringify(initialData.value, null, 2) : "{}");
    const [description, setDescription] = useState(initialData?.description || "");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const parsedValue = JSON.parse(value);
            onSubmit({ key, value: parsedValue, description });
        } catch (err) {
            alert("Value must be valid JSON");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Key</label>
                <Input
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    disabled={!!initialData}
                    placeholder="e.g. system.maintenance_mode"
                    className="bg-white/5 border-white/10 text-white"
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Value (JSON)</label>
                <Textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="{}"
                    className="bg-white/5 border-white/10 text-white font-mono h-32"
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Description</label>
                <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Configuration description"
                    className="bg-white/5 border-white/10 text-white"
                />
            </div>
            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                保存
            </Button>
        </form>
    );
}
