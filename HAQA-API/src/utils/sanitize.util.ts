import { SANITIZE_METADATA_KEY, SanitizeOptions } from '@/decorators/sanitize.decorator';

/**
 * Default mask pattern
 */
const DEFAULT_MASK_PATTERN = '****';

/**
 * Creates a mask string based on options
 */
function createMask(value: string, options?: SanitizeOptions): string {
    const pattern = options?.pattern || DEFAULT_MASK_PATTERN;
    const showFirst = options?.showFirst || 0;
    const showLast = options?.showLast || 0;

    if (value.length <= showFirst + showLast) {
        // If value is too short, just return the pattern
        return pattern;
    }

    const firstPart = showFirst > 0 ? value.substring(0, showFirst) : '';
    const lastPart = showLast > 0 ? value.substring(value.length - showLast) : '';
    
    if (showFirst > 0 || showLast > 0) {
        return `${firstPart}${pattern}${lastPart}`;
    }
    
    return pattern;
}

/**
 * Sanitizes a value based on options
 */
function sanitizeValue(value: any, options?: SanitizeOptions): any {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'string') {
        if (value.length === 0) {
            return value;
        }
        return createMask(value, options);
    }

    // For non-string values, convert to string first
    const stringValue = String(value);
    return createMask(stringValue, options);
}

/**
 * Recursively sanitizes sensitive fields in an object based on:
 * @Sanitize() decorator metadata
 * 
 * @param obj - The object to sanitize
 * @param metadataMap - Map of property keys to their sanitize options (from decorators)
 * @param visited - Set to track circular references
 * @returns A new object with sanitized sensitive fields
 */
export function sanitizeSensitiveFields(
    obj: any,
    metadataMap?: Map<string, SanitizeOptions>,
    visited: WeakSet<object> = new WeakSet(),
): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle primitives
    if (typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeSensitiveFields(item, metadataMap, visited));
    }

    // Handle Date objects
    if (obj instanceof Date) {
        return obj;
    }

    // Handle circular references
    if (visited.has(obj)) {
        return '[Circular]';
    }
    visited.add(obj);

    // Handle plain objects
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
        // Check for sanitize metadata from decorator
        const sanitizeOptions = metadataMap?.get(key);
        
        // If metadata exists, sanitize it
        if (sanitizeOptions !== undefined) {
            sanitized[key] = sanitizeValue(value, sanitizeOptions);
        } else if (typeof value === 'object' && value !== null) {
            // Recursively sanitize nested objects
            sanitized[key] = sanitizeSensitiveFields(value, metadataMap, visited);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Extracts sanitize metadata from a class prototype or instance
 * This reads the @Sanitize() decorator metadata set by SetMetadata
 */
export function extractSanitizeMetadata(target: any): Map<string, SanitizeOptions> | undefined {
    if (!target || typeof target !== 'object') {
        return undefined;
    }

    // Check if Reflect is available (from reflect-metadata)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Reflect = (globalThis as any).Reflect;
    if (!Reflect || typeof Reflect.getMetadata !== 'function') {
        return undefined;
    }

    const metadataMap = new Map<string, SanitizeOptions>();
    let hasMetadata = false;

    // Try to get metadata from the class constructor (for class-level metadata)
    const constructor = target.constructor || target;
    if (constructor && typeof constructor === 'function') {
        // Get all property keys from the instance
        const instanceKeys = Object.keys(target);
        
        // Also check prototype properties
        const prototype = Object.getPrototypeOf(target);
        const prototypeKeys = prototype ? Object.getOwnPropertyNames(prototype) : [];
        
        const allKeys = new Set([...instanceKeys, ...prototypeKeys]);
        
        for (const key of allKeys) {
            // Skip constructor and non-enumerable properties
            if (key === 'constructor' || typeof key === 'symbol') {
                continue;
            }
            
            try {
                // Try to get metadata from the property
                const metadata = Reflect.getMetadata(SANITIZE_METADATA_KEY, constructor.prototype, key) ||
                                 Reflect.getMetadata(SANITIZE_METADATA_KEY, target, key);
                
                if (metadata !== undefined) {
                    metadataMap.set(key, metadata);
                    hasMetadata = true;
                }
            } catch {
                // Metadata not available for this property
            }
        }
    }

    return hasMetadata ? metadataMap : undefined;
}

/**
 * Sanitizes sensitive fields in an object based on:
 * Fields marked with @Sanitize() decorator
 * 
 * @param obj - The object to sanitize
 * @param classInstance - Optional class instance to extract decorator metadata from
 * @returns A new object with sanitized sensitive fields
 */
export function sanitizeObject(obj: any, classInstance?: any): any {
    const metadataMap = classInstance ? extractSanitizeMetadata(classInstance) : undefined;
    return sanitizeSensitiveFields(obj, metadataMap);
}

