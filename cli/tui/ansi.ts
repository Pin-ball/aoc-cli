const ESCAPE = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b[@-Z\\-_]/g;

/** The text as it appears on screen, with every escape sequence removed. */
export const strip = (text: string): string => text.replace(ESCAPE, "");
