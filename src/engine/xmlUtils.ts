/**
 * XML utility functions for QTI generation
 */

/**
 * Escape XML special characters
 */
export function escapeXml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert index to letter identifier (0=A, 1=B, etc.)
 */
export function indexToIdentifier(index: number): string {
  if (index < 0 || index > 25) {
    throw new Error('Index must be between 0 and 25');
  }
  return String.fromCharCode(65 + index);
}

/**
 * Convert letter identifier to index (A=0, B=1, etc.)
 */
export function identifierToIndex(identifier: string): number {
  const upper = identifier.toUpperCase();
  if (upper.length !== 1 || upper.charCodeAt(0) < 65 || upper.charCodeAt(0) > 90) {
    throw new Error('Identifier must be a single letter A-Z');
  }
  return upper.charCodeAt(0) - 65;
}

/**
 * Validate if identifier is valid (A-Z or 1-26)
 */
export function isValidIdentifier(identifier: string): boolean {
  const upper = identifier.toUpperCase();
  // Check if letter (A-Z)
  if (/^[A-Z]$/.test(upper)) {
    return true;
  }
  // Check if number (1-26)
  if (/^\d+$/.test(upper)) {
    const num = parseInt(upper);
    return num >= 1 && num <= 26;
  }
  return false;
}
