type PromptInput = string | ReadonlyArray<{ content?: unknown } | string>;

export interface FakeLLMResponse {
  content: string;
}

interface RegisteredResponse {
  matcher: RegExp | string;
  content: string;
}

const DEFAULT_RESPONSE = '{}';

const responses: RegisteredResponse[] = [];

function promptToString(input: PromptInput): string {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input
      .map((message) => (typeof message === 'string' ? message : String(message.content ?? '')))
      .join('\n\n');
  }
  return String(input ?? '');
}

function toJsonString(jsonContent: string | object): string {
  return typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent);
}

export class FakeLLM {
  public defaultContent: string = DEFAULT_RESPONSE;

  invoke(input: PromptInput): FakeLLMResponse {
    const prompt = promptToString(input);

    for (const { matcher, content } of responses) {
      const matches = typeof matcher === 'string' ? prompt.includes(matcher) : matcher.test(prompt);
      if (matches) return { content };
    }

    return { content: this.defaultContent };
  }

  reset(): void {
    responses.length = 0;
    this.defaultContent = DEFAULT_RESPONSE;
  }
}

export const fakeLLM = new FakeLLM();

export function setLLMResponse(matcher: RegExp | string, jsonContent: string | object): void {
  responses.push({ matcher, content: toJsonString(jsonContent) });
}

export function setDefaultLLMResponse(jsonContent: string | object): void {
  fakeLLM.defaultContent = toJsonString(jsonContent);
}

export function resetLLMResponses(): void {
  fakeLLM.reset();
}