import React from "react";
import { REVIEW_MARKER } from "../logic/caseUtils";

type ReviewFieldProps = {
  value?: string;
  fallback?: string;
  onReviewClick?: () => void;
};

const ReviewField: React.FC<ReviewFieldProps> = ({
  value,
  fallback = "—",
  onReviewClick,
}) => {
  if (!value) return <>{fallback}</>;
  if (value.includes(REVIEW_MARKER)) {
    return (
      <button
        type="button"
        className="badge badge--review badge--review-button"
        onClick={onReviewClick}
      >
        Review
      </button>
    );
  }
  return <>{value}</>;
};

export default ReviewField;
