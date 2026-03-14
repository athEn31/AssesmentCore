/**
 * QTI 3.0 Item Builders
 * Unified interface for building QTI 3.0 assessment items
 */

import { MCQItemBuilder } from './mcqItemBuilder';
import { TextEntryItemBuilder } from './textEntryItemBuilder';
import { ItemBuilderInput, ItemBuilderOutput } from './types';

export * from './types';
export { MCQItemBuilder, createMCQBuilder } from './mcqItemBuilder';
export { TextEntryItemBuilder, createTextEntryBuilder } from './textEntryItemBuilder';

// Phase 2: Scoring & Response Processing exports
export * from './responseProcessingBuilder';
export * from './outcomeMapper';
export * from './feedbackBuilder';

// Phase 3: Test Structure exports
export * from './testStructure';
export * from './testBuilder';

// Phase 4: IMS Packaging exports
export * from './resourceRegistry';
export * from './manifestBuilder';
export * from './packageBuilder';

// Phase 5: Metadata Mapping exports
export * from './metadataMapper';

// Phase 6: Stimulus exports
export * from './stimulusBuilder';

// Image utilities
export * from './imageUtils';

/**
 * Factory to get the appropriate builder
 */
export class ItemBuilderFactory {
  static getBuilder(type: 'mcq' | 'textEntry') {
    switch (type) {
      case 'mcq':
        return new MCQItemBuilder();
      case 'textEntry':
        return new TextEntryItemBuilder();
      default:
        throw new Error(`Unknown question type: ${type}`);
    }
  }
}

/**
 * Unified build function
 */
export async function buildAssessmentItem(
  input: ItemBuilderInput
): Promise<ItemBuilderOutput> {
  const builder = ItemBuilderFactory.getBuilder(input.questionType);
  return builder.build(input);
}

/**
 * Batch build multiple items
 */
export async function buildAssessmentItemsBatch(
  inputs: ItemBuilderInput[]
): Promise<ItemBuilderOutput[]> {
  return Promise.all(inputs.map((input) => buildAssessmentItem(input)));
}
