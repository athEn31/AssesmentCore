/**
 * QTI 1.2 Text Entry Builder
 * Generates compliant QTI 1.2 XML for Text Entry Questions (Short Answer)
 */

import { Question, QuestionBuilder, GenerationError } from '../../types';
import { escapeXml } from '../../xmlUtils';
import { validateXml } from '../../xmlValidator';

class TextEntryBuilder12 implements QuestionBuilder {
  /**
   * Generate QTI 1.2 XML for Text Entry question
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
   * Build QTI 1.2 XML structure for text entry question for Canvas LMS compatibility
   */
  private buildXml(question: Question): string {
    const escapedId = escapeXml(question.identifier);
    const idSuffixMatch = question.identifier.match(/^item_(\d{3})$/);
    const idSuffix = idSuffixMatch ? idSuffixMatch[1] : question.identifier;
    const assessmentId = escapeXml(`assessment_${idSuffix}`);
    const sectionId = escapeXml(`section_${idSuffix}`);
    const escapedTitle = escapeXml(question.stem.substring(0, 100));
    const escapedStem = escapeXml(question.stem);
    const escapedAnswer = escapeXml(question.correct_answer);

    // Calculate expected length based on answer length
    const answerLength = question.correct_answer.length;
    const expectedLength = Math.max(20, Math.min(answerLength + 10, 500));

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
              <fieldentry>short_answer_question</fieldentry>
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
          <response_str ident="RESPONSE" rcardinality="Single">
            <render_fib>
              <response_label ident="ANSWER" rshuffle="No"/>
            </render_fib>
          </response_str>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar varname="SCORE" vartype="Integer" minvalue="0" maxvalue="100"/>
          </outcomes>
          <respcondition continue="No">
            <conditionvar>
              <varequal respident="RESPONSE" case="No">${escapedAnswer}</varequal>
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
 * Factory function to create Text Entry builder
 */
export function createTextEntryBuilder12(): QuestionBuilder {
  return new TextEntryBuilder12();
}

/**
 * Generate QTI 1.2 XML for a single text entry question
 * Throws error if generation fails
 */
export function generateTextEntryXml12(question: Question): string {
  const builder = createTextEntryBuilder12();
  return builder.generate(question);
}

/**
 * Generate and validate QTI 1.2 XML for text entry question
 * Returns error if validation fails
 */
export function generateAndValidateTextEntry12(
  question: Question
): { xml: string } | { error: GenerationError } {
  try {
    const xml = generateTextEntryXml12(question);
    const builder = createTextEntryBuilder12();

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
