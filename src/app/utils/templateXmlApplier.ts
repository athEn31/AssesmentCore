type GeneratedChoice = {
  identifier: string;
  contentXml: string;
};

type GeneratedItemData = {
  identifier: string;
  title: string;
  questionText: string;
  promptXml: string;
  itemBodyXml: string;
  choiceInteraction: boolean;
  textEntryInteraction: boolean;
  choices: GeneratedChoice[];
  correctValues: string[];
};

function normalizeXmlInput(xml: string): string {
  return xml
    .replace(/^\uFEFF/, '')
    .replace(/^\s+(<\?xml)/, '$1')
    .trim();
}

function parseXml(xml: string): Document {
  const normalizedXml = normalizeXmlInput(xml);
  const doc = new DOMParser().parseFromString(normalizedXml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML file');
  }
  return doc;
}

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

function setInnerXml(doc: Document, element: Element, xmlFragment: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (!xmlFragment || xmlFragment.trim() === '') {
    return;
  }

  const wrapped = `<root>${xmlFragment}</root>`;
  const fragmentDoc = parseXml(wrapped);
  const root = fragmentDoc.documentElement;
  const nodes = Array.from(root.childNodes);

  nodes.forEach((node) => {
    element.appendChild(doc.importNode(node, true));
  });
}

function setCorrectResponseValues(doc: Document, responseDeclaration: Element, values: string[]): void {
  let correctResponse = findFirstByLocalName(responseDeclaration, 'correctResponse');

  if (!correctResponse) {
    correctResponse = doc.createElementNS(responseDeclaration.namespaceURI, 'correctResponse');
    responseDeclaration.appendChild(correctResponse);
  }

  while (correctResponse.firstChild) {
    correctResponse.removeChild(correctResponse.firstChild);
  }

  values.forEach((value) => {
    const valueEl = doc.createElementNS(responseDeclaration.namespaceURI, 'value');
    valueEl.textContent = value;
    correctResponse.appendChild(valueEl);
  });
}

function extractGeneratedData(generatedDoc: Document): GeneratedItemData {
  const root = findFirstByLocalName(generatedDoc, 'assessmentItem') || findFirstByLocalName(generatedDoc, 'item');
  if (!root) {
    throw new Error('Generated XML is missing assessment item root');
  }

  const itemBody = findFirstByLocalName(root, 'itemBody');
  if (!itemBody) {
    throw new Error('Generated XML is missing itemBody');
  }

  const promptEl = findFirstByLocalName(root, 'prompt');
  const choices = findAllByLocalName(root, 'simpleChoice').map((choice) => ({
    identifier: choice.getAttribute('identifier') || '',
    contentXml: getInnerXml(choice),
  }));

  const responseDeclaration = findFirstByLocalName(root, 'responseDeclaration');
  const correctResponse = responseDeclaration
    ? findFirstByLocalName(responseDeclaration, 'correctResponse')
    : null;
  const correctValues = correctResponse
    ? findAllByLocalName(correctResponse, 'value').map((valueEl) => valueEl.textContent || '')
    : [];

  const firstParagraph = findFirstByLocalName(itemBody, 'p');
  const questionText = promptEl?.textContent?.trim()
    || firstParagraph?.textContent?.trim()
    || itemBody.textContent?.trim()
    || '';

  return {
    identifier: root.getAttribute('identifier') || '',
    title: root.getAttribute('title') || '',
    questionText,
    promptXml: promptEl ? getInnerXml(promptEl) : '',
    itemBodyXml: getInnerXml(itemBody),
    choiceInteraction: !!findFirstByLocalName(root, 'choiceInteraction'),
    textEntryInteraction: !!findFirstByLocalName(root, 'textEntryInteraction'),
    choices,
    correctValues,
  };
}

