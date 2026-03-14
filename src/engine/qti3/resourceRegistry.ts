/**
 * Resource Registry
 * Manages resources for IMS Content Package manifest
 */

/**
 * Resource Types in IMS QTI
 */
export type ResourceType = 
  | 'imsqti_test_xmlv3p0'           // Assessment Test
  | 'imsqti_item_xmlv3p0'           // Assessment Item
  | 'imsqti_stimulus_xmlv3p0'       // Assessment Stimulus
  | 'associatedcontent/learning-application-resource'  // Images, media, etc.
  | 'webcontent';                    // Generic web content

/**
 * Resource Entry
 * Represents a single resource in the manifest
 */
export interface ResourceEntry {
  identifier: string;                // Unique resource ID
  type: ResourceType;                // Resource type
  href: string;                       // Main file path
  metadata?: ResourceMetadata;        // Optional metadata
  files: FileEntry[];                 // All files in this resource
  dependencies?: string[];            // IDs of dependent resources
}

/**
 * File Entry
 * Represents a file within a resource
 */
export interface FileEntry {
  href: string;                       // Relative path in package
}

/**
 * Resource Metadata
 */
export interface ResourceMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  language?: string;
  schema?: string;
  schemaVersion?: string;
}

/**
 * Resource Registry Class
 * Manages all resources in a QTI package
 */
export class ResourceRegistry {
  private resources: Map<string, ResourceEntry> = new Map();
  private fileToResource: Map<string, string> = new Map(); // File -> Resource ID mapping

  /**
   * Register an assessment test
   */
  registerTest(config: {
    identifier: string;
    href: string;
    title?: string;
    itemIdentifiers?: string[];
  }): void {
    const resource: ResourceEntry = {
      identifier: config.identifier,
      type: 'imsqti_test_xmlv3p0',
      href: config.href,
      metadata: config.title ? { title: config.title } : undefined,
      files: [{ href: config.href }],
      dependencies: config.itemIdentifiers || [],
    };

    this.resources.set(config.identifier, resource);
    this.fileToResource.set(config.href, config.identifier);
  }

  /**
   * Register an assessment item
   */
  registerItem(config: {
    identifier: string;
    href: string;
    title?: string;
    imageFiles?: string[];
    stimulusIdentifiers?: string[];
  }): void {
    const files: FileEntry[] = [{ href: config.href }];
    const dependencies: string[] = [];

    // Add image files as dependencies
    if (config.imageFiles && config.imageFiles.length > 0) {
      config.imageFiles.forEach(imageFile => {
        // Check if image resource already exists
        let imageResourceId = this.fileToResource.get(imageFile);
        
        if (!imageResourceId) {
          // Create new image resource
          imageResourceId = this.generateImageResourceId(imageFile);
          this.registerImage({
            identifier: imageResourceId,
            href: imageFile,
          });
        }

        dependencies.push(imageResourceId);
      });
    }

    // Add stimulus dependencies
    if (config.stimulusIdentifiers && config.stimulusIdentifiers.length > 0) {
      config.stimulusIdentifiers.forEach(stimulusId => {
        if (this.resources.has(stimulusId)) {
          dependencies.push(stimulusId);
        }
      });
    }

    const resource: ResourceEntry = {
      identifier: config.identifier,
      type: 'imsqti_item_xmlv3p0',
      href: config.href,
      metadata: config.title ? { title: config.title } : undefined,
      files,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
    };

    this.resources.set(config.identifier, resource);
    this.fileToResource.set(config.href, config.identifier);
  }

  /**
   * Register an assessment stimulus
   */
  registerStimulus(config: {
    identifier: string;
    href: string;
    title?: string;
    imageFiles?: string[];
  }): void {
    const dependencies: string[] = [];

    if (config.imageFiles && config.imageFiles.length > 0) {
      config.imageFiles.forEach(imageFile => {
        let imageResourceId = this.fileToResource.get(imageFile);
        if (!imageResourceId) {
          imageResourceId = this.generateImageResourceId(imageFile);
          this.registerImage({
            identifier: imageResourceId,
            href: imageFile,
          });
        }
        dependencies.push(imageResourceId);
      });
    }

    const resource: ResourceEntry = {
      identifier: config.identifier,
      type: 'imsqti_stimulus_xmlv3p0',
      href: config.href,
      metadata: config.title ? { title: config.title } : undefined,
      files: [{ href: config.href }],
      dependencies: dependencies.length > 0 ? dependencies : undefined,
    };

    this.resources.set(config.identifier, resource);
    this.fileToResource.set(config.href, config.identifier);
  }

