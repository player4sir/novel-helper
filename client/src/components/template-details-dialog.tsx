import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Template {
  id: number;
  name: string;
  description: string | null;
  genre: string;
  style: string | null;
  characterStructure: any;
  worldFramework: any;
  conflictPatterns: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateDetailsDialogProps {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateDetailsDialog({
  template,
  open,
  onOpenChange,
}: TemplateDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{template.name}</DialogTitle>
          <DialogDescription>
            {template.description || "无描述"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Badge>{template.genre}</Badge>
          {template.style && <Badge variant="outline">{template.style}</Badge>}
          <Badge variant="secondary">使用次数: {template.usageCount}</Badge>
        </div>

        <Tabs defaultValue="characters" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="characters">角色结构</TabsTrigger>
            <TabsTrigger value="world">世界观</TabsTrigger>
            <TabsTrigger value="conflicts">冲突模式</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="characters" className="space-y-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">角色结构配置</h3>
                {template.characterStructure ? (
                  <StructureDisplay data={template.characterStructure} />
                ) : (
                  <p className="text-muted-foreground">无角色结构配置</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="world" className="space-y-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">世界观框架</h3>
                {template.worldFramework ? (
                  <StructureDisplay data={template.worldFramework} />
                ) : (
                  <p className="text-muted-foreground">无世界观配置</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="conflicts" className="space-y-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">冲突模式</h3>
                {template.conflictPatterns && template.conflictPatterns.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1">
                    {template.conflictPatterns.map((pattern, index) => (
                      <li key={index}>{pattern}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">无冲突模式配置</p>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <Separator />

        <div className="text-sm text-muted-foreground space-y-1">
          <p>创建时间: {new Date(template.createdAt).toLocaleString("zh-CN")}</p>
          <p>更新时间: {new Date(template.updatedAt).toLocaleString("zh-CN")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StructureDisplay({ data }: { data: any }) {
  if (!data) return null;

  if (typeof data === "string") {
    return <p className="whitespace-pre-wrap">{data}</p>;
  }

  if (Array.isArray(data)) {
    return (
      <ul className="list-disc list-inside space-y-1">
        {data.map((item, index) => (
          <li key={index}>
            {typeof item === "object" ? (
              <div className="ml-4 mt-1">
                <StructureDisplay data={item} />
              </div>
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof data === "object") {
    return (
      <div className="space-y-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="border-l-2 border-muted pl-4">
            <p className="font-medium text-sm mb-1">{key}:</p>
            <div className="text-sm">
              <StructureDisplay data={value} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <p>{String(data)}</p>;
}
