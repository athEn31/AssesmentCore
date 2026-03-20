/**
 * Placeholder Handler - Detects and replaces placeholders in template XML
 * Supports XML comment markers: <!-- AC:token -->
 */

export type PlaceholderInfo = {
  placeholder: string; // e.g., "<!-- AC:concept -->"
  name: string; // e.g., "concept"
  fieldId: string; // unique field ID for mapping
  displayName: string; // e.g., "Concept Placeholder"
  parent: 'incorrect' | 'correct' | null; // reserved for legacy behavior
};

/**
 * Normalize placeholder tokens to lowercase snake_case
 */
function normalizePlaceholderToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'placeholder';
}

function parseCommentPlaceholder(text: string): string | null {
  const match = text.match(/^\s*AC:([a-zA-Z0-9_\- ]+)\s*$/);
  if (!match) return null;
  return normalizePlaceholderToken(match[1] || '');
}

/**
 * Extract all placeholders from XML comments in template XML.
 * Returns array of placeholder info objects.
 */
export function extractPlaceholdersFromComments(templateXml: string): PlaceholderInfo[] {
  try {
    const doc = new DOMParser().parseFromString(templateXml, 'application/xml');
    if (doc.querySelector('parsererror')) {
      return [];
    }

    const placeholders: Map<string, PlaceholderInfo> = new Map();
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
    let current = walker.nextNode();
    while (current) {
      const token = parseCommentPlaceholder(current.nodeValue || '');
      if (token) {
        const fieldId = `placeholder_${token}`;
        if (!placeholders.has(fieldId)) {
          const displayName = `Placeholder: ${token.replace(/_/g, ' ')}`;
          placeholders.set(fieldId, {
            placeholder: `<!-- AC:${token} -->`,
            name: token,
            fieldId,
            displayName,
            parent: null,
          });
        }
      }
      current = walker.nextNode();
    }

    return Array.from(placeholders.values());
  } catch (error) {
    console.error('Error extracting placeholders:', error);
    return [];
  }
}

/**
 * Legacy export name kept for compatibility.
 */
export const extractPlaceholdersFromFeedback = extractPlaceholdersFromComments;


/**
 * Replace a single placeholder comment with new content
 * Preserves wrapper structure, only updates placeholder content
 */
export function replacePlaceholder(
  rootNode: Element,
  placeholderName: string,
  newContent: string | null,
  containsMath: string,
  mathFormat: string,
  processXmlMath: (xml: string) => string,
): void {
  if (!rootNode) {
    return;
  }

  // Process LaTeX to MathML if needed
  let processedContent = newContent || '';
  if (newContent && containsMath === 'yes' && mathFormat === 'mathml') {
    try {
      processedContent = processXmlMath(newContent);
    } catch (error) {
      console.error('Error processing math in placeholder:', error);
      processedContent = newContent;
    }
  }

  const normalizedPlaceholder = normalizePlaceholderToken(placeholderName);

  // Handle empty content - remove wrapper element containing the comment placeholder
  if (!processedContent || processedContent.trim() === '') {
    removePlaceholderSection(rootNode, normalizedPlaceholder);
    return;
  }

  // Replace comment placeholders with new content while preserving structure
  const ownerDoc = rootNode.ownerDocument || document;
  const commentNodes: Comment[] = [];
  const walker = ownerDoc.createTreeWalker(rootNode, NodeFilter.SHOW_COMMENT);
  let current = walker.nextNode();
  while (current) {
    const token = parseCommentPlaceholder(current.nodeValue || '');
    if (token && token === normalizedPlaceholder) {
      commentNodes.push(current as Comment);
    }
    current = walker.nextNode();
  }

  if (commentNodes.length === 0) return;

  commentNodes.forEach((commentNode) => {
    const parentElement = commentNode.parentNode as Element | null;
    if (!parentElement) return;

    // Try to parse new content as XML fragment
    let fragmentDoc: Document | null = null;
    try {
      const fragmentWrapper = `<root>${processedContent}</root>`;
      fragmentDoc = new DOMParser().parseFromString(fragmentWrapper, 'application/xml');
      if (fragmentDoc.querySelector('parsererror')) {
        fragmentDoc = null;
      }
    } catch {
      fragmentDoc = null;
    }

    if (!fragmentDoc) {
      const textNode = ownerDoc.createTextNode(processedContent);
      parentElement.replaceChild(textNode, commentNode);
      return;
    }

    const fragment = ownerDoc.createDocumentFragment();
    Array.from(fragmentDoc.documentElement.childNodes).forEach((node) => {
      fragment.appendChild(rootNode.ownerDocument.importNode(node, true));
    });

    parentElement.replaceChild(fragment, commentNode);
  });
}

/**
 * Check if a feedback block contains any placeholders
 */
export function hasFeedbackPlaceholders(feedbackNode: Element): boolean {
  const ownerDoc = feedbackNode.ownerDocument || document;
  const walker = ownerDoc.createTreeWalker(feedbackNode, NodeFilter.SHOW_COMMENT);
  let current = walker.nextNode();
  while (current) {
    if (parseCommentPlaceholder(current.nodeValue || '')) {
      return true;
    }
    current = walker.nextNode();
  }
  return false;
}

/**
 * List placeholder names found in a node (without braces), e.g. ['concept', 'calculation']
 */
export function listPlaceholdersInNode(node: Element): string[] {
  const found = new Set<string>();
  const ownerDoc = node.ownerDocument || document;
  const walker = ownerDoc.createTreeWalker(node, NodeFilter.SHOW_COMMENT);
  let current = walker.nextNode();
  while (current) {
    const token = parseCommentPlaceholder(current.nodeValue || '');
    if (token) {
      found.add(token);
    }
    current = walker.nextNode();
  }
  return Array.from(found);
}

/**
 * Remove the whole subsection wrapper that contains a placeholder token.
 * Assumes each subsection is wrapped in its own element inside rootNode.
 */
export function removePlaceholderSection(rootNode: Element, placeholderName: string): void {
  const normalizedPlaceholder = normalizePlaceholderToken(placeholderName);
  const removals: Element[] = [];

  const ownerDoc = rootNode.ownerDocument || document;
  const walker = ownerDoc.createTreeWalker(rootNode, NodeFilter.SHOW_COMMENT);
  let current = walker.nextNode();
  while (current) {
    const token = parseCommentPlaceholder(current.nodeValue || '');
    if (token && token === normalizedPlaceholder) {
      const target = (current as Comment).parentElement;
      if (target && target !== rootNode) {
        removals.push(target);
      } else if (target) {
        // If the comment is a direct child of rootNode, just remove the comment.
        target.removeChild(current);
      }
    }
    current = walker.nextNode();
  }

  // Remove unique nodes only.
  Array.from(new Set(removals)).forEach((el) => {
    if (el.parentElement) {
      el.parentElement.removeChild(el);
    }
  });
}

