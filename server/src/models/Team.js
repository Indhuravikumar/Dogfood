const mongoose = require('mongoose');
const crypto = require('crypto');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters'],
      maxlength: [50, 'Team name cannot exceed 50 characters'],
    },
    hackathon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hackathon',
      required: [true, 'Hackathon reference is required'],
      index: true,
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Team leader is required'],
    },
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      validate: {
        validator: function (members) {
          return members.length <= (this.maxMembers || 5);
        },
        message: 'Team members exceed the maximum team size limit',
      },
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      default: () => `DF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    },
    maxMembers: {
      type: Number,
      default: 5,
      min: [1, 'Team must have at least 1 member'],
      max: [10, 'Team size cannot exceed 10 members'],
    },
    status: {
      type: String,
      enum: {
        values: ['Forming', 'Looking for members', 'Complete'],
        message: '{VALUE} is not a valid team status',
      },
      default: 'Forming',
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Team name must be unique within a hackathon
teamSchema.index({ hackathon: 1, name: 1 }, { unique: true });

// Pre-validate hook: Ensure leader is included in members array
teamSchema.pre('validate', function () {
  if (this.leader && Array.isArray(this.members)) {
    const leaderStr = this.leader.toString();
    const hasLeader = this.members.some((m) => m && m.toString() === leaderStr);
    if (!hasLeader) {
      this.members.unshift(this.leader);
    }
  }
});

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
