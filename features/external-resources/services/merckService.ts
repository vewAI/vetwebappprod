import axios from 'axios';

const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX; // Custom Search Engine ID restricted to merckvetmanual.com

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

export async function searchMerckManual(query: string): Promise<string> {
  const startTime = Date.now();
  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    console.error("Google Search API keys not configured. Aborting Merck consult.");
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
    // Emit a lightweight consult event for admin debugging: include query, results count and top result link (if any).
    try {
    } catch (e) {
      // ignore telemetry failures
    }

    if (items.length === 0) return "No results found in Merck Veterinary Manual.";

    // Format results
    return items.map((item: any) => `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`).join("\n\n");
  } catch (error) {
    console.error("Error searching Merck Manual:", error);
    throw error;
  }
}
