import { GaussStream, toNextResponse, pipeTextStream } from "@gauss-ai/chat/server";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = new GaussStream();

  // Extract the last user message
  const lastMessage = messages.at(-1);
  const prompt =
    lastMessage?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("") ?? "";

  // Example: echo the prompt back as a streaming response
  // Replace this with your actual agent integration
  async function* generateResponse(): AsyncIterable<string> {
    const words = `You said: "${prompt}". This is a demo response from Gauss!`.split(" ");
    for (const word of words) {
      yield word + " ";
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  pipeTextStream(generateResponse(), stream);

  return toNextResponse(stream);
}
