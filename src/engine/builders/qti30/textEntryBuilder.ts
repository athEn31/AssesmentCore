/**
 * QTI 3.0 Text Entry Builder
 * Generates compliant QTI 3.0 XML for Text Entry Questions (Short Answer)
 */

import { Question, QuestionBuilder, GenerationError } from '../../types';
import { escapeXml } from '../../xmlUtils';
import { validateXml } from '../../xmlValidator';

class TextEntryBuilder30 implements QuestionBuilder {
  /**
   * Generate QTI 3.0 XML for Text Entry question
   */
  generate(question: Question): string {
    // Validate question data
    this.validateQuestion(question);

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

    if (!question.correct_answer || question.correct_answer.trim() === '') {
      throw new Error('Correct answer is required');
    }
  }

  /**
   * Build QTI 3.0 XML structure for text entry question
   */
  private buildXml(question: Question): string {
    const escapedId = escapeXml(question.identifier);
    const escapedTitle = escapeXml(question.stem.substring(0, 100));
    const escapedStem = escapeXml(question.stem);
    const escapedAnswer = escapeXml(question.correct_answer);

    // Calculate expected length based on answer length
    const answerLength = question.correct_answer.length;
    const expectedLength = Math.max(20, Math.min(answerLength + 10, 500));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v3p0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v3p0 http://www.imsglobal.org/xsd/qti/qtiv3p0/imsqti_v3p0.xsd"
  identifier="${escapedId}"
  title="${escapedTitle}"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>${escapedAnswer}</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <div>
      <p>${escapedStem}</p>
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="${expectedLength}">
        <prompt>Enter your answer:</prompt>
      </textEntryInteraction>
    </div>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <stringMatch caseSensitive="false">
          <variable identifier="RESPONSE"/>
          <baseValue baseType="string">${escapedAnswer}</baseValue>
        </stringMatch>
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
 * Factory function to create Text Entry builder
 */
export function createTextEntryBuilder30(): QuestionBuilder {
  return new TextEntryBuilder30();
}

/**
 * Generate QTI 3.0 XML for a single text entry question
 * Throws error if generation fails
 */
export function generateTextEntryXml30(question: Question): string {
  const builder = createTextEntryBuilder30();
  return builder.generate(question);
}

/**
 * Generate and validate QTI 3.0 XML for text entry question
 * Returns error if validation fails
 */
export function generateAndValidateTextEntry30(
  question: Question
): { xml: string } | { error: GenerationError } {
  try {
    const xml = generateTextEntryXml30(question);
    const builder = createTextEntryBuilder30();

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
        code: 'TEXT_ENTRY_GENERATION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        details: error,
      },
    };
  }
}
