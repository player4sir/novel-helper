/**
 * Editor AI Integration Hook
 * 
 * Provides AI-powered editing capabilities to the editor
 */

import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export interface EditorAIRequest {
    instruction: string;
    selectedText?: string;
    cursorPosition?: number;
    chapterContent?: string; // Optional if preceding/following are provided
    precedingText?: string;
    followingText?: string;
    chapterId: string;
    projectId: string;
    styleProfileId?: string;
}

export interface EditorAIResponse {
    success: boolean;
    result: string;
    metadata: {
        intent: string;
        modelId: string;
        tokensUsed: number;
        retrievedContexts?: number;
        processingTime: number;
    };
}

export function useEditorAI() {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const processInstructionMutation = useMutation({
        mutationFn: async (request: EditorAIRequest) => {
            const res = await apiRequest("POST", "/api/editor/ai-instruction", request);
            return await res.json() as EditorAIResponse;
        },
        onSuccess: (data) => {
            if (data.success) {
                toast({
                    title: "AI处理完成",
                    description: `使用模型: ${data.metadata.modelId}, 耗时: ${data.metadata.processingTime}ms`,
                });
            }
        },
        onError: (error: any) => {
            toast({
                title: "AI处理失败",
                description: error.message || "未知错误",
                variant: "destructive",
            });
        },
    });

    const polishChapterMutation = useMutation({
        mutationFn: async (params: { chapterId: string; projectId: string; focusAreas?: string[] }) => {
            const res = await apiRequest("POST", `/api/chapters/${params.chapterId}/polish`, {
                projectId: params.projectId,
                focusAreas: params.focusAreas,
            });
            return await res.json();
        },
        onSuccess: () => {
            toast({
                title: "润色完成",
                description: "章节已成功润色",
            });
        },
    });

    const checkCoherenceMutation = useMutation({
        mutationFn: async (params: { chapterId: string; projectId: string }) => {
            const res = await apiRequest("POST", `/api/chapters/${params.chapterId}/check-coherence`, {
                projectId: params.projectId,
            });
            return await res.json();
        },
        onSuccess: (data: any) => {
            const score = data.coherence?.overallScore || 0;
            const issues = data.coherence?.issues?.length || 0;

            toast({
                title: "连贯性检查完成",
                description: `评分: ${score}/100, 发现 ${issues} 个潜在问题`,
            });
        },
    });

    const processInstructionStream = async (
        request: EditorAIRequest,
        callbacks: {
            onChunk: (chunk: string) => void;
            onMetadata?: (metadata: any) => void;
            onError?: (error: string) => void;
            onComplete?: (data: any) => void;
        }
    ) => {
        setIsProcessing(true);
        try {
            const response = await fetch("/api/editor/ai-instruction-stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
            });

            if (!response.ok) throw new Error(response.statusText);
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            let completeCalled = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log("[useEditorAI] Stream done");
                    // Flush the decoder
                    buffer += decoder.decode();
                    break;
                }

                const chunkStr = decoder.decode(value, { stream: true });
                // console.log("[useEditorAI] Received chunk:", chunkStr);
                buffer += chunkStr;
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.trim() === "") continue;
                    // console.log("[useEditorAI] Raw line:", JSON.stringify(line));

                    if (!line.startsWith("data: ")) continue;

                    try {
                        const jsonStr = line.slice(6).trim();
                        const event = JSON.parse(jsonStr);

                        if (event.type === "content") {
                            callbacks.onChunk(event.data);
                        } else if (event.type === "metadata") {
                            callbacks.onMetadata?.(event.data);
                        } else if (event.type === "complete") {
                            console.log("[useEditorAI] Received complete event");
                            completeCalled = true;
                            callbacks.onComplete?.(event.data);
                        } else if (event.type === "error") {
                            throw new Error(event.error);
                        }
                    } catch (e: any) {
                        console.warn("Failed to parse SSE event:", e, "Line:", line);
                        if (e.message && e.message !== "Unexpected end of JSON input") {
                            callbacks.onError?.(e.message);
                        }
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim() !== "") {
                console.log("[useEditorAI] Processing remaining buffer:", buffer);
                const line = buffer;
                if (line.startsWith("data: ")) {
                    try {
                        const jsonStr = line.slice(6);
                        const event = JSON.parse(jsonStr);
                        if (event.type === "content") {
                            callbacks.onChunk(event.data);
                        } else if (event.type === "metadata") {
                            callbacks.onMetadata?.(event.data);
                        } else if (event.type === "complete") {
                            console.log("[useEditorAI] Received complete event (from buffer)");
                            completeCalled = true;
                            callbacks.onComplete?.(event.data);
                        } else if (event.type === "error") {
                            throw new Error(event.error);
                        }
                    } catch (e: any) {
                        console.warn("Failed to parse remaining SSE event:", e);
                    }
                }
            }

            // Fallback: If stream finished but no complete event received, trigger it anyway
            if (!completeCalled) {
                console.warn("[useEditorAI] Stream finished without complete event. Triggering fallback.");
                callbacks.onComplete?.({
                    processingTime: 0,
                    fullContentLength: 0 // We don't track total length here easily, but it's not critical
                });
            }
        } catch (error: any) {
            console.error("Stream error:", error);
            callbacks.onError?.(error.message);
            toast({
                title: "AI处理失败",
                description: error.message || "未知错误",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        processInstruction: processInstructionMutation.mutateAsync,
        processInstructionStream,
        polishChapter: polishChapterMutation.mutateAsync,
        checkCoherence: checkCoherenceMutation.mutateAsync,
        isProcessing: isProcessing || processInstructionMutation.isPending || polishChapterMutation.isPending || checkCoherenceMutation.isPending,
    };
}
