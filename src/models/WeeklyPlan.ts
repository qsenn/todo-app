import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { ownedByUser } from "@/lib/tenant";

const weeklyPlanSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    weekStart: { type: String, required: true },
    weekEnd: { type: String, required: true },
    yearGoalId: { type: Schema.Types.ObjectId, ref: "YearGoal", default: null },
  },
  { timestamps: true },
);
weeklyPlanSchema.plugin(ownedByUser);
weeklyPlanSchema.index({ userId: 1, yearGoalId: 1 });
weeklyPlanSchema.index({ userId: 1, weekStart: 1 });

export type WeeklyPlanDoc = InferSchemaType<typeof weeklyPlanSchema>;
export const WeeklyPlan: Model<WeeklyPlanDoc> =
  (models.WeeklyPlan as Model<WeeklyPlanDoc>) || model<WeeklyPlanDoc>("WeeklyPlan", weeklyPlanSchema);
