const mongoose = require('mongoose');

const rubricScoreItemSchema = new mongoose.Schema(
  {
    criterion: {
      type: String,
      required: [true, 'Rubric criterion name is required'],
      trim: true,
    },
    score: {
      type: Number,
      required: [true, 'Score value is required'],
      min: [0, 'Score cannot be negative'],
    },
    maxScore: {
      type: Number,
      required: [true, 'Max score is required'],
      min: [1, 'Max score must be greater than 0'],
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const scoreSchema = new mongoose.Schema(
  {
    hackathon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hackathon',
      required: [true, 'Hackathon reference is required'],
      index: true,
    },
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: [true, 'Submission reference is required'],
      index: true,
    },
    judge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Judge reference is required'],
      index: true,
    },
    rubricScores: {
      type: [rubricScoreItemSchema],
      required: [true, 'At least one rubric score is required'],
      validate: {
        validator: function (scores) {
          return Array.isArray(scores) && scores.length > 0;
        },
        message: 'Rubric scores array cannot be empty',
      },
    },
    totalScore: {
      type: Number,
      min: [0, 'Total score cannot be negative'],
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'submitted'],
        message: '{VALUE} is not a valid score status',
      },
      default: 'submitted',
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL CONSTRAINT: Exactly ONE score per judge per submission
scoreSchema.index({ submission: 1, judge: 1 }, { unique: true });

// Synchronous pre-validate hook: Computes totalScore directly from rubricScores and enforces score <= maxScore
scoreSchema.pre('validate', function () {
  if (Array.isArray(this.rubricScores) && this.rubricScores.length > 0) {
    let calculatedTotal = 0;

    for (const item of this.rubricScores) {
      if (item.score > item.maxScore) {
        this.invalidate(
          'rubricScores',
          `Score for "${item.criterion}" (${item.score}) cannot exceed maximum allowed (${item.maxScore})`
        );
        return;
      }
      calculatedTotal += Number(item.score) || 0;
    }

    // Always overwrite with server-calculated total for tamper-proof accuracy
    this.totalScore = calculatedTotal;
  }
});

const Score = mongoose.model('Score', scoreSchema);

module.exports = Score;
