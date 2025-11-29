import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { queryClient, API_BASE_URL } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
    user: SelectUser | null;
    isLoading: boolean;
    error: Error | null;
    loginMutation: any;
    logoutMutation: any;
    registerMutation: any;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();

    const {
        data: user,
        error,
        isLoading,
    } = useQuery<SelectUser | null, Error>({
        queryKey: ["/api/user"],
        retry: false,
    });

    const loginMutation = useMutation({
        mutationFn: async (credentials: Pick<InsertUser, "username" | "password">) => {
            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(credentials),
            });

            if (!res.ok) {
                let errorMessage = "登录失败";
                const responseText = await res.text();

                try {
                    const error = JSON.parse(responseText);
                    errorMessage = error.message || errorMessage;
                } catch {
                    // If parsing fails, use the raw text if it's not empty
                    if (responseText) {
                        errorMessage = responseText;
                    }
                }

                // Map to friendly Chinese messages
                if (errorMessage.includes("Incorrect username")) {
                    throw new Error("用户名不存在");
                } else if (errorMessage.includes("Incorrect password")) {
                    throw new Error("密码错误");
                } else if (errorMessage.includes("Invalid password format")) {
                    throw new Error("密码格式错误");
                }

                throw new Error(errorMessage);
            }

            return await res.json();
        },
        onSuccess: (user: SelectUser) => {
            queryClient.setQueryData(["/api/user"], user);
            toast({
                title: "登录成功",
                description: `欢迎回来，${user.username}`,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "登录失败",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (credentials: InsertUser) => {
            const res = await fetch(`${API_BASE_URL}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(credentials),
            });

            if (!res.ok) {
                let errorMessage = "注册失败";
                const responseText = await res.text();

                try {
                    const error = JSON.parse(responseText);
                    errorMessage = error.message || errorMessage;
                } catch {
                    // If parsing fails, use the raw text if it's not empty
                    if (responseText) {
                        errorMessage = responseText;
                    }
                }

                // Map to friendly Chinese messages
                if (errorMessage.includes("Username already exists")) {
                    throw new Error("用户名已存在");
                }

                throw new Error(errorMessage);
            }

            return await res.json();
        },
        onSuccess: (user: SelectUser) => {
            queryClient.setQueryData(["/api/user"], user);
            toast({
                title: "注册成功",
                description: `欢迎加入，${user.username}`,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "注册失败",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const logoutMutation = useMutation({
        mutationFn: async () => {
            await fetch(`${API_BASE_URL}/api/logout`, {
                method: "POST",
            });
        },
        onSuccess: () => {
            queryClient.setQueryData(["/api/user"], null);
            // Clear all queries to prevent data leak between users
            queryClient.clear();
            toast({
                title: "已退出登录",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "退出失败",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                isLoading,
                error,
                loginMutation,
                logoutMutation,
                registerMutation,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
