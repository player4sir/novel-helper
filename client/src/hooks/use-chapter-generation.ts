import { useState, useCallback, useRef } from "react";
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
                setState((prev) => ({ ...prev, step: "connected", message: "已连接，准备生成..." }));
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case "connected":
                            setState((prev) => ({ ...prev, step: "connected" }));
                            break;

                        case "progress":
                            setState((prev) => ({
                                ...prev,
                                progress: data.progress || prev.progress,
                                step: data.step || prev.step,
                                message: data.message || prev.message,
                            }));
                            break;

                        case "scenes_decomposed":
                            setState((prev) => ({
                                ...prev,
                                progress: data.data.progress,
                                message: `已分解为 ${data.data.totalScenes} 个场景`,
                                currentScene: {
                                    index: 0,
                                    total: data.data.totalScenes,
                                    purpose: "",
                                },
                            }));
                            break;

                        case "scene_start":
                            setState((prev) => ({
                                ...prev,
                                progress: data.data.progress,
                                message: `正在生成场景 ${data.data.sceneIndex + 1}/${data.data.totalScenes}...`,
                                currentScene: {
                                    index: data.data.sceneIndex,
                                    total: data.data.totalScenes,
                                    purpose: data.data.scenePurpose,
                                    partialContent: "",
                                },
                            }));
                            if (options.onSceneStart) {
                                options.onSceneStart(data.data.sceneIndex, data.data.totalScenes, data.data.scenePurpose);
                            }
                            break;

                        case "thinking_start":
                            setState((prev) => ({
                                ...prev,
                                isThinking: true,
                                message: data.data.message || "AI正在深度思考剧情走向..."
                            }));
                            break;

                        case "thinking_end":
                            setState((prev) => ({
                                ...prev,
                                isThinking: false,
                                message: "思考完成，开始撰写..."
                            }));
                            break;

                        case "scene_content_chunk":
                            setState((prev) => {
                                if (!prev.currentScene) return prev;
                                return {
                                    ...prev,
                                    currentScene: {
                                        ...prev.currentScene,
                                        partialContent: (prev.currentScene.partialContent || "") + data.data.chunk
                                    }
                                };
                            });
                            // Call onChunk callback
                            if (options.onChunk) {
                                options.onChunk(data.data.chunk);
                            }
                            break;

                        case "scene_completed":
                            setState((prev) => ({
                                ...prev,
                                progress: data.data.progress,
                                stats: {
                                    ...prev.stats,
                                    scenesCompleted: prev.stats.scenesCompleted + 1,
                                    wordsGenerated: prev.stats.wordsGenerated + (data.data.wordCount || 0),
                                },
                            }));
                            // Invalidate queries to refresh chapter content
                            queryClient.invalidateQueries({ queryKey: ["chapter", chapterId] });
                            break;

                        case "scene_failed":
                            setState((prev) => ({
                                ...prev,
                                progress: data.data.progress,
                                message: `场景 ${data.data.sceneIndex + 1} 生成失败: ${data.data.error}`,
                                stats: {
                                    ...prev.stats,
                                    failedScenes: prev.stats.failedScenes + 1,
                                },
                            }));
                            break;

                        case "completed":
                            stopGeneration();
                            setState((prev) => ({
                                ...prev,
                                isGenerating: false,
                                progress: 100,
                                step: "completed",
                                message: `生成完成！共 ${data.data.wordCount} 字`,
                            }));
                            toast({
                                title: "生成完成",
                                description: `成功生成 ${data.data.successfulScenes} 个场景，共 ${data.data.wordCount} 字。`,
                            });
                            queryClient.invalidateQueries({ queryKey: ["chapter", chapterId] });
                            break;

                        case "error":
                            stopGeneration();
                            setState((prev) => ({
                                ...prev,
                                isGenerating: false,
                                step: "error",
                                message: `错误: ${data.error}`,
                            }));
                            toast({
                                title: "生成失败",
                                description: data.error,
                                variant: "destructive",
                            });
                            break;
                    }
                } catch (e) {
                    console.error("Error parsing SSE event:", e);
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
                    title: "连接错误",
                    description: "与生成服务的连接中断，请重试。",
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
    }, [state.isGenerating, stopGeneration, toast, queryClient]);

    return {
        ...state,
        startGeneration,
        stopGeneration,
    };
}
