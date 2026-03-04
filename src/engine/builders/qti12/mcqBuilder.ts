/**
 * QTI 1.2 MCQ Builder
 * Generates compliant QTI 1.2 XML for Multiple Choice Questions
 */

import { Question, QuestionBuilder, GenerationError } from '../../types';
import { escapeXml, isValidIdentifier } from '../../xmlUtils';
import { validateXml } from '../../xmlValidator';

class MCQBuilder12 implements QuestionBuilder {
  /**
   * Generate QTI 1.2 XML for MCQ question
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
   * Build QTI 1.2 XML structure for Canvas LMS compatibility
   */
  private buildXml(question: Question): string {
    const escapedId = escapeXml(question.identifier);
    const idSuffixMatch = question.identifier.match(/^item_(\d{3})$/);
    const idSuffix = idSuffixMatch ? idSuffixMatch[1] : question.identifier;
    const assessmentId = escapeXml(`assessment_${idSuffix}`);
    const sectionId = escapeXml(`section_${idSuffix}`);
    const escapedTitle = escapeXml(question.stem.substring(0, 100));
    const escapedStem = escapeXml(question.stem);
    const correctAnswer = question.correct_answer.trim().toUpperCase();

    // Build response labels (options)
    const responseLabels = question.options
      .map((option: string, index: number) => {
        const identifier = String.fromCharCode(65 + index); // A, B, C, D...
        const escapedOption = escapeXml(option);
        
        return `            <response_label ident="${identifier}" rshuffle="Yes">
              <material>
                <mattext texttype="text/plain">${escapedOption}</mattext>
              </material>
            </response_label>`;
      })
      .join('\n');

    // Build the complete QTI 1.2 XML with assessment/section wrapper for Canvas LMS
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE questestinterop SYSTEM "ims_qtiasiv1p2.dtd">
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="${assessmentId}" title="${escapedTitle}">
    <section ident="${sectionId}">
      <item ident="${escapedId}" title="${escapedTitle}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>multiple_choice_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>1.0</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>assessment_question_identifierref</fieldlabel>
              <fieldentry>${escapedId}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${escapedStem}</mattext>
          </material>
          <response_lid ident="RESPONSE" rcardinality="Single">
            <render_choice shuffle="Yes">
${responseLabels}
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar varname="SCORE" vartype="Integer" minvalue="0" maxvalue="100"/>
          </outcomes>
          <respcondition continue="No">
            <conditionvar>
              <varequal respident="RESPONSE">${correctAnswer}</varequal>
            </conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
          </respcondition>
          <respcondition continue="Yes">
            <conditionvar>
              <other/>
            </conditionvar>
            <setvar action="Set" varname="SCORE">0</setvar>
          </respcondition>
        </resprocessing>
      </item>
    </section>
  </assessment>
</questestinterop>`;

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
export function createMCQBuilder12(): QuestionBuilder {
  return new MCQBuilder12();
}

/**
 * Generate QTI 1.2 XML for a single MCQ question
 * Throws error if generation fails
 */
export function generateMCQXml12(question: Question): string {
  const builder = createMCQBuilder12();
  return builder.generate(question);
}

/**
 * Generate and validate QTI 1.2 XML for MCQ question
 * Returns error if validation fails
 */
export function generateAndValidateMCQ12(
  question: Question
): { xml: string } | { error: GenerationError } {
  try {
    const xml = generateMCQXml12(question);
    const builder = createMCQBuilder12();

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
