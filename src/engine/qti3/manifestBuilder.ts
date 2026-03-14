/**
 * IMS Manifest Builder
 * Generates imsmanifest.xml for QTI 3.0 Content Packages
 */

import { ResourceRegistry, ResourceEntry } from './resourceRegistry';

/**
 * Manifest Configuration
 */
export interface ManifestConfig {
  identifier: string;                 // Unique package identifier
  title?: string;                     // Package title
  description?: string;               // Package description
  version?: string;                   // Package version
  schema?: string;                    // Metadata schema
  schemaVersion?: string;             // Schema version
  organizations?: OrganizationConfig; // Optional organizations
}

/**
 * Organization Configuration
 */
export interface OrganizationConfig {
  default?: string;                   // Default organization ID
  organizations: Organization[];
}

/**
 * Organization
 * Hierarchical structure of content (optional in QTI packages)
 */
export interface Organization {
  identifier: string;
  title?: string;
  items: OrganizationItem[];
}

/**
 * Organization Item
 */
export interface OrganizationItem {
  identifier: string;
  title?: string;
  identifierref?: string;             // Reference to resource
  items?: OrganizationItem[];         // Nested items
}

/**
 * Manifest Builder Class
 */
export class ManifestBuilder {
  private config: ManifestConfig;
  private registry: ResourceRegistry;

  constructor(config: ManifestConfig, registry: ResourceRegistry) {
    this.config = config;
    this.registry = registry;
  }

  /**
   * Build manifest XML
   */
  build(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<manifest\n';
    xml += '  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"\n';
    xml += '  xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"\n';
    xml += '  xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v3p0"\n';
    xml += '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p2.xsd\n';
    xml += '    http://www.imsglobal.org/xsd/imsqti_v3p0 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_v3p0.xsd"\n';
    xml += `  identifier="${this.escapeXml(this.config.identifier)}"\n`;
    
    if (this.config.version) {
      xml += `  version="${this.escapeXml(this.config.version)}"\n`;
    }
    
    xml += '>\n';

    // Metadata
    if (this.config.title || this.config.description) {
      xml += this.buildMetadata();
    }

    // Organizations (optional)
    if (this.config.organizations) {
      xml += this.buildOrganizations();
    } else {
      xml += '  <organizations />\n';
    }

    // Resources
    xml += this.buildResources();

    xml += '</manifest>\n';
    return xml;
  }

  /**
   * Build metadata section
   */
  private buildMetadata(): string {
    let xml = '  <metadata>\n';
    xml += '    <schema>IMS Content</schema>\n';
    xml += '    <schemaversion>1.2</schemaversion>\n';

    if (this.config.title || this.config.description) {
      xml += '    <imsmd:lom>\n';
      xml += '      <imsmd:general>\n';

      if (this.config.title) {
        xml += '        <imsmd:title>\n';
        xml += `          <imsmd:string language="en">${this.escapeXml(this.config.title)}</imsmd:string>\n`;
        xml += '        </imsmd:title>\n';
      }

      if (this.config.description) {
        xml += '        <imsmd:description>\n';
        xml += `          <imsmd:string language="en">${this.escapeXml(this.config.description)}</imsmd:string>\n`;
        xml += '        </imsmd:description>\n';
      }

      xml += '      </imsmd:general>\n';
      xml += '    </imsmd:lom>\n';
    }

    xml += '  </metadata>\n';
    return xml;
  }

  /**
   * Build organizations section
   */
  private buildOrganizations(): string {
    if (!this.config.organizations) {
      return '  <organizations />\n';
    }

    let xml = '  <organizations';
    if (this.config.organizations.default) {
      xml += ` default="${this.escapeXml(this.config.organizations.default)}"`;
    }
    xml += '>\n';

    this.config.organizations.organizations.forEach(org => {
      xml += this.buildOrganization(org);
    });

    xml += '  </organizations>\n';
    return xml;
  }

  /**
   * Build single organization
   */
  private buildOrganization(org: Organization): string {
    let xml = `    <organization identifier="${this.escapeXml(org.identifier)}"`;
    if (org.title) {
      xml += ` title="${this.escapeXml(org.title)}"`;
    }
    xml += '>\n';

    org.items.forEach(item => {
      xml += this.buildOrganizationItem(item, '      ');
    });

    xml += '    </organization>\n';
    return xml;
  }

  /**
   * Build organization item (recursive)
   */
  private buildOrganizationItem(item: OrganizationItem, indent: string): string {
    let xml = `${indent}<item identifier="${this.escapeXml(item.identifier)}"`;
    
    if (item.identifierref) {
      xml += ` identifierref="${this.escapeXml(item.identifierref)}"`;
    }

    if (!item.items || item.items.length === 0) {
      if (item.title) {
        xml += '>\n';
        xml += `${indent}  <title>${this.escapeXml(item.title)}</title>\n`;
        xml += `${indent}</item>\n`;
      } else {
        xml += ' />\n';
      }
    } else {
      xml += '>\n';
      
      if (item.title) {
        xml += `${indent}  <title>${this.escapeXml(item.title)}</title>\n`;
      }

      item.items.forEach(childItem => {
        xml += this.buildOrganizationItem(childItem, indent + '  ');
      });

      xml += `${indent}</item>\n`;
    }

    return xml;
  }

