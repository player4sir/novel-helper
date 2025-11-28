import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { EnhancedCreationWizard } from "./EnhancedCreationWizard";

interface CreateProjectDialogProps {
  children: React.ReactNode;
  onSuccess?: (projectId: string) => void;
}

export function CreateProjectDialog({ children, onSuccess }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = (projectId: string) => {
    setOpen(false);
    onSuccess?.(projectId);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent
        className="w-[900px] max-w-[95vw] h-[750px] max-h-[90vh] p-0 gap-0 overflow-hidden border-none shadow-2xl bg-transparent"
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside
          e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">创建新项目</DialogTitle>
        <div className="h-full w-full bg-background rounded-lg overflow-hidden flex flex-col shadow-2xl border">
          <EnhancedCreationWizard
            open={open}
            onOpenChange={setOpen}
            onSuccess={handleSuccess}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
