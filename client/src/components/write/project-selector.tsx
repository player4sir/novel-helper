import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import type { Project } from "@shared/schema";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-64 justify-between"
          data-testid="button-select-project"
        >
          <span className="truncate">
            {selectedProject ? selectedProject.title : "选择项目..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="搜索项目..." />
          <CommandList>
            <CommandEmpty>未找到项目</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.title}
                  onSelect={() => {
                    onSelectProject(project.id);
                    setOpen(false);
                  }}
                  data-testid={`option-project-${project.id}`}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedProjectId === project.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="font-medium truncate">{project.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {project.genre} · {project.currentWordCount?.toLocaleString() || 0} 字
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onNewProject();
                  setOpen(false);
                }}
                data-testid="button-new-project-command"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>新建项目</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
