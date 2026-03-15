/**
 * QTI 2.1 MCQ Builder
 * Generates compliant QTI 2.1 XML for Multiple Choice Questions
 */

import { Question, QuestionBuilder, GenerationError } from '../../types';
import { escapeXml, isValidIdentifier } from '../../xmlUtils';
import { validateXml } from '../../xmlValidator';
import { convertTextWithMath, stripMath } from '../../../app/utils/mathmlConverter';
import { IMG_SEPARATOR } from '../../../app/utils/mediaUtils';

class MCQBuilder implements QuestionBuilder {
  /**
   * Generate QTI 2.1 XML for MCQ question
   */
  async generate(question: Question): Promise<string> {
    // Validate question data
    this.validateQuestion(question);

    // Validate correct answer is in options
    this.validateCorrectAnswer(question);

    // Generate XML
    return this.buildXml(question);
  }

  /**
   * Validate question has all required fields
   */
  private validateQuestion(question: Question): void {
    if (!question.identifier || question.identifier.trim() === '') {
      throw new Error('Question identifier is required');
    }

    if (!question.stem || question.stem.trim() === '') {
      throw new Error('Question stem is required');
    }

    if (!question.options || !Array.isArray(question.options)) {
      throw new Error('Question options must be an array');
    }

    if (question.options.length < 2) {
      throw new Error('Question must have at least 2 options');
    }

    if (!question.correct_answer || question.correct_answer.trim() === '') {
      throw new Error('Correct answer is required');
    }
  }

  /**
   * Validate that correct answer is valid and exists in options
   */
  private validateCorrectAnswer(question: Question): void {
    const answer = question.correct_answer.trim().toUpperCase();

    // Validate format
    if (!isValidIdentifier(answer)) {
      throw new Error(
        `Invalid correct answer format: "${answer}". Must be A-Z or 1-26`
      );
    }

    // Convert answer to index (0-based)
    let answerIndex: number;
    if (/^[A-Z]$/.test(answer)) {
      answerIndex = answer.charCodeAt(0) - 65;
    } else {
      answerIndex = parseInt(answer) - 1;
    }

    // Check if answer index exists in options
    if (answerIndex >= question.options.length || answerIndex < 0) {
      throw new Error(
        `Correct answer "${answer}" exceeds number of options (${question.options.length})`
      );
    }
  }

  /**
   * Build QTI 2.1 XML structure
   */
  private async buildXml(question: Question): Promise<string> {
    const escapedId = escapeXml(question.identifier);
    const escapedTitle = escapeXml(stripMath(question.stem).substring(0, 100));
    
    // Process stem content handling image separators to avoid nested <p>
    const stemParts = question.stem.split(IMG_SEPARATOR);
    const stemContentBlocks = await Promise.all(stemParts.map(async part => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<img') && trimmed.endsWith('/>')) {
        // It's a bare image tag, wrap in <p>
        return `<p>${trimmed}</p>`;
      }
      // It's text/math content, convert and wrap in <p>
      const converted = await convertTextWithMath(trimmed);
      return `<p>${converted}</p>`;
    }));
    const stemContent = stemContentBlocks.filter(Boolean).join('\n      ');

    const correctAnswer = question.correct_answer.trim().toUpperCase();

    // Build simpleChoice elements
    const simpleChoices = (
      await Promise.all(
        question.options.map(async (option: string, index: number) => {
        const identifier = String.fromCharCode(65 + index); // A, B, C, D...
        const optionContent = await convertTextWithMath(option);
        return `      <simpleChoice identifier="${identifier}">${optionContent}</simpleChoice>`;
        })
      )
    ).join('\n');

    // Build the complete XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
  identifier="${escapedId}"
  title="${escapedTitle}"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>${correctAnswer}</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>
      ${stemContent}
      </prompt>
${simpleChoices}
    </choiceInteraction>
  </itemBody>
${correctAnswer ? `
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <baseValue baseType="identifier">${correctAnswer}</baseValue>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>` : `
  <responseProcessing/>`}

</assessmentItem>`;

    return xml;
  }

  /**
   * Validate the generated XML
   */
  validate(xml: string): boolean {
    const errors = validateXml(xml);
    return errors.length === 0;
  }
}

/**
 * Factory function to create MCQ builder
 */
export function createMCQBuilder(): QuestionBuilder {
  return new MCQBuilder();
}

/**
 * Generate QTI XML for a single MCQ question
 * Throws error if generation fails
 */
export async function generateMCQXml(question: Question): Promise<string> {
  const builder = createMCQBuilder();
  return builder.generate(question);
}

/**
 * Generate and validate QTI XML for MCQ question
 * Returns error if validation fails
 */
export async function generateAndValidateMCQ(
  question: Question
): Promise<{ xml: string } | { error: GenerationError }> {
  try {
    const xml = await generateMCQXml(question);
    const builder = createMCQBuilder();

    // Custom QTI 2.1 validation logic: check structural rules 1, 2, 5
    if (xml.includes('<p><p>') || xml.includes('</p></p>')) {
      return {
        error: { code: 'XML_VALIDATION_FAILED', message: 'Generated XML contains nested <p> tags' }
      };
    }
    
    // Check missing response processing or outcome
    if (!xml.includes('<responseProcessing') || !xml.includes('<outcomeDeclaration')) {
       return {
         error: { code: 'XML_VALIDATION_FAILED', message: 'Missing responseProcessing or outcomeDeclaration' }
       };
    }
    
    // Enforce <responseDeclaration> before <itemBody>
    const rdIndex = xml.indexOf('<responseDeclaration');
    const ibIndex = xml.indexOf('<itemBody');
    if (rdIndex > -1 && ibIndex > -1 && rdIndex > ibIndex) {
      return {
         error: { code: 'XML_VALIDATION_FAILED', message: 'responseDeclaration appears after itemBody' }
       };
    }

    if (!builder.validate(xml)) {
      return {
        error: {
          code: 'XML_VALIDATION_FAILED',
          message: 'Generated XML failed base validation',
        },
      };
    }

    return { xml };
  } catch (error) {
    return {
      error: {
        code: 'MCQ_GENERATION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        details: error,
      },
    };
  }
}
