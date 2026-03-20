import React from "react";
import type { OpinionAppearance } from "../../../core/opinions/types";
import InlineMarkdown from "./InlineMarkdown";

type OpinionAppearancesProps = {
  appearances?: OpinionAppearance[] | null;
  showTitle?: boolean;
};

const OpinionAppearances: React.FC<OpinionAppearancesProps> = ({
  appearances,
  showTitle = true,
}) => {
  if (!appearances?.length) return null;

  return (
    <section
      className="opinion-appearances"
      aria-labelledby={showTitle ? "opinion-appearances-heading" : undefined}
      aria-label={showTitle ? undefined : "Appearances of Counsel"}
    >
      {showTitle ? (
        <h2 id="opinion-appearances-heading" className="opinion-section__title">
          Appearances of Counsel
        </h2>
      ) : null}
      <div className="opinion-appearances__list">
        {appearances.map((appearance, index) =>
          appearance?.text ? (
            <p key={`${appearance.side ?? "appearance"}-${index}`}>
              <InlineMarkdown>{appearance.text}</InlineMarkdown>
            </p>
          ) : null,
        )}
      </div>
    </section>
  );
};

export default OpinionAppearances;
