// src/lib/session-options.ts
import { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD || "your-secure-password-here",
  cookieName: "jumbo-auth",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

declare module "iron-session" {
  interface IronSessionData {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
}
