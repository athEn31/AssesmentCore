/**
 * XML Validator for QTI content
 * Validates generated XML against QTI schema requirements (1.2, 2.1, 3.0)
 */

import { XMLValidationError } from './types';

/**
 * Parse and validate XML
 * Returns validation errors if any
 */
export function validateXml(xmlString: string): XMLValidationError[] {
  const errors: XMLValidationError[] = [];

  // Check if parser is available (browser or Node.js)
  const parser = getXMLParser();
  if (!parser) {
    errors.push({
      message: 'XML parser not available',
    });
    return errors;
  }

  try {
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    // Check for parsing errors
    if (isParsingError(doc)) {
      errors.push({
        message: 'Malformed XML: ' + getParseError(doc),
      });
      return errors;
    }

    // Validate root element
    const root = doc.documentElement;
    if (!root) {
      errors.push({
        message: 'Root element not found',
      });
      return errors;
    }

    // Support multiple QTI versions
    const validRootElements = ['assessmentItem', 'questestinterop'];
    if (!validRootElements.includes(root.tagName)) {
      errors.push({
        message: `Expected root element 'assessmentItem' or 'questestinterop', got '${root.tagName}'`,
      });
      return errors;
    }

    // Validate QTI 2.1/3.0 format (assessmentItem)
    if (root.tagName === 'assessmentItem') {
      // Validate required attributes
      if (!root.hasAttribute('xmlns')) {
        errors.push({
          message: 'Missing required attribute: xmlns',
        });
      }

      if (!root.hasAttribute('identifier')) {
        errors.push({
          message: 'Missing required attribute: identifier',
        });
      }
    }
    
    // Validate QTI 1.2 format (questestinterop)
    if (root.tagName === 'questestinterop') {
      // QTI 1.2 should have assessment/section/item structure
      const assessment = root.querySelector('assessment');
      if (!assessment) {
        errors.push({
          message: 'QTI 1.2: Missing required element: assessment',
        });
      }
      
      const item = root.querySelector('item');
      if (!item) {
        errors.push({
          message: 'QTI 1.2: Missing required element: item',
        });
      }
    }

    // Validate QTI 2.1/3.0 required child elements (only for assessmentItem)
    if (root.tagName === 'assessmentItem') {
      const responseDecl = root.querySelector('responseDeclaration');
      if (!responseDecl) {
        errors.push({
          message: 'Missing required element: responseDeclaration',
        });
      }

      const itemBody = root.querySelector('itemBody');
      if (!itemBody) {
        errors.push({
          message: 'Missing required element: itemBody',
        });
      }

      // Validate responseDeclaration structure
      if (responseDecl) {
        const correctResponse = responseDecl.querySelector('correctResponse');
        if (!correctResponse) {
          errors.push({
            message: 'Missing correctResponse in responseDeclaration',
          });
        }
      }

      // Validate itemBody has choiceInteraction or textEntryInteraction
      if (itemBody) {
        const choiceInteraction = itemBody.querySelector('choiceInteraction');
        const textEntryInteraction = itemBody.querySelector('textEntryInteraction');
        
        if (!choiceInteraction && !textEntryInteraction) {
          errors.push({
            message: 'Missing interaction in itemBody (choiceInteraction or textEntryInteraction)',
          });
        }

        // Check for simpleChoice elements if it's a choice interaction
        if (choiceInteraction) {
          const simpleChoices = choiceInteraction.querySelectorAll('simpleChoice');
          if (simpleChoices.length < 2) {
            errors.push({
              message: `At least 2 options required, found ${simpleChoices.length}`,
            });
          }
        }
      }
    }
  } catch (error) {
    errors.push({
      message: `XML parsing failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return errors;
}

/**
 * Get appropriate XML parser based on environment
 */
function getXMLParser(): DOMParser | null {
  // Browser environment
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    return new DOMParser();
  }

  // Node.js environment - return a mock parser that works server-side
  // In a real implementation, you'd use a library like `xmldom` or `xml2js`
  if (typeof DOMParser === 'undefined') {
    // For Node.js, return null - will need xmldom library in real implementation
    return null;
  }

  return null;
}

/**
 * Check if XML parsing resulted in an error
 */
function isParsingError(doc: Document): boolean {
  // In browser DOMParser
  if (doc.documentElement && doc.documentElement.tagName === 'parsererror') {
    return true;
  }
  return false;
}

/**
 * Get parse error message
 */
function getParseError(doc: Document): string {
  if (doc.documentElement?.tagName === 'parsererror') {
    return doc.documentElement.textContent || 'Unknown parsing error';
  }
  return 'Unknown error';
}

/**
 * Validate QTI MCQ structure
 */
export function validateMCQStructure(xml: string): boolean {
  const errors = validateXml(xml);
  return errors.length === 0;
}
