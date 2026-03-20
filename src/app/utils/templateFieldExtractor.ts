/**
 * Template Field Extractor
 * Auto-detects fields from template XML and prepares them for manual mapping
 */

import { extractPlaceholdersFromComments } from './placeholderHandler';

export type TemplateFieldType = 'text' | 'html' | 'mathml' | 'choice-list' | 'identifier' | 'custom';

export type TemplateField = {
  id: string; // unique field identifier
  name: string; // display name
  type: TemplateFieldType;
  xpath?: string; // optional XPath for locating in template
  required: boolean;
  description?: string;
  defaultValue?: string;
};

export type ExtractedTemplate = {
  identifier: string;
  title: string;
  version: string; // QTI version detected
  fields: TemplateField[];
  rawXml: string;
};

function localName(nodeName: string): string {
  const parts = nodeName.split(':');
  return parts[parts.length - 1];
}
function sanitizeFieldName(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'Unknown Field';
  }

  // Remove control characters and clamp length for UI safety.
  return name
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim()
    .slice(0, 100) || 'Unnamed Field';
}

function findByLocalName(root: Element, name: string): Element | null {
  const elements = Array.from(root.querySelectorAll('*')) as Element[];
  return elements.find((el) => localName(el.nodeName) === name) || null;
}

function findAllByLocalName(root: Element, name: string): Element[] {
  const elements = Array.from(root.querySelectorAll('*')) as Element[];
  return elements.filter((el) => localName(el.nodeName) === name);
}

function isIncorrectFeedbackIdentifier(identifier: string): boolean {
  const normalized = identifier.toLowerCase();
  return normalized.includes('incorrect') || normalized.includes('wrong');
}

function isCorrectFeedbackIdentifier(identifier: string): boolean {
  const normalized = identifier.toLowerCase();
  return !isIncorrectFeedbackIdentifier(normalized) && normalized.includes('correct');
}

function normalizeXmlInput(xml: string): string {
  return xml
    .replace(/^\uFEFF/, '')
    .replace(/^\s+(<\?xml)/, '$1')
    .trim();
}

/**
 * Detects QTI version from namespace
 */
function detectQtiVersion(doc: Document): string {
  const root = doc.documentElement;
  const namespace = root.getAttribute('xmlns') || '';

  if (namespace.includes('v3p0') || namespace.includes('imsqtiasi_v3p0')) {
    return '3.0';
  } else if (namespace.includes('v2p1') || namespace.includes('imsqtiasi_v2p1')) {
    return '2.1';
  } else if (namespace.includes('v1p2') || namespace.includes('imsqtiasi_v1p2')) {
    return '1.2';
  }
  return 'unknown';
}

/**
 * Extract all fields from template XML
 */
