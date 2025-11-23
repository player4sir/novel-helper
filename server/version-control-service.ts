import { storage } from "./storage";
import { ChangeSet } from "@shared/schema";
import { diffLines } from "diff";

export class VersionControlService {

    /**
     * Create a change set for a chapter update
     */
    async createChangeSet(
        chapterId: string,
        oldContent: string,
        newContent: string,
        author: string = "user"
    ): Promise<ChangeSet> {
        // Get current version
        const chapter = await storage.getChapter(chapterId);
        if (!chapter) throw new Error("Chapter not found");

        const currentVersion = chapter.version || 1;

        // Calculate diff using diffLines for granular text changes
        const changes = diffLines(oldContent, newContent);

        // Create change set
        const changeSet = await storage.createChangeSet({
            chapterId,
            baseVersion: currentVersion,
            targetVersion: currentVersion + 1,
            operations: changes, // Store diff result as JSON
            author,
            description: `Update to version ${currentVersion + 1}`,
        });

        // Update chapter version
        await storage.updateChapter(chapterId, {
            version: currentVersion + 1
        });

        return changeSet;
    }

    /**
     * Get history for a chapter
     */
    async getHistory(chapterId: string): Promise<ChangeSet[]> {
        return storage.getChangeSetsByChapter(chapterId);
    }
}

export const versionControlService = new VersionControlService();
