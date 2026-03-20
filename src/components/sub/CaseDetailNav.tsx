import React from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";

type SubCaseDetailNavProps = {
  hasPrevious: boolean;
  hasNext: boolean;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

const SubCaseDetailNav: React.FC<SubCaseDetailNavProps> = ({
  hasPrevious,
  hasNext,
  onBack,
  onPrevious,
  onNext,
  className,
}) => {
  const navClassName = className ? `case-detail__bar ${className}` : "case-detail__bar";
  return (
    <div className={navClassName}>
      <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>
        Home
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

export default SubCaseDetailNav;
