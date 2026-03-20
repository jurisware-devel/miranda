import React from "react";
import type { OpinionFootnote } from "../../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";

type FootnotesPanelProps = {
  footnotes?: OpinionFootnote[] | null;
  opinionSourceUrl?: string;
  showTitle?: boolean;
};

const FootnotesPanel: React.FC<FootnotesPanelProps> = ({
  footnotes,
  opinionSourceUrl,
  showTitle = true,
}) => {
  if (!footnotes?.length) return null;

  return (
    <section
      className="opinion-footnotes"
      aria-labelledby={showTitle ? "opinion-footnotes-heading" : undefined}
      aria-label={showTitle ? undefined : "Footnotes"}
    >
      {showTitle ? (
        <h2 id="opinion-footnotes-heading" className="opinion-section__title">
          Footnotes
        </h2>
      ) : null}
      <div className="opinion-footnotes__list">
        {footnotes.map((footnote, index) => {
          const label = footnote.label?.trim() || String(index + 1);
          return (
            <section
              key={label}
              id={`opinion-footnote-${label}`}
              className="opinion-footnote"
            >
              <h3 className="opinion-footnote__label">{label}</h3>
              {footnote.blocks?.map((block, blockIndex) => (
                <OpinionBlock
                  key={`${label}-${block.type}-${blockIndex}`}
                  block={block}
                  opinionSourceUrl={opinionSourceUrl}
                />
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
};

export default FootnotesPanel;
