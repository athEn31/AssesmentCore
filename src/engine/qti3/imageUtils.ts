/**
 * Image Handling Utilities
 * Extract, validate, and organize images for QTI packages
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ImageFile {
  filename: string;
  sourcePath: string;
  destinationPath: string;
  mimeType: string;
}

/**
 * Extract image metadata from question
 */
export function extractImageReferences(questionText: string): string[] {
  const images: Set<string> = new Set();

  // Match markdown images: ![alt](filename)
  const markdownRegex = /!\[.*?\]\((.*?)\)/g;
  let match;

  while ((match = markdownRegex.exec(questionText)) !== null) {
    images.add(match[1]);
  }

  // Match HTML images: src="filename"
  const htmlRegex = /src="([^"]+)"/g;
  while ((match = htmlRegex.exec(questionText)) !== null) {
    images.add(match[1]);
  }

  // Match HTML images with single quotes
  const htmlSingleRegex = /src='([^']+)'/g;
  while ((match = htmlSingleRegex.exec(questionText)) !== null) {
    images.add(match[1]);
  }

  return Array.from(images);
}

/**
 * Get MIME type from filename
 */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();

  const mimeTypes: { [key: string]: string } = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Create image map from source directory
 * Maps filename -> filepath
 */
export function createImageMap(sourceDir: string): Map<string, string> {
  const imageMap = new Map<string, string>();

  if (!fs.existsSync(sourceDir)) {
    return imageMap;
  }

  const files = fs.readdirSync(sourceDir);

  files.forEach(file => {
    const filePath = path.join(sourceDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile()) {
      imageMap.set(file, filePath);
    }
  });

  return imageMap;
}

/**
 * Validate that all referenced images exist
 */
export function validateImageReferences(
  imageReferences: string[],
  imageMap: Map<string, string>
): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  imageReferences.forEach(img => {
    if (!imageMap.has(img)) {
      missing.push(img);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get image dimensions (if available)
 * Note: This would need 'image-size' or similar package in real implementation
 */
export function getImageDimensions(
  filepath: string
): { width?: number; height?: number } {
  // Placeholder - actual implementation would parse image metadata
  return {};
}

/**
 * Copy images to destination directory
 */
export function copyImages(
  sourceMap: Map<string, string>,
  destinationDir: string,
  imagesToCopy: string[]
): ImageFile[] {
  const copied: ImageFile[] = [];

  // Create destination directory if needed
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  imagesToCopy.forEach(filename => {
    const sourcePath = sourceMap.get(filename);
    if (sourcePath && fs.existsSync(sourcePath)) {
      const destinationPath = path.join(destinationDir, filename);

      // Copy file
      fs.copyFileSync(sourcePath, destinationPath);

      copied.push({
        filename,
        sourcePath,
        destinationPath,
        mimeType: getMimeType(filename),
      });
    }
  });

  return copied;
}

/**
 * Replace image paths in XML with relative paths
 */
export function updateImagePathsInXML(
  xml: string,
  imageFilenames: string[]
): string {
  let updated = xml;

  imageFilenames.forEach(filename => {
    // Replace various image reference patterns with relative path
    const patterns = [
      new RegExp(`src="[^"]*${filename}"`, 'g'),
      new RegExp(`src='[^']*${filename}'`, 'g'),
      new RegExp(`\\(.*?${filename}\\)`, 'g'),
    ];

    patterns.forEach(pattern => {
      updated = updated.replace(pattern, new RegExp(pattern).source.replace(filename, `images/${filename}`));
    });
  });

  return updated;
}
