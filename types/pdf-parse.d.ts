declare module "pdf-parse" {
  interface PDFParseOptions {}
  interface PDFParseResult {
    text?: string;
    info?: any;
    metadata?: any;
    numpages?: number;
    numrender?: number;
    version?: string;
    text_as_html?: string;
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array | ArrayBuffer, options?: PDFParseOptions): Promise<PDFParseResult>;
  export = pdfParse;
}