  /**
   * Build resources section
   */
  private buildResources(): string {
    let xml = '  <resources>\n';

    const resources = this.registry.getAllResources();
    resources.forEach(resource => {
      xml += this.buildResource(resource);
    });

    xml += '  </resources>\n';
    return xml;
  }

  /**
   * Build single resource
   */
  private buildResource(resource: ResourceEntry): string {
    let xml = '    <resource';
    xml += ` identifier="${this.escapeXml(resource.identifier)}"`;
    xml += ` type="${this.escapeXml(resource.type)}"`;
    xml += ` href="${this.escapeXml(resource.href)}"`;

    // Check if resource has children (metadata, files, dependencies)
    const hasChildren = 
      (resource.metadata !== undefined) ||
      (resource.files.length > 1) || // More than just the main file
      (resource.dependencies && resource.dependencies.length > 0);

    if (!hasChildren) {
      xml += ' />\n';
      return xml;
    }

    xml += '>\n';

    // Metadata
    if (resource.metadata) {
      xml += this.buildResourceMetadata(resource.metadata);
    }

    // Files (including the main file if not already listed)
    resource.files.forEach(file => {
      xml += `      <file href="${this.escapeXml(file.href)}" />\n`;
    });

    // Dependencies
    if (resource.dependencies && resource.dependencies.length > 0) {
      resource.dependencies.forEach(depId => {
        xml += `      <dependency identifierref="${this.escapeXml(depId)}" />\n`;
      });
    }

    xml += '    </resource>\n';
    return xml;
  }

  /**
   * Build resource metadata
   */
  private buildResourceMetadata(metadata: ResourceEntry['metadata']): string {
    if (!metadata) return '';

    let xml = '      <metadata>\n';
    
    if (metadata.schema) {
      xml += `        <schema>${this.escapeXml(metadata.schema)}</schema>\n`;
    }
    
    if (metadata.schemaVersion) {
      xml += `        <schemaversion>${this.escapeXml(metadata.schemaVersion)}</schemaversion>\n`;
    }

    // LOM metadata
    if (metadata.title || metadata.description || metadata.keywords) {
      xml += '        <imsmd:lom>\n';
      xml += '          <imsmd:general>\n';

      if (metadata.title) {
        xml += '            <imsmd:title>\n';
        xml += `              <imsmd:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.title)}</imsmd:string>\n`;
        xml += '            </imsmd:title>\n';
      }

      if (metadata.description) {
        xml += '            <imsmd:description>\n';
        xml += `              <imsmd:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.description)}</imsmd:string>\n`;
        xml += '            </imsmd:description>\n';
      }

      if (metadata.keywords && metadata.keywords.length > 0) {
        metadata.keywords.forEach(keyword => {
          xml += '            <imsmd:keyword>\n';
          xml += `              <imsmd:string language="${metadata.language || 'en'}">${this.escapeXml(keyword)}</imsmd:string>\n`;
          xml += '            </imsmd:keyword>\n';
        });
      }

      xml += '          </imsmd:general>\n';
      xml += '        </imsmd:lom>\n';
    }

    xml += '      </metadata>\n';
    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Validate manifest
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate registry first
    const registryValidation = this.registry.validate();
    if (!registryValidation.valid) {
      errors.push(...registryValidation.errors);
    }

    // Check for required fields
    if (!this.config.identifier) {
      errors.push('Manifest identifier is required');
    }

    // Check organizations references
    if (this.config.organizations) {
      this.config.organizations.organizations.forEach(org => {
        this.validateOrganizationItems(org.items, errors);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate organization items recursively
   */
  private validateOrganizationItems(items: OrganizationItem[], errors: string[]): void {
    items.forEach(item => {
      if (item.identifierref && !this.registry.hasResource(item.identifierref)) {
        errors.push(`Organization item "${item.identifier}" references non-existent resource: "${item.identifierref}"`);
      }

      if (item.items) {
        this.validateOrganizationItems(item.items, errors);
      }
    });
  }
}

/**
 * Helper function to create manifest
 */
export function createManifest(
  config: ManifestConfig,
  registry: ResourceRegistry
): string {
  const builder = new ManifestBuilder(config, registry);
  return builder.build();
}

/**
 * Quick manifest builder with validation
 */
export function buildManifestWithValidation(
  config: ManifestConfig,
  registry: ResourceRegistry
): { xml: string; valid: boolean; errors: string[] } {
  const builder = new ManifestBuilder(config, registry);
  const validation = builder.validate();

  return {
    xml: validation.valid ? builder.build() : '',
    valid: validation.valid,
    errors: validation.errors,
  };
}
