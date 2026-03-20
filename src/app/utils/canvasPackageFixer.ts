import JSZip from 'jszip';

export type CanvasPreviewItem = {
  id: string;
  xmlPath: string;
  xmlFileName: string;
  xmlContent: string;
  status: 'ready' | 'skipped';
  includeInExport: boolean;
  issues: string[];
  referencedImages: string[];
};

export type CanvasPreviewPackage = {
  manifestOriginalXml: string;
  items: CanvasPreviewItem[];
  imageFiles: Array<{ path: string; data: Uint8Array }>;
  summary: {
    totalXml: number;
    readyXml: number;
    skippedXml: number;
    convertedImgTags: number;
  };
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

function normalizePath(value: string): string {
  let normalized = String(value || '').replace(/\\/g, '/').trim();
  normalized = normalized.replace(/^\.\//, '');
  normalized = normalized.replace(/[?#].*$/, '');

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep original normalized value when URI decoding fails.
  }

  return normalized;
}

function pathDir(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

function joinNormalizedPath(baseDir: string, relPath: string): string {
  const baseParts = normalizePath(baseDir).split('/').filter(Boolean);
  const relParts = normalizePath(relPath).split('/').filter(Boolean);
  const out = [...baseParts];

  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }

  return out.join('/');
}

function fileBaseName(path: string): string {
  const p = normalizePath(path);
  const parts = p.split('/');
  return parts[parts.length - 1] || '';
}

function getExt(path: string): string {
  const base = fileBaseName(path).toLowerCase();
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx + 1) : '';
}

function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.has(getExt(path));
}

function mimeFromPath(path: string): string {
  const ext = getExt(path);
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    bmp: 'image/bmp',
  };
  return map[ext] || 'application/octet-stream';
}

function isRemoteUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

const QTI_NS = 'http://www.imsglobal.org/xsd/imsqti_v2p1';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

function localName(nodeName: string): string {
  const parts = nodeName.split(':');
  return parts[parts.length - 1];
}

function findFirstByLocalName(root: ParentNode, name: string): Element | null {
  const elements = Array.from(root.querySelectorAll('*')) as Element[];
  return elements.find((el) => localName(el.nodeName) === name) || null;
}

function findAllByLocalName(root: ParentNode, name: string): Element[] {
  const elements = Array.from(root.querySelectorAll('*')) as Element[];
  return elements.filter((el) => localName(el.nodeName) === name);
}

function getInnerXml(element: Element): string {
  return Array.from(element.childNodes)
    .map((node) => new XMLSerializer().serializeToString(node))
    .join('');
}

function cloneIntoQtiNamespace(doc: Document, node: Node): Node {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.nodeValue || '');
  }
  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return doc.createCDATASection(node.nodeValue || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return doc.importNode(node, true);
  }

  const srcEl = node as Element;
  const outEl = createQtiElement(doc, localName(srcEl.nodeName));

  Array.from(srcEl.attributes).forEach((attr) => {
    if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) return;
    outEl.setAttribute(attr.name, attr.value);
  });

  Array.from(srcEl.childNodes).forEach((child) => {
    outEl.appendChild(cloneIntoQtiNamespace(doc, child));
  });

  return outEl;
}

function collectItemBodyImagesBeforeInteraction(itemBody: Element): string[] {
  const images: string[] = [];
  const interactionNames = new Set([
    'choiceInteraction',
    'textEntryInteraction',
    'extendedTextInteraction',
    'inlineChoiceInteraction',
    'matchInteraction',
    'orderInteraction',
    'associateInteraction',
    'gapMatchInteraction',
  ]);

  for (const node of Array.from(itemBody.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    if (interactionNames.has(localName(el.nodeName))) {
      break;
    }

    const mediaNodes = [
      ...Array.from(el.querySelectorAll('img')),
      ...Array.from(el.querySelectorAll('object')),
    ];

    mediaNodes.forEach((mediaNode) => {
      const tag = localName(mediaNode.nodeName);
      const src = tag === 'object'
        ? (mediaNode.getAttribute('data') || '')
        : (mediaNode.getAttribute('src') || '');
      if (src) images.push(src);
    });
  }

  return images;
}

function stripXmlnsAttributes(node: Element): void {
  // ONLY remove xmlns attributes from child elements, keep ones on root
  // This prevents breaking the namespace declarations Canvas expects
  Array.from(node.children || []).forEach((child) => {
    const attrsToRemove: string[] = [];
    Array.from(child.attributes || []).forEach((attr) => {
      if (attr.name.startsWith('xmlns') || attr.name === 'xmlns') {
        attrsToRemove.push(attr.name);
      }
    });
    attrsToRemove.forEach(name => child.removeAttribute(name));
    // Recurse for deeper children
    stripXmlnsAttributes(child as Element);
  });
}

function appendXmlFragment(doc: Document, parent: Element, xmlFragment: string): void {
  if (!xmlFragment || !xmlFragment.trim()) return;
  
  // Clean namespace declarations from fragment
  const cleaned = xmlFragment
    .replace(/\sxmlns(:\w+)?="[^"]*"/g, '')
    .replace(/\sxmlns=""/g, '');
  
  const wrapped = `<root>${cleaned}</root>`;
  const fragmentDoc = new DOMParser().parseFromString(wrapped, 'application/xml');
  
  if (fragmentDoc.querySelector('parsererror')) {
    // If parsing fails, append as text to avoid data loss
    if (parent.textContent) {
      parent.textContent = parent.textContent + ' ' + xmlFragment;
    } else {
      parent.textContent = xmlFragment;
    }
    return;
  }

  // Successfully parsed - import all child nodes
  Array.from(fragmentDoc.documentElement.childNodes).forEach((node) => {
    const imported = cloneIntoQtiNamespace(doc, node);
    if (imported.nodeType === Node.ELEMENT_NODE) {
      // Only strip namespace attributes from imported children, not root
      stripXmlnsAttributesFrom(imported as Element);
    }
    parent.appendChild(imported);
  });
}

// Helper function to strip xmlns from specific element only
function stripXmlnsAttributesFrom(node: Element): void {
  // Remove any xmlns attributes that might break namespace validation
  const attrsToRemove: string[] = [];
  Array.from(node.attributes || []).forEach((attr) => {
    // Remove xmlns attributes to prevent xmlns="" or conflicting declarations
    if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) {
      attrsToRemove.push(attr.name);
    }
  });
  attrsToRemove.forEach(name => node.removeAttribute(name));
  
  // Recurse to child elements
  Array.from(node.children || []).forEach((child) => {
    stripXmlnsAttributesFrom(child as Element);
  });
}

