const express = require('express');
const router = express.Router();
const {
  getTeams,
  getTeamById,
  createTeam,
  joinTeam,
  updateTeam,
} = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');

// All team operations require authentication
router.use(protect);

router.get('/', getTeams);
router.get('/:id', getTeamById);
router.post('/', createTeam);
router.post('/join', joinTeam);
router.put('/:id', updateTeam);

module.exports = router;
