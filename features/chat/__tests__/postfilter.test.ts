import { describe, it, expect } from 'vitest';

const treatmentRefusalRegex = /I(?:'m| am)\s+unable to provide treatment recommendations[\s\S]*?(?:Would you like to discuss treatment options[\s\S]*?)?\.?$/i;
const treatmentKeywordsReg = /\b(treat|treatment|recommend|recommendation|therapy|prescribe|prescription|antibiotic|antimicrobial|medication|dose|dosing)\b/i;

describe('Chat post-filters', () => {
  it('removes treatment refusal when user did not ask about treatment', () => {
    const content = "I'm unable to provide treatment recommendations. Would you like to discuss treatment options or do you have specific questions about the findings?";
    const userText = 'What are the heart rate and temperature values?';

    const shouldRemove = treatmentRefusalRegex.test(content) && !treatmentKeywordsReg.test(userText);
    const filtered = shouldRemove ? content.replace(treatmentRefusalRegex, '').trim() : content;

    expect(filtered).toBe('');
  });

  it('keeps refusal text when user asked about treatment', () => {
    const content = "I'm unable to provide treatment recommendations. Would you like to discuss treatment options or do you have specific questions about the findings?";
    const userText = 'What treatment would you recommend?';

    const shouldRemove = treatmentRefusalRegex.test(content) && !treatmentKeywordsReg.test(userText);
    const filtered = shouldRemove ? content.replace(treatmentRefusalRegex, '').trim() : content;

    expect(filtered).toBe(content);
  });

  it('replaces owner claims about result availability with a neutral suggestion', () => {
    const content = 'Results are available for the bloodwork. Please review the report.';
    const ownerResultsRegex = /(?:\bresults?\b[\s\S]{0,60}?\b(?:available|ready)\b(?:\s*for[^\.\n]*)?|\btest results?\b[\s\S]{0,60}?\b(?:available|ready)\b(?:\s*for[^\.\n]*)?)/gi;
    let filtered = content.replace(ownerResultsRegex, 'Please check with the nurse or laboratory for test availability.');
    filtered = filtered.replace(/\.\s*\./g, '.');
    filtered = filtered.replace(/\.{2,}/g, '.');
    filtered = filtered.replace(/\s+([.,!?;:])/g, '$1');
    expect(filtered).toBe('Please check with the nurse or laboratory for test availability. Please review the report.');
  });
});