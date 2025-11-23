// Session Manager Service
// Manages project creation session state and persistence

import { db } from "./db";
import { sessions, sessionSteps, type Session, type SessionStep } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import type { ProjectSeed } from "./enhanced-project-creation-service";

// Types
export type SessionId = string;
export type CreationMode = "quick" | "stepwise";
export type CreationStep = "basic" | "characters" | "world" | "outline" | "finalize";
export type SessionStatus = "active" | "paused" | "completed" | "expired";

export interface SessionState {
  currentStep: CreationStep;
  stepResults: Record<CreationStep, StepResult>;
  status: SessionStatus;
}

export interface StepResult {
  step: CreationStep;
  data: any;
  candidates?: any[];
  selectedCandidate?: any;
  timestamp: Date;
}

/**
 * SessionManager - Manages creation session lifecycle
 */
export class SessionManager {
  /**
   * Create a new session
   */
  async createSession(seed: ProjectSeed, mode: CreationMode, userId?: string): Promise<Session> {
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        mode,
        seed: seed as any,
        currentStep: "basic",
        stepResults: {},
        status: "active",
        expiresAt,
      })
      .returning();

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: SessionId): Promise<Session | null> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return session || null;
  }

  /**
   * Update session state
   */
  async updateSession(
    sessionId: SessionId,
    updates: Partial<SessionState>
  ): Promise<void> {
    const updateData: any = {};

    if (updates.currentStep !== undefined) {
      updateData.currentStep = updates.currentStep;
    }

    if (updates.stepResults !== undefined) {
      updateData.stepResults = updates.stepResults;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Save step result
   */
  async saveStepResult(
    sessionId: SessionId,
    step: CreationStep,
    result: StepResult
  ): Promise<void> {
    // Get current session
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Save step result to session_steps table
    await db.insert(sessionSteps).values({
      sessionId,
      step,
      data: result.data,
      candidates: result.candidates,
      selectedCandidate: result.selectedCandidate,
    });

    // Update session's stepResults
    const stepResults = (session.stepResults as Record<CreationStep, StepResult>) || {};
    stepResults[step] = result;

    await this.updateSession(sessionId, {
      stepResults,
      currentStep: step,
    });
  }

  /**
   * Get incomplete sessions
   */
  async getIncompleteSessions(userId?: string): Promise<Session[]> {
    const conditions = [
      or(
        eq(sessions.status, "active"),
        eq(sessions.status, "paused")
      ),
    ];

    if (userId) {
      conditions.push(eq(sessions.userId, userId));
    }

    const incompleteSessions = await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(sessions.updatedAt);

    return incompleteSessions;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: SessionId): Promise<void> {
    // Delete session (cascade will delete session_steps)
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  /**
   * Renew session expiration
   */
  async renewSession(sessionId: SessionId, days: number = 7): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await db
      .update(sessions)
      .set({
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();

    // Find expired sessions
    const expiredSessions = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.status, "active"),
        // expiresAt < now
      ));

    // Delete expired sessions
    let deletedCount = 0;
    for (const session of expiredSessions) {
      if (session.expiresAt < now) {
        await this.deleteSession(session.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get session steps
   */
  async getSessionSteps(sessionId: SessionId): Promise<SessionStep[]> {
    const steps = await db
      .select()
      .from(sessionSteps)
      .where(eq(sessionSteps.sessionId, sessionId))
      .orderBy(sessionSteps.timestamp);

    return steps;
  }

  /**
   * Pause session
   */
  async pauseSession(sessionId: SessionId): Promise<void> {
    await this.updateSession(sessionId, {
      status: "paused",
    });
  }

  /**
   * Resume session
   */
  async resumeSession(sessionId: SessionId): Promise<void> {
    await this.updateSession(sessionId, {
      status: "active",
    });

    // Renew expiration when resuming
    await this.renewSession(sessionId);
  }

  /**
   * Complete session
   */
  async completeSession(sessionId: SessionId): Promise<void> {
    await this.updateSession(sessionId, {
      status: "completed",
    });
  }

  /**
   * Mark session as expired
   */
  async expireSession(sessionId: SessionId): Promise<void> {
    await this.updateSession(sessionId, {
      status: "expired",
    });
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
