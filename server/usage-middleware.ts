import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

const QUOTAS = {
    free: {
        daily_generations: 5,
        max_projects: 1,
    },
    pro: {
        daily_generations: 100,
        max_projects: Infinity,
    },
    admin: {
        daily_generations: Infinity,
        max_projects: Infinity,
    },
};

export async function checkUsageQuota(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.id;
    const user = await storage.getUserByUsername(req.user.username); // Refresh user to get latest subscription

    if (!user) {
        return res.status(401).json({ error: "User not found" });
    }

    const tier = (user.subscriptionTier || "free") as keyof typeof QUOTAS;
    const quota = QUOTAS[tier] || QUOTAS.free;

    // Check project limit for creation
    if (req.path.includes("/api/projects") && req.method === "POST") {
        const projects = await storage.getProjects(userId);
        if (projects.length >= quota.max_projects) {
            return res.status(403).json({
                error: "Project limit exceeded",
                code: "PROJECT_LIMIT_EXCEEDED",
                limit: quota.max_projects,
                current: projects.length,
                upgradeUrl: "/#pricing"
            });
        }
    }

    // Check generation limit
    // Apply to routes that trigger AI generation
    const isGenerationRoute =
        req.path.includes("/generate") ||
        req.path.includes("/creation") ||
        (req.path.includes("/api/chapters") && req.method === "POST");

    if (isGenerationRoute) {
        const usage = await storage.getUserUsage(userId, new Date());
        const currentUsage = usage?.aiRequestCount || 0;

        if (currentUsage >= quota.daily_generations) {
            return res.status(403).json({
                error: "Daily generation limit exceeded",
                code: "GENERATION_LIMIT_EXCEEDED",
                limit: quota.daily_generations,
                current: currentUsage,
                upgradeUrl: "/#pricing"
            });
        }

        // Increment usage
        // Note: We increment here for simplicity. Ideally, we should increment only after success.
        // But to prevent abuse (spamming requests), incrementing here is safer.
        await storage.trackUsage(userId, "ai_request", 1);
    }

    next();
}