function createChoiceIdentifier(index: number, existingIds: string[]): string {
  if (existingIds[index]) {
    return existingIds[index];
  }

  const firstId = existingIds[0];
  if (!firstId) {
    return `CHOICE_${index + 1}`;
  }

  const match = firstId.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${firstId}_${index + 1}`;
  }

  const prefix = match[1];
  const width = match[2].length;
  return `${prefix}${String(index + 1).padStart(width, '0')}`;
}

function updateResponseProcessingIdentifier(root: Element, oldIdentifier: string, newIdentifier: string): void {
  if (!oldIdentifier || !newIdentifier || oldIdentifier === newIdentifier) {
    return;
  }

  const baseValues = findAllByLocalName(root, 'baseValue').filter(
    (el) => el.getAttribute('baseType') === 'identifier'
  );

  baseValues.forEach((el) => {
    if ((el.textContent || '').trim() === oldIdentifier) {
      el.textContent = newIdentifier;
    }
  });
}

function applyMcqTemplate(doc: Document, templateRoot: Element, generated: GeneratedItemData): void {
  const templateBody = findFirstByLocalName(templateRoot, 'itemBody');
  const templateInteraction = findFirstByLocalName(templateRoot, 'choiceInteraction');

  if (!templateBody || !templateInteraction) {
    // If template shape is incompatible, use generated body but preserve declarations/processing from template.
    if (templateBody) {
      setInnerXml(doc, templateBody, generated.itemBodyXml);
    }
    return;
  }

  const prompt = findFirstByLocalName(templateInteraction, 'prompt') || findFirstByLocalName(templateBody, 'prompt');
  if (prompt) {
    setInnerXml(doc, prompt, generated.promptXml || generated.questionText);
  }

  const existingChoices = findAllByLocalName(templateInteraction, 'simpleChoice');
  const existingIds = existingChoices.map((choice) => choice.getAttribute('identifier') || '').filter(Boolean);

  existingChoices.forEach((choice) => choice.remove());

  const baseChoice = existingChoices[0] || null;
  const generatedChoiceIds: string[] = [];

  generated.choices.forEach((choice, index) => {
    const identifier = createChoiceIdentifier(index, existingIds);
    generatedChoiceIds.push(identifier);

    let newChoice: Element;
    if (baseChoice) {
      newChoice = baseChoice.cloneNode(true) as Element;
      while (newChoice.firstChild) {
        newChoice.removeChild(newChoice.firstChild);
      }
    } else {
      newChoice = doc.createElementNS(templateInteraction.namespaceURI, 'simpleChoice');
    }

    newChoice.setAttribute('identifier', identifier);
    setInnerXml(doc, newChoice, choice.contentXml || (choice.identifier || `Option ${index + 1}`));
    templateInteraction.appendChild(newChoice);
  });

  const generatedCorrect = generated.correctValues[0] || '';
  const generatedCorrectIndex = generated.choices.findIndex((choice) => choice.identifier === generatedCorrect);
  const fallbackIndex = generatedCorrectIndex >= 0 ? generatedCorrectIndex : 0;
  const newCorrectIdentifier = generatedChoiceIds[fallbackIndex] || generatedChoiceIds[0];

  const responseDeclaration = findFirstByLocalName(templateRoot, 'responseDeclaration');
  if (responseDeclaration && newCorrectIdentifier) {
    const previousCorrect = findFirstByLocalName(responseDeclaration, 'correctResponse');
    const oldTemplateCorrect = previousCorrect
      ? findAllByLocalName(previousCorrect, 'value')[0]?.textContent?.trim() || ''
      : '';

    setCorrectResponseValues(doc, responseDeclaration, [newCorrectIdentifier]);
    updateResponseProcessingIdentifier(templateRoot, oldTemplateCorrect, newCorrectIdentifier);
  }
}

function applyTextEntryTemplate(doc: Document, templateRoot: Element, generated: GeneratedItemData): void {
  const templateBody = findFirstByLocalName(templateRoot, 'itemBody');
  if (!templateBody) {
    return;
  }

  const prompt = findFirstByLocalName(templateBody, 'prompt');
  if (prompt) {
    setInnerXml(doc, prompt, generated.promptXml || generated.questionText);
  } else {
    const paragraph = findFirstByLocalName(templateBody, 'p');
    if (paragraph && generated.questionText) {
      paragraph.textContent = generated.questionText;
    }
  }

  const responseDeclaration = findFirstByLocalName(templateRoot, 'responseDeclaration');
  if (responseDeclaration) {
    setCorrectResponseValues(doc, responseDeclaration, [generated.correctValues[0] || '']);
  }
}

export function applyTemplateXmlToGeneratedItem(templateXml: string, generatedXml: string): string {
  const templateDoc = parseXml(templateXml);
  const generatedDoc = parseXml(generatedXml);

  const templateRoot = findFirstByLocalName(templateDoc, 'assessmentItem') || findFirstByLocalName(templateDoc, 'item');
  if (!templateRoot) {
    throw new Error('Template XML must contain an assessment item root');
  }

  const generated = extractGeneratedData(generatedDoc);

  if (generated.identifier) {
    templateRoot.setAttribute('identifier', generated.identifier);
  }

  if (generated.title) {
    templateRoot.setAttribute('title', generated.title);
  }

  if (generated.choiceInteraction) {
    applyMcqTemplate(templateDoc, templateRoot, generated);
  } else if (generated.textEntryInteraction) {
    applyTextEntryTemplate(templateDoc, templateRoot, generated);
  } else {
    const templateBody = findFirstByLocalName(templateRoot, 'itemBody');
    if (templateBody) {
      setInnerXml(templateDoc, templateBody, generated.itemBodyXml);
    }
  }

  return new XMLSerializer().serializeToString(templateDoc);
}
