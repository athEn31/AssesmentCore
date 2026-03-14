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
      const filename = relativePath.split('/').pop() || relativePath;
      const lowerFilename = filename.toLowerCase();
      
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
    
    const imageFilename = String(imageValue).trim();
    const lowerFilename = imageFilename.toLowerCase();
    referencedImages.add(lowerFilename);
    
    // Check if file exists in media ZIP
    if (!mediaFiles.has(lowerFilename)) {
      errors.push({
        rowId: row.id || `row_${index}`,
        rowNumber: index + 1,
        imageFilename,
        message: `Image file "${imageFilename}" not found in media ZIP`,
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
 * Insert image HTML tag into question text
 * Returns modified question text with image embedded
 */
export function insertImageIntoQuestionText(
  questionText: string,
  imageFilename: string | undefined | null,
  imagePosition: 'before' | 'after' = 'after'
): string {
  if (!imageFilename || String(imageFilename).trim() === '') {
    return questionText;
  }
  
  const filename = String(imageFilename).trim();
  const imagePath = `images/${filename}`;
  const imageTag = `<br/><img src="${imagePath}" alt="${filename}" />`;
  
  if (imagePosition === 'before') {
    return `${imageTag}<br/>${questionText}`;
  }
  
  return `${questionText}${imageTag}`;
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
  const imagePatterns = ['image', 'img', 'picture', 'media', 'figure', 'graphic'];
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
