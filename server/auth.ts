import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

const scryptAsync = promisify(scrypt);

declare global {
    namespace Express {
        interface User {
            id: string;
            username: string;
            role: string | null;
            subscriptionTier: string | null;
        }
    }
}

export function setupAuth(app: Express) {
    const sessionSettings: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || "novel-helper-secret-key",
        resave: false,
        saveUninitialized: false,
        store: storage.sessionStore,
        proxy: true, // Required for secure cookies behind proxy
        cookie: {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        },
    };

    if (app.get("env") === "production") {
        app.set("trust proxy", true); // Trust all proxies (Zeabur likely has multiple layers)
    }

    app.use(session(sessionSettings));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

                if (!user) {
                    return done(null, false, { message: "Incorrect username." });
                }

                const [hashedPassword, salt] = user.password.split(".");

                if (!salt) {
                    // Invalid password format (e.g. plain text or missing salt)
                    return done(null, false, { message: "Invalid password format." });
                }

                const passwordBuffer = (await scryptAsync(password, salt, 64)) as Buffer;
                const keyBuffer = Buffer.from(hashedPassword, "hex");
                const match = timingSafeEqual(passwordBuffer, keyBuffer);

                if (!match) {
                    return done(null, false, { message: "Incorrect password." });
                }

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }),
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            console.log(`[Auth Debug] Deserializing user ${id}`);
            const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
            done(null, user);
        } catch (err) {
            console.error(`[Auth Debug] Deserialize error:`, err);
            done(err);
        }
    });

    app.post("/api/register", async (req, res, next) => {
        try {
            const existingUser = await storage.getUserByUsername(req.body.username);
            if (existingUser) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const user = await storage.createUser(req.body.username, req.body.password);
            req.login(user, (err) => {
                if (err) return next(err);
                res.status(201).json(user);
            });
        } catch (err) {
            next(err);
        }
    });

    app.post("/api/login", (req, res, next) => {
        // Debug logging for auth issues
        console.log(`[Auth Debug] Login attempt. Protocol: ${req.protocol}, Secure: ${req.secure}, IPs: ${req.ips}`);

        passport.authenticate("local", (err: any, user: Express.User, info: any) => {
            if (err) return next(err);
            if (!user) return res.status(400).json({ message: info?.message || "Login failed" });
            req.login(user, (err) => {
                if (err) return next(err);
                console.log(`[Auth Debug] Login successful for user ${user.username}. Session ID: ${req.sessionID}`);

                // Log the Set-Cookie header to verify attributes
                const setCookie = res.getHeader('Set-Cookie');
                console.log(`[Auth Debug] Set-Cookie Header:`, setCookie);

                res.json(user);
            });
        })(req, res, next);
    });

    app.post("/api/logout", (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            res.sendStatus(200);
        });
    });

    app.get("/api/user", (req, res) => {
        if (!req.isAuthenticated()) return res.sendStatus(401);
        res.json(req.user);
    });
}
