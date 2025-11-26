
import { characterGenerator, type Character, type ProjectContext } from "./character-generator";
import { creationOrchestrator } from "./creation-orchestrator";

// Mock AI Service to return duplicate names
const mockAiService = {
    generate: async () => {
        return {
            content: JSON.stringify({
                name: "DuplicateName",
                role: "配角",
                personality: "Test Personality",
                appearance: "Test Appearance",
                background: "Test Background",
                abilities: "Test Abilities",
                motivation: "Test Motivation",
                innerConflict: "Test Conflict",
                hiddenGoal: "Test Goal",
                growthPath: "Test Growth"
            })
        };
    }
};

// We can't easily mock the internal aiService import without a mocking library or dependency injection.
// Instead, we will test the orchestrator's merge logic which is deterministic and doesn't require AI.

async function verifyOrchestratorDeduplication() {
    console.log("Verifying Orchestrator Deduplication...");

    const mockStepResults: any = {
        basic: { data: { title: "Test Project" } },
        characters: {
            data: {
                characters: [
                    { name: "Hero", role: "主角" },
                    { name: "Hero", role: "配角" }, // Duplicate
                    { name: "Hero", role: "反派" }, // Triplicate
                    { name: "Villain", role: "反派" }
                ]
            }
        }
    };

    // Access private method via any cast (for testing purposes)
    const meta = (creationOrchestrator as any).mergeStepResults(mockStepResults);

    const names = meta.mainEntities.map((e: any) => e.name);
    console.log("Generated Names:", names);

    const uniqueNames = new Set(names);
    if (uniqueNames.size === names.length) {
        console.log("[PASS] All names are unique.");
    } else {
        console.error("[FAIL] Duplicate names found.");
    }

    if (names.includes("Hero") && names.includes("Hero (2)") && names.includes("Hero (3)")) {
        console.log("[PASS] Renaming logic works correctly (Hero, Hero (2), Hero (3)).");
    } else {
        console.error("[FAIL] Renaming logic failed.");
    }
}

verifyOrchestratorDeduplication().catch(console.error);
