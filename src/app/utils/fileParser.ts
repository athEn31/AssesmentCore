import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedFileData {
  columns: string[];
  rows: Record<string, any>[];
  fileName: string;
  fileType: 'xlsx' | 'csv';
}

export interface RawQuestion {
  [key: string]: any;
  id?: string;
}

/**
 * Parse uploaded file (XLSX or CSV) and extract columns and rows
 */
export async function parseFile(file: File): Promise<ParsedFileData> {
  const fileName = file.name;
  const fileType = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ? 'xlsx' : 'csv';

  if (fileType === 'xlsx') {
    return parseXlsx(file, fileName);
  } else {
    return parseCsv(file, fileName);
  }
}

/**
 * Parse XLSX file
 */
function parseXlsx(file: File, fileName: string): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

        if (jsonData.length === 0) {
          reject(new Error('No data found in the sheet'));
          return;
        }

        // Extract columns from first row
        const columns = Object.keys(jsonData[0]);

        // Add ID to each row if not present
        const rows = jsonData.map((row, index) => ({
          ...row,
          id: row.id || `row_${index}`,
        }));

        resolve({
          columns,
          rows,
          fileName,
          fileType: 'xlsx',
        });
      } catch (error) {
        reject(new Error(`Failed to parse XLSX file: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse CSV file
 */
function parseCsv(file: File, fileName: string): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const rows = results.data as Record<string, any>[];

        if (rows.length === 0) {
          reject(new Error('No data found in the CSV file'));
          return;
        }

        const columns = results.meta.fields || Object.keys(rows[0]);

        // Add ID to each row if not present
        const rowsWithId = rows.map((row, index) => ({
          ...row,
          id: row.id || `row_${index}`,
        }));

        resolve({
          columns,
          rows: rowsWithId,
          fileName,
          fileType: 'csv',
        });
      },
      error: (error: any) => {
        reject(new Error(`Failed to parse CSV file: ${error.message}`));
      },
    });
  });
}

/**
 * Detect which columns are likely question/answer related based on column names
 */
export function detectQuestionColumns(columns: string[]): {
  questionCol?: string;
  answerCol?: string;
  optionCols?: string[];
  typeCol?: string;
  difficultyCol?: string;
  solutionCol?: string;
  pointsCol?: string;
} {
  const lowerColumns = columns.map(c => c.toLowerCase());

  const result: any = {};

  // Detect question column
  const questionPatterns = ['question', 'query', 'problem', 'stem', 'text'];
  result.questionCol = columns[lowerColumns.findIndex(c => questionPatterns.some(p => c.includes(p)))];

  // Detect answer/correct answer column
  const answerPatterns = ['answer', 'correct'];
  result.answerCol = columns[lowerColumns.findIndex(c => answerPatterns.some(p => c.includes(p)))];

  // Detect option columns (A-H or Option 1-8, etc.)
  const optionCols: string[] = [];
  columns.forEach(col => {
    const lower = col.toLowerCase().trim();
    if (
      /^option\s*[a-h]$/i.test(col) ||
      /^[a-h]\s*$/.test(col) ||
      /^option\s*[1-8]$/i.test(col) ||
      /^[1-8]\s*$/.test(col)
    ) {
      optionCols.push(col);
    }
  });
  result.optionCols = optionCols.length > 0 ? optionCols : undefined;

  // Detect question type column
  const typePatterns = ['type', 'qtype', 'questiontype'];
  result.typeCol = columns[lowerColumns.findIndex(c => typePatterns.some(p => c.includes(p)))];

  // Detect difficulty column
  const diffPatterns = ['difficulty', 'level', 'difficulty_level'];
  result.difficultyCol = columns[lowerColumns.findIndex(c => diffPatterns.some(p => c.includes(p)))];

  // Detect solution column
  const solutionPatterns = ['solution', 'explanation', 'remark'];
  result.solutionCol = columns[lowerColumns.findIndex(c => solutionPatterns.some(p => c.includes(p)))];

  // Detect points column - includes 'grade' now
  const pointsPatterns = ['points', 'marks', 'score', 'weight', 'grade'];
  result.pointsCol = columns[lowerColumns.findIndex(c => pointsPatterns.some(p => c.includes(p)))];

  // Detect subject column
  const subjectPatterns = ['subject', 'category', 'domain'];
  result.subjectCol = columns[lowerColumns.findIndex(c => subjectPatterns.some(p => c.includes(p)))];

  // Detect topic column
  const topicPatterns = ['topic', 'subtopic', 'unit', 'chapter'];
  result.topicCol = columns[lowerColumns.findIndex(c => topicPatterns.some(p => c.includes(p)))];

  // Detect tolerance column (for numeric questions)
  const tolerancePatterns = ['tolerance', 'margin', 'tolerance_value'];
  result.toleranceCol = columns[lowerColumns.findIndex(c => tolerancePatterns.some(p => c.includes(p)))];

  // Detect order column (for ordering interaction)
  const orderPatterns = ['order', 'sequence', 'arrange', 'order_items'];
  result.orderCol = columns[lowerColumns.findIndex(c => orderPatterns.some(p => c.includes(p)))];

  return result;
}
