import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { SignInSchema } from "@/validators/auth-validators";
import { findUserByEmail } from "@/lib/server-utils/userQueries";
import argon2 from "argon2";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import db from "@/db";
import * as schema from "@/db/schema";
import { oathVerifyEmailAction } from "@/actions/auth/oauth-verify-email-actions";

const nextAuth = NextAuth({
  adapter: DrizzleAdapter(db, {
    accountsTable: schema.accounts,
    usersTable: schema.users,
    sessionsTable: schema.sessions,
    authenticatorsTable: schema.authenticators,
    verificationTokensTable: schema.verificationTokens,
  }), //adds the user to db when using external provider
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET as string,
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (trigger === "update") {
        return { ...token, ...session.user };
      }
      //first login is the only chance to attach to token because that the only time we will get the user object back
      console.log("user", user);
      if (user?.id) token.id = user.id;
      if (user?.role) token.role = user.role;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id!;
      session.user.role = token.role!;

      return session;
    },
  },
  events: {
    async linkAccount({ user, account }) {
      if (["google", "github"].includes(account.provider)) {
        //verify the user's email
        if (user?.email) await oathVerifyEmailAction(user?.email);
      }
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = SignInSchema.safeParse(credentials);

        if (parsedCredentials.success) {
          //Carry on with sign in
          const { email, password } = parsedCredentials.data;
          const user = await findUserByEmail(email);
          if (!user) return null;
          if (!user.password) return null; //becuase other credetionals
          console.log("This is user", user);
          const passwordsMatch = await argon2.verify(user.password, password);
          console.log("PAsswords match", passwordsMatch);
          if (passwordsMatch) {
            //remove password from user object
            const { password: _, ...userWithoutPassword } = user;
            console.log("userWithoutPassword", userWithoutPassword);
            return userWithoutPassword;
          }
        }
        return null;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
});

export default nextAuth;
