import React from "react";
import type { OpinionDocument } from "../../../core/opinions/types";

type OpinionHeaderVariant = "title" | "details";

type OpinionHeaderProps = {
  document: OpinionDocument;
  variant?: OpinionHeaderVariant;
  fallbackTitle?: string | null;
  fallbackSlipOpinion?: string | null;
  fallbackOfficialCitation?: string | null;
  fallbackCourt?: string | null;
  fallbackDecisionDate?: string | null;
};

const OpinionHeader: React.FC<OpinionHeaderProps> = ({
  document,
  variant = "details",
  fallbackTitle,
  fallbackSlipOpinion,
  fallbackOfficialCitation,
  fallbackCourt,
  fallbackDecisionDate,
}) => {
  const header = document.header;
  const title = header?.title ?? fallbackTitle ?? "";
  const slipOpinion = header?.slipOpinion ?? fallbackSlipOpinion ?? "";
  const officialCitation = header?.officialCitation ?? fallbackOfficialCitation ?? "";
  const court = header?.court ?? fallbackCourt ?? "";
  const decisionDate = header?.decisionDate ?? fallbackDecisionDate ?? "";
  const mergedHeader = {
    ...(header ?? {}),
    title,
    slipOpinion,
    officialCitation,
    court,
    decisionDate,
  };

  const normalizeDisplayValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) {
      return value
        .map((entry) => normalizeDisplayValue(entry))
        .filter(Boolean)
        .join(", ");
    }
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
  };

  const formatHeaderLabel = (key: string): string | null => {
    switch (key) {
      case "slipOpinion":
        return null;
      case "officialCitation":
        return "Official Citation";
      case "court":
        return null;
      case "decisionDate":
        return null;
      default:
        return key
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^./, (value) => value.toUpperCase());
    }
  };

  const detailEntries = Object.entries(mergedHeader).reduce<Array<{ key: string; label: string | null; value: string }>>(
    (accumulator, [key, rawValue]) => {
      if (key === "title" || key === "court" || key === "decisionDate") return accumulator;
      const value = normalizeDisplayValue(rawValue);
      if (!value) return accumulator;
      if (
        key === "officialCitation" &&
        value === normalizeDisplayValue(mergedHeader.slipOpinion)
      ) {
        return accumulator;
      }
      accumulator.push({
        key,
        label: formatHeaderLabel(key),
        value,
      });
      return accumulator;
    },
    [],
  );

  const courtLine = [normalizeDisplayValue(mergedHeader.court), normalizeDisplayValue(mergedHeader.decisionDate)]
    .filter(Boolean)
    .join(" • ");
  if (courtLine) {
    detailEntries.push({
      key: "courtDecisionDate",
      label: null,
      value: courtLine,
    });
  }

  if (variant === "title") {
    return title ? (
      <header className="opinion-title-section">
        <h1 className="case-detail__pdf-title">{title}</h1>
      </header>
    ) : null;
  }

  if (!detailEntries.length) return null;

  return (
    <section className="opinion-header">
      <dl className="opinion-header__details">
        {detailEntries.map((entry) => (
          <div
            key={entry.key}
            className={`opinion-header__row${entry.label ? "" : " opinion-header__row--value-only"}`}
          >
            {entry.label ? <dt className="opinion-header__label">{entry.label}</dt> : null}
            <dd className="opinion-header__value">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default OpinionHeader;
