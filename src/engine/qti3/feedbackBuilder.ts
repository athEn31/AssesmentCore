/**
 * Feedback Builder
 * Creates QTI 3.0 modal feedback based on outcomes
 */

import { ModalFeedback } from './types';

/**
 * Feedback Type
 */
export type FeedbackType = 
  | 'correct'       // Show when answer is correct
  | 'incorrect'     // Show when answer is incorrect
  | 'partial'       // Show when partial credit awarded
  | 'hint'          // Show as hint before answering
  | 'solution'      // Show full solution
  | 'custom';       // Custom condition

/**
 * Feedback Configuration
 */
export interface FeedbackConfig {
  identifier: string;
  type: FeedbackType;
  content: string;
  showHide: 'show' | 'hide';
  outcomeIdentifier?: string;
  condition?: string; // Custom condition expression
}

/**
 * Feedback Builder Class
 */
export class FeedbackBuilder {
  /**
   * Build modal feedback element
   */
  static build(config: FeedbackConfig): ModalFeedback {
    return {
      identifier: config.identifier,
      showHide: config.showHide,
      content: config.content,
      outcomeIdentifier: config.outcomeIdentifier || 'SCORE',
    };
  }

  /**
   * Build multiple feedback items from question data
   */
  static buildMultiple(
    correctFeedback?: string,
    incorrectFeedback?: string,
    solution?: string
  ): ModalFeedback[] {
    const feedbacks: ModalFeedback[] = [];

    if (correctFeedback) {
      feedbacks.push({
        identifier: 'feedback_correct',
        showHide: 'show',
        content: correctFeedback,
        outcomeIdentifier: 'SCORE',
      });
    }

    if (incorrectFeedback) {
      feedbacks.push({
        identifier: 'feedback_incorrect',
        showHide: 'show',
        content: incorrectFeedback,
        outcomeIdentifier: 'SCORE',
      });
    }

    if (solution) {
      feedbacks.push({
        identifier: 'feedback_solution',
        showHide: 'show',
        content: solution,
        outcomeIdentifier: 'SCORE',
      });
    }

    return feedbacks;
  }

  /**
   * Convert feedback to XML
   */
  static toXML(feedback: ModalFeedback): string {
    const escaped = this.escapeXml(feedback.content);

    let xml = `  <modalFeedback 
    identifier="${feedback.identifier}" 
    outcomeIdentifier="${feedback.outcomeIdentifier || 'SCORE'}" 
    showHide="${feedback.showHide}">`;

    xml += `\n    <p>${escaped}</p>`;
    xml += `\n  </modalFeedback>`;

    return xml;
  }

  /**
   * Convert multiple feedbacks to XML
   */
  static multipleToXML(feedbacks: ModalFeedback[]): string {
    return feedbacks.map(fb => this.toXML(fb)).join('\n\n');
  }

  /**
   * Build feedback with conditional display
   * Shows feedback only when specific score is achieved
   */
  static buildConditionalFeedback(
    identifier: string,
    content: string,
    scoreCondition: 'perfect' | 'partial' | 'zero'
  ): ModalFeedback {
    return {
      identifier,
      showHide: 'show',
      content,
      outcomeIdentifier: 'SCORE',
    };
  }

  /**
   * Create feedback from explanation field
   */
  static fromExplanation(explanation: string): ModalFeedback {
    return {
      identifier: 'feedback_explanation',
      showHide: 'show',
      content: explanation,
      outcomeIdentifier: 'SCORE',
    };
  }

  /**
   * Build hint feedback (shown before answering)
   */
  static buildHint(hint: string): ModalFeedback {
    return {
      identifier: 'hint',
      showHide: 'show',
      content: hint,
    };
  }

  /**
   * Build solution feedback (shown after completion)
   */
  static buildSolution(solution: string): ModalFeedback {
    return {
      identifier: 'solution',
      showHide: 'show',
      content: solution,
    };
  }

  /**
   * Escape XML special characters in feedback content
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

  /**
   * Add feedback display rule to response processing
   * This enhances response processing to set FEEDBACK outcome
   */
  static addFeedbackDisplayRule(
    responseProcessingXML: string,
    correctFeedbackId: string,
    incorrectFeedbackId: string
  ): string {
    // Insert feedback outcome setting before closing responseProcessing tag
    const feedbackRule = `
    <responseCondition>
      <responseIf>
        <equal>
          <variable identifier="SCORE" />
          <variable identifier="MAXSCORE" />
        </equal>
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">${correctFeedbackId}</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">${incorrectFeedbackId}</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>`;

    return responseProcessingXML.replace(
      '</responseProcessing>',
      `${feedbackRule}\n  </responseProcessing>`
    );
  }
}

/**
 * Helper to create feedback from question data
 */
export function createFeedbackFromQuestion(questionData: {
  explanation?: string;
  hint?: string;
  solution?: string;
  correctMessage?: string;
  incorrectMessage?: string;
}): ModalFeedback[] {
  const feedbacks: ModalFeedback[] = [];

  if (questionData.explanation) {
    feedbacks.push(FeedbackBuilder.fromExplanation(questionData.explanation));
  }

  if (questionData.hint) {
    feedbacks.push(FeedbackBuilder.buildHint(questionData.hint));
  }

  if (questionData.solution) {
    feedbacks.push(FeedbackBuilder.buildSolution(questionData.solution));
  }

  if (questionData.correctMessage) {
    feedbacks.push({
      identifier: 'feedback_correct',
      showHide: 'show',
      content: questionData.correctMessage,
      outcomeIdentifier: 'SCORE',
    });
  }

  if (questionData.incorrectMessage) {
    feedbacks.push({
      identifier: 'feedback_incorrect',
      showHide: 'show',
      content: questionData.incorrectMessage,
      outcomeIdentifier: 'SCORE',
    });
  }

  return feedbacks;
}

/**
 * Validate feedback structure
 */
export function validateFeedback(
  feedback: ModalFeedback
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!feedback.identifier || feedback.identifier.trim() === '') {
    errors.push('Feedback identifier is required');
  }

  if (!feedback.content || feedback.content.trim() === '') {
    errors.push('Feedback content is required');
  }

  if (!['show', 'hide'].includes(feedback.showHide)) {
    errors.push(`Invalid showHide value: ${feedback.showHide}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
