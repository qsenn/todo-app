import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { ownedByUser } from "@/lib/tenant";

const yearGoalSchema = new Schema(
  {
    year: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
yearGoalSchema.plugin(ownedByUser);
yearGoalSchema.index({ userId: 1, year: 1 });

export type YearGoalDoc = InferSchemaType<typeof yearGoalSchema>;
export const YearGoal: Model<YearGoalDoc> =
  (models.YearGoal as Model<YearGoalDoc>) || model<YearGoalDoc>("YearGoal", yearGoalSchema);
