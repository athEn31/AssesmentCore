/**
 * QTI 3.0 Test Builder
 * Generates assessmentTest.xml files with proper hierarchy
 */

import {
  AssessmentTest,
  TestPart,
  AssessmentSection,
  AssessmentItemRef,
  TestBuildConfig,
  TestItemConfig,
  SectionConfig,
  TestOutcomeDeclaration,
  OutcomeProcessing,
  ItemSessionControl,
  TimeLimits,
  VariableMapping,
} from './testStructure';

/**
 * Test Builder Class
 * Creates QTI 3.0 assessment test structures
 */
export class TestBuilder {
  private config: TestBuildConfig;

  constructor(config: TestBuildConfig) {
    this.config = config;
  }

  /**
   * Build complete assessment test structure
   */
  build(): AssessmentTest {
    const test: AssessmentTest = {
      identifier: this.config.testIdentifier,
      title: this.config.testTitle,
      toolName: this.config.toolName || 'AC Question Bank',
      toolVersion: this.config.toolVersion || '1.0.0',
      outcomeDeclarations: this.buildOutcomeDeclarations(),
      testParts: this.buildTestParts(),
      outcomeProcessing: this.config.aggregateScores ? this.buildOutcomeProcessing() : undefined,
      timeLimits: this.config.timeLimits,
    };

    return test;
  }

  /**
   * Build test-level outcome declarations
   */
  private buildOutcomeDeclarations(): TestOutcomeDeclaration[] {
    const outcomes: TestOutcomeDeclaration[] = [];

    // Total score outcome
    outcomes.push({
      identifier: 'TOTAL_SCORE',
      cardinality: 'single',
      baseType: 'float',
      defaultValue: 0,
      normalMaximum: this.calculateMaxScore(),
      normalMinimum: 0,
    });

    // Pass/fail outcome
    outcomes.push({
      identifier: 'PASS',
      cardinality: 'single',
      baseType: 'boolean',
      defaultValue: false,
    });

    // Number completed
    outcomes.push({
      identifier: 'NUM_COMPLETED',
      cardinality: 'single',
      baseType: 'integer',
      defaultValue: 0,
    });

    // Percentage score
    if (this.config.normalizeScores) {
      outcomes.push({
        identifier: 'PERCENT_SCORE',
        cardinality: 'single',
        baseType: 'float',
        defaultValue: 0,
        normalMaximum: 100,
        normalMinimum: 0,
      });
    }

    return outcomes;
  }

  /**
   * Calculate maximum possible score
   */
  private calculateMaxScore(): number {
    return this.config.items.reduce((sum, item) => {
      const weight = item.weight || 1;
      return sum + weight;
    }, 0);
  }

  /**
   * Build test parts
   */
  private buildTestParts(): TestPart[] {
    const navigationMode = this.config.navigationMode || 'linear';
    const submissionMode = this.config.submissionMode || 'individual';

    const testPart: TestPart = {
      identifier: 'PART_1',
      navigationMode,
      submissionMode,
      itemSessionControl: this.buildItemSessionControl(),
      assessmentSections: this.buildAssessmentSections(),
      timeLimits: this.config.timeLimits,
    };

    return [testPart];
  }

  /**
   * Build item session control
   */
  private buildItemSessionControl(): ItemSessionControl {
    return {
      maxAttempts: this.config.maxAttempts || 1,
      showFeedback: this.config.showFeedback !== false,
      allowReview: this.config.allowReview !== false,
      showSolution: this.config.showSolution !== false,
      allowSkipping: true,
      validateResponses: false,
    };
  }

  /**
   * Build assessment sections based on grouping strategy
   */
  private buildAssessmentSections(): AssessmentSection[] {
    const strategy = this.config.groupingStrategy || 'single-section';

    switch (strategy) {
      case 'single-section':
        return [this.buildSingleSection()];
      
      case 'by-category':
        return this.buildSectionsByCategory();
      
      case 'by-difficulty':
        return this.buildSectionsByDifficulty();
      
      case 'custom':
        return this.buildCustomSections();
      
      default:
        return [this.buildSingleSection()];
    }
  }

  /**
   * Build single section with all items
   */
  private buildSingleSection(): AssessmentSection {
    return {
      identifier: 'SECTION_1',
      title: 'All Questions',
      visible: true,
      assessmentItemRefs: this.config.items.map(item => this.buildItemRef(item)),
      ordering: this.config.shuffle ? { shuffle: true } : undefined,
    };
  }

