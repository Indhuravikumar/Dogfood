const express = require('express');
const router = express.Router();
const {
  getPendingSubmissions,
  createScore,
  getSubmissionScores,
  updateScore,
} = require('../controllers/scoreController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All scoring endpoints require authentication
router.use(protect);

// List pending submissions queue for judges
router.get('/pending', authorize('judge', 'organizer'), getPendingSubmissions);

// Submit a new evaluation (Judges only)
router.post('/', authorize('judge'), createScore);

// Retrieve evaluations for a submission
router.get('/submission/:submissionId', getSubmissionScores);

// Update a judge's own evaluation (Judges only)
router.put('/:id', authorize('judge'), updateScore);

module.exports = router;
