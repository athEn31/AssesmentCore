/**
 * QTI Package Builder
 * Creates IMS Content Package ZIP files for QTI 3.0
 */

import JSZip from 'jszip';
import { ResourceRegistry } from './resourceRegistry';
import { ManifestBuilder, ManifestConfig } from './manifestBuilder';

/**
 * Package Configuration
 */
export interface PackageConfig {
  // Package identification
  packageIdentifier: string;
  packageTitle?: string;
  packageDescription?: string;
  packageVersion?: string;

  // Test configuration
  testIdentifier: string;
  testXML: string;
  testTitle?: string;

  // Items configuration
  items: PackageItem[];
  stimuli?: PackageStimulus[];

  // Output options
  outputFormat?: 'blob' | 'arraybuffer' | 'uint8array' | 'nodebuffer';
  compressionLevel?: number; // 0-9, default 6
}

/**
 * Package Item
 */
export interface PackageItem {
  identifier: string;
  xml: string;
  title?: string;
  images?: PackageImage[];
  stimulusIdentifiers?: string[];
}

export interface PackageStimulus {
  identifier: string;
  xml: string;
  title?: string;
  images?: PackageImage[];
}

/**
 * Package Image
 */
export interface PackageImage {
  filename: string;              // e.g., "image1.png"
  data: Buffer | Uint8Array | Blob | string; // Image data
  mimeType?: string;             // e.g., "image/png"
}

/**
 * Package Build Result
 */
export interface PackageResult {
  success: boolean;
  data?: any;                    // ZIP data in requested format
  errors?: string[];
  warnings?: string[];
  statistics?: PackageStatistics;
}

/**
 * Package Statistics
 */
export interface PackageStatistics {
  totalFiles: number;
  testFiles: number;
  itemFiles: number;
  stimulusFiles: number;
  imageFiles: number;
  totalSize: number;             // In bytes
  manifestSize: number;
}

/**
 * Package Builder Class
 */
export class PackageBuilder {
  private config: PackageConfig;
  private zip: JSZip;
  private registry: ResourceRegistry;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(config: PackageConfig) {
    this.config = config;
    this.zip = new JSZip();
    this.registry = new ResourceRegistry();
  }