export function extractTemplateFields(templateXml: string): ExtractedTemplate {
  if (typeof templateXml !== 'string' || templateXml.trim() === '') {
    throw new Error('Template XML is empty');
  }

  const trimmedXml = normalizeXmlInput(templateXml);
  if (!trimmedXml.startsWith('<')) {
    throw new Error('Template XML appears invalid (must begin with <)');
  }

  const doc = new DOMParser().parseFromString(trimmedXml, 'application/xml');

  const root = doc.documentElement;
  if (!root || !root.nodeName) {
    throw new Error('XML parsing failed - no root element found');
  }

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML template');
  }

  const rootLocalName = localName(root.nodeName);
  if (rootLocalName !== 'assessmentItem' && rootLocalName !== 'item') {
    throw new Error(`Root element is <${rootLocalName}>, expected <assessmentItem> or <item>`);
  }

  const identifier = root.getAttribute('identifier') || 'unknown';
  const title = root.getAttribute('title') || 'Untitled Template';
  const version = detectQtiVersion(doc);

  const fields: TemplateField[] = [];
  const fieldIds = new Set<string>();

  const hasFieldName = (name: string): boolean => {
    const normalized = sanitizeFieldName(name).toLowerCase();
    return fields.some((field) => field.name.toLowerCase() === normalized);
  };

  // Helper to add field with unique ID
  const addField = (name: string, type: TemplateFieldType, required: boolean, desc?: string) => {
      const sanitizedName = sanitizeFieldName(name);
      const sanitizedDesc = desc ? sanitizeFieldName(desc) : undefined;
      let id = sanitizedName.toLowerCase().replace(/\s+/g, '_');
    let counter = 1;
    const originalId = id;
    while (fieldIds.has(id)) {
      id = `${originalId}_${counter}`;
      counter++;
    }
    fieldIds.add(id);
    fields.push({
      id,
        name: sanitizedName,
      type,
      required,
        description: sanitizedDesc,
    });
  };

  // 1. Extract prompt field
  const itemBody = findByLocalName(root, 'itemBody');
  if (itemBody) {
    const choiceInteraction = findByLocalName(itemBody, 'choiceInteraction');
    const textEntryInteraction = findByLocalName(itemBody, 'textEntryInteraction');

    if (choiceInteraction) {
      const prompt = findByLocalName(choiceInteraction, 'prompt');
      if (prompt) {
        addField('Question Stem', 'html', true, 'Main question text/stem');
      }

      // 2. Extract choice fields
      const simpleChoices = findAllByLocalName(choiceInteraction, 'simpleChoice');
      simpleChoices.forEach((choice, index) => {
        const identifier = choice.getAttribute('identifier') || `choice_${String.fromCharCode(65 + index)}`;
        addField(
          `Choice ${String.fromCharCode(65 + index)}`,
          'html',
          false,
          `Choice option (identifier: ${identifier})`,
        );
      });
    } else if (textEntryInteraction) {
      addField('Text Entry Prompt', 'html', true, 'Question text for text entry');
    }
  }

  // 3. Extract correct answer field
  const responseDecl = findByLocalName(root, 'responseDeclaration');
  if (responseDecl) {
    const correctResponse = findByLocalName(responseDecl, 'correctResponse');
    if (correctResponse) {
      const values = findAllByLocalName(correctResponse, 'value');
      if (values.length > 0) {
        addField('Correct Answer', 'identifier', true, 'Identifier of correct choice(s)');
      }
    }
  }

  // 4. Extract feedback fields
  const modalFeedbacks = findAllByLocalName(root, 'modalFeedback');
  modalFeedbacks.forEach((feedback) => {
    const outcomeId = feedback.getAttribute('outcomeIdentifier') || '';
    const feedbackId = feedback.getAttribute('identifier') || '';

    if (outcomeId.toLowerCase().includes('feedback')) {
      if (isIncorrectFeedbackIdentifier(feedbackId)) {
        addField('Incorrect Feedback', 'html', false, 'Feedback for incorrect answer');
      } else if (isCorrectFeedbackIdentifier(feedbackId)) {
        addField('Correct Feedback', 'html', false, 'Feedback for correct answer');
      } else {
        addField(`Feedback: ${feedbackId}`, 'html', false, `Custom feedback (${feedbackId})`);
      }
    }
  });

  // Always expose standard feedback mapping options for manual mapping UI,
  // even when template detection cannot classify feedback blocks.
  if (!hasFieldName('Correct Feedback')) {
    addField('Correct Feedback', 'html', false, 'Feedback for correct answer');
  }
  if (!hasFieldName('Incorrect Feedback')) {
    addField('Incorrect Feedback', 'html', false, 'Feedback for incorrect answer');
  }

  // 4.5 Extract placeholders from XML comments (anywhere in template)
  const commentPlaceholders = extractPlaceholdersFromComments(trimmedXml);
  const reservedPlaceholderTokens = new Set([
    'question_stem',
    'text_entry_prompt',
    'correct_feedback',
    'incorrect_feedback',
    'correct_answer',
    'question_id',
    'question_title',
  ]);
  const subsectionPlaceholderTokens = new Set([
    'concept',
    'explanation',
    'key_idea',
    'final_answer',
    'image',
    'calculation',
  ]);
  const isReservedPlaceholder = (token: string): boolean => {
    if (!token) return true;
    if (reservedPlaceholderTokens.has(token)) return true;
    if (subsectionPlaceholderTokens.has(token)) return true;
    if (/^choice_[a-z0-9]+$/.test(token)) return true;
    return false;
  };

  commentPlaceholders.forEach((ph) => {
    if (isReservedPlaceholder(ph.name)) {
      return;
    }
    if (!hasFieldName(ph.displayName) && !fieldIds.has(ph.fieldId)) {
      fieldIds.add(ph.fieldId);
      fields.push({
        id: ph.fieldId,
        name: sanitizeFieldName(ph.displayName),
        type: 'html',
        required: false,
        description: `${sanitizeFieldName(ph.displayName)} placeholder`,
      });
    }
  });

  // 5. Add optional metadata fields
  addField('Question ID', 'identifier', false, 'Unique question identifier');
  addField('Question Title', 'text', false, 'Short question title');

  return {
    identifier,
    title,
    version,
    fields,
    rawXml: trimmedXml,
  };
}

/**
 * Validate that required fields are mapped
 */
export function validateFieldMapping(
  extractedTemplate: ExtractedTemplate,
  mapping: Record<string, string | null>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  extractedTemplate.fields.forEach((field) => {
    if (field.required && !mapping[field.id]) {
      errors.push(`Required field "${field.name}" is not mapped to any sheet column`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