function createQtiElement(doc: Document, tag: string): Element {
  return doc.createElementNS(QTI_NS, tag);
}

function normalizeImageRefsInElement(
  doc: Document,
  root: ParentNode,
  imagePathMap: Map<string, string>,
  usedImages: Set<string>,
  issues: string[],
): number {
  let converted = 0;
  const elements = Array.from(root.querySelectorAll('*')) as Element[];
  const imageElements = elements.filter((el) => ['img', 'object'].includes(localName(el.nodeName)));

  imageElements.forEach((el) => {
    const isImg = localName(el.nodeName) === 'img';
    const attrName = isImg ? 'src' : 'data';
    const rawPath = el.getAttribute(attrName) || '';
    if (!rawPath) return;

    const normalized = normalizePath(rawPath);
    const base = fileBaseName(normalized);
    const mapped = imagePathMap.get(normalized) || imagePathMap.get(base);

    if (!mapped) {
      issues.push(`Missing image file for ${rawPath}`);
    } else {
      usedImages.add(mapped);
    }

    const targetPath = mapped || (base ? `images/${base}` : rawPath);

    const img = createQtiElement(doc, 'img');
    img.setAttribute('src', targetPath);
    img.setAttribute('alt', 'image');

    el.parentNode?.replaceChild(img, el);
    converted += 1;
  });

  return converted;
}

function formatXml(xml: string): string {
  // Preserve XML declaration if present
  let declaration = '';
  const declMatch = xml.match(/^<\?xml[^?]*\?>/);
  if (declMatch) {
    declaration = declMatch[0];
    xml = xml.substring(declMatch[0].length).trim();
  }
  
  const normalized = xml.replace(/>\s+</g, '><');
  const parts = normalized.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n');
  let indent = 0;
  
  const formatted = parts
    .map((line) => {
      if (line.match(/^<\/\w/)) indent = Math.max(indent - 1, 0);
      const pad = '  '.repeat(indent);
      // Only increase indent for opening tags without a closing tag on same line
      if (line.match(/^<[^!?/].*[^/]>$/) && !line.includes('</')) indent += 1;
      return pad + line;
    })
    .join('\n')
    .trim();
  
  // Add XML declaration back if it was present
  if (declaration) {
    return declaration + '\n' + formatted;
  }
  return formatted;
}

function deriveBaseTypeFromSource(responseDeclaration: Element | null, isChoice: boolean): 'identifier' | 'string' | 'float' {
  if (isChoice) return 'identifier';
  const baseType = (responseDeclaration?.getAttribute('baseType') || '').toLowerCase();
  return baseType === 'float' ? 'float' : 'string';
}

function isNumericAnswer(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^-?\d+(\.\d+)?$/.test(trimmed);
}

function convertFeedbackBlocks(sourceRoot: Element): void {
  const feedbackBlocks = findAllByLocalName(sourceRoot, 'feedbackBlock');
  feedbackBlocks.forEach((block) => {
    const identifier = block.getAttribute('identifier') || '';
    const outcomeIdentifier = block.getAttribute('outcomeIdentifier') || 'ANSWER_FEEDBACK';
    const parentNode = block.parentNode;

    if (parentNode && identifier) {
      const doc = sourceRoot.ownerDocument;
      if (!doc) return;
      
      // Create modalFeedback with same namespace as source
      const newFeedback = doc.createElement('modalFeedback');
      newFeedback.setAttribute('identifier', identifier);
      newFeedback.setAttribute('outcomeIdentifier', outcomeIdentifier);
      newFeedback.setAttribute('showHide', 'show');
      
      // PRESERVE: Copy all child content from feedbackBlock to modalFeedback
      const feedbackContent = getInnerXml(block);
      if (feedbackContent) {
        appendXmlFragment(doc, newFeedback, feedbackContent);
      } else {
        newFeedback.textContent = block.textContent || '';
      }
      
      parentNode.replaceChild(newFeedback, block);
    }
  });
}

function extractQuestionTextAndImages(
  xmlFragment: string,
): { textXml: string; images: string[] } {
  if (!xmlFragment || !xmlFragment.trim()) {
    return { textXml: '', images: [] };
  }

  const wrapped = `<root>${xmlFragment}</root>`;
  const fragmentDoc = new DOMParser().parseFromString(wrapped, 'application/xml');
  if (fragmentDoc.querySelector('parsererror')) {
    return { textXml: xmlFragment, images: [] };
  }

  const images: string[] = [];
  const root = fragmentDoc.documentElement;

  // FIRST: Extract and remove all img/object elements recursively
  const imageElements = Array.from(root.querySelectorAll('img, object'));
  imageElements.forEach((el) => {
    const name = localName(el.nodeName);
    if (name === 'img') {
      const src = el.getAttribute('src') || '';
      if (src) images.push(src);
    } else if (name === 'object') {
      const data = el.getAttribute('data') || '';
      if (data) images.push(data);
    }
    el.parentNode?.removeChild(el);
  });

  // SECOND: Serialize remaining content (images now removed)
  const kept: string[] = [];
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      kept.push(new XMLSerializer().serializeToString(node));
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue || '';
      if (text.trim()) {
        kept.push(text);
      }
    }
  });

  return { textXml: kept.join(''), images };
}

