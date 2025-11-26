
import { promptTemplateService } from "./prompt-template-service";

async function verifyPromptUpdate() {
    console.log("Verifying Prompt Template Update...");

    try {
        // 1. Check if we can load the new template ID
        const templateId = 'pt_chapter_draft_v2';
        const template = await promptTemplateService.getTemplate(templateId);

        console.log(`Loaded template: ${template.id}`);
        console.log(`Version: ${template.version}`);

        // 2. Verify key instructions exist
        const criticalPhrases = [
            "拒绝人物小传式出场",
            "拒绝流水账",
            "强化冲突与悬念",
            "自然流畅的过渡",
            "系统元信息",
            "严禁输出场景标记",
            "深度思维链规划",
            "<thinking>",
            "角色声纹锁",
            "场景类型分析"
        ];

        let allFound = true;
        for (const phrase of criticalPhrases) {
            if (template.templateText.includes(phrase)) {
                console.log(`[PASS] Found instruction: "${phrase}"`);
            } else {
                console.error(`[FAIL] Missing instruction: "${phrase}"`);
                allFound = false;
            }
        }

        if (allFound) {
            console.log("\nSUCCESS: New prompt template is correctly implemented and loaded.");
        } else {
            console.error("\nFAILURE: Some instructions are missing from the loaded template.");
            process.exit(1);
        }

    } catch (error) {
        console.error("Error during verification:", error);
        process.exit(1);
    }
}

verifyPromptUpdate();
