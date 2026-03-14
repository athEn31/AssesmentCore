/**
 * QTI 3.0 Stimulus Builder
 * Builds shared assessment stimulus XML and item stimulus references.
 */

export interface StimulusBuildInput {
  identifier: string;
  title?: string;
  content: string;
  language?: string;
  images?: string[];
}

export interface StimulusBuildOutput {
  stimulusId: string;
  href: string;
  xml: string;
  images: string[];
}

export interface StimulusReference {
  identifier: string;
  href: string;
}

export class StimulusBuilder {
  private readonly NAMESPACE = 'http://www.imsglobal.org/xsd/imsqti_v3p0';
  private readonly XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
  private readonly SCHEMA_LOCATION = 'http://www.imsglobal.org/xsd/qti/qtiv3p0/imsqti_v3p0.xsd';

  build(input: StimulusBuildInput): StimulusBuildOutput {
    if (!input.identifier || !input.identifier.trim()) {
      throw new Error('Stimulus identifier is required');
    }

    if (!input.content || !input.content.trim()) {
      throw new Error('Stimulus content is required');
    }

    const stimulusId = this.normalizeIdentifier(input.identifier);
    const href = `stimuli/${stimulusId}.xml`;
    const xml = this.toXML({
      identifier: stimulusId,
      title: input.title || stimulusId,
      content: input.content,
      language: input.language || 'en',
    });

    return {
      stimulusId,
      href,
      xml,
      images: input.images || [],
    };
  }

  static buildReference(reference: StimulusReference): string {
    return `      <assessmentStimulusRef identifier="${StimulusBuilder.escapeXml(reference.identifier)}" href="${StimulusBuilder.escapeXml(reference.href)}" />`;
  }

  static fromQuestion(question: any): StimulusReference | undefined {
    const stimulusId = question?.stimulusId || question?.stimulusIdentifier || question?.sharedStimulusId;
    if (!stimulusId || !String(stimulusId).trim()) {
      return undefined;
    }

    const normalized = String(stimulusId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      identifier: normalized,
      href: question?.stimulusHref || `stimuli/${normalized}.xml`,
    };
  }

  private toXML(data: { identifier: string; title: string; content: string; language: string }): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<assessmentStimulus\n`;
    xml += `  xmlns="${this.NAMESPACE}"\n`;
    xml += `  xmlns:xsi="${this.XSI_NAMESPACE}"\n`;
    xml += `  xsi:schemaLocation="${this.NAMESPACE} ${this.SCHEMA_LOCATION}"\n`;
    xml += `  identifier="${StimulusBuilder.escapeXml(data.identifier)}"\n`;
    xml += `  title="${StimulusBuilder.escapeXml(data.title)}"\n`;
    xml += `  language="${StimulusBuilder.escapeXml(data.language)}">\n\n`;
    xml += `  <stimulusBody>\n`;
    xml += `    <div>${data.content}</div>\n`;
    xml += `  </stimulusBody>\n`;
    xml += `</assessmentStimulus>\n`;
    return xml;
  }

  private normalizeIdentifier(identifier: string): string {
    return String(identifier).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export function buildAssessmentStimulus(input: StimulusBuildInput): StimulusBuildOutput {
  return new StimulusBuilder().build(input);
}
