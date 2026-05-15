/** CSV取込方針: 区分コードは Y で始まるもののみ */
export function isCsvStyleDivisionCode(code: string | null | undefined): boolean {
  const c = code?.trim() ?? "";
  return c.length > 0 && c.startsWith("Y");
}

/** CSV取込方針: 勘定科目コードは数字のみ（標準勘定 SYS_* は別扱い） */
export function isCsvStyleAccountCode(code: string | null | undefined): boolean {
  const c = code?.trim() ?? "";
  return /^\d+$/.test(c);
}

export function isSystemAccountCode(code: string | null | undefined): boolean {
  const c = code?.trim() ?? "";
  return c.startsWith("SYS_");
}

export function isAllowedAccountCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false;
  return isSystemAccountCode(code) || isCsvStyleAccountCode(code);
}
