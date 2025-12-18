import axios from 'axios';
import { debugEventBus } from "@/lib/debug-events";

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
    console.warn("Google Search API keys not configured. Returning mock result.");
    debugEventBus.emitEvent('warning', 'MerckService', 'API keys missing, using mock result');
    return `[Mock Search Result] Information about "${query}" from Merck Veterinary Manual. 
    
    (To enable real search, configure GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX in your .env.local file. 
    The CX should be a Programmable Search Engine restricted to 'merckvetmanual.com'.)`;
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
    
    if (items.length === 0) return "No results found in Merck Veterinary Manual.";

    // Format results
    return items.map((item: any) => `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`).join("\n\n");
  } catch (error) {
    console.error("Error searching Merck Manual:", error);
    debugEventBus.emitEvent('error', 'MerckService', 'Search failed', { error: String(error) });
    return "Error performing search.";
  }
}
