import React from "react";
import type { OpinionDocument } from "../../../core/opinions/types";
import InlineMarkdown from "./InlineMarkdown";

type OpinionHeaderVariant = "title" | "details";

type OpinionHeaderEntry =
  | { key: string; label: string | null; value: string; lines?: undefined }
  | { key: string; label: string | null; value?: undefined; lines: string[] };

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
  const normalizedCourt = normalizeDisplayValue(court).toLowerCase();
  const normalizedSlipOpinion = normalizeDisplayValue(slipOpinion);
  const normalizedOfficialCitation = normalizeDisplayValue(officialCitation);
  const shouldPreferOfficialCitation =
    normalizedCourt === "court of appeals" &&
    Boolean(normalizedOfficialCitation) &&
    normalizedOfficialCitation !== normalizedSlipOpinion;

  const lawReportingBureauUrl = (() => {
    const caseId = document.source?.caseId?.trim() ?? "";
    const caseIdMatch = /^(?<year>\d{4})_(?<slug>\d{5})$/.exec(caseId);
    if (normalizedCourt !== "court of appeals" || !caseIdMatch?.groups) {
      return null;
    }
    const { year, slug } = caseIdMatch.groups;
    return `https://nycourts.gov/reporter/3dseries/${year}/${year}_${slug}.htm`;
  })();

  const formatHeaderLabel = (key: string): string | null => {
    switch (key) {
      case "caption":
        return null;
      case "slipOpinion":
        return null;
      case "officialCitation":
        return null;
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

  const detailEntries = Object.entries(mergedHeader).reduce<OpinionHeaderEntry[]>(
    (accumulator, [key, rawValue]) => {
      if (key === "title" || key === "court" || key === "decisionDate" || key === "appearances") {
        return accumulator;
      }
      if (key === "caption") {
        const lines = Array.isArray(rawValue)
          ? rawValue
              .map((entry) => normalizeDisplayValue(entry))
              .filter(Boolean)
          : [];
        if (!lines.length) return accumulator;
        accumulator.push({
          key,
          label: formatHeaderLabel(key),
          lines,
        });
        return accumulator;
      }
      if (key === "slipOpinion" && shouldPreferOfficialCitation) return accumulator;
      const value = normalizeDisplayValue(rawValue);
      if (!value) return accumulator;
      if (key === "officialCitation" && value === normalizedSlipOpinion) {
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

  const renderEntryValue = (entry: OpinionHeaderEntry) => {
    if (entry.lines) {
      return (
        <div className="opinion-header__multiline">
          {entry.lines.map((line, index) => (
            <div key={`${entry.key}-${index}`}>
              <InlineMarkdown>{line}</InlineMarkdown>
            </div>
          ))}
        </div>
      );
    }
    if (
      lawReportingBureauUrl &&
      (entry.key === "slipOpinion" || entry.key === "officialCitation")
    ) {
      return (
        <a href={lawReportingBureauUrl} target="_blank" rel="noreferrer">
          <InlineMarkdown>{entry.value}</InlineMarkdown>
        </a>
      );
    }
    return <InlineMarkdown>{entry.value}</InlineMarkdown>;
  };

  return (
    <section className="opinion-header">
      <dl className="opinion-header__details">
        {detailEntries.map((entry) => (
          <div
            key={entry.key}
            className={`opinion-header__row${entry.label ? "" : " opinion-header__row--value-only"}`}
          >
            {entry.label ? <dt className="opinion-header__label">{entry.label}</dt> : null}
            <dd className="opinion-header__value">{renderEntryValue(entry)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default OpinionHeader;
