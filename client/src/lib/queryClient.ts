import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getLocalAIConfigHeader } from "./ai-config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(await getLocalAIConfigHeader() ? { "x-ai-config": await getLocalAIConfigHeader()! } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = <T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: {
        ...(await getLocalAIConfigHeader() ? { "x-ai-config": await getLocalAIConfigHeader()! } : {}),
      },
    });

    if (res.status === 401) {
      if (options.on401 === "returnNull") {
        return null as T;
      }
      await throwIfResNotOk(res);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
