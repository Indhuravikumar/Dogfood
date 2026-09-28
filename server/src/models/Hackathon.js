const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Track name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const prizeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Prize title is required'],
      trim: true,
    },
    amount: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const rubricCriterionSchema = new mongoose.Schema(
  {
    criterion: {
      type: String,
      required: [true, 'Criterion name is required'],
      trim: true,
    },
    maxScore: {
      type: Number,
      required: [true, 'Max score is required'],
      min: [1, 'Max score must be at least 1'],
      default: 25,
    },
    weight: {
      type: Number,
      default: 1,
      min: [0.1, 'Weight must be greater than 0'],
    },
  },
  { _id: false }
);

const hackathonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Hackathon title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer is required'],
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function (value) {
          return !this.startDate || value >= this.startDate;
        },
        message: 'End date must be on or after start date',
      },
    },
    registrationDeadline: {
      type: Date,
      required: [true, 'Registration deadline is required'],
    },
    submissionDeadline: {
      type: Date,
      required: [true, 'Submission deadline is required'],
      validate: {
        validator: function (value) {
          return !this.endDate || value <= this.endDate;
        },
        message: 'Submission deadline cannot be after hackathon end date',
      },
    },
    tracks: {
      type: [trackSchema],
      default: [],
    },
    prizes: {
      type: [prizeSchema],
      default: [],
    },
    rubric: {
      type: [rubricCriterionSchema],
      default: [
        { criterion: 'Innovation', maxScore: 25, weight: 1 },
        { criterion: 'Technical Execution', maxScore: 25, weight: 1 },
        { criterion: 'Impact & Usability', maxScore: 25, weight: 1 },
        { criterion: 'Presentation', maxScore: 25, weight: 1 },
      ],
    },
    status: {
      type: String,
      enum: {
        values: ['UPCOMING', 'LIVE', 'COMPLETED'],
        message: '{VALUE} is not a valid hackathon status',
      },
      default: 'UPCOMING',
      index: true,
    },
    badgeColor: {
      type: String,
      enum: ['purple', 'blue', 'orange', 'green'],
      default: 'purple',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast milestone and deadline lookups
hackathonSchema.index({ status: 1, submissionDeadline: 1 });

const Hackathon = mongoose.model('Hackathon', hackathonSchema);

module.exports = Hackathon;