function extractNonInteractionItemBodyContent(itemBody: Element): string {
  const parts: string[] = [];
  Array.from(itemBody.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const name = localName(el.nodeName);
      if (name === 'choiceInteraction' || name === 'textEntryInteraction') {
        return;
      }
      if (name === 'prompt') {
        return;
      }
      if (name === 'modalFeedback' || name === 'feedbackBlock') {
        return;
      }
      parts.push(new XMLSerializer().serializeToString(el));
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue || '').trim();
      if (text) parts.push(text);
    }
  });
  return parts.join('');
}

function buildCanvasCompatibleItem(
  xml: string,
  imagePathMap: Map<string, string>,
): { xml: string; issues: string[]; referencedImages: string[]; convertedImages: number } {
  const issues: string[] = [];
  const usedImages = new Set<string>();
  let convertedImages = 0;

  const sourceDoc = new DOMParser().parseFromString(xml, 'application/xml');
  if (sourceDoc.querySelector('parsererror')) {
    return { xml, issues: ['Invalid XML: parser error'], referencedImages: [], convertedImages: 0 };
  }

  const sourceRoot = findFirstByLocalName(sourceDoc, 'assessmentItem');
  if (!sourceRoot) {
    return { xml, issues: ['Missing assessmentItem root'], referencedImages: [], convertedImages: 0 };
  }

  convertFeedbackBlocks(sourceRoot);

  const sourceResponseDeclaration = findFirstByLocalName(sourceRoot, 'responseDeclaration');
  const correctResponse = sourceResponseDeclaration ? findFirstByLocalName(sourceResponseDeclaration, 'correctResponse') : null;
  const correctValues = correctResponse ? findAllByLocalName(correctResponse, 'value').map((v) => v.textContent || '') : [];

  const sourceItemBody = findFirstByLocalName(sourceRoot, 'itemBody');
  const sourceChoiceInteraction = sourceItemBody ? findFirstByLocalName(sourceItemBody, 'choiceInteraction') : null;
  const sourceTextEntryInteraction = sourceItemBody ? findFirstByLocalName(sourceItemBody, 'textEntryInteraction') : null;

  const isChoice = !!sourceChoiceInteraction;
  const isTextEntry = !!sourceTextEntryInteraction;

  const firstCorrectValue = correctValues[0] || '';
  const isNumeric = isTextEntry && isNumericAnswer(firstCorrectValue);
  const baseType = isChoice ? 'identifier' : (isTextEntry && isNumeric ? 'float' : 'string');

  const questionPrompt =
    (sourceChoiceInteraction ? findFirstByLocalName(sourceChoiceInteraction, 'prompt') : null) ||
    (sourceItemBody
      ? findAllByLocalName(sourceItemBody, 'prompt').find((prompt) => {
          const parentName = prompt.parentElement ? localName(prompt.parentElement.nodeName) : '';
          return parentName !== 'textEntryInteraction' && parentName !== 'choiceInteraction';
        }) || null
      : null);

  let questionTextXml = questionPrompt ? getInnerXml(questionPrompt) : '';
  if (!questionTextXml && sourceItemBody) {
    const firstParagraph = findFirstByLocalName(sourceItemBody, 'p');
    questionTextXml = firstParagraph ? getInnerXml(firstParagraph) : '';
  }
  if (sourceItemBody && !questionTextXml) {
    const extraContent = extractNonInteractionItemBodyContent(sourceItemBody);
    if (extraContent && !questionTextXml.includes(extraContent)) {
      questionTextXml = `${questionTextXml}${extraContent}`;
    }
  }

  const sourceModalFeedbacks = findAllByLocalName(sourceRoot, 'modalFeedback');
  const allFeedbacks = [
    ...sourceModalFeedbacks,
    ...findAllByLocalName(sourceRoot, 'feedbackBlock'),
  ];

  const correctFeedbackEl = allFeedbacks.find((el) => {
    const identifier = (el.getAttribute('identifier') || '').toLowerCase();
    return identifier === 'correct' || identifier.includes('correct');
  });
  const incorrectFeedbackEl = allFeedbacks.find((el) => {
    const identifier = (el.getAttribute('identifier') || '').toLowerCase();
    return identifier === 'incorrect' || identifier.includes('incorrect') || identifier.includes('wrong');
  });

  // FIX: Preserve inner structure of feedback, not just text content
  const correctFeedbackContent = correctFeedbackEl ? getInnerXml(correctFeedbackEl) : '';
  const incorrectFeedbackContent = incorrectFeedbackEl ? getInnerXml(incorrectFeedbackEl) : '';
  
  const correctFeedbackText = correctFeedbackContent || (correctFeedbackEl ? (correctFeedbackEl.textContent || '').trim() : '');
  const incorrectFeedbackText = incorrectFeedbackContent || (incorrectFeedbackEl ? (incorrectFeedbackEl.textContent || '').trim() : '');

  const outputDoc = document.implementation.createDocument(QTI_NS, 'assessmentItem', null);
  const outputRoot = outputDoc.documentElement;

  outputRoot.setAttribute('xmlns', QTI_NS);
  outputRoot.setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
  outputRoot.setAttribute('xmlns:m', MATHML_NS);
  outputRoot.setAttribute(
    'xsi:schemaLocation',
    'http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd'
  );
  outputRoot.setAttribute('identifier', sourceRoot.getAttribute('identifier') || 'ITEM_1');
  outputRoot.setAttribute('title', sourceRoot.getAttribute('title') || 'Canvas Item');
  outputRoot.setAttribute('adaptive', 'false');
  outputRoot.setAttribute('timeDependent', 'false');

  const responseDeclaration = createQtiElement(outputDoc, 'responseDeclaration');
  responseDeclaration.setAttribute('identifier', 'RESPONSE');
  if (isChoice && sourceChoiceInteraction?.getAttribute('maxChoices')) {
    const maxChoices = Number(sourceChoiceInteraction.getAttribute('maxChoices'));
    responseDeclaration.setAttribute('cardinality', maxChoices > 1 ? 'multiple' : 'single');
  } else {
    responseDeclaration.setAttribute('cardinality', (sourceResponseDeclaration?.getAttribute('cardinality') || 'single'));
  }
  responseDeclaration.setAttribute('baseType', baseType);
  const correctResponseOut = createQtiElement(outputDoc, 'correctResponse');
  if (correctValues.length === 0) {
    const valueEl = createQtiElement(outputDoc, 'value');
    valueEl.textContent = '';
    correctResponseOut.appendChild(valueEl);
  } else {
    correctValues.forEach((value) => {
      const valueEl = createQtiElement(outputDoc, 'value');
      valueEl.textContent = value;
      correctResponseOut.appendChild(valueEl);
    });
  }
  responseDeclaration.appendChild(correctResponseOut);
  outputRoot.appendChild(responseDeclaration);

  const scoreDecl = createQtiElement(outputDoc, 'outcomeDeclaration');
  scoreDecl.setAttribute('identifier', 'SCORE');
  scoreDecl.setAttribute('cardinality', 'single');
  scoreDecl.setAttribute('baseType', 'float');
  const scoreDefault = createQtiElement(outputDoc, 'defaultValue');
  const scoreDefaultValue = createQtiElement(outputDoc, 'value');
  scoreDefaultValue.textContent = '0';
  scoreDefault.appendChild(scoreDefaultValue);
  scoreDecl.appendChild(scoreDefault);
  outputRoot.appendChild(scoreDecl);

  const feedbackDecl = createQtiElement(outputDoc, 'outcomeDeclaration');
  feedbackDecl.setAttribute('identifier', 'ANSWER_FEEDBACK');
  feedbackDecl.setAttribute('cardinality', 'single');
  feedbackDecl.setAttribute('baseType', 'identifier');
  const feedbackDefault = createQtiElement(outputDoc, 'defaultValue');
  const feedbackDefaultValue = createQtiElement(outputDoc, 'value');
  feedbackDefaultValue.textContent = 'INCORRECT';
  feedbackDefault.appendChild(feedbackDefaultValue);
  feedbackDecl.appendChild(feedbackDefault);
  outputRoot.appendChild(feedbackDecl);

  const itemBody = createQtiElement(outputDoc, 'itemBody');

  const extracted = extractQuestionTextAndImages(questionTextXml || '');
  const orderedImages = sourceItemBody
    ? collectItemBodyImagesBeforeInteraction(sourceItemBody)
    : extracted.images;
  let questionTextToUse = extracted.textXml || '';
  
  // FIX: Add question text FIRST for all question types (not just non-text-entry)
  if (questionTextToUse.trim()) {
    const questionP = createQtiElement(outputDoc, 'p');
    const sanitized = sanitizeQuestionText(questionTextToUse);
    if (sanitized) {
      appendXmlFragment(outputDoc, questionP, sanitized);
      convertedImages += normalizeImageRefsInElement(outputDoc, questionP, imagePathMap, usedImages, issues);
    }
    itemBody.appendChild(questionP);
  }

  // For Canvas text-entry UX, place diagrams before the input instruction.
  orderedImages.forEach((src) => {
    const base = fileBaseName(normalizePath(src));
    const mapped = imagePathMap.get(normalizePath(src)) || imagePathMap.get(base);
    const targetPath = mapped || (base ? `images/${base}` : src);
    if (mapped) {
      usedImages.add(mapped);
    } else if (base) {
      usedImages.add(`images/${base}`);
    } else {
      issues.push(`Missing image file for ${src}`);
    }

    const imageP = createQtiElement(outputDoc, 'p');
    const img = createQtiElement(outputDoc, 'img');
    img.setAttribute('src', targetPath);
    img.setAttribute('alt', 'image');
    imageP.appendChild(img);
    itemBody.appendChild(imageP);
    convertedImages += 1;
  });

  if (isTextEntry && sourceTextEntryInteraction) {
    const textEntryP = createQtiElement(outputDoc, 'p');
    // FIX: Use proper label for text entry, separate from actual question
    const entryLabel = 'Enter your answer:';
    textEntryP.appendChild(outputDoc.createTextNode(entryLabel + ' '));
    const textEntry = createQtiElement(outputDoc, 'textEntryInteraction');
    textEntry.setAttribute('responseIdentifier', 'RESPONSE');
    const expectedLength = sourceTextEntryInteraction.getAttribute('expectedLength');
    if (expectedLength) {
      textEntry.setAttribute('expectedLength', expectedLength);
    }
    textEntryP.appendChild(textEntry);
    itemBody.appendChild(textEntryP);
  } else if (isChoice && sourceChoiceInteraction) {
    const choiceInteraction = createQtiElement(outputDoc, 'choiceInteraction');
    choiceInteraction.setAttribute('responseIdentifier', 'RESPONSE');
    choiceInteraction.setAttribute('shuffle', sourceChoiceInteraction.getAttribute('shuffle') || 'false');
    choiceInteraction.setAttribute('maxChoices', sourceChoiceInteraction.getAttribute('maxChoices') || '1');

    const choices = findAllByLocalName(sourceChoiceInteraction, 'simpleChoice');
    choices.forEach((choice) => {
      const simpleChoice = createQtiElement(outputDoc, 'simpleChoice');
      const identifier = choice.getAttribute('identifier') || '';
      if (identifier) simpleChoice.setAttribute('identifier', identifier);
      const choiceContent = getInnerXml(choice);
      appendXmlFragment(outputDoc, simpleChoice, choiceContent);
      convertedImages += normalizeImageRefsInElement(outputDoc, simpleChoice, imagePathMap, usedImages, issues);
      choiceInteraction.appendChild(simpleChoice);
    });

    itemBody.appendChild(choiceInteraction);
  } else if (sourceItemBody) {
    const interactionTags = [
      'extendedTextInteraction',
      'inlineChoiceInteraction',
      'matchInteraction',
      'orderInteraction',
      'associateInteraction',
      'gapMatchInteraction',
    ];
    const sourceInteraction = interactionTags
      .map((tag) => findFirstByLocalName(sourceItemBody, tag))
      .find((el) => !!el);
    if (sourceInteraction) {
      const interactionP = createQtiElement(outputDoc, 'p');
      const cloned = outputDoc.importNode(sourceInteraction, true) as Element;
      findAllByLocalName(cloned, 'prompt').forEach((prompt) => prompt.parentNode?.removeChild(prompt));
      convertedImages += normalizeImageRefsInElement(outputDoc, cloned, imagePathMap, usedImages, issues);
      interactionP.appendChild(cloned);
      itemBody.appendChild(interactionP);
    }
  }

  cleanNestedParagraphs(itemBody);
  
  // FIX: Strip xmlns from itemBody to prevent xmlns="" in output
  stripXmlnsAttributesFrom(itemBody);

  outputRoot.appendChild(itemBody);

  // FIX: modalFeedback MUST be outside itemBody (Canvas requirement)
  const correctFeedback = createQtiElement(outputDoc, 'modalFeedback');
  correctFeedback.setAttribute('identifier', 'CORRECT');
  correctFeedback.setAttribute('outcomeIdentifier', 'ANSWER_FEEDBACK');
  correctFeedback.setAttribute('showHide', 'show');
  appendFeedbackContent(outputDoc, correctFeedback, correctFeedbackText, 'Correct.');
  // FIX: Strip xmlns from modalFeedback elements
  stripXmlnsAttributesFrom(correctFeedback);
  outputRoot.appendChild(correctFeedback);

  const incorrectFeedback = createQtiElement(outputDoc, 'modalFeedback');
  incorrectFeedback.setAttribute('identifier', 'INCORRECT');
  incorrectFeedback.setAttribute('outcomeIdentifier', 'ANSWER_FEEDBACK');
  incorrectFeedback.setAttribute('showHide', 'show');
  appendFeedbackContent(outputDoc, incorrectFeedback, incorrectFeedbackText, 'Incorrect.');
  // FIX: Strip xmlns from modalFeedback elements  
  stripXmlnsAttributesFrom(incorrectFeedback);
  outputRoot.appendChild(incorrectFeedback);

  const responseProcessing = createQtiElement(outputDoc, 'responseProcessing');
  const responseCondition = createQtiElement(outputDoc, 'responseCondition');
  const responseIf = createQtiElement(outputDoc, 'responseIf');

  if (isTextEntry) {
    // FIX: For numeric text entry, use float comparison instead of string
    if (isNumeric) {
      const match = createQtiElement(outputDoc, 'match');
      const variable = createQtiElement(outputDoc, 'variable');
      variable.setAttribute('identifier', 'RESPONSE');
      const baseValue = createQtiElement(outputDoc, 'baseValue');
      baseValue.setAttribute('baseType', 'float');
      baseValue.textContent = firstCorrectValue || '0';
      match.appendChild(variable);
      match.appendChild(baseValue);
      responseIf.appendChild(match);
    } else {
      const stringMatch = createQtiElement(outputDoc, 'stringMatch');
      stringMatch.setAttribute('caseSensitive', 'false');
      const variable = createQtiElement(outputDoc, 'variable');
      variable.setAttribute('identifier', 'RESPONSE');
      const baseValue = createQtiElement(outputDoc, 'baseValue');
      baseValue.setAttribute('baseType', 'string');
      baseValue.textContent = firstCorrectValue || '';
      stringMatch.appendChild(variable);
      stringMatch.appendChild(baseValue);
      responseIf.appendChild(stringMatch);
    }
  } else if (baseType === 'float' || isNumeric) {
    const match = createQtiElement(outputDoc, 'match');
    const variable = createQtiElement(outputDoc, 'variable');
    variable.setAttribute('identifier', 'RESPONSE');
    const baseValue = createQtiElement(outputDoc, 'baseValue');
    baseValue.setAttribute('baseType', 'float');
    baseValue.textContent = firstCorrectValue || '0';
    match.appendChild(variable);
    match.appendChild(baseValue);
    responseIf.appendChild(match);
  } else if (baseType === 'string') {
    const stringMatch = createQtiElement(outputDoc, 'stringMatch');
    stringMatch.setAttribute('caseSensitive', 'false');
    const variable = createQtiElement(outputDoc, 'variable');
    variable.setAttribute('identifier', 'RESPONSE');
    const baseValue = createQtiElement(outputDoc, 'baseValue');
    baseValue.setAttribute('baseType', 'string');
    baseValue.textContent = firstCorrectValue || '';
    stringMatch.appendChild(variable);
    stringMatch.appendChild(baseValue);
    responseIf.appendChild(stringMatch);
  } else {
    const match = createQtiElement(outputDoc, 'match');
    const variable = createQtiElement(outputDoc, 'variable');
    variable.setAttribute('identifier', 'RESPONSE');
    const correct = createQtiElement(outputDoc, 'correct');
    correct.setAttribute('identifier', 'RESPONSE');
    match.appendChild(variable);
    match.appendChild(correct);
    responseIf.appendChild(match);
  }

  const scoreIf = createQtiElement(outputDoc, 'setOutcomeValue');
  scoreIf.setAttribute('identifier', 'SCORE');
  const scoreIfValue = createQtiElement(outputDoc, 'baseValue');
  scoreIfValue.setAttribute('baseType', 'float');
  scoreIfValue.textContent = '1';
  scoreIf.appendChild(scoreIfValue);
  responseIf.appendChild(scoreIf);

  const feedbackIf = createQtiElement(outputDoc, 'setOutcomeValue');
  feedbackIf.setAttribute('identifier', 'ANSWER_FEEDBACK');
  const feedbackIfValue = createQtiElement(outputDoc, 'baseValue');
  feedbackIfValue.setAttribute('baseType', 'identifier');
  feedbackIfValue.textContent = 'CORRECT';
  feedbackIf.appendChild(feedbackIfValue);
  responseIf.appendChild(feedbackIf);

  const responseElse = createQtiElement(outputDoc, 'responseElse');
  const scoreElse = createQtiElement(outputDoc, 'setOutcomeValue');
  scoreElse.setAttribute('identifier', 'SCORE');
  const scoreElseValue = createQtiElement(outputDoc, 'baseValue');
  scoreElseValue.setAttribute('baseType', 'float');
  scoreElseValue.textContent = '0';
  scoreElse.appendChild(scoreElseValue);
  responseElse.appendChild(scoreElse);

  const feedbackElse = createQtiElement(outputDoc, 'setOutcomeValue');
  feedbackElse.setAttribute('identifier', 'ANSWER_FEEDBACK');
  const feedbackElseValue = createQtiElement(outputDoc, 'baseValue');
  feedbackElseValue.setAttribute('baseType', 'identifier');
  feedbackElseValue.textContent = 'INCORRECT';
  feedbackElse.appendChild(feedbackElseValue);
  responseElse.appendChild(feedbackElse);

  responseCondition.appendChild(responseIf);
  responseCondition.appendChild(responseElse);
  responseProcessing.appendChild(responseCondition);
  outputRoot.appendChild(responseProcessing);

  cleanNestedParagraphs(outputRoot);
  stripXmlnsAttributes(outputRoot);

  const serialized = new XMLSerializer().serializeToString(outputDoc);
  const normalizedSerialized = normalizeCanvasOutputXml(serialized);
  
  // FIX: Preserve required namespaces on root element
  // Only clean up duplicate/empty namespace declarations in child elements
  let cleaned = normalizedSerialized
    .replace(/<assessmentItem([^>]*)xmlns=""([^>]*)>/g, '<assessmentItem$1$2>');
  
  // Ensure root has proper namespaces
  if (!cleaned.includes('xmlns:xsi')) {
    cleaned = cleaned.replace(
      /^(<assessmentItem[^>]*)(xmlns="[^"]*")/,
      '$1 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"$2'
    );
  }
  if (!cleaned.includes('xmlns:m') && cleaned.includes('<!-- ') === false) {
    cleaned = cleaned.replace(
      /^(<assessmentItem[^>]*)(xmlns="[^"]*")/,
      '$1 xmlns:m="http://www.w3.org/1998/Math/MathML"$2'
    );
  }

  return {
    xml: '<?xml version="1.0" encoding="UTF-8"?>\n' + formatXml(cleaned),
    issues,
    referencedImages: Array.from(usedImages),
    convertedImages,
  };
}

