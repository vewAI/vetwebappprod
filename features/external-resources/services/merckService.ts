import axios from 'axios';
import { debugEventBus } from "@/lib/debug-events-fixed";

const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX; // Custom Search Engine ID restricted to merckvetmanual.com

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

export async function searchMerckManual(query: string): Promise<string> {
  const startTime = Date.now();
  debugEventBus.emitEvent('info', 'MerckService', `Searching: ${query}`);

  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    console.error("Google Search API keys not configured. Aborting Merck consult.");
    debugEventBus.emitEvent('error', 'MerckService', 'API keys missing - Merck consult aborted', {
      hint: 'Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX in server environment (no local fallback allowed)'
    });
    throw new Error('Google Search API keys not configured');
  }

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CX,
        q: query,
        num: 3 // Get top 3 results
      }
    });

    const data = response.data as any;
    const items = data.items || [];
    debugEventBus.emitEvent('success', 'MerckService', `Found ${items.length} results in ${Date.now() - startTime}ms`);

    // Emit a lightweight consult event for admin debugging: include query, results count and top result link (if any).
    try {
      debugEventBus.emitEvent('info', 'MerckService', 'Merck consult performed', {
        query,
        resultsCount: items.length,
        topLink: items[0]?.link ?? null,
        durationMs: Date.now() - startTime,
      });
    } catch (e) {
      // ignore telemetry failures
    }

    if (items.length === 0) return "No results found in Merck Veterinary Manual.";

    // Format results
    return items.map((item: any) => `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`).join("\n\n");
  } catch (error) {
    console.error("Error searching Merck Manual:", error);
    debugEventBus.emitEvent('error', 'MerckService', 'Search failed', { error: String(error), stack: (error as any)?.stack ?? null });
    throw error;
  }
}
