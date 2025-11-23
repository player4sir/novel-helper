// Quality Evaluator Service
// Evaluates the quality of generated content based on validation results

export interface QualityEvaluation {
    overall: number; // Overall quality score (0-100)
    dimensions?: {
        coherence?: number;
        completeness?: number;
        creativity?: number;
        [key: string]: number | undefined;
    };
}

export interface ValidationResult {
    passed: boolean;
    score: number;
    violations: any[];
    executionTime: number;
}

export interface QualityOptions {
    targetWords?: number;
    [key: string]: any;
}

class QualityEvaluatorService {
    /**
     * Evaluate the quality of generated content
     * @param content - The content to evaluate
     * @param validation - Validation results
     * @param options - Additional options for quality evaluation
     * @returns Quality evaluation with overall score and dimensions
     */
    async evaluateQuality(
        content: string,
        validation: ValidationResult,
        options: QualityOptions = {}
    ): Promise<QualityEvaluation> {
        try {
            // Base score from validation
            let overallScore = validation.passed ? validation.score : validation.score * 0.7;

            // Adjust based on violations
            const violationPenalty = validation.violations.length * 5;
            overallScore = Math.max(0, overallScore - violationPenalty);

            // Content length check
            if (options.targetWords) {
                const wordCount = content.split(/\s+/).length;
                const lengthRatio = wordCount / options.targetWords;

                // Penalize if too short or too long
                if (lengthRatio < 0.5) {
                    overallScore *= 0.8;
                } else if (lengthRatio > 2.0) {
                    overallScore *= 0.9;
                }
            }

            // Calculate dimension scores
            const dimensions = {
                coherence: this.evaluateCoherence(content, validation),
                completeness: this.evaluateCompleteness(content, validation),
                creativity: this.evaluateCreativity(content),
            };

            // Ensure score is in valid range
            overallScore = Math.min(100, Math.max(0, overallScore));

            return {
                overall: Math.round(overallScore),
                dimensions,
            };
        } catch (error) {
            console.error('[QualityEvaluator] Error evaluating quality:', error);
            // Return a default score on error
            return {
                overall: 50,
                dimensions: {
                    coherence: 50,
                    completeness: 50,
                    creativity: 50,
                },
            };
        }
    }

    /**
     * Evaluate coherence of the content
     */
    private evaluateCoherence(content: string, validation: ValidationResult): number {
        let score = 80;

        // Check for validation issues related to coherence
        const coherenceViolations = validation.violations.filter(
            (v: any) => v.type === 'coherence' || v.severity === 'high'
        );
        score -= coherenceViolations.length * 10;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Evaluate completeness of the content
     */
    private evaluateCompleteness(content: string, validation: ValidationResult): number {
        let score = 80;

        // Check if content has minimal structure
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                // Check if array items have required fields
                const hasTitle = parsed.every((item: any) => item.title);
                const hasBeats = parsed.every((item: any) => item.beats && item.beats.length > 0);

                if (!hasTitle) score -= 20;
                if (!hasBeats) score -= 20;
            }
        } catch {
            // Not JSON, assume it's text content
            if (content.length < 100) score -= 30;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Evaluate creativity of the content
     */
    private evaluateCreativity(content: string): number {
        // Basic creativity heuristics
        let score = 70;

        // Check for variety in vocabulary (简单指标)
        const words = content.split(/\s+/);
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        const uniqueRatio = uniqueWords.size / words.length;

        if (uniqueRatio > 0.5) score += 10;
        if (uniqueRatio > 0.7) score += 10;

        // Check for presence of descriptive elements
        if (content.includes('主题') || content.includes('冲突')) score += 5;
        if (content.includes('节拍') || content.includes('beats')) score += 5;

        return Math.max(0, Math.min(100, score));
    }
}

// Export singleton instance
export const qualityEvaluatorService = new QualityEvaluatorService();
