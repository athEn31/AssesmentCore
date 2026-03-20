/**
 * Template Data Mapper
 * Maps uploaded sheet data to template fields and generates QTI XML
 */

import { ExtractedTemplate, TemplateField } from './templateFieldExtractor';
import { parseFile } from './fileParser';

export type ColumnMapping = {
  [templateFieldId: string]: string | null; // field ID -> sheet column name
};

export type SheetRow = {
  [columnName: string]: string | undefined;
};

export type MappedRow = {
  rowIndex: number;
  templateFieldValues: {
    [fieldId: string]: string;
  };
  errors?: string[];
};

/**
 * Extract sheet headers and sample data
 */
export function parseSheetData(file: File): Promise<{ headers: string[]; rows: SheetRow[] }> {
  return parseFile(file).then((parsed) => {
    const headers = parsed.columns;

    const rows: SheetRow[] = parsed.rows.map((row) => {
      const normalized: SheetRow = {};
      headers.forEach((header) => {
        const value = row[header];
        normalized[header] = value == null ? '' : String(value);
      });
      return normalized;
    });

    return { headers, rows };
  });
}

/**
 * Map sheet row data to template fields
 */
export function mapRowToFields(row: SheetRow, mapping: ColumnMapping): MappedRow {
  const templateFieldValues: { [fieldId: string]: string } = {};
  const errors: string[] = [];

  // Iterate through mapping and extract values
  Object.entries(mapping).forEach(([fieldId, columnName]) => {
    if (!columnName) {
      // Unmapped field - leave empty
      templateFieldValues[fieldId] = '';
    } else {
      const value = row[columnName] || '';
      templateFieldValues[fieldId] = value;
    }
  });

  return {
    rowIndex: 0, // will be set by batch processor
    templateFieldValues,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Sanitize text for XML (escape special characters)
 */
export function sanitizeXmlText(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Safely set element inner HTML (for protected contexts)
 */
function setInnerXml(element: Element, xmlFragment: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (!xmlFragment || xmlFragment.trim() === '') {
    return;
  }

  try {
    const wrapped = `<root>${xmlFragment}</root>`;
    const fragmentDoc = new DOMParser().parseFromString(wrapped, 'application/xml');

    if (fragmentDoc.querySelector('parsererror')) {
      // Fall back to text content if XML parsing fails
      element.textContent = xmlFragment;
      return;
    }

    const root = fragmentDoc.documentElement;
    const nodes = Array.from(root.childNodes);

    const ownerDoc = element.ownerDocument;
    nodes.forEach((node) => {
      element.appendChild(ownerDoc.importNode(node, true));
    });
  } catch (error) {
    // Fallback: set as text content
    element.textContent = xmlFragment;
  }
}

/**
 * Generate QTI XML from mapped data
 */
export function generateQtiFromMappedData(
  template: ExtractedTemplate,
  mappedRow: MappedRow,
): { xml: string; itemIdentifier: string } {
  const doc = new DOMParser().parseFromString(template.rawXml, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid template XML');
  }

  const root = doc.documentElement;

  // Map each field value to template elements
  template.fields.forEach((field) => {
    const value = mappedRow.templateFieldValues[field.id] || '';

    if (!value) {
      return; // Skip empty fields
    }

    // Route based on field type and name
    if (field.name.includes('Question Stem')) {
      updatePrompt(doc, root, value, field);
    } else if (field.name.startsWith('Choice')) {
      updateChoice(doc, root, field.name, value);
    } else if (field.name.includes('Correct Answer')) {
      updateCorrectAnswer(doc, root, value);
    } else if (field.name.includes('Correct Feedback')) {
      updateFeedback(doc, root, 'correct', value);
    } else if (field.name.includes('Incorrect Feedback')) {
      updateFeedback(doc, root, 'incorrect', value);
    } else if (field.name.includes('Question ID')) {
      root.setAttribute('identifier', sanitizeXmlText(value));
    } else if (field.name.includes('Question Title')) {
      root.setAttribute('title', sanitizeXmlText(value));
    }
  });

  const identifier = root.getAttribute('identifier') || 'item_001';
  return {
    xml: new XMLSerializer().serializeToString(doc),
    itemIdentifier: identifier,
  };
}

/**
 * Update prompt element in template
 */
function updatePrompt(doc: Document, root: Element, value: string, field: TemplateField): void {
  const itemBody = findByLocalName(root, 'itemBody');
  if (!itemBody) return;

  const choiceInteraction = findByLocalName(itemBody, 'choiceInteraction');
  const textEntryInteraction = findByLocalName(itemBody, 'textEntryInteraction');

  let prompt: Element | null = null;

  if (choiceInteraction) {
    prompt = findByLocalName(choiceInteraction, 'prompt');
  } else if (textEntryInteraction) {
    prompt = findByLocalName(textEntryInteraction, 'prompt');
  }

  if (prompt) {
    setInnerXml(prompt, value);
  }
}

/**
 * Update choice content in template
 */
function updateChoice(doc: Document, root: Element, choiceName: string, value: string): void {
  const itemBody = findByLocalName(root, 'itemBody');
  if (!itemBody) return;

  const choiceInteraction = findByLocalName(itemBody, 'choiceInteraction');
  if (!choiceInteraction) return;

  const simpleChoices = findAllByLocalName(choiceInteraction, 'simpleChoice');
  const choiceLetter = choiceName.match(/[A-Z]/)?.[0];

  if (!choiceLetter) return;

  const choiceIndex = choiceLetter.charCodeAt(0) - 65; // A=0, B=1, etc
  if (choiceIndex < simpleChoices.length) {
    setInnerXml(simpleChoices[choiceIndex], value);
  }
}

/**
 * Update correct answer in responseDeclaration
 */
function updateCorrectAnswer(doc: Document, root: Element, value: string): void {
  const responseDecl = findByLocalName(root, 'responseDeclaration');
  if (!responseDecl) return;

  let correctResponse = findByLocalName(responseDecl, 'correctResponse');
  if (!correctResponse) {
    // Create correctResponse if missing
    correctResponse = doc.createElementNS(responseDecl.namespaceURI, 'correctResponse');
    responseDecl.appendChild(correctResponse);
  }

  // Clear existing values
  const existingValues = findAllByLocalName(correctResponse, 'value');
  existingValues.forEach((v) => v.remove());

  // Add new value
  const valueEl = doc.createElementNS(responseDecl.namespaceURI, 'value');
  valueEl.textContent = sanitizeXmlText(value);
  correctResponse.appendChild(valueEl);
}

/**
 * Update feedback content
 */
function updateFeedback(doc: Document, root: Element, feedbackType: 'correct' | 'incorrect', value: string): void {
  const feedbacks = findAllByLocalName(root, 'modalFeedback');

  for (const feedback of feedbacks) {
    const identifier = feedback.getAttribute('identifier') || '';
    const normalizedIdentifier = identifier.toLowerCase();
    const isIncorrect = normalizedIdentifier.includes('incorrect') || normalizedIdentifier.includes('wrong');
    const isCorrect = !isIncorrect && normalizedIdentifier.includes('correct');
    const isTarget =
      (feedbackType === 'correct' && isCorrect) ||
      (feedbackType === 'incorrect' && isIncorrect);

    if (isTarget) {
      setInnerXml(feedback, value);
      break;
    }
  }
}

/**
 * Helper functions
 */
function findByLocalName(root: Element, name: string): Element | null {
  const elements = Array.from(root.querySelectorAll('*')) as Element[];
  return elements.find((el) => localNameOnly(el.nodeName) === name) || null;
}

function findAllByLocalName(root: Element, name: string): Element[] {
  const elements = Array.from(root.querySelectorAll('*')) as Element[];
  return elements.filter((el) => localNameOnly(el.nodeName) === name);
}

function localNameOnly(nodeName: string): string {
  const parts = nodeName.split(':');
  return parts[parts.length - 1];
}