  /**
   * Register an image or media file
   */
  registerImage(config: {
    identifier: string;
    href: string;
  }): void {
    // Check if already registered
    if (this.resources.has(config.identifier)) {
      return;
    }

    const resource: ResourceEntry = {
      identifier: config.identifier,
      type: 'associatedcontent/learning-application-resource',
      href: config.href,
      files: [{ href: config.href }],
    };

    this.resources.set(config.identifier, resource);
    this.fileToResource.set(config.href, config.identifier);
  }

  /**
   * Register multiple images
   */
  registerImages(imageFiles: string[]): void {
    imageFiles.forEach(imageFile => {
      const identifier = this.generateImageResourceId(imageFile);
      this.registerImage({ identifier, href: imageFile });
    });
  }

  /**
   * Get all resources
   */
  getAllResources(): ResourceEntry[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resource by ID
   */
  getResource(identifier: string): ResourceEntry | undefined {
    return this.resources.get(identifier);
  }

  /**
   * Get resource by file path
   */
  getResourceByFile(href: string): ResourceEntry | undefined {
    const identifier = this.fileToResource.get(href);
    return identifier ? this.resources.get(identifier) : undefined;
  }

  /**
   * Check if resource exists
   */
  hasResource(identifier: string): boolean {
    return this.resources.has(identifier);
  }

  /**
   * Get all files in package
   */
  getAllFiles(): string[] {
    const files = new Set<string>();
    this.resources.forEach(resource => {
      resource.files.forEach(file => files.add(file.href));
    });
    return Array.from(files);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalResources: number;
    tests: number;
    items: number;
    stimuli: number;
    images: number;
    totalFiles: number;
  } {
    const stats = {
      totalResources: this.resources.size,
      tests: 0,
      items: 0,
      stimuli: 0,
      images: 0,
      totalFiles: this.getAllFiles().length,
    };

    this.resources.forEach(resource => {
      switch (resource.type) {
        case 'imsqti_test_xmlv3p0':
          stats.tests++;
          break;
        case 'imsqti_item_xmlv3p0':
          stats.items++;
          break;
        case 'imsqti_stimulus_xmlv3p0':
          stats.stimuli++;
          break;
        case 'associatedcontent/learning-application-resource':
          stats.images++;
          break;
      }
    });

    return stats;
  }

  /**
   * Generate unique resource ID for image
   */
  private generateImageResourceId(imageFile: string): string {
    // Extract filename without extension
    const parts = imageFile.split('/');
    const filename = parts[parts.length - 1];
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    // Create identifier
    const baseId = `IMG_${nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    
    // Ensure uniqueness
    let identifier = baseId;
    let counter = 1;
    while (this.resources.has(identifier)) {
      identifier = `${baseId}_${counter}`;
      counter++;
    }
    
    return identifier;
  }

  /**
   * Validate registry
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for missing dependencies
    this.resources.forEach((resource, id) => {
      if (resource.dependencies) {
        resource.dependencies.forEach(depId => {
          if (!this.resources.has(depId)) {
            errors.push(`Resource "${id}" has missing dependency: "${depId}"`);
          }
        });
      }

      // Check for empty files array
      if (!resource.files || resource.files.length === 0) {
        errors.push(`Resource "${id}" has no files`);
      }

      // Check for missing href
      if (!resource.href) {
        errors.push(`Resource "${id}" has no href`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.resources.clear();
    this.fileToResource.clear();
  }

  /**
   * Get dependency graph (for debugging)
   */
  getDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    this.resources.forEach((resource, id) => {
      graph[id] = resource.dependencies || [];
    });
    return graph;
  }
}

/**
 * Helper to create resource registry from batch data
 */
export function createResourceRegistry(config: {
  testIdentifier: string;
  testHref: string;
  testTitle?: string;
  items: Array<{
    identifier: string;
    href: string;
    title?: string;
    imageFiles?: string[];
  }>;
}): ResourceRegistry {
  const registry = new ResourceRegistry();

  // Register test
  registry.registerTest({
    identifier: config.testIdentifier,
    href: config.testHref,
    title: config.testTitle,
    itemIdentifiers: config.items.map(item => item.identifier),
  });

  // Register items
  config.items.forEach(item => {
    registry.registerItem(item);
  });

  return registry;
}
