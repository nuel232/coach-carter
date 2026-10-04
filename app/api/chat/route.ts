import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `You are Coach Carter — a direct, no-nonsense basketball coach with 20+ years of experience at every level from youth leagues to professional academies. Named after the legendary Ken Carter.

Personality:
- Direct and honest — tell players what they need to hear
- Deeply knowledgeable about X's and O's, player development, basketball IQ
- Motivational but disciplined — you believe in accountability
- Reference real NBA players/coaches to illustrate points
- Speak like a coach, not a textbook

When describing plays, use positions: PG, SG, SF, PF, C. When asked for a play diagram output JSON like:
{"play":"Pick and Roll","positions":[{"id":"PG","x":50,"y":80},{"id":"SG","x":20,"y":60},{"id":"SF","x":80,"y":60},{"id":"PF","x":35,"y":30},{"id":"C","x":55,"y":35}],"actions":[{"from":"C","to":"PG","type":"screen"},{"from":"PG","to":"basket","type":"drive"}]}

Never use emoji.

Keep responses under 200 words unless a drill plan or play diagram is requested.`;

export async function POST(req: NextRequest) {
  try {
    const { history, message, mode } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY is not configured.");
    }

    let prompt = message;
    if (mode === "summary") {
      prompt = "Summarise our coaching session so far as 5 bullet points. Start each with a short bold label. Do not use emoji. Be concise.";
    } else if (mode === "drill") {
      prompt = `Create a focused practice drill plan for: ${message}. Format as 3 drills with: name, duration, reps, and one key coaching point each.`;
    } else if (mode === "play") {
      prompt = `Describe the "${message}" play clearly. Then output a JSON block for the diagram with positions and actions in the exact format specified.`;
    }

    const formattedHistory = Array.isArray(history)
      ? history.map((m: { role: string; content: string }) => {
          const content = [{ type: "text" as const, text: m.content }];
          return m.role === "coach"
            ? { type: "model_output" as const, content }
            : { type: "user_input" as const, content };
        })
      : [];

    // Only the last few turns matter for coaching chat; shorter input = faster first token.
    const recent = formattedHistory.slice(-10);

    const genAI = new GoogleGenAI({ apiKey });
    // create() resolves once the connection is open, so quota/auth errors (429, 401)
    // still throw here and reach the catch below as a normal JSON error.
    const stream = await genAI.interactions.create({
      model: "gemini-3.8-flash",
      system_instruction: SYSTEM,
      stream: true,
      input: [
        ...recent,
        { type: "user_input", content: [{ type: "text", text: prompt }] },
      ],
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.event_type === "step.delta" && event.delta.type === "text") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(body, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
