/** Keep source offsets intact so scanner findings retain their line numbers. */
export function stripComments(source: string, isTs: boolean): string {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (isTs) out = out.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  return out;
}

export interface CssBlock {
  readonly header: string;
  readonly start: number;
  readonly end: number;
  readonly parent: CssBlock | undefined;
}

/** CSS blocks in authored CSS/template text, including enclosing media rules. */
export function cssBlocks(text: string): CssBlock[] {
  const result: CssBlock[] = [];
  const stack: Array<{ header: string; start: number; end: number; parent: CssBlock | undefined }> =
    [];
  let boundary = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      for (i++; i < text.length; i++) {
        if (text[i] === '\\') i++;
        else if (text[i] === quote) break;
      }
      continue;
    }
    if (ch === '{') {
      const block = {
        header: text.slice(boundary, i).trim(),
        start: i + 1,
        end: text.length,
        parent: stack.at(-1),
      };
      stack.push(block);
      result.push(block);
      boundary = i + 1;
    } else if (ch === '}') {
      const block = stack.pop();
      if (block) block.end = i;
      boundary = i + 1;
    } else if (ch === ';' || ch === '`') {
      boundary = i + 1;
    }
  }
  return result;
}