  /**
   * Build the complete package
   */
  async build(): Promise<PackageResult> {
    try {
      // Step 1: Add test file
      this.addTestFile();

      // Step 2: Add stimulus files
      this.addStimulusFiles();

      // Step 3: Add item files and collect images
      this.addItemFiles();

      // Step 4: Add image files
      this.addImageFiles();

      // Step 5: Build and add manifest
      this.addManifest();

      // Step 6: Validate
      const validation = this.validate();
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Step 7: Generate ZIP
      const format = this.config.outputFormat || 'blob';
      const compression = this.config.compressionLevel !== undefined 
        ? this.config.compressionLevel 
        : 6;

      const data = await this.zip.generateAsync({
        type: format as any,
        compression: 'DEFLATE',
        compressionOptions: {
          level: compression,
        },
      });

      // Step 8: Calculate statistics
      const statistics = await this.calculateStatistics();

      return {
        success: true,
        data,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
        statistics,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Add test file to package
   */
  private addTestFile(): void {
    const testHref = 'assessmentTest.xml';
    
    // Add to ZIP
    this.zip.file(testHref, this.config.testXML);

    // Register in registry
    this.registry.registerTest({
      identifier: this.config.testIdentifier,
      href: testHref,
      title: this.config.testTitle,
      itemIdentifiers: this.config.items.map(item => item.identifier),
    });
  }

  /**
   * Add item files to package
   */
  private addItemFiles(): void {
    this.config.items.forEach(item => {
      const itemHref = `items/${item.identifier}.xml`;

      // Add to ZIP
      this.zip.file(itemHref, item.xml);

      // Collect image filenames
      const imageFiles = item.images?.map(img => `images/${img.filename}`) || [];

      // Register in registry
      this.registry.registerItem({
        identifier: item.identifier,
        href: itemHref,
        title: item.title,
        imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
        stimulusIdentifiers: item.stimulusIdentifiers,
      });
    });
  }

  /**
   * Add stimulus files to package
   */
  private addStimulusFiles(): void {
    if (!this.config.stimuli || this.config.stimuli.length === 0) {
      return;
    }

    this.config.stimuli.forEach(stimulus => {
      const stimulusHref = `stimuli/${stimulus.identifier}.xml`;
      this.zip.file(stimulusHref, stimulus.xml);

      const imageFiles = stimulus.images?.map(img => `images/${img.filename}`) || [];
      this.registry.registerStimulus({
        identifier: stimulus.identifier,
        href: stimulusHref,
        title: stimulus.title,
        imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
      });
    });
  }

  /**
   * Add image files to package
   */
  private addImageFiles(): void {
    const addedImages = new Set<string>();

    this.config.items.forEach(item => {
      if (!item.images || item.images.length === 0) {
        return;
      }

      item.images.forEach(image => {
        // Avoid duplicates
        if (addedImages.has(image.filename)) {
          this.warnings.push(`Duplicate image: ${image.filename} (using first occurrence)`);
          return;
        }

        const imageHref = `images/${image.filename}`;

        // Add to ZIP
        // Handle different data types
        if (typeof image.data === 'string') {
          // Base64 string
          this.zip.file(imageHref, image.data, { base64: true });
        } else {
          // Binary data (Buffer, Uint8Array, Blob)
          this.zip.file(imageHref, image.data as any);
        }

        addedImages.add(image.filename);
      });
    });

    this.config.stimuli?.forEach(stimulus => {
      if (!stimulus.images || stimulus.images.length === 0) {
        return;
      }

      stimulus.images.forEach(image => {
        if (addedImages.has(image.filename)) {
          this.warnings.push(`Duplicate image: ${image.filename} (using first occurrence)`);
          return;
        }

        const imageHref = `images/${image.filename}`;
        if (typeof image.data === 'string') {
          this.zip.file(imageHref, image.data, { base64: true });
        } else {
          this.zip.file(imageHref, image.data as any);
        }

        addedImages.add(image.filename);
      });
    });
  }

  /**
   * Generate and add manifest
   */
  private addManifest(): void {
    const manifestConfig: ManifestConfig = {
      identifier: this.config.packageIdentifier,
      title: this.config.packageTitle,
      description: this.config.packageDescription,
      version: this.config.packageVersion || '1.0',
    };

    const manifestBuilder = new ManifestBuilder(manifestConfig, this.registry);
    const manifestXML = manifestBuilder.build();

    // Add to ZIP
    this.zip.file('imsmanifest.xml', manifestXML);
  }

  /**
   * Validate package
   */
  private validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate registry
    const registryValidation = this.registry.validate();
    if (!registryValidation.valid) {
      errors.push(...registryValidation.errors);
    }

    // Check test XML is valid (basic check)
    if (!this.config.testXML || this.config.testXML.trim().length === 0) {
      errors.push('Test XML is empty');
    }

    // Check items
    if (!this.config.items || this.config.items.length === 0) {
      errors.push('No items provided');
    }

    this.config.items.forEach((item, index) => {
      if (!item.identifier) {
        errors.push(`Item at index ${index} has no identifier`);
      }
      if (!item.xml || item.xml.trim().length === 0) {
        errors.push(`Item "${item.identifier}" has empty XML`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate package statistics
   */
  private async calculateStatistics(): Promise<PackageStatistics> {
    const files = Object.keys(this.zip.files);
    const stats: PackageStatistics = {
      totalFiles: files.length,
      testFiles: 0,
      itemFiles: 0,
      stimulusFiles: 0,
      imageFiles: 0,
      totalSize: 0,
      manifestSize: 0,
    };

    // Count file types
    files.forEach(filename => {
      if (filename === 'assessmentTest.xml') {
        stats.testFiles++;
      } else if (filename.startsWith('items/')) {
        stats.itemFiles++;
      } else if (filename.startsWith('stimuli/')) {
        stats.stimulusFiles++;
      } else if (filename.startsWith('images/')) {
        stats.imageFiles++;
      }
    });

    // Calculate sizes
    for (const filename of files) {
      const file = this.zip.files[filename];
      if (!file.dir) {
        try {
          const content = await file.async('uint8array');
          const size = content.length;
          stats.totalSize += size;

          if (filename === 'imsmanifest.xml') {
            stats.manifestSize = size;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    return stats;
  }

  /**
   * Get registry (for debugging)
   */
  getRegistry(): ResourceRegistry {
    return this.registry;
  }

  /**
   * Get ZIP instance (for advanced usage)
   */
  getZip(): JSZip {
    return this.zip;
  }
}

/**
 * Quick build function
 */
export async function buildPackage(config: PackageConfig): Promise<PackageResult> {
  const builder = new PackageBuilder(config);
  return builder.build();
}

/**
 * Build package from separate components
 */
export async function buildPackageFromComponents(config: {
  packageIdentifier: string;
  packageTitle?: string;
  
  // Test
  testIdentifier: string;
  testXML: string;
  
  // Items with their XMLs
  items: Array<{
    identifier: string;
    xml: string;
    title?: string;
    imageMap?: Map<string, Buffer | Uint8Array | Blob | string>;
    stimulusIdentifiers?: string[];
  }>;

  stimuli?: Array<{
    identifier: string;
    xml: string;
    title?: string;
    imageMap?: Map<string, Buffer | Uint8Array | Blob | string>;
  }>;
  
  outputFormat?: 'blob' | 'arraybuffer' | 'uint8array' | 'nodebuffer';
}): Promise<PackageResult> {
  // Convert items to PackageItem format
  const packageItems: PackageItem[] = config.items.map(item => {
    const images: PackageImage[] = [];
    
    if (item.imageMap) {
      item.imageMap.forEach((data, filename) => {
        images.push({ filename, data });
      });
    }

    return {
      identifier: item.identifier,
      xml: item.xml,
      title: item.title,
      images: images.length > 0 ? images : undefined,
      stimulusIdentifiers: item.stimulusIdentifiers,
    };
  });

  const packageStimuli: PackageStimulus[] = (config.stimuli || []).map(stimulus => {
    const images: PackageImage[] = [];

    if (stimulus.imageMap) {
      stimulus.imageMap.forEach((data, filename) => {
        images.push({ filename, data });
      });
    }

    return {
      identifier: stimulus.identifier,
      xml: stimulus.xml,
      title: stimulus.title,
      images: images.length > 0 ? images : undefined,
    };
  });

  const packageConfig: PackageConfig = {
    packageIdentifier: config.packageIdentifier,
    packageTitle: config.packageTitle,
    testIdentifier: config.testIdentifier,
    testXML: config.testXML,
    items: packageItems,
    stimuli: packageStimuli.length > 0 ? packageStimuli : undefined,
    outputFormat: config.outputFormat || 'blob',
  };

  return buildPackage(packageConfig);
}

/**
 * Build package with validation report
 */
export async function buildPackageWithReport(
  config: PackageConfig
): Promise<{
  result: PackageResult;
  report: {
    registry: {
      tests: number;
      items: number;
      stimuli: number;
      images: number;
    };
    validation: {
      valid: boolean;
      errors: string[];
    };
  };
}> {
  const builder = new PackageBuilder(config);
  const result = await builder.build();

  const registry = builder.getRegistry();
  const stats = registry.getStatistics();
  const validation = registry.validate();

  return {
    result,
    report: {
      registry: {
        tests: stats.tests,
        items: stats.items,
        stimuli: stats.stimuli,
        images: stats.images,
      },
      validation,
    },
  };
}
