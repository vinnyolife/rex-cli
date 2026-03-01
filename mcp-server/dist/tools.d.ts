import { z } from 'zod';
export declare const navigateSchema: z.ZodObject<{
    url: z.ZodString;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    url: string;
    pageId?: number | undefined;
}, {
    url: string;
    pageId?: number | undefined;
}>;
export declare const clickSchema: z.ZodObject<{
    selector: z.ZodString;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    selector: string;
    pageId?: number | undefined;
}, {
    selector: string;
    pageId?: number | undefined;
}>;
export declare const fillSchema: z.ZodObject<{
    selector: z.ZodString;
    value: z.ZodString;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    value: string;
    selector: string;
    pageId?: number | undefined;
}, {
    value: string;
    selector: string;
    pageId?: number | undefined;
}>;
export declare const typeSchema: z.ZodObject<{
    selector: z.ZodString;
    text: z.ZodString;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    selector: string;
    text: string;
    pageId?: number | undefined;
}, {
    selector: string;
    text: string;
    pageId?: number | undefined;
}>;
export declare const screenshotSchema: z.ZodObject<{
    fullPage: z.ZodOptional<z.ZodBoolean>;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pageId?: number | undefined;
    fullPage?: boolean | undefined;
}, {
    pageId?: number | undefined;
    fullPage?: boolean | undefined;
}>;
export declare const evaluateSchema: z.ZodObject<{
    script: z.ZodString;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    script: string;
    pageId?: number | undefined;
}, {
    script: string;
    pageId?: number | undefined;
}>;
export declare const waitForSchema: z.ZodObject<{
    selector: z.ZodString;
    timeout: z.ZodOptional<z.ZodNumber>;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    selector: string;
    pageId?: number | undefined;
    timeout?: number | undefined;
}, {
    selector: string;
    pageId?: number | undefined;
    timeout?: number | undefined;
}>;
export declare const scrollSchema: z.ZodObject<{
    y: z.ZodOptional<z.ZodNumber>;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pageId?: number | undefined;
    y?: number | undefined;
}, {
    pageId?: number | undefined;
    y?: number | undefined;
}>;
export declare const snapshotSchema: z.ZodObject<{
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pageId?: number | undefined;
}, {
    pageId?: number | undefined;
}>;
export declare const mouseMoveSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    y: number;
    x: number;
    pageId?: number | undefined;
}, {
    y: number;
    x: number;
    pageId?: number | undefined;
}>;
export declare const newTabSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url?: string | undefined;
}, {
    url?: string | undefined;
}>;
export declare const switchTabSchema: z.ZodObject<{
    target: z.ZodUnion<[z.ZodNumber, z.ZodEnum<["previous", "next"]>]>;
}, "strip", z.ZodTypeAny, {
    target: number | "previous" | "next";
}, {
    target: number | "previous" | "next";
}>;
export declare const closeTabSchema: z.ZodObject<{
    pageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pageId?: number | undefined;
}, {
    pageId?: number | undefined;
}>;
export declare const tools: {
    stealth_navigate: (input: z.infer<typeof navigateSchema>) => Promise<{
        success: boolean;
        url: string;
    }>;
    stealth_click: (input: z.infer<typeof clickSchema>) => Promise<{
        success: boolean;
    }>;
    stealth_fill: (input: z.infer<typeof fillSchema>) => Promise<{
        success: boolean;
    }>;
    stealth_type: (input: z.infer<typeof typeSchema>) => Promise<{
        success: boolean;
    }>;
    stealth_screenshot: (input: z.infer<typeof screenshotSchema>) => Promise<{
        success: boolean;
        image: string;
    }>;
    stealth_snapshot: (input: z.infer<typeof snapshotSchema>) => Promise<{
        success: boolean;
        content: string;
        url: string;
        title: string;
    }>;
    stealth_evaluate: (input: z.infer<typeof evaluateSchema>) => Promise<{
        success: boolean;
        result: unknown;
    }>;
    stealth_wait_for: (input: z.infer<typeof waitForSchema>) => Promise<{
        success: boolean;
    }>;
    stealth_scroll: (input: z.infer<typeof scrollSchema>) => Promise<{
        success: boolean;
    }>;
    stealth_mouse_move: (input: z.infer<typeof mouseMoveSchema>) => Promise<{
        success: boolean;
    }>;
    stealth_new_tab: (input: z.infer<typeof newTabSchema>) => Promise<{
        success: boolean;
        pageId: number;
    }>;
    stealth_switch_tab: (input: z.infer<typeof switchTabSchema>) => Promise<{
        success: boolean;
        pageId: number;
    }>;
    stealth_close_tab: (input: z.infer<typeof closeTabSchema>) => Promise<{
        success: boolean;
    }>;
    stealth_list_tabs: () => Promise<{
        success: boolean;
        pages: {
            id: number;
            url: string;
            title: string;
        }[];
    }>;
    stealth_close_browser: () => Promise<{
        success: boolean;
    }>;
};
//# sourceMappingURL=tools.d.ts.map