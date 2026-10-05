import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

// Only a hash of the cookie token is stored, so a database leak does not expose live sessions.
const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1 });

export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export const Session: Model<SessionDoc> =
  (models.Session as Model<SessionDoc>) || model<SessionDoc>("Session", sessionSchema);