function parseAttr(tag: string, attrName: string): string {
  const match = tag.match(new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] || '';
}

function canonicalPathKey(value: string): string {
  const normalized = normalizePath(value).toLowerCase();
  const base = fileBaseName(normalized);
  const dotIndex = base.lastIndexOf('.');
  const rawName = dotIndex >= 0 ? base.slice(0, dotIndex) : base;
  let ext = dotIndex >= 0 ? base.slice(dotIndex + 1) : '';
  if (ext === 'jpeg') ext = 'jpg';
  const compact = rawName.replace(/[\s._-]+/g, '');
  return ext ? `${compact}.${ext}` : compact;
}

function parseManifestResources(manifestXml: string): string[] {
  return manifestXml.match(/<resource\b[\s\S]*?<\/resource>/gi) || [];
}

function getManifestImageRefsByXmlBase(manifestXml: string): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const block of parseManifestResources(manifestXml)) {
    const fileHrefMatches = Array.from(
      block.matchAll(/<file\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/gi)
    );
    const hrefs = fileHrefMatches.map((m) => normalizePath(m[1] || '')).filter(Boolean);
    const xmlHref = hrefs.find((h) => /\.xml$/i.test(h));
    if (!xmlHref) continue;

    const xmlBase = fileBaseName(xmlHref);
    const images = hrefs.filter((h) => isImagePath(h));
    map.set(xmlBase, images);
  }

  return map;
}

