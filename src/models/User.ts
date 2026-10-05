import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    username: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>("User", userSchema);
