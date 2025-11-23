// Feedback Learning Service
// Collects user feedback and learns preferences to improve generation quality

import { db } from "./db";
import {
  userFeedback,
  userPreferences,
  creationHistory,

  type UserFeedback,
  type UserPreferences,
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

// Types
export interface FeedbackInput {
  rating: number; // 1-5
  tags: string[]; // 'excellent', 'good', 'poor', etc.
  comments?: string;
}

export interface UserPreferencesData {
  favoriteGenres: string[];
  favoriteStyles: string[];
  characterPreferences: CharacterPreferences;
  worldPreferences: WorldPreferences;
  innovationTolerance: number; // 0-100
}

export interface CharacterPreferences {
  preferredRoles: string[];
  preferredComplexity: "simple" | "moderate" | "complex";
}

export interface WorldPreferences {
  preferredElements: string[];
  preferredComplexity: "simple" | "moderate" | "complex";
}

export interface GenerationParameters {
  temperature: number;
  characterDepth: number;
  worldComplexity: number;
  innovationBias: number;
  styleHints: string[];
}

/**
 * FeedbackLearningService - Learns from user feedback to improve generation
 */
export class FeedbackLearningService {
  /**
   * Record user feedback on a candidate
   */
  async recordFeedback(
    userId: string,
    candidateId: string,
    feedback: FeedbackInput
  ): Promise<void> {
    console.log(`[FeedbackLearning] Recording feedback from user: ${userId}`);

    try {
      await db.insert(userFeedback).values({
        userId,
        candidateId,
        rating: feedback.rating,
        tags: feedback.tags,
        comments: feedback.comments,
      });

      console.log(`[FeedbackLearning] Feedback recorded for candidate: ${candidateId}`);

      // Trigger preference analysis after recording feedback
      await this.analyzeUserPreferences(userId);
    } catch (error) {
      console.error(`[FeedbackLearning] Error recording feedback:`, error);
      throw error;
    }
  }

  /**
   * Analyze user preferences based on feedback history
   */
  async analyzeUserPreferences(userId: string): Promise<UserPreferencesData> {
    console.log(`[FeedbackLearning] Analyzing preferences for user: ${userId}`);

    try {
      // Get all feedback from this user
      const feedbacks = await db
        .select({
          feedback: userFeedback,
          candidate: creationHistory.candidate,
          rating: userFeedback.rating,
        })
        .from(userFeedback)
        .innerJoin(
          creationHistory,
          eq(userFeedback.candidateId, creationHistory.id)
        )
        .where(eq(userFeedback.userId, userId))
        .orderBy(desc(userFeedback.createdAt));

      if (feedbacks.length === 0) {
        // Return default preferences
        return this.getDefaultPreferences();
      }

      // Analyze high-rated candidates (rating >= 4)
      const highRatedFeedbacks = feedbacks.filter((f) => f.rating >= 4);

      // Extract genres from high-rated candidates
      const genreCounts = new Map<string, number>();
      const styleCounts = new Map<string, number>();
      const characterRoleCounts = new Map<string, number>();
      const worldElementCounts = new Map<string, number>();

      for (const feedback of highRatedFeedbacks) {
        const candidate = feedback.candidate as any;

        // Count genres
        if (candidate.genre) {
          genreCounts.set(
            candidate.genre,
            (genreCounts.get(candidate.genre) || 0) + 1
          );
        }

        // Count styles
        if (candidate.toneProfile) {
          styleCounts.set(
            candidate.toneProfile,
            (styleCounts.get(candidate.toneProfile) || 0) + 1
          );
        }

        // Count character roles
        if (candidate.mainEntities) {
          for (const entity of candidate.mainEntities) {
            if (entity.role) {
              characterRoleCounts.set(
                entity.role,
                (characterRoleCounts.get(entity.role) || 0) + 1
              );
            }
          }
        }

        // Count world elements
        if (candidate.worldRules) {
          for (const rule of candidate.worldRules) {
            // Extract element type from rule (simplified)
            const element = rule.split(":")[0] || rule.substring(0, 20);
            worldElementCounts.set(
              element,
              (worldElementCounts.get(element) || 0) + 1
            );
          }
        }
      }

      // Calculate innovation tolerance based on feedback
      const avgRating =
        feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
      const innovationTolerance = Math.round(avgRating * 20); // Scale 1-5 to 20-100

      // Determine complexity preferences
      const avgEntityCount =
        highRatedFeedbacks.reduce((sum, f) => {
          const candidate = f.candidate as any;
          return sum + (candidate.mainEntities?.length || 0);
        }, 0) / (highRatedFeedbacks.length || 1);

      const avgWorldRuleCount =
        highRatedFeedbacks.reduce((sum, f) => {
          const candidate = f.candidate as any;
          return sum + (candidate.worldRules?.length || 0);
        }, 0) / (highRatedFeedbacks.length || 1);

      const characterComplexity =
        avgEntityCount >= 5
          ? "complex"
          : avgEntityCount >= 3
            ? "moderate"
            : "simple";
      const worldComplexity =
        avgWorldRuleCount >= 5
          ? "complex"
          : avgWorldRuleCount >= 3
            ? "moderate"
            : "simple";

      // Build preferences
      const preferences: UserPreferencesData = {
        favoriteGenres: this.getTopItems(genreCounts, 3),
        favoriteStyles: this.getTopItems(styleCounts, 3),
        characterPreferences: {
          preferredRoles: this.getTopItems(characterRoleCounts, 3),
          preferredComplexity: characterComplexity,
        },
        worldPreferences: {
          preferredElements: this.getTopItems(worldElementCounts, 5),
          preferredComplexity: worldComplexity,
        },
        innovationTolerance,
      };

      // Save preferences to database
      await this.savePreferences(userId, preferences);

      console.log(
        `[FeedbackLearning] Preferences analyzed for user: ${userId}`
      );
      return preferences;
    } catch (error) {
      console.error(`[FeedbackLearning] Error analyzing preferences:`, error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Get personalized generation parameters
   */
  async getPersonalizedParameters(
    userId: string
  ): Promise<GenerationParameters> {
    console.log(
      `[FeedbackLearning] Getting personalized parameters for user: ${userId}`
    );

    try {
      const [prefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (!prefs) {
        return this.getDefaultParameters();
      }

      const charPrefs = prefs.characterPreferences as CharacterPreferences;
      const worldPrefs = prefs.worldPreferences as WorldPreferences;

      // Map preferences to generation parameters
      const parameters: GenerationParameters = {
        temperature: this.mapInnovationToTemperature(
          prefs.innovationTolerance
        ),
        characterDepth: this.mapComplexityToDepth(
          charPrefs.preferredComplexity
        ),
        worldComplexity: this.mapComplexityToDepth(
          worldPrefs.preferredComplexity
        ),
        innovationBias: prefs.innovationTolerance / 100,
        styleHints: prefs.favoriteStyles,
      };

      console.log(
        `[FeedbackLearning] Generated personalized parameters for user: ${userId}`
      );
      return parameters;
    } catch (error) {
      console.error(
        `[FeedbackLearning] Error getting personalized parameters:`,
        error
      );
      return this.getDefaultParameters();
    }
  }



  /**
   * Generate personalized suggestions
   */
  async generatePersonalizedSuggestions(
    userId: string,
    context: any
  ): Promise<string[]> {
    console.log(
      `[FeedbackLearning] Generating personalized suggestions for user: ${userId}`
    );

    try {
      const [prefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (!prefs) {
        return [];
      }

      const suggestions: string[] = [];

      // Suggest based on favorite genres
      if (prefs.favoriteGenres.length > 0) {
        suggestions.push(
          `考虑使用您喜欢的类型：${prefs.favoriteGenres.join("、")}`
        );
      }

      // Suggest based on favorite styles
      if (prefs.favoriteStyles.length > 0) {
        suggestions.push(
          `推荐使用您偏好的风格：${prefs.favoriteStyles.join("、")}`
        );
      }

      // Suggest based on character preferences
      const charPrefs = prefs.characterPreferences as CharacterPreferences;
      if (charPrefs.preferredComplexity === "complex") {
        suggestions.push("建议增加角色的内心冲突和隐藏动机，以符合您的偏好");
      }

      // Suggest based on world preferences
      const worldPrefs = prefs.worldPreferences as WorldPreferences;
      if (worldPrefs.preferredComplexity === "complex") {
        suggestions.push("建议构建更复杂的世界观体系，包含多层次的规则");
      }

      // Suggest based on innovation tolerance
      if (prefs.innovationTolerance > 70) {
        suggestions.push("您偏好创新性内容，建议尝试非传统的设定和冲突");
      } else if (prefs.innovationTolerance < 30) {
        suggestions.push("建议使用经典的故事结构和设定，确保稳定性");
      }

      console.log(
        `[FeedbackLearning] Generated ${suggestions.length} suggestions`
      );
      return suggestions;
    } catch (error) {
      console.error(
        `[FeedbackLearning] Error generating suggestions:`,
        error
      );
      return [];
    }
  }

  /**
   * Get feedback statistics for a user
   */
  async getFeedbackStats(userId: string): Promise<FeedbackStats> {
    console.log(`[FeedbackLearning] Getting feedback stats for user: ${userId}`);

    try {
      const feedbacks = await db
        .select()
        .from(userFeedback)
        .where(eq(userFeedback.userId, userId));

      if (feedbacks.length === 0) {
        return {
          totalFeedbacks: 0,
          avgRating: 0,
          ratingDistribution: {},
          commonTags: [],
        };
      }

      const avgRating =
        feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;

      // Calculate rating distribution
      const ratingDistribution: Record<number, number> = {};
      for (const feedback of feedbacks) {
        ratingDistribution[feedback.rating] =
          (ratingDistribution[feedback.rating] || 0) + 1;
      }

      // Calculate common tags
      const tagCounts = new Map<string, number>();
      for (const feedback of feedbacks) {
        for (const tag of feedback.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      const commonTags = this.getTopItems(tagCounts, 5);

      return {
        totalFeedbacks: feedbacks.length,
        avgRating,
        ratingDistribution,
        commonTags,
      };
    } catch (error) {
      console.error(`[FeedbackLearning] Error getting feedback stats:`, error);
      return {
        totalFeedbacks: 0,
        avgRating: 0,
        ratingDistribution: {},
        commonTags: [],
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Save preferences to database
   */
  private async savePreferences(
    userId: string,
    preferences: UserPreferencesData
  ): Promise<void> {
    try {
      // Check if preferences exist
      const [existing] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (existing) {
        // Update existing preferences
        await db
          .update(userPreferences)
          .set({
            favoriteGenres: preferences.favoriteGenres,
            favoriteStyles: preferences.favoriteStyles,
            characterPreferences: preferences.characterPreferences as any,
            worldPreferences: preferences.worldPreferences as any,
            innovationTolerance: preferences.innovationTolerance,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, userId));
      } else {
        // Insert new preferences
        await db.insert(userPreferences).values({
          userId,
          favoriteGenres: preferences.favoriteGenres,
          favoriteStyles: preferences.favoriteStyles,
          characterPreferences: preferences.characterPreferences as any,
          worldPreferences: preferences.worldPreferences as any,
          innovationTolerance: preferences.innovationTolerance,
        });
      }
    } catch (error) {
      console.error(`[FeedbackLearning] Error saving preferences:`, error);
    }
  }

  /**
   * Get top N items from a count map
   */
  private getTopItems(counts: Map<string, number>, n: number): string[] {
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map((entry) => entry[0]);
  }

  /**
   * Map innovation tolerance to temperature
   */
  private mapInnovationToTemperature(innovationTolerance: number): number {
    // Map 0-100 to 0.5-1.0
    return 0.5 + (innovationTolerance / 100) * 0.5;
  }

  /**
   * Map complexity preference to depth parameter
   */
  private mapComplexityToDepth(
    complexity: "simple" | "moderate" | "complex"
  ): number {
    switch (complexity) {
      case "simple":
        return 0.3;
      case "moderate":
        return 0.6;
      case "complex":
        return 0.9;
      default:
        return 0.6;
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferencesData {
    return {
      favoriteGenres: [],
      favoriteStyles: [],
      characterPreferences: {
        preferredRoles: [],
        preferredComplexity: "moderate",
      },
      worldPreferences: {
        preferredElements: [],
        preferredComplexity: "moderate",
      },
      innovationTolerance: 50,
    };
  }

  /**
   * Get default generation parameters
   */
  private getDefaultParameters(): GenerationParameters {
    return {
      temperature: 0.7,
      characterDepth: 0.6,
      worldComplexity: 0.6,
      innovationBias: 0.5,
      styleHints: [],
    };
  }
}

// Additional types
export interface FeedbackStats {
  totalFeedbacks: number;
  avgRating: number;
  ratingDistribution: Record<number, number>;
  commonTags: string[];
}

// Export singleton instance
export const feedbackLearningService = new FeedbackLearningService();