function resolveImageTargetPath(
  src: string,
  xmlPath: string,
  imagePathMap: Map<string, string>,
  canonicalImagePathMap: Map<string, string>,
  declaredManifestRefs: string[]
): string | undefined {
  const normalizedSrc = normalizePath(src);
  const xmlDir = pathDir(xmlPath);

  const candidatePaths = [
    normalizedSrc,
    joinNormalizedPath(xmlDir, normalizedSrc),
    fileBaseName(normalizedSrc),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    const mapped =
      imagePathMap.get(candidate) ||
      imagePathMap.get(fileBaseName(candidate)) ||
      canonicalImagePathMap.get(canonicalPathKey(candidate));
    if (mapped) return mapped;
  }

  const srcCanonical = canonicalPathKey(normalizedSrc);
  if (srcCanonical) {
    for (const declaredPath of declaredManifestRefs) {
      if (canonicalPathKey(declaredPath) === srcCanonical) {
        const mapped =
          imagePathMap.get(declaredPath) ||
          imagePathMap.get(fileBaseName(declaredPath)) ||
          canonicalImagePathMap.get(canonicalPathKey(declaredPath));
        if (mapped) return mapped;
      }
    }
  }

  if (declaredManifestRefs.length === 1) {
    const only = declaredManifestRefs[0];
    return (
      imagePathMap.get(only) ||
      imagePathMap.get(fileBaseName(only)) ||
      canonicalImagePathMap.get(canonicalPathKey(only))
    );
  }

  return undefined;
}

