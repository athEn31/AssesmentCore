/**
 * QTI 3.0 MCQ Builder
 * Generates compliant QTI 3.0 XML for Multiple Choice Questions
 */

import { Question, QuestionBuilder, GenerationError } from '../../types';
import { escapeXml, isValidIdentifier } from '../../xmlUtils';
import { validateXml } from '../../xmlValidator';
import { convertTextWithMath, stripMath } from '../../../app/utils/mathmlConverter';

class MCQBuilder30 implements QuestionBuilder {
  /**
   * Generate QTI 3.0 XML for MCQ question
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
   * Build QTI 3.0 XML structure
   */
  private async buildXml(question: Question): Promise<string> {
    const escapedId = escapeXml(question.identifier);
    const escapedTitle = escapeXml(stripMath(question.stem).substring(0, 100));
    const stemContent = convertTextWithMath(question.stem);
    const correctAnswer = question.correct_answer.trim().toUpperCase();

    // Build simpleChoice elements
    const simpleChoices = (
      await Promise.all(
        question.options.map(async (option: string, index: number) => {
        const identifier = String.fromCharCode(65 + index); // A, B, C, D...
        const optionContent = convertTextWithMath(option);
        return `      <simpleChoice identifier="${identifier}">${optionContent}</simpleChoice>`;
        })
      )
    ).join('\n');

    // Build the complete QTI 3.0 XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v3p0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v3p0 http://www.imsglobal.org/xsd/qti/qtiv3p0/imsqti_v3p0.xsd"
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
      <prompt>${stemContent}</prompt>
${simpleChoices}
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <baseValue baseType="identifier">${correctAnswer}</baseValue>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>

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
export function createMCQBuilder30(): QuestionBuilder {
  return new MCQBuilder30();
}

/**
 * Generate QTI 3.0 XML for a single MCQ question
 * Throws error if generation fails
 */
export async function generateMCQXml30(question: Question): Promise<string> {
  const builder = createMCQBuilder30();
  return builder.generate(question);
}

/**
 * Generate and validate QTI 3.0 XML for MCQ question
 * Returns error if validation fails
 */
export async function generateAndValidateMCQ30(
  question: Question
): Promise<{ xml: string } | { error: GenerationError }> {
  try {
    const xml = await generateMCQXml30(question);
    const builder = createMCQBuilder30();

    if (!builder.validate(xml)) {
      return {
        error: {
          code: 'XML_VALIDATION_FAILED',
          message: 'Generated XML failed validation',
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
