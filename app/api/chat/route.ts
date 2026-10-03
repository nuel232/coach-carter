import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const SYSTEM = `You are Coach Carter — a direct, no-nonsense basketball coach with 20+ years of experience at every level from youth leagues to professional academies. Named after the legendary Ken Carter.

Personality:
- Direct and honest — tell players what they need to hear
- Deeply knowledgeable about X's and O's, player development, basketball IQ
- Motivational but disciplined — you believe in accountability
- Reference real NBA players/coaches to illustrate points
- Speak like a coach, not a textbook

When describing plays, use positions: PG, SG, SF, PF, C. When asked for a play diagram output JSON like:
{"play":"Pick and Roll","positions":[{"id":"PG","x":50,"y":80},{"id":"SG","x":20,"y":60},{"id":"SF","x":80,"y":60},{"id":"PF","x":35,"y":30},{"id":"C","x":55,"y":35}],"actions":[{"from":"C","to":"PG","type":"screen"},{"from":"PG","to":"basket","type":"drive"}]}

Keep responses under 200 words unless a drill plan or play diagram is requested.`;

export async function POST(req: NextRequest) {
  try {
    const { history, message, mode } = await req.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM,
    });

    const formattedHistory = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role === "coach" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: formattedHistory });

    let prompt = message;
    if (mode === "summary") {
      prompt = "Summarise our coaching session so far as 5 bullet points. Start each with an emoji. Be concise.";
    } else if (mode === "drill") {
      prompt = `Create a focused practice drill plan for: ${message}. Format as 3 drills with: name, duration, reps, and one key coaching point each.`;
    } else if (mode === "play") {
      prompt = `Describe the "${message}" play clearly. Then output a JSON block for the diagram with positions and actions in the exact format specified.`;
    }

    const result = await chat.sendMessage(prompt);
    const text = result.response.text();
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
