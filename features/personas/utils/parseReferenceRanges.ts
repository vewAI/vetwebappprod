/**
 * Utility to parse bulk pasted reference range text (from text files, Word, Excel, Google Sheets, etc.)
 * into a structured Record<string, string> of parameter -> normal range.
 */

export interface ParseReferenceRangesOptions {
  /**
   * If true, non-blood panel/fluid section headers (e.g., CSF, Urinalysis, Peritoneal Fluid)
   * are automatically prepended to duplicate or fluid-specific parameters (e.g. "CSF - Glucose").
   * Defaults to true.
   */
  prefixSectionHeaders?: boolean;
}

export interface ParsedReferenceRangesResult {
  /** Map of parameter name -> formatted normal range */
  ranges: Record<string, string>;
  /** Array of entries in the order they were parsed */
  entries: Array<{ key: string; value: string }>;
  /** Lines that were skipped as recognized headers or narrative commentary */
  skippedHeaderLines: string[];
  /** Lines that could not be parsed into a parameter & range */
  unparsedLines: string[];
  /** Total count of successfully extracted parameters */
  count: number;
}

const COMMON_HEADER_PATTERNS = [
  /^(BLOOD\/SERUM|Reproduction|Arterial blood|Venous blood|Coagulation|Serum electro|PERITONEAL|TRACHEAL|BRONCHO|CEREBRO|PLEURAL|URINALYSIS|SYNOVIAL)/i,
  /^(These are reference|For haematology|-For bio|Standard values|Normal ranges|Laboratory findings)/i,
  /^(=+|-{3,}|\*{3,})$/,
];

function cleanSectionName(raw: string): string {
  const s = raw.replace(/^[\+\-\*•·]\s*/, "").replace(/[:]+$/, "").trim();
  if (/CEREBROSPINAL/i.test(s)) return "CSF";
  if (/URINALYSIS/i.test(s)) return "Urinalysis";
  if (/PERITONEAL/i.test(s)) return "Peritoneal Fluid";
  if (/PLEURAL/i.test(s)) return "Pleural Fluid";
  if (/SYNOVIAL/i.test(s)) return "Synovial Fluid";
  if (/TRACHEAL WASH/i.test(s)) return "Tracheal Wash";
  if (/BRONCHOALVEOLAR/i.test(s)) return "BALF";
  if (/Arterial blood gas/i.test(s)) return "ABG";
  if (/Venous blood gas/i.test(s)) return "VBG";
  if (/Coagulation/i.test(s)) return "Coagulation";
  if (/Reproduction FEMALE/i.test(s)) return "Reproduction (Female)";
  if (/Reproduction MALE/i.test(s)) return "Reproduction (Male)";
  if (/Serum electrophoresis/i.test(s)) return "Serum Electrophoresis";
  if (/BLOOD\/SERUM/i.test(s)) return "";
  if (/haematology|biochemistry|These are reference/i.test(s)) return "";
  return s;
}

function isLikelyNarrativeOrHeader(line: string): boolean {
  if (line.endsWith(":") && !line.includes("[")) return true;
  if (/^(Note|Warning|Instructions|Important):/i.test(line)) return true;
  for (const pat of COMMON_HEADER_PATTERNS) {
    if (pat.test(line) && !line.includes("[") && !line.includes(":")) {
      return true;
    }
  }
  // Check if line is all uppercase words with no numbers or brackets (e.g. "PERITONEAL FLUID")
  if (/^[A-Z\s\/\-_]+$/.test(line) && line.length > 3 && !line.includes("[")) {
    return true;
  }
  return false;
}

