/**
 * Response Processing Builder
 * Creates QTI 3.0 compliant response processing logic
 */

/**
 * Response Processing Template Types
 */
export type ResponseProcessingTemplate = 
  | 'match_correct'        // Exact match - all or nothing
  | 'map_response'         // Map response values to scores
  | 'map_response_point'   // Map with point interpolation
  | 'custom';              // Custom processing logic

/**
 * Response Processing Configuration
 */
export interface ResponseProcessingConfig {
  template: ResponseProcessingTemplate;
  responseIdentifier?: string;
  outcomeIdentifier?: string;
  customLogic?: string; // Custom XML if template is 'custom'
  caseSensitive?: boolean; // For string matching
  partialCredit?: PartialCreditConfig[];
}

/**
 * Partial Credit Configuration
 */
export interface PartialCreditConfig {
  value: string; // Response value
  score: number; // Points awarded
  condition?: string; // Optional condition
}

/**
 * Response Processing Builder Class
 */
export class ResponseProcessingBuilder {
  /**
   * Build response processing XML based on configuration
   */
  static build(config: ResponseProcessingConfig): string {
    switch (config.template) {
      case 'match_correct':
        return this.buildMatchCorrect(config);
      case 'map_response':
        return this.buildMapResponse(config);
      case 'map_response_point':
        return this.buildMapResponsePoint(config);
      case 'custom':
        return config.customLogic || '';
      default:
        throw new Error(`Unknown template: ${config.template}`);
    }
  }

  /**
   * Build match_correct template
   * Standard template for exact match scoring
   */
  public static buildMatchCorrect(config: ResponseProcessingConfig): string {
    const responseId = config.responseIdentifier || 'RESPONSE';
    const outcomeId = config.outcomeIdentifier || 'SCORE';

    return `  <responseProcessing template="http://www.imsglobal.org/question/qti_v3p0/rptemplates/match_correct" />`;
  }

  /**
   * Build map_response template
   * Maps specific response values to scores
   */
  public static buildMapResponse(config: ResponseProcessingConfig): string {
    const responseId = config.responseIdentifier || 'RESPONSE';
    const outcomeId = config.outcomeIdentifier || 'SCORE';

    return `  <responseProcessing template="http://www.imsglobal.org/question/qti_v3p0/rptemplates/map_response" />`;
  }

  /**
   * Build map_response_point template
   * Maps with point interpolation
   */
  public static buildMapResponsePoint(config: ResponseProcessingConfig): string {
    return `  <responseProcessing template="http://www.imsglobal.org/question/qti_v3p0/rptemplates/map_response_point" />`;
  }

  /**
   * Build custom response processing with partial credit
   */
  static buildWithPartialCredit(
    responseIdentifier: string,
    outcomeIdentifier: string,
    correctAnswer: string,
    partialCredit: PartialCreditConfig[],
    baseType: 'identifier' | 'string' = 'identifier'
  ): string {
    let xml = '  <responseProcessing>\n';
    xml += '    <responseCondition>\n';

    // Full credit condition
    xml += '      <responseIf>\n';
    if (baseType === 'string') {
      xml += `        <stringMatch caseSensitive="false">\n`;
    } else {
      xml += `        <match>\n`;
    }
    xml += `          <variable identifier="${responseIdentifier}" />\n`;
    xml += `          <baseValue baseType="${baseType}">${this.escapeXml(correctAnswer)}</baseValue>\n`;
    if (baseType === 'string') {
      xml += `        </stringMatch>\n`;
    } else {
      xml += `        </match>\n`;
    }
    xml += `        <setOutcomeValue identifier="${outcomeIdentifier}">\n`;
    xml += `          <baseValue baseType="float">1.0</baseValue>\n`;
    xml += `        </setOutcomeValue>\n`;
    xml += '      </responseIf>\n';

    // Partial credit conditions
    partialCredit.forEach(pc => {
      xml += '      <responseElseIf>\n';
      if (baseType === 'string') {
        xml += `        <stringMatch caseSensitive="false">\n`;
      } else {
        xml += `        <match>\n`;
      }
      xml += `          <variable identifier="${responseIdentifier}" />\n`;
      xml += `          <baseValue baseType="${baseType}">${this.escapeXml(pc.value)}</baseValue>\n`;
      if (baseType === 'string') {
        xml += `        </stringMatch>\n`;
      } else {
        xml += `        </match>\n`;
      }
      xml += `        <setOutcomeValue identifier="${outcomeIdentifier}">\n`;
      xml += `          <baseValue baseType="float">${pc.score}</baseValue>\n`;
      xml += `        </setOutcomeValue>\n`;
      xml += '      </responseElseIf>\n';
    });

    // Default: no credit
    xml += '      <responseElse>\n';
    xml += `        <setOutcomeValue identifier="${outcomeIdentifier}">\n`;
    xml += `          <baseValue baseType="float">0</baseValue>\n`;
    xml += `        </setOutcomeValue>\n`;
    xml += '      </responseElse>\n';

    xml += '    </responseCondition>\n';
    xml += '  </responseProcessing>';

    return xml;
  }

