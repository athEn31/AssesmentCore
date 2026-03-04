/**
 * Groq AI Validation Service
 * Validates QTI XML files using Groq's LLM API before export
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

export interface AIValidationResult {
  fileName: string;
  isValid: boolean;
  score: number; // 0-100
  issues: AIValidationIssue[];
  suggestions: string[];
  summary: string;
}

export interface AIValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  element?: string;
}

export interface AIValidationBatchResult {
  totalFiles: number;
  passedFiles: number;
  failedFiles: number;
  results: AIValidationResult[];
  overallStatus: 'passed' | 'failed' | 'partial';
  timestamp: string;
}

/**
 * Get stored Groq API key from localStorage
 */
export function getGroqApiKey(): string | null {
  return localStorage.getItem('groq_api_key');
}

/**
 * Store Groq API key in localStorage
 */
export function setGroqApiKey(key: string): void {
  localStorage.setItem('groq_api_key', key);
}

/**
 * Remove stored Groq API key
 */
export function removeGroqApiKey(): void {
  localStorage.removeItem('groq_api_key');
}

/**
 * Test if a Groq API key is valid
 */
export async function testGroqApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 5,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Validate a single QTI XML file using Groq AI
 */
async function validateSingleQTI(
  apiKey: string,
  fileName: string,
  xmlContent: string,
  qtiVersion: string
): Promise<AIValidationResult> {
  const prompt = `You are a QTI (Question and Test Interoperability) XML validator expert. Analyze the following QTI ${qtiVersion} XML file and validate it.

Check for:
1. XML well-formedness (proper nesting, closed tags, valid attributes)
2. QTI ${qtiVersion} specification compliance (correct elements, required attributes, proper structure)
3. Correct response processing (responseDeclaration, outcomeDeclaration, responseProcessing)
4. Proper item body structure (itemBody content, interaction elements)
5. Namespace declarations and schema references
6. Identifier uniqueness and proper referencing

Respond ONLY with a JSON object (no markdown, no code blocks, no extra text) in this exact format:
{
  "isValid": true/false,
  "score": 0-100,
  "issues": [
    {"severity": "error|warning|info", "message": "description", "element": "element name if applicable"}
  ],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "summary": "Brief one-line summary of validation result"
}

Here is the QTI XML to validate:

${xmlContent}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a strict QTI XML validator. Always respond with valid JSON only, no markdown formatting.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response, handling potential markdown wrapper
    let parsed: any;
    try {
      // Try direct JSON parse first
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // Try finding JSON object in the text
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          parsed = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not parse AI response as JSON');
        }
      }
    }

    return {
      fileName,
      isValid: parsed.isValid ?? true,
      score: parsed.score ?? 80,
      issues: (parsed.issues || []).map((issue: any) => ({
        severity: issue.severity || 'info',
        message: issue.message || 'Unknown issue',
        element: issue.element,
      })),
      suggestions: parsed.suggestions || [],
      summary: parsed.summary || 'Validation complete',
    };
  } catch (error) {
    console.error(`AI validation failed for ${fileName}:`, error);
    return {
      fileName,
      isValid: true, // Don't block export on AI failure
      score: 0,
      issues: [
        {
          severity: 'warning',
          message: `AI validation could not complete: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      suggestions: [],
      summary: 'AI validation encountered an error - manual review recommended',
    };
  }
}

/**
 * Validate a batch of QTI XML files using Groq AI
 * Processes files in parallel batches to respect rate limits
 */
export async function validateQTIBatch(
  apiKey: string,
  files: Array<{ fileName: string; xmlContent: string }>,
  qtiVersion: string,
  onProgress?: (completed: number, total: number) => void
): Promise<AIValidationBatchResult> {
  const results: AIValidationResult[] = [];
  const BATCH_SIZE = 3; // Process 3 at a time to avoid rate limits

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(file =>
        validateSingleQTI(apiKey, file.fileName, file.xmlContent, qtiVersion)
      )
    );
    results.push(...batchResults);
    onProgress?.(Math.min(i + BATCH_SIZE, files.length), files.length);

    // Small delay between batches to be kind to rate limiter
    if (i + BATCH_SIZE < files.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const passedFiles = results.filter(r => r.isValid).length;
  const failedFiles = results.filter(r => !r.isValid).length;

  return {
    totalFiles: files.length,
    passedFiles,
    failedFiles,
    results,
    overallStatus: failedFiles === 0 ? 'passed' : passedFiles === 0 ? 'failed' : 'partial',
    timestamp: new Date().toISOString(),
  };
}
