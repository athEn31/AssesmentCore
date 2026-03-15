/**
 * Media Utilities for QTI Export
 * Handles image extraction, validation, and packaging for QTI exports
 */

import JSZip from 'jszip';

export interface MediaFile {
  filename: string;
  data: ArrayBuffer | Uint8Array;
  type: string;
}

export interface MediaValidationError {
  rowId: string;
  rowNumber: number;
  imageFilename: string;
  message: string;
}

export interface MediaValidationResult {
  valid: boolean;
  errors: MediaValidationError[];
  referencedImages: Set<string>;
}

/**
 * Normalize filename from sheet/zip for reliable matching.
 * Handles paths, quotes, non-breaking spaces, and case-insensitivity.
 */
function extractBaseFilename(input: string): string {
  let value = String(input || '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  // Remove wrapping quotes often introduced by CSV/Excel exports.
  value = value.replace(/^['"]+|['"]+$/g, '');

  // Support pasted paths from Windows/Linux and keep only the basename.
  value = value.replace(/\\/g, '/');
  const parts = value.split('/');
  value = parts[parts.length - 1] || '';

  // Decode common URL-encoded names from exported archives (%20, etc.)
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep original if decoding fails.
  }

  // Treat '+' as a space in filenames coming from encoded contexts.
  value = value.replace(/\+/g, ' ');

  // Collapse internal whitespace noise.
  value = value.replace(/\s+/g, ' ');

  return value.trim();
}

export function normalizeMediaFilename(input: string): string {
  return extractBaseFilename(input).toLowerCase();
}

export function sanitizeMediaFilename(input: string): string {
  return extractBaseFilename(input);
}

function canonicalMediaKey(input: string): string {
  const base = normalizeMediaFilename(input);
  if (!base) return '';

  const parts = base.split('.');
  const ext = parts.length > 1 ? parts.pop() || '' : '';
  let name = parts.join('.');

  // Handle accidental double image extensions like: question.jpg.jpeg
  // by stripping one trailing image extension token from the basename.
  name = name.replace(/\.(png|jpe?g|gif|svg|webp|bmp)$/i, '');

  const normalizedName = name.replace(/[.\s_-]+/g, '');
  const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;

  return normalizedExt ? `${normalizedName}.${normalizedExt}` : normalizedName;
}

/**
 * Resolve a sheet-provided filename against uploaded media keys.
 * 1) Exact normalized key match
 * 2) Canonical fallback (ignores spaces/_/- and treats jpg/jpeg as equivalent)
 */
export function resolveMediaFileKey(
  mediaFiles: Map<string, MediaFile>,
  sheetValue: string
): string | undefined {
  const normalized = normalizeMediaFilename(sheetValue);
  if (!normalized) return undefined;

  if (mediaFiles.has(normalized)) {
    return normalized;
  }

  const targetCanonical = canonicalMediaKey(sheetValue);
  if (!targetCanonical) return undefined;

  for (const key of mediaFiles.keys()) {
    if (canonicalMediaKey(key) === targetCanonical) {
      return key;
    }
  }

  return undefined;
}

/**
 * Extract files from a media ZIP
 */
export async function extractMediaZip(file: File): Promise<Map<string, MediaFile>> {
  const mediaFiles = new Map<string, MediaFile>();
  
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
    
    for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
      // Skip directories
      if (zipEntry.dir) continue;
      
      // Get the filename (handle nested folders)
      const filename = sanitizeMediaFilename(relativePath);
      const lowerFilename = normalizeMediaFilename(relativePath);
      if (!filename || !lowerFilename) continue;
      
      // Check if it's an image file
      const isImage = imageExtensions.some(ext => lowerFilename.endsWith(ext));
      if (!isImage) continue;
      
      // Extract the file data
      const data = await zipEntry.async('arraybuffer');
      
      // Determine MIME type
      const type = getImageMimeType(filename);
      
      // Store with lowercase filename for case-insensitive matching
      mediaFiles.set(lowerFilename, {
        filename: filename, // Preserve original case
        data,
        type,
      });
    }
    
    return mediaFiles;
  } catch (error) {
    console.error('Error extracting media ZIP:', error);
    throw new Error(`Failed to extract media ZIP: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get MIME type from filename
 */
function getImageMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Validate that all referenced images exist in the media files
 */
export function validateMediaReferences(
  rows: Record<string, any>[],
  imageColName: string | undefined,
  mediaFiles: Map<string, MediaFile>
): MediaValidationResult {
  const errors: MediaValidationError[] = [];
  const referencedImages = new Set<string>();
  
  if (!imageColName) {
    return { valid: true, errors: [], referencedImages };
  }
  
  rows.forEach((row, index) => {
    const imageValue = row[imageColName];
    if (!imageValue || String(imageValue).trim() === '') return;
    
    // Skip validation for remote URLs (e.g. Supabase links)
    if (String(imageValue).startsWith('http://') || String(imageValue).startsWith('https://')) {
      return;
    }

    const imageFilename = sanitizeMediaFilename(String(imageValue));
    const resolvedKey = resolveMediaFileKey(mediaFiles, String(imageValue));
    const fallbackKey = normalizeMediaFilename(String(imageValue));
    if (!fallbackKey) return;

    referencedImages.add(resolvedKey || fallbackKey);
    
    // Check if file exists in media ZIP
    if (!resolvedKey) {
      const mediaSample = Array.from(mediaFiles.values())
        .slice(0, 5)
        .map(f => f.filename)
        .join(', ');

      errors.push({
        rowId: row.id || `row_${index}`,
        rowNumber: index + 1,
        imageFilename,
        message: mediaSample
          ? `Image file "${imageFilename}" not found in media ZIP. Sample files detected: ${mediaSample}`
          : `Image file "${imageFilename}" not found in media ZIP`,
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    referencedImages,
  };
}

/**
 * Separator used between question text and image tag.
 * Builders split on this to produce separate <p> blocks.
 */
export const IMG_SEPARATOR = '\n<!--IMG_SEP-->\n';

/**
 * Sanitize image filename for QTI compliance:
 * - Replace spaces with underscores
 * - Lowercase the filename
 * - Strip double image extensions (e.g. .jpg.jpeg -> .jpeg)
 */
export function sanitizeImageFilenameForQTI(filename: string): string {
  let sanitized = filename.trim();
  // Replace spaces with underscores (Rule 8)
  sanitized = sanitized.replace(/\s+/g, '_');
  // Lowercase (Rule 9)
  sanitized = sanitized.toLowerCase();
  // Strip double image extensions like .jpg.jpeg (Rule 10)
  sanitized = sanitized.replace(/\.(png|jpe?g|gif|svg|webp|bmp)\.(png|jpe?g|gif|svg|webp|bmp)$/i, '.$2');
  return sanitized;
}

export function insertImageIntoQuestionText(
  questionText: string,
  imageFilename: string | undefined | null,
  imagePosition: 'before' | 'after' = 'after'
): string {
  if (!imageFilename || String(imageFilename).trim() === '') {
    return questionText;
  }
  
  const filename = sanitizeMediaFilename(String(imageFilename));
  if (!filename) return questionText;
  const safeFilename = sanitizeImageFilenameForQTI(filename);
  const imagePath = `images/${safeFilename}`;
  // Bare <img> tag — builders will wrap in <p> to avoid nested <p> (Rule 5/6)
  const imageTag = `<img src="${imagePath}" alt="${safeFilename}" />`;
  
  if (imagePosition === 'before') {
    return `${imageTag}${IMG_SEPARATOR}${questionText}`;
  }
  
  return `${questionText}${IMG_SEPARATOR}${imageTag}`;
}

/**
 * Handle duplicate filenames in media by adding suffix
 */
export function handleDuplicateFilenames(
  mediaFiles: Map<string, MediaFile>,
  referencedImages: Set<string>
): Map<string, { original: string; renamed: string }> {
  const renameMap = new Map<string, { original: string; renamed: string }>();
  const usedFilenames = new Set<string>();
  
  referencedImages.forEach(lowerFilename => {
    const mediaFile = mediaFiles.get(lowerFilename);
    if (!mediaFile) return;
    
    let finalFilename = mediaFile.filename;
    
    // Check for collision
    if (usedFilenames.has(finalFilename.toLowerCase())) {
      // Generate unique filename
      const ext = finalFilename.split('.').pop() || '';
      const baseName = finalFilename.substring(0, finalFilename.length - ext.length - 1);
      let counter = 1;
      
      while (usedFilenames.has(`${baseName}_${counter}.${ext}`.toLowerCase())) {
        counter++;
      }
      
      finalFilename = `${baseName}_${counter}.${ext}`;
    }
    
    usedFilenames.add(finalFilename.toLowerCase());
    
    if (finalFilename !== mediaFile.filename) {
      renameMap.set(lowerFilename, {
        original: mediaFile.filename,
        renamed: finalFilename,
      });
    }
  });
  
  return renameMap;
}

/**
 * Generate the images folder content for the ZIP
 */
export function getImagesForPackaging(
  mediaFiles: Map<string, MediaFile>,
  referencedImages: Set<string>
): Map<string, { filename: string; data: ArrayBuffer | Uint8Array }> {
  const imagesToPackage = new Map<string, { filename: string; data: ArrayBuffer | Uint8Array }>();
  
  referencedImages.forEach(lowerFilename => {
    const mediaFile = mediaFiles.get(lowerFilename);
    if (mediaFile) {
      imagesToPackage.set(lowerFilename, {
        filename: mediaFile.filename,
        data: mediaFile.data,
      });
    }
  });
  
  return imagesToPackage;
}

/**
 * Detect "Image" or similar column in columns list
 */
export function detectImageColumn(columns: string[]): string | undefined {
  const imagePatterns = ['image', 'img', 'picture', 'media', 'figure', 'graphic', 'diagram', 'illustration'];
  const lowerColumns = columns.map(c => c.toLowerCase());
  
  const index = lowerColumns.findIndex(c => 
    imagePatterns.some(p => c === p || c.includes(p))
  );
  
  return index >= 0 ? columns[index] : undefined;
}

/**
 * Validate that correct answers exist in options
 */
export function validateAnswerInOptions(
  rows: Record<string, any>[],
  columnMapping: any
): { valid: boolean; errors: Array<{ rowId: string; rowNumber: number; message: string }> } {
  const errors: Array<{ rowId: string; rowNumber: number; message: string }> = [];
  
  if (!columnMapping.answerCol || !columnMapping.optionCols) {
    return { valid: true, errors };
  }
  
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  
  rows.forEach((row, index) => {
    const answer = row[columnMapping.answerCol];
    if (!answer) return;
    
    const normalizedAnswer = String(answer).toUpperCase().trim();
    
    // Check if it's a valid option letter
    if (/^[A-H]$/.test(normalizedAnswer)) {
      const optionIndex = normalizedAnswer.charCodeAt(0) - 65;
      const optionCols = columnMapping.optionCols || [];
      
      if (optionIndex >= optionCols.length) {
        errors.push({
          rowId: row.id || `row_${index}`,
          rowNumber: index + 1,
          message: `Answer "${normalizedAnswer}" exceeds available options (only ${optionCols.length} options)`,
        });
      } else {
        // Check if the referenced option has content
        const optionValue = row[optionCols[optionIndex]];
        if (!optionValue || String(optionValue).trim() === '') {
          errors.push({
            rowId: row.id || `row_${index}`,
            rowNumber: index + 1,
            message: `Answer "${normalizedAnswer}" references an empty option`,
          });
        }
      }
    } else if (/^[1-8]$/.test(normalizedAnswer)) {
      const optionIndex = parseInt(normalizedAnswer) - 1;
      const optionCols = columnMapping.optionCols || [];
      
      if (optionIndex >= optionCols.length) {
        errors.push({
          rowId: row.id || `row_${index}`,
          rowNumber: index + 1,
          message: `Answer "${normalizedAnswer}" exceeds available options (only ${optionCols.length} options)`,
        });
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check for duplicate item IDs
 */
export function validateUniqueIds(
  rows: Record<string, any>[]
): { valid: boolean; errors: Array<{ rowId: string; rowNumber: number; message: string }> } {
  const errors: Array<{ rowId: string; rowNumber: number; message: string }> = [];
  const seenIds = new Map<string, number>();
  
  rows.forEach((row, index) => {
    const id = row.id;
    if (!id) return;
    
    if (seenIds.has(id)) {
      errors.push({
        rowId: id,
        rowNumber: index + 1,
        message: `Duplicate item ID "${id}" (first seen at row ${seenIds.get(id)})`,
      });
    } else {
      seenIds.set(id, index + 1);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
