/**
 * QTI 3.0 Text Entry Item Builder
 * Generates valid QTI 3.0 assessment items for short answer questions
 */

import {
  ItemBuilderInput,
  ItemBuilderOutput,
  QTIAssessmentItem,
  ResponseDeclaration,
  OutcomeDeclaration,
  TextEntryInteraction,
} from './types';
import { ResponseProcessingBuilder } from './responseProcessingBuilder';
import { OutcomeMapper, getOutcomesFromMetadata } from './outcomeMapper';
import { FeedbackBuilder, createFeedbackFromQuestion } from './feedbackBuilder';
import { MetadataMapper, extractMetadata } from './metadataMapper';
import { StimulusBuilder } from './stimulusBuilder';
import { convertTextWithMath } from '../../app/utils/mathmlConverter';

export class TextEntryItemBuilder {
  private readonly NAMESPACE = 'http://www.imsglobal.org/xsd/imsqti_v3p0';
  private readonly XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
  private readonly MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
  private readonly SCHEMA_LOCATION = 'http://www.imsglobal.org/xsd/qti/qtiv3p0/imsqti_v3p0.xsd';

  /**
   * Build text entry assessment item from Excel question
   */
  async build(input: ItemBuilderInput): Promise<ItemBuilderOutput> {
    try {
      const { questionData } = input;

      // Validate inputs
      this.validate(questionData);

      // Generate item ID
      const itemId = this.generateItemId(questionData);

      // Extract images
      const images = this.extractImages(questionData);

      // Build XML
      const item = await this.buildItem(questionData, itemId, input.imageMap);
      const xml = this.itemToXML(item);

      return {
        xml,
        itemId,
        images,
      };
    } catch (error) {
      return {
        xml: '',
        itemId: '',
        images: [],
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Validate text entry question data
   */
  private validate(question: any): void {
    if (!question.question || question.question.trim() === '') {
      throw new Error('Question text is required');
    }

    if (!question.correctAnswer || question.correctAnswer.trim() === '') {
      throw new Error('Correct answer is required');
    }
  }

  /**
   * Generate unique item identifier
   */
  private generateItemId(question: any): string {
    if (question.id) {
      return `item_${question.id}`;
    }
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract image filenames from question
   */
  private extractImages(question: any): string[] {
    const images: Set<string> = new Set();

    // Check for images array
    if (question.images && Array.isArray(question.images)) {
      question.images.forEach((img: string) => images.add(img));
    }

    // Check for image references in question text
    const imgRegex = /!\[.*?\]\((.*?)\)|src="([^"]+)"|<img[^>]+src="([^"]+)"/g;
    let match;

    while ((match = imgRegex.exec(question.question)) !== null) {
      const img = match[1] || match[2] || match[3];
      if (img) images.add(img);
    }

    return Array.from(images);
  }

  /**
   * Build complete QTI assessment item structure
   */
  private async buildItem(question: any, itemId: string, imageMap?: Map<string, string>): Promise<QTIAssessmentItem> {
    // Build response declaration
    const responseDeclaration = this.buildResponseDeclaration(question.correctAnswer);

    // Build outcome declarations with metadata
    const outcomeDeclarations = getOutcomesFromMetadata({
      points: question.points || 1,
      difficulty: question.difficulty,
    });

    // Extract metadata from question
    const metadata = extractMetadata(question);

    // Build item body with interaction
    const itemBody = await this.buildItemBody(question, imageMap);

    // Build response processing with Phase 2 builder
    const responseProcessing = {
      xml: ResponseProcessingBuilder.buildMultipleAcceptableAnswers(
        'RESPONSE',
        'SCORE',
        [question.correctAnswer],
        false // case insensitive
      ),
    };

    // Build feedbacks if explanation exists
    const feedbacks = question.explanation
      ? createFeedbackFromQuestion({ explanation: question.explanation })
      : undefined;

    return {
      identifier: itemId,
      title: this.sanitizeTitle(question.question),
      adaptive: false,
      timeDependent: false,
      responseDeclaration,
      outcomeDeclarations,
      itemBody,
      responseProcessing,
      feedbacks,
      metadata,
    };
  }

  /**
   * Build response declaration for text entry
   */
  private buildResponseDeclaration(correctAnswer: string): ResponseDeclaration {
    return {
      identifier: 'RESPONSE',
      cardinality: 'single',
      baseType: 'string',
      correctResponse: {
        values: [correctAnswer],
      },
    };
  }

  /**
   * Build outcome declarations
   * @deprecated Use OutcomeMapper from Phase 2
   */
  private buildOutcomeDeclarations(): OutcomeDeclaration[] {
    return OutcomeMapper.buildStandardOutcomes({ points: 1 });
  }

  /**
   * Build item body with question and text entry interaction (with MathML support)
   */
  private async buildItemBody(question: any, imageMap?: Map<string, string>) {
    const processedText = this.processQuestionText(question.question, imageMap);
    const questionText = await convertTextWithMath(processedText);
    const stimulusRef = StimulusBuilder.fromQuestion(question);

    const textEntryInteraction: TextEntryInteraction = {
      type: 'textEntry',
      responseIdentifier: 'RESPONSE',
      expectedLength: this.calculateExpectedLength(question.correctAnswer),
      format: 'plain',
      content: '',
    };

    return {
      content: questionText,
      interactions: [textEntryInteraction],
      stimulusRef,
    };
  }

  /**
   * Calculate expected length for text entry field
   */
  private calculateExpectedLength(answer: string): number {
    const answerLength = String(answer).length;
    return Math.max(20, Math.min(answerLength + 10, 500));
  }

  /**
   * Process question text and replace image paths
   */
  private processQuestionText(text: string, imageMap?: Map<string, string>): string {
    let processed = text;

    if (imageMap) {
      imageMap.forEach((filepath, filename) => {
        const patterns = [
          new RegExp(`!\\[.*?\\]\\(${filename}\\)`, 'gi'),
          new RegExp(`src="${filename}"`, 'gi'),
          new RegExp(`src='${filename}'`, 'gi'),
        ];

        patterns.forEach(pattern => {
          processed = processed.replace(pattern, `src="images/${filename}"`);
        });
      });
    }

    return processed;
  }

  /**
   * Build string match response processing
   * @deprecated Use ResponseProcessingBuilder from Phase 2
   */
  private buildStringMatchResponseProcessing(correctAnswer: string): string {
    return ResponseProcessingBuilder.buildMultipleAcceptableAnswers(
      'RESPONSE',
      'SCORE',
      [correctAnswer],
      false
    );
  }

  /**
   * Sanitize title
   */
  private sanitizeTitle(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .substring(0, 100)
      .trim();
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert item object to XML string
   */
  private itemToXML(item: QTIAssessmentItem): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="${this.NAMESPACE}"
  xmlns:xsi="${this.XSI_NAMESPACE}"
  xmlns:m="${this.MATHML_NAMESPACE}"
  xsi:schemaLocation="${this.NAMESPACE} ${this.SCHEMA_LOCATION}"
  identifier="${this.escapeXml(item.identifier)}"
  title="${this.escapeXml(item.title)}"
  adaptive="${item.adaptive}"
  timeDependent="${item.timeDependent}">

`;

    // Add metadata if available
    if (item.metadata) {
      const metadata = MetadataMapper.toQTIMetadata(item.metadata);
      if (metadata.lomXML) {
        xml += metadata.lomXML;
        xml += '\n';
      }
    }

    // Add response declaration
    xml += this.responseDeclarationToXML(item.responseDeclaration);
    xml += '\n\n';

    // Add outcome declarations
    item.outcomeDeclarations.forEach(od => {
      xml += this.outcomeDeclarationToXML(od);
      xml += '\n';
    });
    xml += '\n';

    // Add item body
    xml += this.itemBodyToXML(item.itemBody);
    xml += '\n\n';

    // Add response processing
    xml += item.responseProcessing.xml || item.responseProcessing.template;
    xml += '\n';

    xml += '</assessmentItem>';

    return xml;
  }

  /**
   * Response declaration to XML
   */
  private responseDeclarationToXML(rd: ResponseDeclaration): string {
    let xml = `  <responseDeclaration
    identifier="${rd.identifier}"
    cardinality="${rd.cardinality}"
    baseType="${rd.baseType}">`;

    if (rd.correctResponse) {
      xml += '\n    <correctResponse>';
      rd.correctResponse.values.forEach(value => {
        xml += `\n      <value>${this.escapeXml(value)}</value>`;
      });
      xml += '\n    </correctResponse>';
    }

    xml += '\n  </responseDeclaration>';
    return xml;
  }

  /**
   * Outcome declaration to XML
   */
  private outcomeDeclarationToXML(od: OutcomeDeclaration): string {
    let xml = `  <outcomeDeclaration
    identifier="${od.identifier}"
    cardinality="${od.cardinality}"
    baseType="${od.baseType}">`;

    if (od.defaultValue !== undefined) {
      xml += `\n    <defaultValue>\n      <value>${od.defaultValue}</value>\n    </defaultValue>`;
    }

    xml += '\n  </outcomeDeclaration>';
    return xml;
  }

  /**
   * Item body to XML (with MathML support)
   */
  private itemBodyToXML(itemBody: any): string {
    let xml = '  <itemBody>\n    <div>';

    if (itemBody.stimulusRef) {
      xml += `\n${StimulusBuilder.buildReference(itemBody.stimulusRef)}`;
    }

    // Add question text (already contains converted MathML)
    xml += `\n      <p>${itemBody.content}</p>`;

    // Add text entry interaction
    const interaction = itemBody.interactions[0] as TextEntryInteraction;
    if (interaction) {
      xml += `\n      <textEntryInteraction responseIdentifier="${interaction.responseIdentifier}" expectedLength="${interaction.expectedLength}">`;
      xml += '\n        <prompt>Enter your answer:</prompt>';
      xml += '\n      </textEntryInteraction>';
    }

    xml += '\n    </div>\n  </itemBody>';
    return xml;
  }
}

export function createTextEntryBuilder() {
  return new TextEntryItemBuilder();
}
