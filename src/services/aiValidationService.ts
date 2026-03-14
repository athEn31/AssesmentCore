/**
 * Unified AI Validation Service
 * Supports both Groq and Gemini APIs for QTI XML validation
 */

export type AIProvider = 'groq' | 'gemini';

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

// ── API Keys ────────────────────────────────────────────────────────────────────

export function getGroqApiKey(): string {
  return import.meta.env.VITE_GROQ_API_KEY ?? '';
}

export function getGeminiApiKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY ?? '';
}

export function isProviderConfigured(provider: AIProvider): boolean {
  if (provider === 'groq') {
    return getGroqApiKey().length > 0;
  }
  return getGeminiApiKey().length > 0;
}

export function getAvailableProviders(): AIProvider[] {
  const available: AIProvider[] = [];
  if (isProviderConfigured('gemini')) available.push('gemini');
  if (isProviderConfigured('groq')) available.push('groq');
  return available;
}

// ── Groq Validation ────────────────────────────────────────────────────────────

async function validateWithGroq(
  xmlContent: string,
  qtiVersion: string,
  itemNo: number,
  fileName: string,
): Promise<AIValidationItem> {
  const apiKey = getGroqApiKey();
  const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
   - IMPORTANT: MathML elements MUST NOT be used inside XML attributes (like 'title' or 'prompt'). Attributes must contain only plain text (LaTeX in attributes is okay if necessary, but plain text is preferred).
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
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: 'You are a strict QTI XML validator and educational content reviewer. Always respond with valid JSON only, no markdown formatting or code blocks.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response
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
    console.error(`Groq validation failed for ${fileName}:`, error);
    return {
      itemNo,
      fileName,
      xmlContent,
      isValid: true,
      issues: [
        {
          severity: 'warning',
          message: `Groq validation could not complete: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      summary: 'Groq validation encountered an error — manual review recommended',
    };
  }
}

// ── Gemini Validation ────────────────────────────────────────────────────────

async function validateWithGemini(
  xmlContent: string,
  qtiVersion: string,
  itemNo: number,
  fileName: string,
): Promise<AIValidationItem> {
  const apiKey = getGeminiApiKey();
  const GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

    // Parse the JSON response
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
    console.error(`Gemini validation failed for ${fileName}:`, error);
    return {
      itemNo,
      fileName,
      xmlContent,
      isValid: true,
      issues: [
        {
          severity: 'warning',
          message: `Gemini validation could not complete: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      summary: 'Gemini validation encountered an error — manual review recommended',
    };
  }
}

// ── Single Item Validation (Provider-agnostic) ──────────────────────────────────

async function validateSingleItem(
  provider: AIProvider,
  xmlContent: string,
  qtiVersion: string,
  itemNo: number,
  fileName: string,
): Promise<AIValidationItem> {
  if (provider === 'groq') {
    return validateWithGroq(xmlContent, qtiVersion, itemNo, fileName);
  }
  return validateWithGemini(xmlContent, qtiVersion, itemNo, fileName);
}

// ── Auto-fix (QTI + MathML) ─────────────────────────────────────────────────────

async function autoFixWithGroq(
  xmlContent: string,
  qtiVersion: string,
): Promise<string> {
  const apiKey = getGroqApiKey();
  const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  const userPrompt = `You are a QTI ${qtiVersion} and MathML fixer.

Given the following QTI XML, return a corrected version that:
- Keeps the same educational content, structure, identifiers, and scoring logic.
- Fixes any XML well-formedness or QTI structural issues.
- Ensures all MathML is clean Presentation MathML only.
- Every mathematical expression must be wrapped inside exactly: <math xmlns="http://www.w3.org/1998/Math/MathML"><mrow> ... </mrow></math>
- Do NOT use namespace prefixes (like m:). Use plain tags: math, mrow, mi, mn, mo, etc.
- Never place operators or identifiers directly inside <math>; they must be inside <mrow>.
- Map elements STRICTLY: variables -> <mi>, numbers -> <mn>, operators -> <mo>.
- Fractions must use <mfrac>. Superscripts must use <msup>. Do NOT use <mo>^</mo>.
- Subscripts must use <msub>. Subscript + Superscript must use <msubsup>.
- Matrices must use <mtable>, <mtr>, <mtd>.
- The AI must NOT generate: &#x2062;, &#x2061;, empty <mrow>, <semantics>, <annotation>, or non-standard attributes like data-semantic*.
- No raw LaTeX commands remain (\\frac, \\sqrt, etc).

Respond ONLY with a JSON object (no markdown, no code blocks) in this exact format:
{
  "fixedXml": "FULL_QTI_XML_HERE"
}

Here is the original QTI XML:

${xmlContent}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: 'You are a strict QTI XML and MathML fixer. Always respond with valid JSON only, no markdown formatting or code blocks.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq AI fix error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        parsed = JSON.parse(objectMatch[0]);
      } else if (content.trim().startsWith('<')) {
        // Fallback: model returned raw XML instead of JSON
        return content.trim();
      } else {
        throw new Error('Could not parse AI fix response as JSON');
      }
    }
  }

  if (!parsed.fixedXml || typeof parsed.fixedXml !== 'string') {
    // Fallback: if content itself looks like XML, use it directly
    if (content.trim().startsWith('<')) {
      return content.trim();
    }
    throw new Error('AI fix response did not include fixedXml');
  }

  return parsed.fixedXml;
}

async function autoFixWithGemini(
  xmlContent: string,
  qtiVersion: string,
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  const userPrompt = `You are a QTI ${qtiVersion} and MathML fixer.

Given the following QTI XML, return a corrected version that:
- Keeps the same educational content, structure, identifiers, and scoring logic.
- Fixes any XML well-formedness or QTI structural issues.
- Ensure all mathematical content is converted to valid, strictly formatted MathML.
- Every <math> block MUST use the xmlns="http://www.w3.org/1998/Math/MathML" attribute and NO namespace prefix.
- Every <math> root MUST contain exactly one <mrow> as its immediate child which wraps the expression.
- Use <mi> for variables/identifiers, <mn> for numbers, and <mo> for operators.
- Fractions must use <mfrac>. Superscripts must <msup>. Subscripts <msub>.
- Matrices must use <mtable>, <mtr>, <mtd>.
- The output must NOT contain: invisible characters (&#x2061;, &#x2062;), data-semantic-* attributes, empty <mrow>, <semantics> or <annotation> elements.
- Ensure no raw LaTeX or delimiters ($$, \(\), etc.) remain in text content.
- IMPORTANT: MathML elements MUST NOT be used inside XML attributes (like 'title'). Attributes must be plain text only.
- Ensure the 'title' attribute of assessmentItem contains NO MathML and NO LaTeX. It should be plain text.

Respond ONLY with a JSON object (no markdown, no code blocks) in this exact format:
{
  "fixedXml": "FULL_QTI_XML_HERE"
}

Here is the original QTI XML:

${xmlContent}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [
          {
            text: 'You are a strict QTI XML and MathML fixer. Always respond with valid JSON only, no markdown formatting or code blocks.',
          },
        ],
      },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini AI fix error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content =
    data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        parsed = JSON.parse(objectMatch[0]);
      } else if (content.trim().startsWith('<')) {
        // Fallback: model returned raw XML instead of JSON
        return content.trim();
      } else {
        throw new Error('Could not parse AI fix response as JSON');
      }
    }
  }

  if (!parsed.fixedXml || typeof parsed.fixedXml !== 'string') {
    // Fallback: if content itself looks like XML, use it directly
    if (content.trim().startsWith('<')) {
      return content.trim();
    }
    throw new Error('AI fix response did not include fixedXml');
  }

  return parsed.fixedXml;
}

export async function autoFixXml(
  provider: AIProvider,
  xmlContent: string,
  qtiVersion: string,
): Promise<string> {
  if (!isProviderConfigured(provider)) {
    throw new Error(
      `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key is not configured.`,
    );
  }

  if (provider === 'groq') {
    return autoFixWithGroq(xmlContent, qtiVersion);
  }
  return autoFixWithGemini(xmlContent, qtiVersion);
}

// ── Batch Validation ────────────────────────────────────────────────────────────

export async function validateBatch(
  items: Array<{ fileName: string; xmlContent: string }>,
  qtiVersion: string,
  provider: AIProvider,
  onProgress?: (current: number, total: number) => void,
): Promise<AIValidationItem[]> {
  if (!isProviderConfigured(provider)) {
    throw new Error(
      `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key is not configured.`,
    );
  }

  const results: AIValidationItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await validateSingleItem(
      provider,
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