  /**
   * Build sections grouped by category
   */
  private buildSectionsByCategory(): AssessmentSection[] {
    const categorizedItems = new Map<string, TestItemConfig[]>();

    // Group items by category
    this.config.items.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!categorizedItems.has(category)) {
        categorizedItems.set(category, []);
      }
      categorizedItems.get(category)!.push(item);
    });

    // Create section for each category
    const sections: AssessmentSection[] = [];
    let sectionIndex = 1;

    categorizedItems.forEach((items, category) => {
      sections.push({
        identifier: `SECTION_${sectionIndex}`,
        title: category,
        visible: true,
        assessmentItemRefs: items.map(item => this.buildItemRef(item)),
        ordering: this.config.shuffle ? { shuffle: true } : undefined,
      });
      sectionIndex++;
    });

    return sections;
  }

  /**
   * Build sections grouped by difficulty
   */
  private buildSectionsByDifficulty(): AssessmentSection[] {
    const difficulties = ['Easy', 'Medium', 'Hard'];
    const sections: AssessmentSection[] = [];

    difficulties.forEach((difficulty, index) => {
      const items = this.config.items.filter(item => 
        item.category?.toLowerCase() === difficulty.toLowerCase()
      );

      if (items.length > 0) {
        sections.push({
          identifier: `SECTION_${index + 1}`,
          title: `${difficulty} Questions`,
          visible: true,
          assessmentItemRefs: items.map(item => this.buildItemRef(item)),
          ordering: this.config.shuffle ? { shuffle: true } : undefined,
        });
      }
    });

    return sections;
  }

  /**
   * Build custom sections from configuration
   */
  private buildCustomSections(): AssessmentSection[] {
    if (!this.config.customSections || this.config.customSections.length === 0) {
      return [this.buildSingleSection()];
    }

    return this.config.customSections.map(sectionConfig => {
      const items = this.config.items.filter(item =>
        sectionConfig.itemIdentifiers.includes(item.itemIdentifier)
      );

      return {
        identifier: sectionConfig.identifier,
        title: sectionConfig.title,
        visible: true,
        assessmentItemRefs: items.map(item => this.buildItemRef(item)),
        ordering: sectionConfig.shuffle ? { shuffle: true } : undefined,
        timeLimits: sectionConfig.timeLimits,
        rubricBlocks: sectionConfig.rubric ? [{
          view: 'candidate',
          content: sectionConfig.rubric,
        }] : undefined,
      };
    });
  }

  /**
   * Build assessment item reference
   */
  private buildItemRef(item: TestItemConfig): AssessmentItemRef {
    const itemRef: AssessmentItemRef = {
      identifier: item.itemIdentifier,
      href: item.itemHref,
      title: item.title,
      category: item.category ? [item.category] : undefined,
      required: item.required,
      weight: item.weight,
      maxAttempts: item.maxAttempts,
      timeLimit: item.timeLimit,
      variableMappings: this.buildVariableMappings(item),
    };

    return itemRef;
  }

  /**
   * Build variable mappings for item
   */
  private buildVariableMappings(item: TestItemConfig): VariableMapping[] {
    const mappings: VariableMapping[] = [];

    // Map SCORE to TOTAL_SCORE with weight
    mappings.push({
      sourceIdentifier: 'SCORE',
      targetIdentifier: 'TOTAL_SCORE',
      transform: item.weight && item.weight !== 1 ? 'multiply' : 'identity',
      transformValue: item.weight,
    });

    return mappings;
  }

  /**
   * Build outcome processing (score aggregation)
   */
  private buildOutcomeProcessing(): OutcomeProcessing {
    // Note: In practice, QTI 3.0 outcome processing uses complex XML expressions
    // For now, we rely on variable mappings to sum scores automatically
    // Custom logic would be added here for complex scoring scenarios
    
    return {
      outcomeRules: [
        {
          type: 'setOutcomeValue',
          identifier: 'PASS',
          expression: 'gte(variable(TOTAL_SCORE), multiply(variable(TOTAL_SCORE.max), 0.6))',
        },
      ],
    };
  }

  /**
   * Convert test structure to XML
   */
  toXML(): string {
    const test = this.build();
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<qti-assessment-test\n';
    xml += '  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"\n';
    xml += '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd"\n';
    xml += `  identifier="${this.escapeXml(test.identifier)}"\n`;
    xml += `  title="${this.escapeXml(test.title)}"\n`;
    if (test.toolName) {
      xml += `  tool-name="${this.escapeXml(test.toolName)}"\n`;
    }
    if (test.toolVersion) {
      xml += `  tool-version="${this.escapeXml(test.toolVersion)}"\n`;
    }
    xml += '>\n';

    // Outcome declarations
    if (test.outcomeDeclarations && test.outcomeDeclarations.length > 0) {
      xml += this.outcomeDeclarationsToXML(test.outcomeDeclarations);
    }

    // Time limits (test level)
    if (test.timeLimits) {
      xml += this.timeLimitsToXML(test.timeLimits);
    }

    // Test parts
    test.testParts.forEach(testPart => {
      xml += this.testPartToXML(testPart);
    });

    // Outcome processing
    if (test.outcomeProcessing) {
      xml += this.outcomeProcessingToXML(test.outcomeProcessing);
    }

    xml += '</qti-assessment-test>\n';
    return xml;
  }

  /**
   * Convert outcome declarations to XML
   */
  private outcomeDeclarationsToXML(declarations: TestOutcomeDeclaration[]): string {
    let xml = '';
    declarations.forEach(decl => {
      xml += '  <qti-outcome-declaration';
      xml += ` identifier="${this.escapeXml(decl.identifier)}"`;
      xml += ` cardinality="${decl.cardinality}"`;
      if (decl.baseType) {
        xml += ` base-type="${decl.baseType}"`;
      }
      if (decl.normalMaximum !== undefined) {
        xml += ` normal-maximum="${decl.normalMaximum}"`;
      }
      if (decl.normalMinimum !== undefined) {
        xml += ` normal-minimum="${decl.normalMinimum}"`;
      }
      xml += '>\n';

      // Default value
      if (decl.defaultValue !== undefined) {
        xml += '    <qti-default-value>\n';
        xml += `      <qti-value>${this.escapeXml(String(decl.defaultValue))}</qti-value>\n`;
        xml += '    </qti-default-value>\n';
      }

      xml += '  </qti-outcome-declaration>\n';
    });
    return xml;
  }

  /**
   * Convert time limits to XML
   */
  private timeLimitsToXML(timeLimits: TimeLimits, indent: string = '  '): string {
    let xml = `${indent}<qti-time-limits`;
    if (timeLimits.minTime !== undefined) {
      xml += ` min-time="${timeLimits.minTime}"`;
    }
    if (timeLimits.maxTime !== undefined) {
      xml += ` max-time="${timeLimits.maxTime}"`;
    }
    if (timeLimits.allowLateSubmission !== undefined) {
      xml += ` allow-late-submission="${timeLimits.allowLateSubmission}"`;
    }
    xml += ' />\n';
    return xml;
  }

  /**
   * Convert test part to XML
   */
  private testPartToXML(testPart: TestPart): string {
    let xml = '  <qti-test-part';
    xml += ` identifier="${this.escapeXml(testPart.identifier)}"`;
    xml += ` navigation-mode="${testPart.navigationMode}"`;
    xml += ` submission-mode="${testPart.submissionMode}"`;
    xml += '>\n';

    // Item session control
    if (testPart.itemSessionControl) {
      xml += this.itemSessionControlToXML(testPart.itemSessionControl);
    }

    // Time limits
    if (testPart.timeLimits) {
      xml += this.timeLimitsToXML(testPart.timeLimits, '    ');
    }

    // Assessment sections
    testPart.assessmentSections.forEach(section => {
      xml += this.assessmentSectionToXML(section);
    });

    xml += '  </qti-test-part>\n';
    return xml;
  }

  /**
   * Convert item session control to XML
   */
  private itemSessionControlToXML(control: ItemSessionControl): string {
    let xml = '    <qti-item-session-control';
    if (control.maxAttempts !== undefined) {
      xml += ` max-attempts="${control.maxAttempts}"`;
    }
    if (control.showFeedback !== undefined) {
      xml += ` show-feedback="${control.showFeedback}"`;
    }
    if (control.allowReview !== undefined) {
      xml += ` allow-review="${control.allowReview}"`;
    }
    if (control.showSolution !== undefined) {
      xml += ` show-solution="${control.showSolution}"`;
    }
    if (control.allowSkipping !== undefined) {
      xml += ` allow-skipping="${control.allowSkipping}"`;
    }
    if (control.validateResponses !== undefined) {
      xml += ` validate-responses="${control.validateResponses}"`;
    }
    xml += ' />\n';
    return xml;
  }

  /**
   * Convert assessment section to XML
   */
  private assessmentSectionToXML(section: AssessmentSection, indent: string = '    '): string {
    let xml = `${indent}<qti-assessment-section`;
    xml += ` identifier="${this.escapeXml(section.identifier)}"`;
    xml += ` title="${this.escapeXml(section.title)}"`;
    if (section.visible !== undefined) {
      xml += ` visible="${section.visible}"`;
    }
    xml += '>\n';

    // Rubric blocks
    if (section.rubricBlocks && section.rubricBlocks.length > 0) {
      section.rubricBlocks.forEach(rubric => {
        xml += `${indent}  <qti-rubric-block view="${rubric.view || 'candidate'}">\n`;
        xml += `${indent}    ${rubric.content}\n`;
        xml += `${indent}  </qti-rubric-block>\n`;
      });
    }

    // Ordering
    if (section.ordering) {
      xml += `${indent}  <qti-ordering shuffle="${section.ordering.shuffle}" />\n`;
    }

    // Time limits
    if (section.timeLimits) {
      xml += this.timeLimitsToXML(section.timeLimits, indent + '  ');
    }

    // Item references
    section.assessmentItemRefs.forEach(itemRef => {
      xml += this.assessmentItemRefToXML(itemRef, indent + '  ');
    });

    // Nested sections
    if (section.assessmentSections && section.assessmentSections.length > 0) {
      section.assessmentSections.forEach(nestedSection => {
        xml += this.assessmentSectionToXML(nestedSection, indent + '  ');
      });
    }

    xml += `${indent}</qti-assessment-section>\n`;
    return xml;
  }

  /**
   * Convert assessment item ref to XML
   */
  private assessmentItemRefToXML(itemRef: AssessmentItemRef, indent: string): string {
    let xml = `${indent}<qti-assessment-item-ref`;
    xml += ` identifier="${this.escapeXml(itemRef.identifier)}"`;
    xml += ` href="${this.escapeXml(itemRef.href)}"`;
    if (itemRef.title) {
      xml += ` title="${this.escapeXml(itemRef.title)}"`;
    }
    if (itemRef.required !== undefined) {
      xml += ` required="${itemRef.required}"`;
    }
    if (itemRef.fixed !== undefined) {
      xml += ` fixed="${itemRef.fixed}"`;
    }

    // Self-closing or with children
    if (!itemRef.variableMappings || itemRef.variableMappings.length === 0) {
      xml += ' />\n';
    } else {
      xml += '>\n';
      
      // Variable mappings
      itemRef.variableMappings.forEach(mapping => {
        xml += `${indent}  <qti-variable-mapping`;
        xml += ` source-identifier="${this.escapeXml(mapping.sourceIdentifier)}"`;
        xml += ` target-identifier="${this.escapeXml(mapping.targetIdentifier)}"`;
        xml += ' />\n';
      });

      xml += `${indent}</qti-assessment-item-ref>\n`;
    }

    return xml;
  }

  /**
   * Convert outcome processing to XML
   */
  private outcomeProcessingToXML(processing: OutcomeProcessing): string {
    let xml = '  <qti-outcome-processing>\n';
    
    // Simple pass/fail logic
    xml += '    <qti-set-outcome-value identifier="PASS">\n';
    xml += '      <qti-gte>\n';
    xml += '        <qti-variable identifier="TOTAL_SCORE" />\n';
    xml += '        <qti-product>\n';
    xml += '          <qti-variable identifier="TOTAL_SCORE" property="normalMaximum" />\n';
    xml += '          <qti-base-value base-type="float">0.6</qti-base-value>\n';
    xml += '        </qti-product>\n';
    xml += '      </qti-gte>\n';
    xml += '    </qti-set-outcome-value>\n';

    // Calculate percentage if needed
    if (this.config.normalizeScores) {
      xml += '    <qti-set-outcome-value identifier="PERCENT_SCORE">\n';
      xml += '      <qti-product>\n';
      xml += '        <qti-divide>\n';
      xml += '          <qti-variable identifier="TOTAL_SCORE" />\n';
      xml += '          <qti-variable identifier="TOTAL_SCORE" property="normalMaximum" />\n';
      xml += '        </qti-divide>\n';
      xml += '        <qti-base-value base-type="float">100</qti-base-value>\n';
      xml += '      </qti-product>\n';
      xml += '    </qti-set-outcome-value>\n';
    }

    xml += '  </qti-outcome-processing>\n';
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
}

/**
 * Helper function to create test builder
 */
export function createTestBuilder(config: TestBuildConfig): TestBuilder {
  return new TestBuilder(config);
}

/**
 * Quick build function
 */
export function buildAssessmentTest(config: TestBuildConfig): string {
  const builder = new TestBuilder(config);
  return builder.toXML();
}
