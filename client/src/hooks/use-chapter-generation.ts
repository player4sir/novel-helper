import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export interface GenerationState {
    isGenerating: boolean;
    isThinking: boolean;
    progress: number;
    step: string;
    message: string;
    currentScene?: {
        index: number;
        total: number;
        purpose: string;
        partialContent?: string;
    };
    stats: {
        scenesCompleted: number;
        wordsGenerated: number;
        failedScenes: number;
    };
}

export interface UseChapterGenerationReturn extends GenerationState {
    startGeneration: (projectId: string, chapterId: string) => Promise<void>;
    stopGeneration: () => void;
}

interface UseChapterGenerationOptions {
    onChunk?: (chunk: string) => void;
    onSceneStart?: (index: number, total: number, purpose: string) => void;
}

export function useChapterGeneration(options: UseChapterGenerationOptions = {}): UseChapterGenerationReturn {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const eventSourceRef = useRef<EventSource | null>(null);

    const [state, setState] = useState<GenerationState>({
        isGenerating: false,
        isThinking: false,
        progress: 0,
        step: "idle",
        message: "",
        stats: {
            scenesCompleted: 0,
            wordsGenerated: 0,
            failedScenes: 0,
        },
    });

    const stopGeneration = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setState((prev) => ({ ...prev, isGenerating: false, message: "生成已停止" }));
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const startGeneration = useCallback(async (projectId: string, chapterId: string) => {
        if (state.isGenerating) return;

        // Reset state
        setState({
            isGenerating: true,
            isThinking: false,
            progress: 0,
            step: "connecting",
            message: "正在连接生成服务...",
            stats: {
                scenesCompleted: 0,
                wordsGenerated: 0,
                failedScenes: 0,
            },
        });

        try {
            const url = `/api/chapters/${chapterId}/generate-content-stream?projectId=${projectId}`;
            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                setState((prev) => ({ ...prev, step: "connected", message: "已连接，开始生成..." }));
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === "done") {
                        stopGeneration();
                        setState((prev) => ({
                            ...prev,
                            isGenerating: false,
                            progress: 100,
                            step: "completed",
                            message: "生成完成！",
                        }));
                        toast({
                            title: "生成完成",
                            description: "章节内容已生成。",
                        });
                        queryClient.invalidateQueries({ queryKey: ["chapter", chapterId] });
                        return;
                    }

                    if (data.type === "error") {
                        throw new Error(data.error);
                    }

                    if (data.type === "progress") {
                        setState((prev) => ({
                            ...prev,
                            progress: data.data.progress,
                            step: data.data.step || "generating",
                            message: data.data.message || prev.message,
                        }));
                    } else if (data.type === "scene_start") {
                        const { index, total, purpose } = data.data;
                        options.onSceneStart?.(index, total, purpose);
                        setState((prev) => ({
                            ...prev,
                            currentScene: { index, total, purpose },
                            message: `正在生成第 ${index + 1}/${total} 幕...`,
                        }));
                    } else if (data.type === "content_chunk") {
                        options.onChunk?.(data.data.content);
                        setState((prev) => ({
                            ...prev,
                            currentScene: {
                                ...prev.currentScene!,
                                partialContent: (prev.currentScene?.partialContent || "") + data.data.content
                            }
                        }));
                    } else if (data.type === "scene_completed") {
                        setState((prev) => ({
                            ...prev,
                            stats: {
                                ...prev.stats,
                                scenesCompleted: prev.stats.scenesCompleted + 1,
                                wordsGenerated: prev.stats.wordsGenerated + data.data.wordCount,
                            },
                            currentScene: undefined
                        }));
                        // Invalidate query to fetch latest content
                        queryClient.invalidateQueries({ queryKey: ["chapter", chapterId] });
                    }
                } catch (error) {
                    console.error("Error parsing SSE data:", error);
                }
            };

            eventSource.onerror = (error) => {
                console.error("SSE Error:", error);
                stopGeneration();
                setState((prev) => ({
                    ...prev,
                    isGenerating: false,
                    step: "error",
                    message: "连接中断",
                }));
                toast({
                    title: "生成中断",
                    description: "与服务器的连接已断开",
                    variant: "destructive",
                });
            };

        } catch (error: any) {
            stopGeneration();
            setState((prev) => ({
                ...prev,
                isGenerating: false,
                step: "error",
                message: `启动失败: ${error.message}`,
            }));
            toast({
                title: "启动失败",
                description: error.message,
                variant: "destructive",
            });
        }
    }, [state.isGenerating, stopGeneration, toast, queryClient, options]);

    return {
        ...state,
        startGeneration,
        stopGeneration,
    };
}
