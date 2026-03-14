/**
 * QTI 3.0 Metadata Mapper
 * Maps Excel/question metadata to QTI 3.0 LOM (Learning Object Metadata)
 */

/**
 * Question Metadata (extracted from Excel or input)
 */
export interface QuestionMetadata {
  // Identification
  identifier?: string;
  title?: string;
  language?: string;

  // Educational
  subject?: string;               // e.g., "Mathematics", "Science", "History"
  topic?: string;                 // e.g., "Algebra", "Linear Equations"
  subtopic?: string;              // e.g., "Solving Single Variable"
  difficulty?: string;            // "easy", "medium", "hard"
  learningObjective?: string;     // What the question assesses
  bloomLevel?: string;            // Bloom's taxonomy level
  
  // Classification
  gradeLevel?: string;            // e.g., "Grade 9", "High School"
  curriculum?: string;            // e.g., "Common Core", "IB"
  standard?: string;              // e.g., "CCSS.MATH.9.A.1"
  
  // Content
  keywords?: string[];            // Search keywords
  tags?: string[];                // Custom tags
  description?: string;           // Question description
  
  // Technical
  author?: string;                // Question author
  organization?: string;          // Creating organization
  version?: string;               // Question version
  created?: Date;                 // Creation date
  modified?: Date;                // Last modification date
  
  // Educational context
  typicalLearningTime?: number;   // Expected time in seconds
  interactivityLevel?: 'low' | 'medium' | 'high';
  interactivityType?: 'active' | 'expositive' | 'mixed';
  
  // Rights
  copyrightNotice?: string;
  license?: string;
  
  // Custom extensions
  extensions?: Record<string, any>;
}

/**
 * QTI Metadata XML Structure
 */
export interface QTIMetadataXML {
  schema?: string;
  schemaVersion?: string;
  lomXML?: string;                // Complete LOM XML block
}

/**
 * Metadata Mapper Class
 */
export class MetadataMapper {
  /**
   * Map question metadata to QTI LOM XML
   */
  static toQTIMetadata(metadata: QuestionMetadata): QTIMetadataXML {
    return {
      schema: 'QTIv3',
      schemaVersion: '3.0.0',
      lomXML: this.buildLOMXML(metadata),
    };
  }

  /**
   * Build LOM (Learning Object Metadata) XML
   */
  private static buildLOMXML(metadata: QuestionMetadata): string {
    let xml = '    <qti-metadata>\n';
    xml += '      <lom:lom xmlns:lom="http://ltsc.ieee.org/xsd/LOM">\n';

    // General section
    if (this.hasGeneralMetadata(metadata)) {
      xml += this.buildGeneralSection(metadata);
    }

    // Lifecycle section
    if (metadata.author || metadata.version || metadata.created) {
      xml += this.buildLifecycleSection(metadata);
    }

    // Educational section
    if (this.hasEducationalMetadata(metadata)) {
      xml += this.buildEducationalSection(metadata);
    }

    // Classification section
    if (this.hasClassificationMetadata(metadata)) {
      xml += this.buildClassificationSection(metadata);
    }

    // Rights section
    if (metadata.copyrightNotice || metadata.license) {
      xml += this.buildRightsSection(metadata);
    }

    xml += '      </lom:lom>\n';
    xml += '    </qti-metadata>\n';
    return xml;
  }

