// Holds BETTER_AUTH_SECRET / Google client secret — keep it off the client.
import 'server-only'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { MongoClient } from 'mongodb'

const client = new MongoClient(
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
)
const db = client.db(process.env.MONGODB_DB ?? 'finances')

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET!,
  database: mongodbAdapter(db),
  user: {
    additionalFields: {
      // Authorization role. Every account is created as "user" (NOT authorized).
      // `input: false` means it can never be set through the sign-up/update API —
      // the only way to grant access is to edit the role directly in MongoDB.
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  trustedOrigins: (
    process.env.TRUSTED_ORIGINS ??
    process.env.BETTER_AUTH_BASE_URL ??
    'http://localhost:3000'
  ).split(','),
})
