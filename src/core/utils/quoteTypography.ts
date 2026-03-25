const DOUBLE_OPEN = '“';
const DOUBLE_CLOSE = '”';
const SINGLE_OPEN = '‘';
const SINGLE_CLOSE = '’';

const isWordChar = (char: string) => /[A-Za-z0-9]/.test(char);
const isWhitespace = (char: string) => /\s/.test(char);
const isClosingPunctuation = (char: string) => /[)\]}>,.;:!?]/.test(char);
const isOpeningPunctuation = (char: string) => /[([{<\u2014/-]/.test(char);

const previousNonSpace = (text: string, index: number) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return '';
};

const nextNonSpace = (text: string, index: number) => {
  for (let i = index + 1; i < text.length; i += 1) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return '';
};

const quoteMarks = (type: 'single' | 'double', isOpening: boolean) => {
  if (type === 'single') {
    return isOpening ? SINGLE_OPEN : SINGLE_CLOSE;
  }
  return isOpening ? DOUBLE_OPEN : DOUBLE_CLOSE;
};

export const normalizeNestedQuotationMarks = (text: string) => {
  const stack: Array<'single' | 'double'> = ['double'];
  let output = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const isDoubleQuote = char === '"' || char === DOUBLE_OPEN || char === DOUBLE_CLOSE;
    const isSingleQuote = char === "'" || char === SINGLE_OPEN || char === SINGLE_CLOSE;

    if (!isDoubleQuote && !isSingleQuote) {
      output += char;
      continue;
    }

    const previous = text[index - 1] ?? '';
    const next = text[index + 1] ?? '';
    const previousVisible = previousNonSpace(text, index);
    const nextVisible = nextNonSpace(text, index);

    if (isSingleQuote && isWordChar(previous) && isWordChar(next)) {
      output += SINGLE_CLOSE;
      continue;
    }

    const activeType = stack[stack.length - 1];

    const openingContext =
      (!previousVisible && !!nextVisible) ||
      (isWhitespace(previous) && !!nextVisible && !isClosingPunctuation(nextVisible)) ||
      isOpeningPunctuation(previousVisible || previous);

    const closingContext =
      (!!previousVisible && !nextVisible) ||
      isWhitespace(next) ||
      (isWhitespace(next) && isOpeningPunctuation(nextVisible)) ||
      isClosingPunctuation(nextVisible || next);

    const shouldCloseNested = stack.length > 1 && closingContext && !openingContext;

    if (shouldCloseNested) {
      output += quoteMarks(activeType, false);
      stack.pop();
      continue;
    }

    const nextType = activeType === 'double' ? 'single' : 'double';
    output += quoteMarks(nextType, true);
    stack.push(nextType);
  }

  return output;
};
