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
    payloadHash: {
      type: String,
      required: true,
      index: true,
      unique: true,   // one stored result per hash (reuse same doc: findOne then return)
    },
    conditionsIds: {
      type: [mongoose.Schema.Types.ObjectId],
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
// Unique: one insight per payload hash (reuse, no duplicate)
aiInsightSchema.index({ payloadHash: 1 }, { unique: true });

// Or non-unique if you keep history (return latest)
aiInsightSchema.index({ payloadHash: 1, generatedAt: -1 });

module.exports = mongoose.model("AiInsight", aiInsightSchema);
