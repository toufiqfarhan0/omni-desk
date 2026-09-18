import { NextResponse } from "next/server";
import {
  signUpOwner,
  signInOwner,
  emailExists,
  listBusinesses,
  createBusiness,
} from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "").trim();
    const name = (body.name || "").trim();
    const mode = (body.mode || "signin") as "signin" | "signup";

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ ok: false, error: "Password is required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }

    let owner = null;

    if (mode === "signup") {
      owner = await signUpOwner(email, password, name || undefined);
      if (!owner) {
        return NextResponse.json(
          { ok: false, error: "An account with this email already exists. Please sign in instead." },
          { status: 409 }
        );
      }
    } else {
      // signin — try to authenticate
      owner = await signInOwner(email, password);
      if (!owner) {
        // Differentiate: no account vs wrong password
        const exists = await emailExists(email);
        if (!exists) {
          return NextResponse.json(
            { ok: false, error: "No account found with this email.", code: "NOT_FOUND" },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { ok: false, error: "Incorrect password. Please try again.", code: "WRONG_PASSWORD" },
          { status: 401 }
        );
      }
    }

    // Load associated businesses
    let businesses = await listBusinesses(owner.id);

    // Seed a starter business for brand-new sign-ups
    if (businesses.length === 0 && owner.id !== "owner_demo") {
      const bizName = owner.name
        ? `${owner.name}'s Salon & Studio`
        : "My Business Studio";
      const starter = await createBusiness({
        id: `biz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        owner_id: owner.id,
        name: bizName,
        industry: "salon",
        tone: "warm",
        greeting: `Thanks for calling ${bizName}. Are you looking to book a haircut, styling, or coloring appointment today?`,
        system_prompt: `You are an autonomous receptionist for ${bizName}. You speak in a warm, welcoming tone. You answer questions about salon services, check real calendar slots using your tools, and book appointments for clients.`,
        voice_id: "alba",
        slot_minutes: 30,
        open_hour: 9,
        close_hour: 17,
        operating_days: "mon-fri",
        keyterms: [
          bizName,
          "appointment",
          "booking",
          "haircut",
          "styling",
          "balayage",
          "coloring",
        ],
        services: [
          {
            key: "haircut",
            label: "Signature Haircut & Styling",
            minutes: 45,
            price: 85.0,
            description: "Custom consultation, precision cut, wash, and luxury blowout.",
          },
          {
            key: "coloring",
            label: "Full Color & Gloss",
            minutes: 90,
            price: 185.0,
            description: "All-over single process coloring, custom formulation, and blowout.",
          },
          {
            key: "balayage",
            label: "Artisan Balayage & Highlights",
            minutes: 120,
            price: 280.0,
            description: "Hand-painted dimensional highlights, toner formulation, and style.",
          },
        ],
      });
      businesses = [starter];
    }

    return NextResponse.json({ ok: true, owner, businesses });
  } catch (err: any) {
    console.error("[auth/owner] error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Server error. Please try again." },
      { status: 500 }
    );
  }
}
