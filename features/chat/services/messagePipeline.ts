export interface Message {
  sender: "user" | "assistant";
  content: string;
  personaRoleKey?: string;
  timestamp?: number;
}

export type Middleware = (msg: Message) => Promise<Message> | Message;

export class MessagePipeline {
  private middlewares: Middleware[];

  constructor(middlewares: Middleware[] = []) {
    this.middlewares = middlewares;
  }

  add(mw: Middleware) {
    this.middlewares.push(mw);
  }

  async process(msg: Message): Promise<Message> {
    let current = msg;
    for (const mw of this.middlewares) {
      // allow middleware to be sync or async
      // and ensure the pipeline awaits each step
      // Middleware may mutate or return a new Message
      // but should preserve `personaRoleKey` unless explicitly changed.
      // Keep this implementation intentionally tiny — behaviour is covered by tests.
      //
      // Example middleware responsibilities: validation, persona-guard, coalescer, transforms, outbound.
      // Real implementations will live in other service modules and be attached here.
      //
      // eslint-disable-next-line no-await-in-loop
      current = await mw(current);
    }
    return current;
  }
}

export default MessagePipeline;
