/**
 * QTI Engine - Main exports
 * Re-export all builders and services for easy access
 */

export * from './types';
export * from './xmlUtils';
export * from './xmlValidator';
export * from './generationService';

// QTI 1.2 Builders
export { createMCQBuilder12, generateMCQXml12, generateAndValidateMCQ12 } from './builders/qti12/mcqBuilder';
export { createTextEntryBuilder12, generateTextEntryXml12, generateAndValidateTextEntry12 } from './builders/qti12/textEntryBuilder';

// QTI 2.1 Builders
export { createMCQBuilder, generateMCQXml, generateAndValidateMCQ } from './builders/qti21/mcqBuilder';
export { createTextEntryBuilder, generateTextEntryXml, generateAndValidateTextEntry } from './builders/qti21/textEntryBuilder';

// QTI 3.0 Builders
export { createMCQBuilder30, generateMCQXml30, generateAndValidateMCQ30 } from './builders/qti30/mcqBuilder';
export { createTextEntryBuilder30, generateTextEntryXml30, generateAndValidateTextEntry30 } from './builders/qti30/textEntryBuilder';
