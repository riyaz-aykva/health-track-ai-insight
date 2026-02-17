const mongoose = require("mongoose");

/**
 * MongoDB collection: ai_insights
 * Stores AI-generated health overview output per patient/run.
 */
const healthAlertSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH"],
    },
    message: { type: String, required: true },
  },
  { _id: false }
);

const insightDataSchema = new mongoose.Schema(
  {
    overallSummary: { type: String, required: true },
    healthAlerts: {
      type: [healthAlertSchema],
      default: undefined,
    },
    vitalsSummary: [String],
    dailyPatterns: [String],
    smartAdvices: [String],
    careTeamNotes: [String],
    nextSteps: [String],
  },
  { _id: false }
);

const tokenUsageDetailsSchema = new mongoose.Schema(
  {
    cached_tokens: Number,
    audio_tokens: Number,
    reasoning_tokens: Number,
    accepted_prediction_tokens: Number,
    rejected_prediction_tokens: Number,
  },
  { _id: false }
);

const tokenUsageSchema = new mongoose.Schema(
  {
    prompt_tokens: Number,
    completion_tokens: Number,
    total_tokens: Number,
    prompt_tokens_details: tokenUsageDetailsSchema,
    completion_tokens_details: tokenUsageDetailsSchema,
  },
  { _id: false }
);

const aiInsightSchema = new mongoose.Schema(
  {
    lookupId: {
      type: String,
      ref: "users",
      required: true,
      index: true,
    },
    conditions: {
      type: [
        {
          conditionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
          },
          lastRecordDate: {
            type: Date,
            required: true,
          },
        },
      ],
      index: true,
    },
    vitalsLastRecordDate: {
      type: Date,
      required: true,
      index: true,
    },
    activitiesLastRecordDate: {
      type: Date,
      required: true,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    generatedBy: {
      type: String,
      trim: true,
      index: true,
    },
    model: {
      type: String,
      trim: true,
      index: true,
    },
    data: {
      type: insightDataSchema,
      required: true,
    },
    tokenUsage: tokenUsageSchema,
    error: {
      type: String,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: "ai_insights",
  }
);

// Compound index for common queries: latest insight per patient
aiInsightSchema.index({ lookupId: 1, generatedAt: -1 });

module.exports = mongoose.model("AiInsight", aiInsightSchema);
