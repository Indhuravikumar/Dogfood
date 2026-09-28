const express = require('express');
const router = express.Router();
const {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public endpoints
router.get('/', getEvents);
router.get('/:id', getEventById);

// Protected organizer-only endpoints
router.post('/', protect, authorize('organizer'), createEvent);
router.put('/:id', protect, authorize('organizer'), updateEvent);

module.exports = router;
