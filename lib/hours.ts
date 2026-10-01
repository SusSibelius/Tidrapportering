/** Avrundar till tiondels timme, så att summor av flyttal inte visar 7,699999. */
export const tenth = (h: number) => Math.round(h * 10) / 10;

/** "7,7", eller "–" för noll. */
export const fmtHours = (h: number) => (tenth(h) === 0 ? "–" : String(tenth(h)).replace(".", ","));

/** Flex med tecken: "+1,3", "−0,7" eller "0". */
export const fmtFlex = (h: number) => {
  const t = tenth(h);
  if (t === 0) return "0";
  return `${t > 0 ? "+" : "−"}${String(Math.abs(t)).replace(".", ",")}`;
};

export const flexClass = (h: number) => (tenth(h) > 0 ? "plus" : tenth(h) < 0 ? "minus" : "");
