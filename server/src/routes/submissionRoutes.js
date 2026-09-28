const express = require('express');
const router = express.Router();
const {
  getSubmissions,
  getSubmissionById,
  createSubmission,
  updateSubmission,
  getGallerySubmissions,
} = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');

// Public gallery endpoint for community project showcase
router.get('/gallery/:hackathonId', getGallerySubmissions);

// Protected routes (require JWT authentication)
router.get('/', protect, getSubmissions);
router.get('/:id', protect, getSubmissionById);
router.post('/', protect, createSubmission);
router.put('/:id', protect, updateSubmission);

module.exports = router;
