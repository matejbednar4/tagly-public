import { Resend } from "resend";
import { NextResponse } from "next/server";
import { WEBSITE_FROM_EMAIL } from "@/lib/contact-inboxes";

type ContactFormData = {
  name: string;
  businessName: string;
  email: string;
  phone?: string;
  preferredContact?: "email" | "phone" | "either";
  message?: string;
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
    const body: ContactFormData = await request.json();

    if (!body.name || !body.businessName || !body.email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await resend.emails.send({
      from: WEBSITE_FROM_EMAIL,
      to: "sales@taglyapp.com",
      subject: `New sales inquiry from ${body.businessName}`,
      text: [
        `Contact name: ${body.name}`,
        `Business name: ${body.businessName}`,
        `Email: ${body.email}`,
        body.phone ? `Phone: ${body.phone}` : "",
        body.preferredContact
          ? `Preferred contact method: ${body.preferredContact}`
          : "",
        body.message ? `\nMessage:\n${body.message}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send contact email:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
