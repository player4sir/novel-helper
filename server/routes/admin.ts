import { Router } from "express";
import { db } from "../db";
import { users, subscriptions, paymentOrders, projects, systemConfig } from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";

const router = Router();

// Middleware to check if user is admin
const isAdmin = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user.role === "admin") {
        return next();
    }
    res.status(403).json({ error: "Forbidden: Admin access required" });
};

// Apply admin middleware to all routes
router.use(isAdmin);

// Get dashboard statistics
router.get("/stats", async (req, res) => {
    try {
        const [userCount] = await db.select({ count: count() }).from(users);
        const [projectCount] = await db.select({ count: count() }).from(projects);
        const [subscriptionCount] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active"));

        // Calculate total revenue (sum of paid payment orders)
        const [revenueResult] = await db
            .select({ total: sql<number>`sum(${paymentOrders.amount})` })
            .from(paymentOrders)
            .where(eq(paymentOrders.status, "paid"));

        // Calculate daily revenue for the last 30 days
        const dailyRevenue = await db.execute(sql`
            SELECT 
                DATE(created_at) as date,
                SUM(amount) as total
            FROM ${paymentOrders}
            WHERE status = 'paid'
            AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        res.json({
            totalUsers: userCount.count,
            totalProjects: projectCount.count,
            activeSubscriptions: subscriptionCount.count,
            totalRevenue: revenueResult?.total || 0,
            revenueTrend: dailyRevenue.rows,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent users with usage stats
router.get("/users", async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const usersWithStats = await db
            .select({
                id: users.id,
                username: users.username,
                role: users.role,
                subscriptionTier: users.subscriptionTier,
                createdAt: users.createdAt,
                projectCount: count(projects.id),
            })
            .from(users)
            .leftJoin(projects, eq(users.id, projects.userId))
            .groupBy(users.id)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset);

        const [totalResult] = await db.select({ count: count() }).from(users);

        res.json({
            users: usersWithStats,
            pagination: {
                total: totalResult.count,
                page,
                limit,
                totalPages: Math.ceil(totalResult.count / limit)
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent payments
router.get("/payments", async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const recentPayments = await db
            .select({
                id: paymentOrders.id,
                amount: paymentOrders.amount,
                status: paymentOrders.status,
                createdAt: paymentOrders.createdAt,
                username: users.username,
            })
            .from(paymentOrders)
            .leftJoin(users, eq(paymentOrders.userId, users.id))
            .orderBy(desc(paymentOrders.createdAt))
            .limit(limit)
            .offset(offset);

        const [totalResult] = await db.select({ count: count() }).from(paymentOrders);

        res.json({
            payments: recentPayments,
            pagination: {
                total: totalResult.count,
                page,
                limit,
                totalPages: Math.ceil(totalResult.count / limit)
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Ban/Unban user
router.post("/users/:id/toggle-ban", async (req, res) => {
    try {
        const { id } = req.params;
        const [user] = await db.select().from(users).where(eq(users.id, id));

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Prevent banning other admins
        if (user.role === "admin") {
            return res.status(400).json({ error: "Cannot ban an admin" });
        }

        // Toggle role between 'user' and 'banned' (assuming 'banned' role exists or we handle it via status)
        const newRole = user.role === "banned" ? "user" : "banned";

        await db.update(users).set({ role: newRole }).where(eq(users.id, id));

        res.json({ success: true, newRole });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// System Settings Routes

// Get all settings
router.get("/settings", async (req, res) => {
    try {
        const settings = await db.select().from(systemConfig);
        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update or Create setting
router.post("/settings", async (req, res) => {
    try {
        const { key, value, description } = req.body;

        if (!key || value === undefined) {
            return res.status(400).json({ error: "Key and value are required" });
        }

        // Check if exists
        const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));

        if (existing) {
            await db.update(systemConfig)
                .set({
                    value,
                    description,
                    updatedAt: new Date(),
                    updatedBy: req.user?.username
                })
                .where(eq(systemConfig.key, key));
        } else {
            await db.insert(systemConfig).values({
                key,
                value,
                description,
                updatedBy: req.user?.username
            });
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete setting
router.delete("/settings/:key", async (req, res) => {
    try {
        const { key } = req.params;
        await db.delete(systemConfig).where(eq(systemConfig.key, key));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const adminRouter = router;