  /**
   * Build General section
   */
  private static buildGeneralSection(metadata: QuestionMetadata): string {
    let xml = '        <lom:general>\n';

    // Identifier
    if (metadata.identifier) {
      xml += '          <lom:identifier>\n';
      xml += `            <lom:catalog>URI</lom:catalog>\n`;
      xml += `            <lom:entry>${this.escapeXml(metadata.identifier)}</lom:entry>\n`;
      xml += '          </lom:identifier>\n';
    }

    // Title
    if (metadata.title) {
      xml += '          <lom:title>\n';
      xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.title)}</lom:string>\n`;
      xml += '          </lom:title>\n';
    }

    // Language
    xml += `          <lom:language>${metadata.language || 'en'}</lom:language>\n`;

    // Description
    if (metadata.description) {
      xml += '          <lom:description>\n';
      xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.description)}</lom:string>\n`;
      xml += '          </lom:description>\n';
    }

    // Keywords
    if (metadata.keywords && metadata.keywords.length > 0) {
      metadata.keywords.forEach(keyword => {
        xml += '          <lom:keyword>\n';
        xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(keyword)}</lom:string>\n`;
        xml += '          </lom:keyword>\n';
      });
    }

    // Tags (as keywords)
    if (metadata.tags && metadata.tags.length > 0) {
      metadata.tags.forEach(tag => {
        xml += '          <lom:keyword>\n';
        xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(tag)}</lom:string>\n`;
        xml += '          </lom:keyword>\n';
      });
    }

    xml += '        </lom:general>\n';
    return xml;
  }

  /**
   * Build Lifecycle section
   */
  private static buildLifecycleSection(metadata: QuestionMetadata): string {
    let xml = '        <lom:lifeCycle>\n';

    // Version
    if (metadata.version) {
      xml += '          <lom:version>\n';
      xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.version)}</lom:string>\n`;
      xml += '          </lom:version>\n';
    }

    // Author
    if (metadata.author || metadata.organization) {
      xml += '          <lom:contribute>\n';
      xml += '            <lom:role>\n';
      xml += '              <lom:source>LOMv1.0</lom:source>\n';
      xml += '              <lom:value>author</lom:value>\n';
      xml += '            </lom:role>\n';
      
      if (metadata.author || metadata.organization) {
        xml += '            <lom:entity>\n';
        xml += `              <vcard:vcard xmlns:vcard="urn:ietf:params:xml:ns:vcard-4.0">\n`;
        if (metadata.author) {
          xml += `                <vcard:fn><vcard:text>${this.escapeXml(metadata.author)}</vcard:text></vcard:fn>\n`;
        }
        if (metadata.organization) {
          xml += `                <vcard:org><vcard:text>${this.escapeXml(metadata.organization)}</vcard:text></vcard:org>\n`;
        }
        xml += `              </vcard:vcard>\n`;
        xml += '            </lom:entity>\n';
      }

      // Date
      if (metadata.created) {
        xml += '            <lom:date>\n';
        xml += `              <lom:dateTime>${metadata.created.toISOString()}</lom:dateTime>\n`;
        xml += '            </lom:date>\n';
      }

      xml += '          </lom:contribute>\n';
    }

    xml += '        </lom:lifeCycle>\n';
    return xml;
  }

  /**
   * Build Educational section
   */
  private static buildEducationalSection(metadata: QuestionMetadata): string {
    let xml = '        <lom:educational>\n';

    // Interactivity Type
    if (metadata.interactivityType) {
      xml += '          <lom:interactivityType>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += `            <lom:value>${metadata.interactivityType}</lom:value>\n`;
      xml += '          </lom:interactivityType>\n';
    }

    // Learning Resource Type (always "assessment item")
    xml += '          <lom:learningResourceType>\n';
    xml += '            <lom:source>LOMv1.0</lom:source>\n';
    xml += '            <lom:value>assessment item</lom:value>\n';
    xml += '          </lom:learningResourceType>\n';

    // Interactivity Level
    if (metadata.interactivityLevel) {
      xml += '          <lom:interactivityLevel>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += `            <lom:value>${metadata.interactivityLevel}</lom:value>\n`;
      xml += '          </lom:interactivityLevel>\n';
    }

    // Difficulty
    if (metadata.difficulty) {
      xml += '          <lom:difficulty>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += `            <lom:value>${this.normalizeDifficulty(metadata.difficulty)}</lom:value>\n`;
      xml += '          </lom:difficulty>\n';
    }

    // Typical Learning Time
    if (metadata.typicalLearningTime) {
      const duration = this.secondsToISO8601Duration(metadata.typicalLearningTime);
      xml += '          <lom:typicalLearningTime>\n';
      xml += `            <lom:duration>${duration}</lom:duration>\n`;
      xml += '          </lom:typicalLearningTime>\n';
    }

    // Learning Objective (as description)
    if (metadata.learningObjective) {
      xml += '          <lom:description>\n';
      xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.learningObjective)}</lom:string>\n`;
      xml += '          </lom:description>\n';
    }

    // Context (Grade Level)
    if (metadata.gradeLevel) {
      xml += '          <lom:context>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += `            <lom:value>${this.escapeXml(metadata.gradeLevel)}</lom:value>\n`;
      xml += '          </lom:context>\n';
    }

    xml += '        </lom:educational>\n';
    return xml;
  }

  /**
   * Build Classification section
   */
  private static buildClassificationSection(metadata: QuestionMetadata): string {
    let xml = '';

    // Subject classification
    if (metadata.subject) {
      xml += '        <lom:classification>\n';
      xml += '          <lom:purpose>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += '            <lom:value>discipline</lom:value>\n';
      xml += '          </lom:purpose>\n';
      xml += '          <lom:taxonPath>\n';
      xml += '            <lom:source>\n';
      xml += `              <lom:string language="${metadata.language || 'en'}">Subject</lom:string>\n`;
      xml += '            </lom:source>\n';
      xml += '            <lom:taxon>\n';
      xml += `              <lom:id>${this.escapeXml(metadata.subject)}</lom:id>\n`;
      xml += '              <lom:entry>\n';
      xml += `                <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.subject)}</lom:string>\n`;
      xml += '              </lom:entry>\n';
      
      // Topic as child taxon
      if (metadata.topic) {
        xml += '              <lom:taxon>\n';
        xml += `                <lom:id>${this.escapeXml(metadata.topic)}</lom:id>\n`;
        xml += '                <lom:entry>\n';
        xml += `                  <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.topic)}</lom:string>\n`;
        xml += '                </lom:entry>\n';
        
        // Subtopic as grandchild
        if (metadata.subtopic) {
          xml += '                <lom:taxon>\n';
          xml += `                  <lom:id>${this.escapeXml(metadata.subtopic)}</lom:id>\n`;
          xml += '                  <lom:entry>\n';
          xml += `                    <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.subtopic)}</lom:string>\n`;
          xml += '                  </lom:entry>\n';
          xml += '                </lom:taxon>\n';
        }
        
        xml += '              </lom:taxon>\n';
      }
      
      xml += '            </lom:taxon>\n';
      xml += '          </lom:taxonPath>\n';
      xml += '        </lom:classification>\n';
    }

    // Curriculum/Standard classification
    if (metadata.curriculum || metadata.standard) {
      xml += '        <lom:classification>\n';
      xml += '          <lom:purpose>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += '            <lom:value>educational objective</lom:value>\n';
      xml += '          </lom:purpose>\n';
      
      if (metadata.curriculum) {
        xml += '          <lom:description>\n';
        xml += `            <lom:string language="${metadata.language || 'en'}">Curriculum: ${this.escapeXml(metadata.curriculum)}</lom:string>\n`;
        xml += '          </lom:description>\n';
      }
      
      if (metadata.standard) {
        xml += '          <lom:keyword>\n';
        xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.standard)}</lom:string>\n`;
        xml += '          </lom:keyword>\n';
      }
      
      xml += '        </lom:classification>\n';
    }

    // Bloom's Taxonomy
    if (metadata.bloomLevel) {
      xml += '        <lom:classification>\n';
      xml += '          <lom:purpose>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += '            <lom:value>educational level</lom:value>\n';
      xml += '          </lom:purpose>\n';
      xml += '          <lom:taxonPath>\n';
      xml += '            <lom:source>\n';
      xml += `              <lom:string language="${metadata.language || 'en'}">Bloom\'s Taxonomy</lom:string>\n`;
      xml += '            </lom:source>\n';
      xml += '            <lom:taxon>\n';
      xml += `              <lom:id>${this.escapeXml(metadata.bloomLevel)}</lom:id>\n`;
      xml += '              <lom:entry>\n';
      xml += `                <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.bloomLevel)}</lom:string>\n`;
      xml += '              </lom:entry>\n';
      xml += '            </lom:taxon>\n';
      xml += '          </lom:taxonPath>\n';
      xml += '        </lom:classification>\n';
    }

    return xml;
  }

  /**
   * Build Rights section
   */
  private static buildRightsSection(metadata: QuestionMetadata): string {
    let xml = '        <lom:rights>\n';

    // Copyright
    if (metadata.copyrightNotice) {
      xml += '          <lom:copyrightAndOtherRestrictions>\n';
      xml += '            <lom:source>LOMv1.0</lom:source>\n';
      xml += '            <lom:value>yes</lom:value>\n';
      xml += '          </lom:copyrightAndOtherRestrictions>\n';
      xml += '          <lom:description>\n';
      xml += `            <lom:string language="${metadata.language || 'en'}">${this.escapeXml(metadata.copyrightNotice)}</lom:string>\n`;
      xml += '          </lom:description>\n';
    }

    // License
    if (metadata.license) {
      xml += '          <lom:description>\n';
      xml += `            <lom:string language="${metadata.language || 'en'}">License: ${this.escapeXml(metadata.license)}</lom:string>\n`;
      xml += '          </lom:description>\n';
    }

    xml += '        </lom:rights>\n';
    return xml;
  }

  /**
   * Check if general metadata exists
   */
  private static hasGeneralMetadata(metadata: QuestionMetadata): boolean {
    return !!(
      metadata.identifier ||
      metadata.title ||
      metadata.description ||
      metadata.keywords ||
      metadata.tags
    );
  }

  /**
   * Check if educational metadata exists
   */
  private static hasEducationalMetadata(metadata: QuestionMetadata): boolean {
    return !!(
      metadata.difficulty ||
      metadata.learningObjective ||
      metadata.typicalLearningTime ||
      metadata.interactivityLevel ||
      metadata.interactivityType ||
      metadata.gradeLevel
    );
  }

  /**
   * Check if classification metadata exists
   */
  private static hasClassificationMetadata(metadata: QuestionMetadata): boolean {
    return !!(
      metadata.subject ||
      metadata.topic ||
      metadata.subtopic ||
      metadata.curriculum ||
      metadata.standard ||
      metadata.bloomLevel
    );
  }

  /**
   * Normalize difficulty value
   */
  private static normalizeDifficulty(difficulty: string): string {
    const normalized = difficulty.toLowerCase();
    const mapping: Record<string, string> = {
      'easy': 'very easy',
      'medium': 'medium',
      'hard': 'very difficult',
      'very easy': 'very easy',
      'very difficult': 'very difficult',
    };
    return mapping[normalized] || normalized;
  }

  /**
   * Convert seconds to ISO 8601 duration
   */
  private static secondsToISO8601Duration(seconds: number): string {
    if (seconds < 60) {
      return `PT${seconds}S`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `PT${minutes}M`;
    }
    return `PT${minutes}M${remainingSeconds}S`;
  }

  /**
   * Escape XML special characters
   */
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Extract metadata from Excel question row
   */
  static fromExcelRow(row: any): QuestionMetadata {
    return {
      identifier: row.id || row.identifier,
      title: row.question || row.title,
      
      // Educational
      subject: row.subject || row.Subject,
      topic: row.topic || row.Topic,
      subtopic: row.subtopic || row.Subtopic,
      difficulty: row.difficulty || row.Difficulty,
      learningObjective: row.learningObjective || row['Learning Objective'],
      bloomLevel: row.bloomLevel || row['Bloom Level'] || row.bloom,
      
      // Classification
      gradeLevel: row.gradeLevel || row['Grade Level'] || row.grade,
      curriculum: row.curriculum || row.Curriculum,
      standard: row.standard || row.Standard,
      
      // Content
      keywords: this.parseStringArray(row.keywords || row.Keywords),
      tags: this.parseStringArray(row.tags || row.Tags),
      description: row.description || row.Description,
      
      // Technical
      author: row.author || row.Author,
      organization: row.organization || row.Organization,
      version: row.version || row.Version,
      
      // Time
      typicalLearningTime: this.parseTime(row.timeLimit || row.typicalTime),
      
      // Rights
      copyrightNotice: row.copyright || row.Copyright,
      license: row.license || row.License,
    };
  }

  /**
   * Parse string array from various formats
   */
  private static parseStringArray(value: any): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      // Try different delimiters
      if (value.includes(',')) {
        return value.split(',').map(s => s.trim()).filter(s => s);
      }
      if (value.includes(';')) {
        return value.split(';').map(s => s.trim()).filter(s => s);
      }
      if (value.includes('|')) {
        return value.split('|').map(s => s.trim()).filter(s => s);
      }
      return [value.trim()];
    }
    return undefined;
  }

  /**
   * Parse time value (could be seconds, minutes, or string)
   */
  private static parseTime(value: any): number | undefined {
    if (!value) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      if (!isNaN(num)) return num;
    }
    return undefined;
  }
}

/**
 * Helper function to extract and map metadata
 */
export function extractMetadata(source: any): QuestionMetadata {
  return MetadataMapper.fromExcelRow(source);
}

/**
 * Helper function to convert metadata to QTI XML
 */
export function metadataToXML(metadata: QuestionMetadata): string {
  const qtiMetadata = MetadataMapper.toQTIMetadata(metadata);
  return qtiMetadata.lomXML || '';
}
