/**
 * Parses a size string with units (KB, MB, GB, TB) and returns the size in bytes
 * 
 * @param sizeString - Size string with optional unit (e.g., "10MB", "1GB", "500KB", "1024")
 * @returns Size in bytes, or null if parsing fails
 * 
 * @example
 * parseSizeToBytes("10MB") // returns 10485760
 * parseSizeToBytes("1GB") // returns 1073741824
 * parseSizeToBytes("500KB") // returns 512000
 * parseSizeToBytes("1024") // returns 1024 (assumes bytes if no unit)
 */
export function parseSizeToBytes(sizeString: string | undefined | null): number | null {
    if (!sizeString) {
        return null;
    }

    // Trim whitespace
    const trimmed = sizeString.trim();
    
    if (trimmed === '') {
        return null;
    }

    // Match number and optional unit (case-insensitive)
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([KMGT]B?|B)?$/i);
    
    if (!match) {
        return null;
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    // Convert to bytes based on unit
    const multipliers: Record<string, number> = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024,
    };

    const multiplier = multipliers[unit] || 1;
    return Math.floor(value * multiplier);
}

