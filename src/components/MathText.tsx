import { useEffect, useRef } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

/** Start with text nodes so model output never becomes arbitrary HTML. */
export default function MathText({ children, className = "" }: {
  children?: string | null;
  className?: string;
}) {
  const element = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!element.current) return;
    element.current.textContent = children ?? "";
    renderMathInElement(element.current, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      trust: false,
    });
  }, [children]);
  return <span ref={element} className={`whitespace-pre-wrap [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden ${className}`} />;
}
