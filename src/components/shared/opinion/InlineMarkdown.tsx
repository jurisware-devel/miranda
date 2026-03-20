import React from "react";
import ReactMarkdown from "react-markdown";

type InlineMarkdownProps = {
  children: string;
};

const InlineMarkdown: React.FC<InlineMarkdownProps> = ({ children }) => {
  return (
    <ReactMarkdown
      components={{
        p: ({ children: content }) => <>{content}</>,
        a: ({ href, children: content }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {content}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
};

export default InlineMarkdown;