function collectLocalMediaRefs(xml: string): Set<string> {
  const refs = new Set<string>();

  const objectMatches = Array.from(xml.matchAll(/<object\b[^>]*\bdata\s*=\s*["']([^"']+)["'][^>]*>/gi));
  for (const m of objectMatches) {
    const dataPath = normalizePath(m[1] || '');
    if (!dataPath || isRemoteUrl(dataPath)) continue;
    refs.add(dataPath);
  }

  const imgMatches = Array.from(xml.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi));
  for (const m of imgMatches) {
    const srcPath = normalizePath(m[1] || '');
    if (!srcPath || isRemoteUrl(srcPath)) continue;
    refs.add(srcPath);
  }

  return refs;
}

function cleanNestedParagraphs(element: Element): void {
  Array.from(element.querySelectorAll('p > p')).forEach((nestedP) => {
    const parent = nestedP.parentElement;
    if (!parent) return;
    while (nestedP.firstChild) {
      parent.insertBefore(nestedP.firstChild, nestedP);
    }
    parent.removeChild(nestedP);
  });
}

function sanitizeQuestionText(textXml: string): string {
  if (!textXml || !textXml.trim()) return '';
  // Only strip the outermost paragraph tags if they exist
  // Preserve internal structure and formatting
  let cleaned = textXml.trim();
  cleaned = cleaned
    .replace(/<modalFeedback\b[\s\S]*?<\/modalFeedback>/gi, '')
    .replace(/<feedbackBlock\b[\s\S]*?<\/feedbackBlock>/gi, '');
  // Only strip if ENTIRE content is wrapped in ONE <p> tag
  if (/^<p[^>]*>.*<\/p>$/is.test(cleaned)) {
    cleaned = cleaned.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '');
  }
  return cleaned.trim();
}

