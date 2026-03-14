/**
 * Gemini AI Validation Service
 * Validates QTI XML items using Google's Gemini API for both
 * XML schema compliance and educational content quality.
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AIValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
}

export interface AIValidationItem {
  itemNo: number;
  fileName: string;
  xmlContent: string;
  isValid: boolean;
  issues: AIValidationIssue[];
  summary: string;
}

// ── API Key ────────────────────────────────────────────────────────────────────

export function getGeminiApiKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY ?? '';
}

export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return key.length > 0;
}

// ── Single Item Validation ─────────────────────────────────────────────────────

async function validateSingleItem(
  apiKey: string,
  xmlContent: string,
  qtiVersion: string,
  itemNo: number,
  fileName: string,
): Promise<AIValidationItem> {
  const userPrompt = `Analyze the following QTI ${qtiVersion} XML and validate it.

Check for:
1. XML well-formedness (proper nesting, closed tags, valid attributes)
2. QTI ${qtiVersion} specification compliance (correct elements, required attributes, proper structure)
3. Correct response processing (responseDeclaration, outcomeDeclaration, responseProcessing)
4. Proper item body structure (itemBody, interactions)
5. Namespace declarations and schema references
6. Mathematical content formatting (STRICT):
   - All math must be in valid MathML format using the default namespace (no prefixes).
   - The root element must be <math xmlns="http://www.w3.org/1998/Math/MathML">.
   - Every <math> root must contain an <mrow> as its immediate child.
   - Use <mi> for variables, <mn> for numbers, and <mo> for operators.
   - No raw LaTeX commands or delimiters ($$, \(\), etc.) should remain in the final XML EXCEPT inside attributes.
   - IMPORTANT: MathML elements MUST NOT be used inside XML attributes (like 'title' or 'prompt'). Attributes must contain only plain text.
   - No invisible operators (&#x2061;, &#x2062;), no data-semantic-* attributes, and no semantics/annotation elements.
   - Use plain tags only: math, mrow, mi, mn, mo, mfrac, msup, msub, msubsup, mtable, mtr, mtd, msqrt, mroot.
7. Content quality: Is the question educationally sound? Is the correct answer actually correct? Are distractors plausible? Is wording clear and unambiguous?

Respond ONLY with a JSON object (no markdown, no code blocks, no extra text) in this exact format:
{
  "isValid": true/false,
  "issues": [
    {"severity": "error|warning|info", "message": "description", "element": "element name if applicable"}
  ],
  "summary": "Brief one-line summary of validation result"
}

Here is the QTI XML:

${xmlContent}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: 'You are a strict QTI XML validator and educational content reviewer. Always respond with valid JSON only, no markdown formatting or code blocks.',
            },
          ],
        },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content =
      data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the JSON response, handling potential markdown wrapping
    let parsed: any;
    try {
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
      itemNo,
      fileName,
      xmlContent,
      isValid: parsed.isValid ?? true,
      issues: (parsed.issues || []).map((issue: any) => ({
        severity: issue.severity || 'info',
        message: issue.message || 'Unknown issue',
        element: issue.element,
      })),
      summary: parsed.summary || 'Validation complete',
    };
  } catch (error) {
    console.error(`AI validation failed for ${fileName}:`, error);
    return {
      itemNo,
      fileName,
      xmlContent,
      isValid: true, // Don't block export on AI failure
      issues: [
        {
          severity: 'warning',
          message: `AI validation could not complete: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      summary: 'AI validation encountered an error — manual review recommended',
    };
  }
}

// ── Batch Validation ───────────────────────────────────────────────────────────

export async function validateBatch(
  items: Array<{ fileName: string; xmlContent: string }>,
  qtiVersion: string,
  onProgress?: (current: number, total: number) => void,
): Promise<AIValidationItem[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env file.',
    );
  }

  const results: AIValidationItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await validateSingleItem(
      apiKey,
      item.xmlContent,
      qtiVersion,
      i,
      item.fileName,
    );
    results.push(result);
    onProgress?.(i + 1, items.length);
  }

  return results;
}
