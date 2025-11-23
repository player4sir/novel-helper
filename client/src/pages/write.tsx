import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, Save, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChapterSidebar } from "@/components/write/chapter-sidebar";
import { EditorPanel, type EditorPanelHandle } from "@/components/write/editor-panel";
import { AIAssistantPanel } from "@/components/write/ai-assistant-panel";
import { SceneDetailsPanel } from "@/components/write/scene-details-panel";
import { PlotCardsPanel } from "@/components/write/plot-cards-panel";
import { ProjectSelector } from "@/components/write/project-selector";
import { AutoWriterControl } from "@/components/creation/AutoWriterControl";
import { StyleLab } from "@/components/creation/StyleLab";

import { GenerateContentButton } from "@/components/write/generate-content-button";
import { useChapterGeneration } from "@/hooks/use-chapter-generation";
import type { Project, Chapter } from "@shared/schema";

export default function Write() {
  const [, navigate] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const projectId = searchParams.get("project");
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }, []);

  const editorRef = useRef<EditorPanelHandle>(null);

  const { startGeneration, stopGeneration, isGenerating } = useChapterGeneration({
    onChunk: (chunk) => {
      if (editorRef.current) {
        editorRef.current.appendContent(chunk);
      }
    },
    onSceneStart: (index, total, purpose) => {
      if (editorRef.current) {
        // Add separator if not the first scene
        const separator = index > 0 ? "\n\n***\n\n" : "";
        // Add scene header (optional, can be removed later by user)
        // Using a distinct format that looks like a draft note
        const header = `\n\n【场景 ${index + 1}/${total}：${purpose}】\n\n`;

        editorRef.current.appendContent(separator + header);
      }
    }
  });

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

          />
        </div>

        <div className="flex items-center gap-2">
          {selectedChapter && selectedProjectId && (
            <>
              <div className="text-sm text-muted-foreground px-3 py-1.5 rounded-md bg-muted">
                <span className="font-medium" data-testid="text-chapter-word-count">
                  {selectedChapter.wordCount || 0}
                </span>{" "}
                字
              </div>
              {(!selectedChapter.content || selectedChapter.content.length < 100) && (
                <GenerateContentButton
                  isGenerating={isGenerating}
                  onGenerate={() => startGeneration(selectedProjectId, selectedChapter.id)}
                  onStop={stopGeneration}
                />
              )}
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
              ref={editorRef}
              project={selectedProject}
              chapter={selectedChapter}
            />

            {/* Right: Panels */}
            <div className="w-80 border-l border-border flex flex-col">
              <Tabs defaultValue="assistant" className="flex-1 flex flex-col">
                <div className="px-4 mt-4">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="assistant">AI助手</TabsTrigger>
                    <TabsTrigger value="scenes">场景</TabsTrigger>
                    <TabsTrigger value="plots">情节</TabsTrigger>
                    <TabsTrigger value="auto">自动</TabsTrigger>
                    <TabsTrigger value="styles">风格</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="assistant" className="flex-1 mt-0">
                  <AIAssistantPanel
                    projectId={selectedProject.id}
                    chapterId={selectedChapterId}
                    editorRef={editorRef}
                  />
                </TabsContent>
                <TabsContent value="scenes" className="flex-1 mt-0">
                  {selectedChapterId && selectedProjectId ? (
                    <SceneDetailsPanel chapterId={selectedChapterId} projectId={selectedProjectId} />
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      请先选择章节
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="plots" className="flex-1 mt-0 overflow-hidden">
                  <PlotCardsPanel
                    projectId={selectedProjectId}
                    onInsert={(content) => {
                      if (editorRef.current) {
                        editorRef.current.appendContent(content);
                      }
                    }}
                  />
                </TabsContent>
                <TabsContent value="auto" className="flex-1 mt-0 p-4">
                  <AutoWriterControl projectId={selectedProject.id} />
                </TabsContent>
                <TabsContent value="styles" className="flex-1 mt-0 overflow-hidden">
                  <StyleLab projectId={selectedProject.id} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h2 className="text-xl font-semibold mb-3">选择或创建项目</h2>
              <p className="text-sm text-muted-foreground mb-6">
                选择一个现有项目继续创作，或创建一个新项目开始您的小说之旅
              </p>
              <Button onClick={() => navigate("/")} data-testid="button-go-dashboard">
                <BookOpen className="h-4 w-4 mr-2" />
                前往项目概览
              </Button>
            </div>
          </div>
        )
        }
      </div >


    </div >
  );
}
