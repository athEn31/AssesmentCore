/**
 * QTI 3.0 MCQ (Multiple Choice) Item Builder
 * Generates valid QTI 3.0 assessment items for single-choice questions
 */

import {
  ItemBuilderInput,
  ItemBuilderOutput,
  QTIAssessmentItem,
  ResponseDeclaration,
  OutcomeDeclaration,
  ChoiceInteraction,
  Choice,
} from './types';
import { ResponseProcessingBuilder } from './responseProcessingBuilder';
import { OutcomeMapper, getOutcomesFromMetadata } from './outcomeMapper';
import { FeedbackBuilder, createFeedbackFromQuestion } from './feedbackBuilder';
import { MetadataMapper, extractMetadata } from './metadataMapper';
import { StimulusBuilder } from './stimulusBuilder';
import { convertTextWithMath } from '../../app/utils/mathmlConverter';

export class MCQItemBuilder {
  private readonly NAMESPACE = 'http://www.imsglobal.org/xsd/imsqti_v3p0';
  private readonly XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
  private readonly MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
  private readonly SCHEMA_LOCATION = 'http://www.imsglobal.org/xsd/qti/qtiv3p0/imsqti_v3p0.xsd';

  /**
   * Build MCQ assessment item from Excel question
   */
  async build(input: ItemBuilderInput): Promise<ItemBuilderOutput> {
    try {
      const { questionData } = input;

      // Validate inputs
      this.validate(questionData);

      // Generate item ID
      const itemId = this.generateItemId(questionData);

      // Extract images from question and options
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
   * Validate MCQ question data
   */
  private validate(question: any): void {
    if (!question.question || question.question.trim() === '') {
      throw new Error('Question text is required');
    }

    if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
      throw new Error('MCQ must have at least 2 options');
    }

    if (!question.correctAnswer || question.correctAnswer.trim() === '') {
      throw new Error('Correct answer is required');
    }

    // Validate correct answer is valid
    const validAnswers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', '1', '2', '3', '4', '5', '6', '7', '8'];
    const answer = String(question.correctAnswer).toUpperCase().trim();

    if (!validAnswers.includes(answer) && parseInt(answer) > question.options.length) {
      throw new Error(`Correct answer "${answer}" is invalid for ${question.options.length} options`);
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
   * Extract image filenames from question and options
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

    // Check options for images
    if (question.options && Array.isArray(question.options)) {
      question.options.forEach((option: string) => {
        while ((match = imgRegex.exec(option)) !== null) {
          const img = match[1] || match[2] || match[3];
          if (img) images.add(img);
        }
      });
    }

    return Array.from(images);
  }

  /**
   * Build complete QTI assessment item structure
   */
  private async buildItem(question: any, itemId: string, imageMap?: Map<string, string>): Promise<QTIAssessmentItem> {
    // Normalize correct answer
    const correctAnswer = this.normalizeAnswer(question.correctAnswer, question.options.length);

    // Build response declaration
    const responseDeclaration = this.buildResponseDeclaration(correctAnswer);

    // Build outcome declarations with metadata
    const outcomeDeclarations = getOutcomesFromMetadata({
      points: question.points || 1,
      difficulty: question.difficulty,
    });

    // Extract metadata from question
    const metadata = extractMetadata(question);

    // Build item body with interaction
    const itemBody = await this.buildItemBody(question, imageMap);

    // Build response processing
    const responseProcessing = {
      xml: ResponseProcessingBuilder.buildMatchCorrect({
        template: 'match_correct',
        responseIdentifier: 'RESPONSE',
        outcomeIdentifier: 'SCORE',
      }),
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
   * Normalize answer to identifier format (A, B, C, D, etc.)
   */
  private normalizeAnswer(answer: string, optionCount: number): string {
    const normalized = String(answer).toUpperCase().trim();

    // If numeric, convert to letter
    if (/^\d+$/.test(normalized)) {
      const index = parseInt(normalized) - 1;
      if (index >= 0 && index < optionCount) {
        return String.fromCharCode(65 + index); // A, B, C, D...
      }
    }

    // If already letter, validate
    if (/^[A-H]$/.test(normalized)) {
      const index = normalized.charCodeAt(0) - 65;
      if (index < optionCount) {
        return normalized;
      }
    }

    throw new Error(`Invalid correct answer: ${answer}`);
  }

  /**
   * Build response declaration for MCQ
   */
  private buildResponseDeclaration(correctAnswer: string): ResponseDeclaration {
    return {
      identifier: 'RESPONSE',
      cardinality: 'single',
      baseType: 'identifier',
      correctResponse: {
        values: [correctAnswer],
      },
    };
  }

  /**
   * Build outcome declarations (SCORE, MAXSCORE)
   * @deprecated Use OutcomeMapper from Phase 2
   */
  private buildOutcomeDeclarations(): OutcomeDeclaration[] {
    return OutcomeMapper.buildStandardOutcomes({ points: 1 });
  }

  /**
   * Build item body with question and interaction
   */
  private async buildItemBody(question: any, imageMap?: Map<string, string>) {
    const processedText = this.processQuestionText(question.question, imageMap);
    const questionText = await convertTextWithMath(processedText);
    const stimulusRef = StimulusBuilder.fromQuestion(question);

    const choices = await this.buildChoices(question.options);

    const choiceInteraction: ChoiceInteraction = {
      type: 'choice',
      responseIdentifier: 'RESPONSE',
      maxChoices: 1, // Single choice for MCQ
      shuffle: false,
      choices,
      content: '', // Set during XML generation
    };

    return {
      content: questionText,
      interactions: [choiceInteraction],
      stimulusRef,
    };
  }

  /**
   * Process question text and replace image paths
   */
  private processQuestionText(text: string, imageMap?: Map<string, string>): string {
    let processed = text;

    if (imageMap) {
      imageMap.forEach((filepath, filename) => {
        // Replace various image formats with relative path
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
   * Build choice options with MathML support
   */
  private async buildChoices(options: string[]): Promise<Choice[]> {
    return Promise.all(
      options.map(async (option, index) => ({
        identifier: String.fromCharCode(65 + index),
        content: await convertTextWithMath(option),
        fixed: false,
      }))
    );
  }

  /**
   * Sanitize title (remove HTML, limit length)
   */
  private sanitizeTitle(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .substring(0, 100) // Limit to 100 chars
      .trim();
  }

  /**
   * Escape XML special characters (for non-math content)
   * Note: For content with math, use convertTextWithMath instead
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
    xml += this.responseProcessingToXML(item.responseProcessing);
    xml += '\n';

    // Add feedback if exists
    if (item.feedbacks && item.feedbacks.length > 0) {
      xml += '\n';
      item.feedbacks.forEach(fb => {
        xml += this.feedbackToXML(fb);
        xml += '\n';
      });
    }

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

    // Add interactions
    itemBody.interactions.forEach((interaction: ChoiceInteraction) => {
      xml += '\n      <choiceInteraction responseIdentifier="' + interaction.responseIdentifier + '" shuffle="false" maxChoices="' + interaction.maxChoices + '">';

      interaction.choices.forEach(choice => {
        // choice.content already contains converted MathML from buildChoices
        xml += `\n        <simpleChoice identifier="${choice.identifier}">${choice.content}</simpleChoice>`;
      });

      xml += '\n      </choiceInteraction>';
    });

    xml += '\n    </div>\n  </itemBody>';
    return xml;
  }

  /**
   * Response processing to XML
   */
  private responseProcessingToXML(rp: any): string {
    if (rp.xml) {
      return rp.xml;
    }
    if (rp.template) {
      return `  <responseProcessing template="http://www.imsglobal.org/question/qti_v3p0/rptemplates/${rp.template}" />`;
    }
    return '';
  }

  /**
   * Feedback to XML
   */
  private feedbackToXML(fb: any): string {
    return FeedbackBuilder.toXML(fb);
  }
}

export function createMCQBuilder() {
  return new MCQItemBuilder();
}
