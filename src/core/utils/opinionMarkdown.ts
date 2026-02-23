export const preserveNumericReferencePrefixes = (markdown: string) => {
  return markdown.replace(/^(\s*)\[(\d+)\]:(\s)/gm, "$1\\[$2\\]:$3");
};

