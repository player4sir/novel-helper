
/**
 * Robust JSON Extractor for AI Responses
 * Handles various formats: Markdown code blocks, raw JSON, text with JSON embedded
 */
export function extractJSON(text: string): any {
    if (!text) {
        throw new Error("Empty input text");
    }

    const strategies = [
        // Strategy 1: Standard JSON.parse (for clean JSON)
        () => JSON.parse(text),

        // Strategy 1.5: Strip <thinking> blocks and try parsing
        () => {
            // Remove content between <thinking> and </thinking> (including tags)
            // Use non-greedy match [\s\S]*? to handle multiple lines
            const cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
            // If text was modified, try parsing the result
            if (cleanText !== text.trim()) {
                return extractJSON(cleanText);
            }
            throw new Error("No thinking blocks found or cleanup didn't help");
        },

        // Strategy 2: Extract from Markdown code block ```json ... ```
        () => {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                return JSON.parse(match[1]);
            }
            throw new Error("No markdown code block found");
        },

        // Strategy 3: Extract from first '{' to last '}'
        () => {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                const jsonStr = text.slice(start, end + 1);
                return JSON.parse(jsonStr);
            }
            throw new Error("No JSON object found in text");
        },

        // Strategy 4: Aggressive cleanup (remove comments, fix common issues)
        () => {
            // This is a simplified cleanup. For production, a more robust library like 'json5' is recommended
            // but here we try to strip potential JS comments if the model outputted them
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                let jsonStr = text.slice(start, end + 1);
                // Remove single line comments //...
                jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
                return JSON.parse(jsonStr);
            }
            throw new Error("Cleanup strategy failed");
        },

        // Strategy 5: Repair truncated JSON
        () => {
            const startObj = text.indexOf('{');
            const startArr = text.indexOf('[');

            // Determine if we are looking for an object or an array
            let start = -1;
            let isArray = false;

            if (startObj !== -1 && startArr !== -1) {
                if (startObj < startArr) {
                    start = startObj;
                } else {
                    start = startArr;
                    isArray = true;
                }
            } else if (startObj !== -1) {
                start = startObj;
            } else if (startArr !== -1) {
                start = startArr;
                isArray = true;
            }

            if (start !== -1) {
                // Take everything from the first '{' or '['
                let jsonStr = text.slice(start);

                // 1. Remove any trailing non-JSON characters (like "..." or text after the cut-off)
                // This is hard to do perfectly, but we can try to trim from the last valid character

                // 2. Try to close unclosed quotes
                const quoteCount = (jsonStr.match(/"/g) || []).length;
                if (quoteCount % 2 !== 0) {
                    jsonStr += '"';
                }

                // 3. Try to close unclosed braces/brackets
                const stack: string[] = [];
                let inString = false;
                let escape = false;

                for (let i = 0; i < jsonStr.length; i++) {
                    const char = jsonStr[i];

                    if (escape) {
                        escape = false;
                        continue;
                    }

                    if (char === '\\') {
                        escape = true;
                        continue;
                    }

                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (char === '{' || char === '[') {
                            stack.push(char);
                        } else if (char === '}' || char === ']') {
                            // Check if it matches the last open
                            const last = stack[stack.length - 1];
                            if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
                                stack.pop();
                            }
                        }
                    }
                }

                // Append missing closing braces/brackets in reverse order
                while (stack.length > 0) {
                    const open = stack.pop();
                    if (open === '{') jsonStr += '}';
                    if (open === '[') jsonStr += ']';
                }

                return JSON.parse(jsonStr);
            }
            throw new Error("Truncation repair failed");
        },

        // Strategy 6: Smart Quote Escaping
        () => {
            // This handles cases like: "key": "some "value" here"
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                let jsonStr = text.slice(start, end + 1);

                // Protect already escaped quotes
                let protectedStr = jsonStr.replace(/\\"/g, '___ESCAPED_QUOTE___');

                // Protect structural quotes (quotes that are part of JSON structure)
                // Key start: {" or ," or ["
                protectedStr = protectedStr.replace(/([{,\[]\s*)"/g, '$1___QUOTE_START___');

                // Key end: ":
                protectedStr = protectedStr.replace(/"(\s*:)/g, '___QUOTE_END___$1');

                // Value start: :"
                protectedStr = protectedStr.replace(/(:\s*)"/g, '$1___QUOTE_START___');

                // Value end: ", or "} or "]
                protectedStr = protectedStr.replace(/"(\s*[,}\]])/g, '___QUOTE_END___$1');

                // Escape remaining quotes (these are likely inside strings)
                protectedStr = protectedStr.replace(/"/g, '\\"');

                // Restore structural quotes
                protectedStr = protectedStr.replace(/___QUOTE_START___/g, '"');
                protectedStr = protectedStr.replace(/___QUOTE_END___/g, '"');

                // Restore originally escaped quotes
                protectedStr = protectedStr.replace(/___ESCAPED_QUOTE___/g, '\\"');

                return JSON.parse(protectedStr);
            }
            throw new Error("Smart quote repair failed");
        }
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
        try {
            return strategy();
        } catch (error) {
            lastError = error as Error;
            continue;
        }
    }

    throw new Error(`Failed to extract JSON: ${lastError?.message || "Unknown error"}`);
}
