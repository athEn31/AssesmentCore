import { useEffect, useRef } from 'react';

interface MathMLRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

/**
 * Component that renders HTML content containing MathML.
 * Sets innerHTML so that any <math> elements are preserved by the browser.
 */
export function MathMLRenderer({ content, className = '', inline = false }: MathMLRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !content) return;

    // Inject the raw HTML/MathML content
    el.innerHTML = content;
  }, [content]);

  const Tag = inline ? 'span' : 'div';

  return (
    <Tag
      ref={containerRef as any}
      className={`qti-rendered-content ${className}`.trim()}
      style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
    />
  );
}
