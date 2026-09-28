const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      maxlength: [100, 'Project title cannot exceed 100 characters'],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [180, 'Tagline cannot exceed 180 characters'],
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
    },
    hackathon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hackathon',
      required: [true, 'Hackathon reference is required'],
      index: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team reference is required'],
      index: true,
    },
    track: {
      type: String,
      required: [true, 'Track selection is required'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    repoUrl: {
      type: String,
      trim: true,
      default: '',
      match: [
        /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
        'Please enter a valid repository URL',
      ],
    },
    demoUrl: {
      type: String,
      trim: true,
      default: '',
      match: [
        /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
        'Please enter a valid demo URL',
      ],
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'submitted'],
        message: '{VALUE} is not a valid submission status',
      },
      default: 'draft',
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEvaluations: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL CONSTRAINT: A team can only submit ONE project per hackathon
submissionSchema.index({ hackathon: 1, team: 1 }, { unique: true });

// Performance index for live leaderboards (descending by average score)
submissionSchema.index({ hackathon: 1, averageScore: -1 });

// Automatically record timestamp when project moves from draft to submitted
submissionSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'submitted' && !this.submittedAt) {
    this.submittedAt = new Date();
  }
  next();
});

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;
