import React from "react";
import type { OpinionAppearance } from "../../../core/opinions/types";

type OpinionAppearancesProps = {
  appearances?: OpinionAppearance[] | null;
};

const OpinionAppearances: React.FC<OpinionAppearancesProps> = ({ appearances }) => {
  if (!appearances?.length) return null;

  return (
    <section className="opinion-appearances" aria-labelledby="opinion-appearances-heading">
      <h2 id="opinion-appearances-heading" className="opinion-section__title">
        Appearances
      </h2>
      <div className="opinion-appearances__list">
        {appearances.map((appearance, index) =>
          appearance?.text ? (
            <p key={`${appearance.side ?? "appearance"}-${index}`}>{appearance.text}</p>
          ) : null,
        )}
      </div>
    </section>
  );
};

export default OpinionAppearances;