export function parseReferenceRanges(
  rawText: string,
  options: ParseReferenceRangesOptions = {}
): ParsedReferenceRangesResult {
  const { prefixSectionHeaders = true } = options;
  const lines = rawText.split(/\r?\n/);
  const ranges: Record<string, string> = {};
  const entries: Array<{ key: string; value: string }> = [];
  const skippedHeaderLines: string[] = [];
  const unparsedLines: string[] = [];
  let currentSection = "";

  for (const originalLine of lines) {
    let line = originalLine
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .trim();

    if (!line) continue;

    // Strip common bullet markers (+, -, *, •, bullet dots)
    line = line.replace(/^[\+\-\*•·]\s*/, "").trim();

    if (isLikelyNarrativeOrHeader(line)) {
      const section = cleanSectionName(line);
      if (section !== undefined) {
        currentSection = section;
      }
      skippedHeaderLines.push(originalLine);
      continue;
    }

    let parsedKey: string | null = null;
    let parsedVal: string | null = null;

    // 1. Bracket pattern: Parameter [Range] (optional trailing note)
    // e.g. "Red Blood Cell count (RBC) [6.40-10.40x 10^12 cells/L]"
    // e.g. "PCV: [28-44%]"
    // e.g. "Red blood cells (RBC) [0-5 /HPF] (hpf = high power field)"
    const bracketMatch = line.match(/^([^\[\]:=]+?)[\s:=]*\[([^\[\]]+)\](.*)$/);
    if (bracketMatch) {
      parsedKey = bracketMatch[1].replace(/[:=]+$/, "").trim();
      let val = bracketMatch[2].trim();
      const extra = bracketMatch[3].trim();
      if (extra && !val.includes(extra)) {
        val = `${val} ${extra}`.trim();
      }
      parsedVal = val;
    }

    // 2. Fallback for typo bracket: e.g. "gastrin (pre-prandial0 18-72pmol/L]"
    if (!parsedKey && line.includes("]") && !line.includes("[")) {
      const typoMatch = line.match(/^(.*?)\s+([<>]?\s*\d+.*)\]$/);
      if (typoMatch) {
        parsedKey = typoMatch[1].trim();
        parsedVal = typoMatch[2].trim();
      }
    }

    // 3. Tab-separated, colon-separated, or equals-separated: "PCV\t32-53%" or "PCV: 32-53%"
    if (!parsedKey) {
      const sepMatch = line.match(/^([^\t:=]+)[\t:=]+(.+)$/);
      if (sepMatch) {
        const potentialKey = sepMatch[1].trim();
        let potentialVal = sepMatch[2].trim().replace(/^\[|\]$/g, "").trim();
        // Ensure key isn't a long descriptive sentence
        if (potentialKey.length > 0 && potentialKey.length < 80 && potentialVal.length > 0) {
          parsedKey = potentialKey;
          parsedVal = potentialVal;
        }
      }
    }

    // 4. Comma-separated: "PCV, 32-53%" (where first part is parameter and second part has numbers)
    if (!parsedKey && line.includes(",")) {
      const commaMatch = line.match(/^([^,]+),\s*([<>]?\s*\d+.*)$/);
      if (commaMatch) {
        parsedKey = commaMatch[1].trim();
        parsedVal = commaMatch[2].trim();
      }
    }

    // 5. Parameter followed directly by numeric range without bracket/colon
    // e.g. "Cardiac CK (CKMB) 5.5-32.7%"
    // e.g. "Testosterone (pre HCG/stallion) 0.5-3.4nmol/L"
    if (!parsedKey) {
      const numRangeMatch = line.match(
        /^(.*?)\s+([<>]?\s*\d+(?:\.\d+)?\s*(?:[-–—]\s*\d+(?:\.\d+)?|\s*proportion|\s*%)[\w\s\/^.%*µ\(\)\-]*(?:cells\/[Ll]|mol\/[Ll]|g\/[Ll]|IU\/[Ll]|U\/[Ll]|mmHg|%|pmol|nmol|fl|pg)?)$/i
      );
      if (numRangeMatch && numRangeMatch[1].trim().length > 1) {
        parsedKey = numRangeMatch[1].trim();
        parsedVal = numRangeMatch[2].trim();
      }
    }

    if (parsedKey && parsedVal) {
      // Clean up parameter name (strip trailing colons, semicolons, dashes)
      let cleanKey = parsedKey.replace(/[:;\-\=]+$/, "").trim();
      const cleanVal = parsedVal.replace(/^[:;\-\=]+/, "").trim();

      if (
        prefixSectionHeaders &&
        currentSection &&
        !cleanKey.toLowerCase().startsWith(currentSection.toLowerCase())
      ) {
        cleanKey = `${currentSection} - ${cleanKey}`;
      }

      if (cleanKey && cleanVal) {
        ranges[cleanKey] = cleanVal;
        entries.push({ key: cleanKey, value: cleanVal });
        continue;
      }
    }

    // If none matched and line was not a header, record as unparsed
    unparsedLines.push(originalLine);
  }

  return {
    ranges,
    entries,
    skippedHeaderLines,
    unparsedLines,
    count: entries.length,
  };
}
