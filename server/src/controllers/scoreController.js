const mongoose = require('mongoose');
const { Score, Submission, Hackathon } = require('../models');

// Helper to recalculate and update a submission's aggregate average score
const updateSubmissionAverage = async (submissionId) => {
  const allScores = await Score.find({
    submission: submissionId,
    status: 'submitted',
  });

  const totalEvaluations = allScores.length;
  const averageScore =
    totalEvaluations > 0
      ? Number(
          (
            allScores.reduce((acc, curr) => acc + curr.totalScore, 0) /
            totalEvaluations
          ).toFixed(2)
        )
      : 0;

  await Submission.findByIdAndUpdate(submissionId, {
    averageScore,
    totalEvaluations,
  });
};

/**
 * @desc    List submitted projects awaiting evaluation by the logged-in judge
 * @route   GET /api/scores/pending
 * @access  Private (Judge or Organizer)
 */
const getPendingSubmissions = async (req, res) => {
  try {
    const filter = {
      status: 'submitted', // Only finalized submissions can be judged
    };

    if (req.query.hackathonId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hackathonId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hackathon ID format in query parameter',
        });
      }
      filter.hackathon = req.query.hackathonId;
    }

    // Find all submitted projects
    const allSubmitted = await Submission.find(filter)
      .populate('team', 'name leader members')
      .populate('hackathon', 'title rubric status');

    // Find all evaluations already completed by this judge
    const judgeScores = await Score.find({
      judge: req.user._id,
      status: 'submitted',
    }).select('submission');

    const evaluatedSubmissionIds = new Set(
      judgeScores.map((s) => s.submission.toString())
    );

    // Filter out:
    // 1. Projects already evaluated by this judge
    // 2. Projects submitted by the judge's own team (Conflict of interest)
    const pending = allSubmitted.filter((sub) => {
      const isAlreadyEvaluated = evaluatedSubmissionIds.has(sub._id.toString());
      if (isAlreadyEvaluated) return false;

      if (sub.team) {
        const isLeader =
          sub.team.leader &&
          sub.team.leader.toString() === req.user._id.toString();
        const isMember =
          Array.isArray(sub.team.members) &&
          sub.team.members.some(
            (m) => (m._id || m).toString() === req.user._id.toString()
          );
        if (isLeader || isMember) return false;
      }

      return true;
    });

    return res.status(200).json({
      success: true,
      count: pending.length,
      data: pending,
    });
  } catch (error) {
    console.error('Get pending submissions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving pending submissions',
    });
  }
};

/**
 * @desc    Submit a rubric evaluation for a project
 * @route   POST /api/scores
 * @access  Private (Judge only)
 */
const createScore = async (req, res) => {
  try {
    const { submissionId, rubricScores, feedback, status } = req.body;

    // 1. Validate required fields
    if (!submissionId || !Array.isArray(rubricScores) || rubricScores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide submissionId and a non-empty rubricScores array',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid submission ID format',
      });
    }

    // 2. Fetch submission with team and hackathon
    const submission = await Submission.findById(submissionId)
      .populate('team')
      .populate('hackathon');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    // Only finalized projects can be evaluated
    if (submission.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot evaluate a project that is still in draft status',
      });
    }

    // 3. Conflict of interest check (judge cannot score their own team)
    if (submission.team) {
      const isLeader =
        submission.team.leader &&
        submission.team.leader.toString() === req.user._id.toString();
      const isMember =
        Array.isArray(submission.team.members) &&
        submission.team.members.some(
          (m) => m.toString() === req.user._id.toString()
        );

      if (isLeader || isMember) {
        return res.status(403).json({
          success: false,
          message:
            'Conflict of Interest: Judges are not permitted to evaluate their own team project',
        });
      }
    }

    // 4. Validate rubric scores against boundaries
    for (const item of rubricScores) {
      if (!item.criterion || item.score === undefined || item.maxScore === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Each rubric item must include criterion, score, and maxScore',
        });
      }
      if (item.score < 0 || item.score > item.maxScore) {
        return res.status(400).json({
          success: false,
          message: `Score for "${item.criterion}" (${item.score}) must be between 0 and ${item.maxScore}`,
        });
      }
    }

    // 5. Enforce one score per judge per submission
    const existingScore = await Score.findOne({
      submission: submissionId,
      judge: req.user._id,
    });

    if (existingScore) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted an evaluation for this project',
      });
    }

    // 6. Create score (totalScore is calculated and verified server-side)
    const newScore = await Score.create({
      hackathon: submission.hackathon._id,
      submission: submission._id,
      judge: req.user._id,
      rubricScores,
      feedback: feedback ? feedback.trim() : '',
      status: status || 'submitted',
    });

    // 7. Update aggregate average on the submission if finalized
    if (newScore.status === 'submitted') {
      await updateSubmissionAverage(submission._id);
    }

    const populatedScore = await Score.findById(newScore._id)
      .populate('judge', 'name email avatar')
      .populate('submission', 'title track team');

    return res.status(201).json({
      success: true,
      message: 'Evaluation submitted successfully',
      data: populatedScore,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted an evaluation for this project',
      });
    }
    console.error('Create score error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating evaluation',
    });
  }
};

/**
 * @desc    Get evaluations for a submission
 * @route   GET /api/scores/submission/:submissionId
 * @access  Private
 */
const getSubmissionScores = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid submission ID format',
      });
    }

    const submission = await Submission.findById(submissionId).populate('team');
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    // Filter depending on user role
    const filter = { submission: submissionId };

    // If caller is a judge, only return their own score
    if (req.user.role === 'judge') {
      filter.judge = req.user._id;
    }

    const scores = await Score.find(filter)
      .populate('judge', 'name email avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: scores.length,
      data: scores,
    });
  } catch (error) {
    console.error('Get submission scores error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving submission scores',
    });
  }
};

/**
 * @desc    Update a judge's own evaluation
 * @route   PUT /api/scores/:id
 * @access  Private (Judge only)
 */
const updateScore = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid score ID format',
      });
    }

    const score = await Score.findById(id);
    if (!score) {
      return res.status(404).json({
        success: false,
        message: 'Evaluation not found',
      });
    }

    // Enforce: Judge can only update their own score
    if (score.judge.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only update your own evaluation',
      });
    }

    // Disallow modifying core reference IDs
    delete req.body.hackathon;
    delete req.body.submission;
    delete req.body.judge;

    const { rubricScores, feedback, status } = req.body;

    // Validate rubricScores if being updated
    if (rubricScores) {
      if (!Array.isArray(rubricScores) || rubricScores.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'rubricScores must be a non-empty array',
        });
      }
      for (const item of rubricScores) {
        if (item.score < 0 || item.score > item.maxScore) {
          return res.status(400).json({
            success: false,
            message: `Score for "${item.criterion}" (${item.score}) must be between 0 and ${item.maxScore}`,
          });
        }
      }
      score.rubricScores = rubricScores;
    }

    if (feedback !== undefined) score.feedback = feedback.trim();
    if (status) score.status = status;

    await score.save();

    // Recalculate submission aggregate
    await updateSubmissionAverage(score.submission);

    const updatedScore = await Score.findById(id)
      .populate('judge', 'name email avatar')
      .populate('submission', 'title track averageScore totalEvaluations');

    return res.status(200).json({
      success: true,
      message: 'Evaluation updated successfully',
      data: updatedScore,
    });
  } catch (error) {
    console.error('Update score error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating evaluation',
    });
  }
};

module.exports = {
  getPendingSubmissions,
  createScore,
  getSubmissionScores,
  updateScore,
};
