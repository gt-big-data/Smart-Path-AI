import type { RawGraph } from './graphTree';

/** Final payload of /upload/process-pdf */
export interface ProcessedPdfResponse {
  graph_id?: string;
  graph?: RawGraph | null;
  [key: string]: unknown;
}

type PdfStreamEvent =
  | { type: 'progress'; percent: number; message: string }
  | { type: 'complete'; data: ProcessedPdfResponse }
  | { type: 'error'; error?: string };

/**
 * Reads the server-sent events of a process-pdf response.
 * Progress events go to onProgress. Resolves with the complete payload,
 * rejects on an error event or when no payload arrives.
 */
export async function readPdfProcessStream(
  response: Response,
  onProgress: (percent: number, message: string) => void,
): Promise<ProcessedPdfResponse> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Failed to read response stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let responseData: ProcessedPdfResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      let event: PdfStreamEvent;
      try {
        event = JSON.parse(line.slice(6));
      } catch (parseErr) {
        // Skip malformed lines, but surface anything else
        if (!(parseErr instanceof SyntaxError)) throw parseErr;
        continue;
      }

      if (event.type === 'progress') {
        onProgress(event.percent, event.message);
      } else if (event.type === 'complete') {
        responseData = event.data;
        onProgress(100, 'Processing complete!');
      } else if (event.type === 'error') {
        throw new Error(event.error || 'Failed to process file');
      }
    }
  }

  if (!responseData) throw new Error('No response data received from server');
  return responseData;
}
