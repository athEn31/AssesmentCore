import { validateAllQuestions, ValidationResult } from './questionValidator';

/**
 * Validates questions in chunks to prevent UI blocking
 * Useful for large datasets (1000+ rows)
 */
export async function validateAllQuestionsChunked(
  rows: Record<string, any>[],
  columnMapping: any,
  chunkSize: number = 500,
  onProgress?: (progress: number, processedCount: number) => void
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();
  const totalRows = rows.length;
  let processedCount = 0;

  // Process in chunks
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, Math.min(i + chunkSize, rows.length));
    
    // Validate chunk (cast to QuestionData for validation)
    const chunkResults = validateAllQuestions(chunk as any, columnMapping);
    
    // Add to results map
    chunkResults.forEach(result => {
      results.set(result.rowId, result);
    });

    processedCount = Math.min(i + chunkSize, rows.length);
    const progress = Math.round((processedCount / totalRows) * 100);
    
    onProgress?.(progress, processedCount);

    // Yield to browser to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
}

/**
 * Validates a subset of rows (for re-validation after edits)
 */
export async function validateRowsSubset(
  rows: Record<string, any>[],
  columnMapping: any,
  changedRowIds: Set<string>
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();
  
  // Only validate changed rows
  const changedRows = rows.filter(row => changedRowIds.has(row.id));
  
  if (changedRows.length > 0) {
    const validationResults = validateAllQuestions(changedRows as any, columnMapping);
    validationResults.forEach(result => {
      results.set(result.rowId, result);
    });
  }

  return results;
}
