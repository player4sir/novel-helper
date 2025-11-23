
import { db } from "./db";
import { projects, chapters } from "@shared/schema";
import { eq } from "drizzle-orm";
import { projectWordCountService } from "./project-word-count-service";
import { storage } from "./storage";

async function verifyWordCountSync() {
    console.log("Starting Word Count Sync Verification...");

    try {
        // 1. Create a test project
        const project = await storage.createProject({
            title: "Word Count Test Project",
            genre: "Test",
            status: "active",
            targetWordCount: 10000,
            currentWordCount: 0
        });
        console.log(`Created project: ${project.id}`);

        // 2. Create a volume
        const volume = await storage.createVolume({
            projectId: project.id,
            title: "Volume 1",
            orderIndex: 1
        });

        // 3. Create a chapter with word count
        const chapter1 = await storage.createChapter({
            projectId: project.id,
            volumeId: volume.id,
            title: "Chapter 1",
            content: "Test content",
            wordCount: 1000,
            orderIndex: 1
        });
        console.log(`Created Chapter 1 with 1000 words`);

        // 4. Trigger recalculation (simulating route handler)
        await projectWordCountService.recalculateProjectWordCount(project.id);

        // 5. Verify project word count
        let updatedProject = await storage.getProject(project.id);
        if (updatedProject?.currentWordCount === 1000) {
            console.log("✅ Test 1 Passed: Project word count updated to 1000");
        } else {
            console.error(`❌ Test 1 Failed: Expected 1000, got ${updatedProject?.currentWordCount}`);
        }

        // 6. Add another chapter
        const chapter2 = await storage.createChapter({
            projectId: project.id,
            volumeId: volume.id,
            title: "Chapter 2",
            content: "More content",
            wordCount: 500,
            orderIndex: 2
        });
        console.log(`Created Chapter 2 with 500 words`);

        // 7. Trigger recalculation
        await projectWordCountService.recalculateProjectWordCount(project.id);

        // 8. Verify project word count
        updatedProject = await storage.getProject(project.id);
        if (updatedProject?.currentWordCount === 1500) {
            console.log("✅ Test 2 Passed: Project word count updated to 1500");
        } else {
            console.error(`❌ Test 2 Failed: Expected 1500, got ${updatedProject?.currentWordCount}`);
        }

        // 9. Delete a chapter
        await storage.deleteChapter(chapter1.id);
        console.log(`Deleted Chapter 1`);

        // 10. Trigger recalculation
        await projectWordCountService.recalculateProjectWordCount(project.id);

        // 11. Verify project word count
        updatedProject = await storage.getProject(project.id);
        if (updatedProject?.currentWordCount === 500) {
            console.log("✅ Test 3 Passed: Project word count updated to 500 after deletion");
        } else {
            console.error(`❌ Test 3 Failed: Expected 500, got ${updatedProject?.currentWordCount}`);
        }

        // Cleanup
        await storage.deleteProject(project.id);
        console.log("Cleanup complete");

    } catch (error) {
        console.error("Verification failed:", error);
    }
}

verifyWordCountSync();
