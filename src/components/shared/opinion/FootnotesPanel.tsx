import React from "react";
import { Collapse } from "antd";
import type { OpinionFootnote } from "../../../core/opinions/types";
import OpinionBlock from "./OpinionBlock";

type FootnotesPanelProps = {
  footnotes?: OpinionFootnote[] | null;
  opinionSourceUrl?: string;
};

const FootnotesPanel: React.FC<FootnotesPanelProps> = ({ footnotes, opinionSourceUrl }) => {
  if (!footnotes?.length) return null;

  return (
    <section className="opinion-footnotes" aria-labelledby="opinion-footnotes-heading">
      <h2 id="opinion-footnotes-heading" className="opinion-section__title">
        Footnotes
      </h2>
      <Collapse
        className="opinion-footnotes__collapse"
        items={[
          {
            key: "footnotes",
            label: `Show footnotes (${footnotes.length})`,
            children: (
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
            ),
          },
        ]}
      />
    </section>
  );
};

export default FootnotesPanel;