  /**
   * Build string match response processing with multiple acceptable answers
   */
  static buildMultipleAcceptableAnswers(
    responseIdentifier: string,
    outcomeIdentifier: string,
    acceptableAnswers: string[],
    caseSensitive: boolean = false
  ): string {
    let xml = '  <responseProcessing>\n';
    xml += '    <responseCondition>\n';
    xml += '      <responseIf>\n';

    if (acceptableAnswers.length === 1) {
      // Single answer - simple match
      xml += `        <stringMatch caseSensitive="${caseSensitive}">\n`;
      xml += `          <variable identifier="${responseIdentifier}" />\n`;
      xml += `          <baseValue baseType="string">${this.escapeXml(acceptableAnswers[0])}</baseValue>\n`;
      xml += `        </stringMatch>\n`;
    } else {
      // Multiple acceptable answers - OR condition
      xml += '        <or>\n';
      acceptableAnswers.forEach(answer => {
        xml += `          <stringMatch caseSensitive="${caseSensitive}">\n`;
        xml += `            <variable identifier="${responseIdentifier}" />\n`;
        xml += `            <baseValue baseType="string">${this.escapeXml(answer)}</baseValue>\n`;
        xml += `          </stringMatch>\n`;
      });
      xml += '        </or>\n';
    }

    xml += `        <setOutcomeValue identifier="${outcomeIdentifier}">\n`;
    xml += `          <baseValue baseType="float">1.0</baseValue>\n`;
    xml += `        </setOutcomeValue>\n`;
    xml += '      </responseIf>\n';

    xml += '      <responseElse>\n';
    xml += `        <setOutcomeValue identifier="${outcomeIdentifier}">\n`;
    xml += `          <baseValue baseType="float">0</baseValue>\n`;
    xml += `        </setOutcomeValue>\n`;
    xml += '      </responseElse>\n';

    xml += '    </responseCondition>\n';
    xml += '  </responseProcessing>';

    return xml;
  }

  /**
   * Build pattern match response processing (for regex matching)
   */
  static buildPatternMatch(
    responseIdentifier: string,
    outcomeIdentifier: string,
    pattern: string
  ): string {
    return `  <responseProcessing>
    <responseCondition>
      <responseIf>
        <patternMatch pattern="${this.escapeXml(pattern)}">
          <variable identifier="${responseIdentifier}" />
        </patternMatch>
        <setOutcomeValue identifier="${outcomeIdentifier}">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="${outcomeIdentifier}">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>`;
  }

  /**
   * Escape XML special characters
   */
  private static escapeXml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

/**
 * Helper function to create response processing from simple config
 */
export function createResponseProcessing(
  questionType: 'mcq' | 'textEntry',
  correctAnswer: string | string[],
  options?: {
    partialCredit?: PartialCreditConfig[];
    caseSensitive?: boolean;
    pattern?: string;
  }
): string {
  if (questionType === 'mcq') {
    // MCQ uses match_correct template
    return ResponseProcessingBuilder.buildMatchCorrect({
      template: 'match_correct',
      responseIdentifier: 'RESPONSE',
      outcomeIdentifier: 'SCORE',
    });
  } else {
    // Text entry - check for multiple acceptable answers
    const answers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];

    if (options?.pattern) {
      return ResponseProcessingBuilder.buildPatternMatch(
        'RESPONSE',
        'SCORE',
        options.pattern
      );
    }

    if (options?.partialCredit && options.partialCredit.length > 0) {
      return ResponseProcessingBuilder.buildWithPartialCredit(
        'RESPONSE',
        'SCORE',
        answers[0],
        options.partialCredit,
        'string'
      );
    }

    if (answers.length > 1) {
      return ResponseProcessingBuilder.buildMultipleAcceptableAnswers(
        'RESPONSE',
        'SCORE',
        answers,
        options?.caseSensitive || false
      );
    }

    // Simple string match
    return ResponseProcessingBuilder.buildMultipleAcceptableAnswers(
      'RESPONSE',
      'SCORE',
      answers,
      options?.caseSensitive || false
    );
  }
}
