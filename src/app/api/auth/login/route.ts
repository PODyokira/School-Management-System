import { NextResponse } from "next/server";
import { verifyLogin, setSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const user = verifyLogin(email || "", password || "");
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  await setSession(user.id);
  return NextResponse.json({ user });
}
