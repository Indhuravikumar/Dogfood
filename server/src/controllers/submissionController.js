const mongoose = require('mongoose');
const { Submission, Team, Hackathon } = require('../models');

/**
 * @desc    List project submissions (with optional hackathonId & status filters)
 * @route   GET /api/submissions
 * @access  Private
 */
const getSubmissions = async (req, res) => {
  try {
    const filter = {};

    if (req.query.hackathonId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hackathonId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hackathon ID format in query parameter',
        });
      }
      filter.hackathon = req.query.hackathonId;
    }

    if (req.query.status) {
      filter.status = req.query.status.toLowerCase();
    }

    const submissions = await Submission.find(filter)
      .populate('team', 'name inviteCode leader members')
      .populate('hackathon', 'title status submissionDeadline')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving submissions',
    });
  }
};

/**
 * @desc    Get single submission by ID
 * @route   GET /api/submissions/:id
 * @access  Private
 */
const getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid submission ID format',
      });
    }

    const submission = await Submission.findById(id)
      .populate('team', 'name inviteCode leader members')
      .populate('hackathon', 'title status submissionDeadline rubric tracks');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error('Get submission by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving submission details',
    });
  }
};

/**
 * @desc    Create a draft or submit a project for a team
 * @route   POST /api/submissions
 * @access  Private (Team Leader only)
 */
const createSubmission = async (req, res) => {
  try {
    const {
      teamId,
      title,
      tagline,
      description,
      track,
      tags,
      repoUrl,
      demoUrl,
      status,
    } = req.body;

    // 1. Validate required fields
    if (!teamId || !title || !description || !track) {
      return res.status(400).json({
        success: false,
        message: 'Please provide teamId, title, description, and track',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID format',
      });
    }

    // 2. Fetch team and verify ownership
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // Enforce: Only team leader can create the team's project submission
    if (team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the team leader may create or submit a project for this team',
      });
    }

    // 3. Fetch hackathon and verify submission deadline
    const hackathon = await Hackathon.findById(team.hackathon);
    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Associated hackathon not found',
      });
    }

    const submissionStatus = status === 'submitted' ? 'submitted' : 'draft';
    const now = new Date();

    if (submissionStatus === 'submitted' && hackathon.submissionDeadline && now > new Date(hackathon.submissionDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline for this hackathon has passed',
      });
    }

    // 4. Enforce one submission per team per hackathon
    const existingSubmission = await Submission.findOne({
      hackathon: team.hackathon,
      team: team._id,
    });

    if (existingSubmission) {
      return res.status(409).json({
        success: false,
        message: 'This team has already created a submission for this hackathon',
      });
    }

    // 5. Create submission (tamper-proof: client cannot set averageScore or totalEvaluations)
    const newSubmission = await Submission.create({
      title: title.trim(),
      tagline: tagline ? tagline.trim() : '',
      description: description.trim(),
      hackathon: team.hackathon, // Inherent from team
      team: team._id,
      track: track.trim(),
      tags: Array.isArray(tags) ? tags : [],
      repoUrl: repoUrl ? repoUrl.trim() : '',
      demoUrl: demoUrl ? demoUrl.trim() : '',
      status: submissionStatus,
      submittedAt: submissionStatus === 'submitted' ? new Date() : null,
      likesCount: 0,
      averageScore: 0,
      totalEvaluations: 0,
    });

    const populatedSubmission = await Submission.findById(newSubmission._id)
      .populate('team', 'name inviteCode leader')
      .populate('hackathon', 'title status submissionDeadline');

    return res.status(201).json({
      success: true,
      message: submissionStatus === 'submitted'
        ? 'Project submitted successfully'
        : 'Project draft saved successfully',
      data: populatedSubmission,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This team has already created a submission for this hackathon',
      });
    }
    console.error('Create submission error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating submission',
    });
  }
};

/**
 * @desc    Update an existing project submission
 * @route   PUT /api/submissions/:id
 * @access  Private (Team Leader only)
 */
const updateSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid submission ID format',
      });
    }

    const submission = await Submission.findById(id)
      .populate('team')
      .populate('hackathon');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    // Enforce: Only team leader can update submission
    if (submission.team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the team leader may update this submission',
      });
    }

    // Enforce deadline lock
    const now = new Date();
    if (
      submission.hackathon.submissionDeadline &&
      now > new Date(submission.hackathon.submissionDeadline)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline for this hackathon has passed. Modifications are locked',
      });
    }

    // Strip client-supplied sensitive/association fields
    delete req.body.hackathon;
    delete req.body.team;
    delete req.body.averageScore;
    delete req.body.totalEvaluations;
    delete req.body.likesCount;
    delete req.body.submittedAt;

    const {
      title,
      tagline,
      description,
      track,
      tags,
      repoUrl,
      demoUrl,
      status,
    } = req.body;

    if (title) submission.title = title.trim();
    if (tagline !== undefined) submission.tagline = tagline.trim();
    if (description) submission.description = description.trim();
    if (track) submission.track = track.trim();
    if (tags && Array.isArray(tags)) submission.tags = tags;
    if (repoUrl !== undefined) submission.repoUrl = repoUrl.trim();
    if (demoUrl !== undefined) submission.demoUrl = demoUrl.trim();

    // If moving from draft to submitted
    if (status === 'submitted') {
      submission.status = 'submitted';
      if (!submission.submittedAt) {
        submission.submittedAt = new Date();
      }
    } else if (status === 'draft') {
      submission.status = 'draft';
    }

    await submission.save();

    const updatedSubmission = await Submission.findById(id)
      .populate('team', 'name inviteCode leader')
      .populate('hackathon', 'title status submissionDeadline');

    return res.status(200).json({
      success: true,
      message: 'Submission updated successfully',
      data: updatedSubmission,
    });
  } catch (error) {
    console.error('Update submission error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating submission',
    });
  }
};

/**
 * @desc    Get public gallery submissions for a hackathon
 * @route   GET /api/submissions/gallery/:hackathonId
 * @access  Public
 */
const getGallerySubmissions = async (req, res) => {
  try {
    const { hackathonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hackathon ID format',
      });
    }

    // Gallery query: ONLY submitted projects (drafts are completely hidden)
    const filter = {
      hackathon: hackathonId,
      status: 'submitted',
    };

    // Optional track filter
    if (req.query.track) {
      filter.track = req.query.track;
    }

    // Optional text search filter
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: regex }, { tagline: regex }, { tags: regex }];
    }

    const submissions = await Submission.find(filter)
      .populate('team', 'name leader')
      .populate('hackathon', 'title status')
      .sort({ likesCount: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    console.error('Get gallery submissions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving gallery submissions',
    });
  }
};

module.exports = {
  getSubmissions,
  getSubmissionById,
  createSubmission,
  updateSubmission,
  getGallerySubmissions,
};
