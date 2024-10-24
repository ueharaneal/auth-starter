"use server";

import nextAuth from "@/auth";
import { AuthError } from "next-auth";

type Res =
  | { success: true }
  | { success: false; error: string; statusCode: 500 | 401 };

export async function signinUserAction(values: unknown): Promise<Res> {
  try {
    if (
      typeof values !== "object" ||
      values === null ||
      Array.isArray(values)
    ) {
      throw new Error("Invalid JSON object");
    }
    //handle logic in auth.ts
    await nextAuth.signIn("credentials", { ...values, redirect: false });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CallbackRouteError":
          return {
            success: false,
            error: "Incorrect Email or Password",
            statusCode: 401,
          };

        case "CredentialsSignin":
          return {
            success: false,
            error: "Incorrect Email or Password",
            statusCode: 401,
          };
        default:
          return {
            success: false,
            error: "oops, Something went wrong",
            statusCode: 500,
          };
      }
    }
    return { success: false, error: "", statusCode: 401 };
  }
}