function appendFeedbackContent(doc: Document, feedbackNode: Element, content: string, fallback: string): void {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    const p = createQtiElement(doc, 'p');
    p.textContent = fallback;
    feedbackNode.appendChild(p);
    return;
  }

  const wrapped = `<root>${trimmed}</root>`;
  const parsed = new DOMParser().parseFromString(wrapped, 'application/xml');
  if (parsed.querySelector('parsererror')) {
    const p = createQtiElement(doc, 'p');
    p.textContent = trimmed;
    feedbackNode.appendChild(p);
    return;
  }

  const nodes = Array.from(parsed.documentElement.childNodes);
  if (nodes.length === 0) {
    const p = createQtiElement(doc, 'p');
    p.textContent = fallback;
    feedbackNode.appendChild(p);
    return;
  }

  nodes.forEach((node) => {
    const imported = cloneIntoQtiNamespace(doc, node);
    if (imported.nodeType === Node.ELEMENT_NODE) {
      stripXmlnsAttributesFrom(imported as Element);
    }
    feedbackNode.appendChild(imported);
  });
}

function normalizeCanvasOutputXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;

  const root = findFirstByLocalName(doc, 'assessmentItem');
  if (!root) return xml;

  const itemBody = findFirstByLocalName(root, 'itemBody');
  if (itemBody) {
    const leakedFeedback = findAllByLocalName(itemBody, 'modalFeedback');
    leakedFeedback.forEach((fb) => {
      fb.parentNode?.removeChild(fb);
      root.appendChild(fb);
    });
  }

  stripXmlnsAttributes(root);

  root.setAttribute('xmlns', QTI_NS);
  root.setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
  root.setAttribute('xmlns:m', MATHML_NS);
  if (!root.getAttribute('xsi:schemaLocation')) {
    root.setAttribute(
      'xsi:schemaLocation',
      'http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd'
    );
  }

  return new XMLSerializer().serializeToString(doc);
}

export function transformXmlForCanvasExport(xml: string): string {
  // Legacy export point. The new Canvas converter is applied during preview/build steps.
  return formatXml(xml);
}

