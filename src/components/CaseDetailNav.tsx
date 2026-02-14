import React from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";

type CaseDetailNavProps = {
  hasPrevious: boolean;
  hasNext: boolean;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

const CaseDetailNav: React.FC<CaseDetailNavProps> = ({
  hasPrevious,
  hasNext,
  onBack,
  onPrevious,
  onNext,
}) => {
  return (
    <div className="case-detail__bar">
      <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>
        Back
      </Button>
      <Button
        type="text"
        className="case-detail__caption-button case-detail__caption-button--prev"
        disabled={!hasPrevious}
        onClick={onPrevious}
      >
        Previous
      </Button>
      <Button
        type="text"
        className="case-detail__caption-button case-detail__caption-button--next"
        disabled={!hasNext}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
};

export default CaseDetailNav;
