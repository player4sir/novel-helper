import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, Save, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChapterSidebar } from "@/components/write/chapter-sidebar";
import { EditorPanel } from "@/components/write/editor-panel";
import { AIAssistantPanel } from "@/components/write/ai-assistant-panel";
import { ProjectSelector } from "@/components/write/project-selector";
import { NewProjectDialog } from "@/components/write/new-project-dialog";
import type { Project, Chapter } from "@shared/schema";

export default function Write() {
  const [, navigate] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: chapters } = useQuery<Chapter[]>({
    queryKey: ["/api/chapters", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);
  const selectedChapter = chapters?.find((c) => c.id === selectedChapterId);

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <ProjectSelector
            projects={projects || []}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onNewProject={() => setShowNewProjectDialog(true)}
          />
        </div>

        <div className="flex items-center gap-2">
          {selectedChapter && (
            <>
              <div className="text-sm text-muted-foreground px-3 py-1.5 rounded-md bg-muted">
                <span className="font-medium" data-testid="text-chapter-word-count">
                  {selectedChapter.wordCount || 0}
                </span>{" "}
                字
              </div>
              <Button variant="ghost" size="sm" data-testid="button-save-chapter">
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {selectedProject ? (
          <>
            {/* Left: Chapter Sidebar */}
            <ChapterSidebar
              projectId={selectedProject.id}
              chapters={chapters || []}
              selectedChapterId={selectedChapterId}
              onSelectChapter={setSelectedChapterId}
            />

            {/* Center: Editor */}
            <EditorPanel
              project={selectedProject}
              chapter={selectedChapter}
            />

            {/* Right: AI Assistant */}
            <AIAssistantPanel
              projectId={selectedProject.id}
              chapterId={selectedChapterId}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h2 className="text-xl font-semibold mb-3">选择或创建项目</h2>
              <p className="text-sm text-muted-foreground mb-6">
                选择一个现有项目继续创作，或创建一个新项目开始您的小说之旅
              </p>
              <Button onClick={() => setShowNewProjectDialog(true)} data-testid="button-start-writing">
                <Sparkles className="h-4 w-4 mr-2" />
                开始创作
              </Button>
            </div>
          </div>
        )}
      </div>

      <NewProjectDialog
        open={showNewProjectDialog}
        onOpenChange={setShowNewProjectDialog}
        onProjectCreated={(projectId) => {
          setSelectedProjectId(projectId);
          setShowNewProjectDialog(false);
        }}
      />
    </div>
  );
}
