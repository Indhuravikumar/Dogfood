const mongoose = require('mongoose');
const { Hackathon } = require('../models');

/**
 * @desc    Get all hackathons (optional status filter)
 * @route   GET /api/events
 * @access  Public
 */
const getEvents = async (req, res) => {
  try {
    const filter = {};

    // Filter by status if provided in query string (e.g. ?status=LIVE)
    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    const events = await Hackathon.find(filter)
      .populate('organizer', 'name email avatar')
      .sort({ startDate: 1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error('Get events error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving hackathon events',
    });
  }
};

/**
 * @desc    Get single hackathon by ID
 * @route   GET /api/events/:id
 * @access  Public
 */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hackathon ID format',
      });
    }

    const event = await Hackathon.findById(id).populate('organizer', 'name email avatar');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Get event by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving hackathon details',
    });
  }
};

/**
 * @desc    Create a new hackathon event
 * @route   POST /api/events
 * @access  Private (Organizer only)
 */
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      registrationDeadline,
      submissionDeadline,
      tracks,
      prizes,
      rubric,
      status,
      badgeColor,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !startDate ||
      !endDate ||
      !registrationDeadline ||
      !submissionDeadline
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (title, description, startDate, endDate, registrationDeadline, submissionDeadline)',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const subDeadline = new Date(submissionDeadline);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format provided',
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be on or after start date',
      });
    }

    if (subDeadline > end) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline cannot be after hackathon end date',
      });
    }

    // Enforce tamper-proof organizer reference from the authenticated JWT
    const newEvent = await Hackathon.create({
      title: title.trim(),
      description: description.trim(),
      organizer: req.user._id, // Never trust client-supplied organizer ID
      startDate: start,
      endDate: end,
      registrationDeadline: new Date(registrationDeadline),
      submissionDeadline: subDeadline,
      tracks: Array.isArray(tracks) ? tracks : [],
      prizes: Array.isArray(prizes) ? prizes : [],
      rubric: Array.isArray(rubric) && rubric.length > 0 ? rubric : undefined,
      status: status || 'UPCOMING',
      badgeColor: badgeColor || 'purple',
    });

    return res.status(201).json({
      success: true,
      message: 'Hackathon created successfully',
      data: newEvent,
    });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating hackathon event',
    });
  }
};

/**
 * @desc    Update an existing hackathon event
 * @route   PUT /api/events/:id
 * @access  Private (Organizer only, must own the event)
 */
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hackathon ID format',
      });
    }

    const event = await Hackathon.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found',
      });
    }

    // Verify ownership: only the creator organizer may update this event
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to update this hackathon',
      });
    }

    // Prevent changing the organizer ID
    delete req.body.organizer;

    // Validate date relationships if dates are being updated
    const start = req.body.startDate ? new Date(req.body.startDate) : event.startDate;
    const end = req.body.endDate ? new Date(req.body.endDate) : event.endDate;
    const subDeadline = req.body.submissionDeadline
      ? new Date(req.body.submissionDeadline)
      : event.submissionDeadline;

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be on or after start date',
      });
    }

    if (subDeadline > end) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline cannot be after hackathon end date',
      });
    }

    const updatedEvent = await Hackathon.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Hackathon updated successfully',
      data: updatedEvent,
    });
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating hackathon event',
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
};
