import { Resend } from "resend";
import { NextResponse } from "next/server";
import {
  CONTACT_INBOXES,
  WEBSITE_FROM_EMAIL,
  type ContactCategory,
} from "@/lib/contact-inboxes";

// Handles the /contact page's dynamic form. The category picks the delivery
// inbox server-side via CONTACT_INBOXES — the client never supplies a target
// address. (The path stays /api/support from when the form was support-only.)

type SupportFormData = {
  category: ContactCategory;
  name: string;
  email: string;
  reason?: string;
  message: string;
};

const subjectByCategory: Record<
  ContactCategory,
  (body: SupportFormData) => string
> = {
  support: (body) => `Support request: ${body.reason}`,
  feedback: () => "Feedback from the website",
  other: () => "Message from the website",
};

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const body: SupportFormData = await request.json();

    const to = CONTACT_INBOXES[body.category];
    if (!to) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }
    if (
      !body.name ||
      !body.email ||
      !body.message ||
      (body.category === "support" && !body.reason)
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await resend.emails.send({
      from: WEBSITE_FROM_EMAIL,
      to,
      subject: subjectByCategory[body.category](body),
      replyTo: body.email,
      text: [
        `Category: ${body.category}`,
        `Name: ${body.name}`,
        `Email: ${body.email}`,
        body.reason ? `Reason: ${body.reason}` : "",
        `\nMessage:\n${body.message}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send support email:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
