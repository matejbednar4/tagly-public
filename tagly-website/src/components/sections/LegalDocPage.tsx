import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { legalStyles } from "@/lib/legal-styles";
import { loadLegalDoc, type LegalDoc } from "@/lib/legal-docs";

const olClass =
  "mt-(--spacing-element-gap) list-decimal pl-(--spacing-element-gap) text-style-body text-text";

const sectionClass =
  "mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pt-(--spacing-section-gap) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)";

const components: Components = {
  h1: ({ children }) => <h1 className={legalStyles.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={legalStyles.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={legalStyles.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={legalStyles.h4}>{children}</h4>,
  p: ({ children }) => <p className={legalStyles.p}>{children}</p>,
  ul: ({ children }) => <ul className={legalStyles.ul}>{children}</ul>,
  ol: ({ children }) => <ol className={olClass}>{children}</ol>,
  a: ({ href, children }) => (
    <a href={href} className={legalStyles.link}>
      {children}
    </a>
  ),
  blockquote: () => null,
  // GFM tables: the Privacy Policy's service-provider, retention and legal-basis
  // tables. Wrapped in an overflow-x container so a wide table scrolls itself
  // instead of scrolling the page.
  table: ({ children }) => (
    <div className={legalStyles.tableWrap}>
      <table className={legalStyles.table}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tr: ({ children }) => <tr className={legalStyles.tr}>{children}</tr>,
  th: ({ children }) => <th className={legalStyles.th}>{children}</th>,
  td: ({ children }) => <td className={legalStyles.td}>{children}</td>,
};

export default function LegalDocPage({
  lng,
  doc,
}: {
  lng: string;
  doc: LegalDoc;
}) {
  const source = loadLegalDoc(lng, doc);
  return (
    <main data-no-animate>
      <section className={sectionClass}>
        <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
          {source}
        </ReactMarkdown>
      </section>
    </main>
  );
}
