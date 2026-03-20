import React from "react";

type TagCapsuleProps = {
  label: string;
  background?: string;
  color?: string;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  rightSlot?: React.ReactNode;
  ariaLabel?: string;
};

const TagCapsule: React.FC<TagCapsuleProps> = ({
  label,
  background,
  color,
  onClick,
  className,
  size = "sm",
  rightSlot,
  ariaLabel,
}) => {
  const classes = ["tag-capsule", `tag-capsule--${size}`, className]
    .filter(Boolean)
    .join(" ");
  const style = { background, color };
  const content = (
    <>
      <span className="tag-capsule__label">{label}</span>
      {rightSlot ? <span className="tag-capsule__slot">{rightSlot}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={onClick}
        aria-label={ariaLabel ?? label}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classes} style={style} aria-label={ariaLabel ?? label}>
      {content}
    </span>
  );
};

export default TagCapsule;
