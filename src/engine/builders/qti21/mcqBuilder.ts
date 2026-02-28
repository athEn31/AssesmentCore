/**
 * QTI 2.1 MCQ Builder
 * Generates compliant QTI 2.1 XML for Multiple Choice Questions
 */

import { Question, QuestionBuilder, GenerationError } from '../../types';
import { escapeXml, isValidIdentifier } from '../../xmlUtils';
import { validateXml } from '../../xmlValidator';

class MCQBuilder implements QuestionBuilder {
  /**
   * Generate QTI 2.1 XML for MCQ question
   */
  generate(question: Question): string {
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
  private buildXml(question: Question): string {
    const escapedId = escapeXml(question.identifier);
    const escapedTitle = escapeXml(question.stem.substring(0, 100));
    const escapedStem = escapeXml(question.stem);
    const correctAnswer = question.correct_answer.trim().toUpperCase();

    // Build simpleChoice elements
    const simpleChoices = question.options
      .map((option: string, index: number) => {
        const identifier = String.fromCharCode(65 + index); // A, B, C, D...
        const escapedOption = escapeXml(option);
        return `      <simpleChoice identifier="${identifier}">${escapedOption}</simpleChoice>`;
      })
      .join('\n');

    // Build the complete XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  identifier="${escapedId}"
  title="${escapedTitle}"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>${correctAnswer}</value>
    </correctResponse>
  </responseDeclaration>

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>${escapedStem}</prompt>
${simpleChoices}
    </choiceInteraction>
  </itemBody>

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
export function generateMCQXml(question: Question): string {
  const builder = createMCQBuilder();
  return builder.generate(question);
}

/**
 * Generate and validate QTI XML for MCQ question
 * Returns error if validation fails
 */
export function generateAndValidateMCQ(
  question: Question
): { xml: string } | { error: GenerationError } {
  try {
    const xml = generateMCQXml(question);
    const builder = createMCQBuilder();

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
