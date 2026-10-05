import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { ownedByUser } from "@/lib/tenant";
import { TODO_STATUSES } from "@/lib/schemas";

const todoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: String, required: true },
    weeklyPlanId: { type: Schema.Types.ObjectId, ref: "WeeklyPlan", default: null },
    status: { type: String, enum: TODO_STATUSES, default: "todo", required: true },
  },
  { timestamps: true },
);
todoSchema.plugin(ownedByUser);
todoSchema.index({ userId: 1, date: 1 });
todoSchema.index({ userId: 1, weeklyPlanId: 1, status: 1 });

export type TodoDoc = InferSchemaType<typeof todoSchema>;
export const Todo: Model<TodoDoc> = (models.Todo as Model<TodoDoc>) || model<TodoDoc>("Todo", todoSchema);