function updateManifest(
  manifestXml: string,
  itemMap: Map<string, CanvasPreviewItem>
): string {
  let updated = manifestXml;

  const resourceBlocks = parseManifestResources(updated);
  for (const block of resourceBlocks) {
    const hrefMatch = block.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    const fileHrefMatches = Array.from(block.matchAll(/<file\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/gi));

    const xmlHrefFromFiles = fileHrefMatches
      .map((m) => m[1])
      .find((href) => /\.xml$/i.test(href));

    const xmlHref = xmlHrefFromFiles || hrefMatch?.[1] || '';
    const xmlBase = fileBaseName(xmlHref);
    if (!xmlBase) continue;

    const item = itemMap.get(xmlBase);
    if (!item || !item.includeInExport) {
      updated = updated.replace(block, '');
      continue;
    }

    const allImageRefs = new Set<string>(item.referencedImages || []);
    // Also collect images referenced in the XML content itself
    collectLocalMediaRefs(item.xmlContent).forEach((path) => allImageRefs.add(path));

    let newBlock = block;
    
    // FIX: Properly escape paths and avoid duplicate entries
    for (const imgPath of allImageRefs) {
      const escaped = imgPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Check with more flexible regex to handle quotes variations
      const exists = new RegExp(`<file\\b[^>]*\\bhref\\s*=\\s*["']?${escaped}["']?`, 'i').test(newBlock);
      if (!exists && imgPath.trim()) {
        // Safely add file entry without duplicates
        newBlock = newBlock.replace(
          /<\/resource>\s*$/i, 
          `    <file href="${imgPath}"/>\n  </resource>`
        );
      }
    }

    updated = updated.replace(block, newBlock);
  }

  return updated;
}

export async function prepareCanvasPackagePreview(file: File): Promise<CanvasPreviewPackage> {
  const inputZip = await JSZip.loadAsync(file);

  const allEntries = Object.entries(inputZip.files);
  const manifestEntry = allEntries.find(
    ([path, entry]) => !entry.dir && /(^|\/)imsmanifest\.xml$/i.test(path)
  );
  if (!manifestEntry) {
    throw new Error('Uploaded ZIP must contain imsmanifest.xml');
  }

  const manifestXmlOriginal = await inputZip.file(manifestEntry[0])!.async('text');
  const manifestImageRefsByXmlBase = getManifestImageRefsByXmlBase(manifestXmlOriginal);

  const imagePathMap = new Map<string, string>();
  const canonicalImagePathMap = new Map<string, string>();
  const imageFiles: Array<{ path: string; data: Uint8Array }> = [];

  for (const [path, entry] of allEntries) {
    if (entry.dir) continue;
    const normalized = normalizePath(path);
    if (!isImagePath(normalized)) continue;

    const base = fileBaseName(normalized);
    if (!base) continue;

    const target = `images/${base}`;
    imagePathMap.set(normalized, target);
    if (!imagePathMap.has(base)) {
      imagePathMap.set(base, target);
    }

    const canonical = canonicalPathKey(base);
    if (canonical && !canonicalImagePathMap.has(canonical)) {
      canonicalImagePathMap.set(canonical, target);
    }

    const bytes = await entry.async('uint8array');
    imageFiles.push({ path: target, data: bytes });
  }

  const xmlEntries = allEntries.filter(
    ([path, entry]) => !entry.dir && /\.xml$/i.test(path) && !/(^|\/)imsmanifest\.xml$/i.test(path)
  );

  const items: CanvasPreviewItem[] = [];
  let convertedImgTags = 0;

  for (let i = 0; i < xmlEntries.length; i += 1) {
    const [xmlPath] = xmlEntries[i];
    const xmlBase = fileBaseName(xmlPath);
    const xmlOutputPath = normalizePath(xmlPath);
    const xmlText = await inputZip.file(xmlPath)!.async('text');
    const declaredManifestRefs = manifestImageRefsByXmlBase.get(xmlBase) || [];

    const issues: string[] = [];
    let status: 'ready' | 'skipped' = 'ready';
    let includeInExport = true;

    const converted = buildCanvasCompatibleItem(xmlText, imagePathMap);
    convertedImgTags += converted.convertedImages;

    if (converted.issues.length > 0) {
      status = 'skipped';
      issues.push(...converted.issues);
    }

    items.push({
      id: `canvas-item-${i + 1}`,
      xmlPath: xmlOutputPath,
      xmlFileName: xmlBase,
      xmlContent: converted.xml,
      status,
      includeInExport,
      issues,
      referencedImages: converted.referencedImages,
    });
  }

  const readyXml = items.filter((item) => item.status === 'ready').length;
  const skippedXml = items.filter((item) => item.status === 'skipped').length;

  return {
    manifestOriginalXml: manifestXmlOriginal,
    items,
    imageFiles,
    summary: {
      totalXml: items.length,
      readyXml,
      skippedXml,
      convertedImgTags,
    },
  };
}

export async function buildCanvasPackageFromPreview(preview: CanvasPreviewPackage): Promise<Blob> {
  const outputZip = new JSZip();

  const itemMap = new Map<string, CanvasPreviewItem>();
  const transformedItems: CanvasPreviewItem[] = [];

  for (const item of preview.items) {
    if (!item.includeInExport) continue;

    const transformedItem: CanvasPreviewItem = {
      ...item,
      xmlContent: item.xmlContent,
    };

    transformedItems.push(transformedItem);
    itemMap.set(fileBaseName(transformedItem.xmlFileName), transformedItem);
    outputZip.file(transformedItem.xmlPath, transformedItem.xmlContent);
  }

  const updatedManifest = updateManifest(preview.manifestOriginalXml, itemMap);
  outputZip.file('imsmanifest.xml', updatedManifest);

  for (const image of preview.imageFiles) {
    outputZip.file(image.path, image.data);
  }

  return outputZip.generateAsync({ type: 'blob' });
}
