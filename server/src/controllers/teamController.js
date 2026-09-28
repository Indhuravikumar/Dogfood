const mongoose = require('mongoose');
const { Team, Hackathon } = require('../models');

/**
 * @desc    List teams (with optional hackathonId filter)
 * @route   GET /api/teams
 * @access  Private
 */
const getTeams = async (req, res) => {
  try {
    const filter = {};

    // Filter by hackathon if provided
    if (req.query.hackathonId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hackathonId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hackathon ID format in query parameter',
        });
      }
      filter.hackathon = req.query.hackathonId;
    }

    const teams = await Team.find(filter)
      .populate('leader', 'name email avatar')
      .populate('members', 'name email avatar skills')
      .populate('hackathon', 'title status registrationDeadline')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: teams.length,
      data: teams,
    });
  } catch (error) {
    console.error('Get teams error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving teams',
    });
  }
};

/**
 * @desc    Get team details by ID
 * @route   GET /api/teams/:id
 * @access  Private
 */
const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID format',
      });
    }

    const team = await Team.findById(id)
      .populate('leader', 'name email avatar')
      .populate('members', 'name email avatar skills')
      .populate('hackathon', 'title status registrationDeadline');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error('Get team by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving team details',
    });
  }
};

/**
 * @desc    Create a new team for a hackathon
 * @route   POST /api/teams
 * @access  Private
 */
const createTeam = async (req, res) => {
  try {
    const { name, hackathonId, maxMembers } = req.body;

    // 1. Validate required fields
    if (!name || !hackathonId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide team name and hackathonId',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hackathon ID format',
      });
    }

    // 2. Verify hackathon exists and is open for registration
    const hackathon = await Hackathon.findById(hackathonId);
    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: 'Hackathon not found',
      });
    }

    if (hackathon.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'This hackathon has already concluded',
      });
    }

    const now = new Date();
    if (hackathon.registrationDeadline && now > new Date(hackathon.registrationDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline for this hackathon has passed',
      });
    }

    // 3. Prevent user from creating or joining multiple teams in the same hackathon
    const existingUserTeam = await Team.findOne({
      hackathon: hackathonId,
      members: req.user._id,
    });

    if (existingUserTeam) {
      return res.status(409).json({
        success: false,
        message: `You are already a member of team '${existingUserTeam.name}' in this hackathon`,
      });
    }

    // 4. Create the team (tamper-proof leader assignment from JWT)
    const newTeam = await Team.create({
      name: name.trim(),
      hackathon: hackathonId,
      leader: req.user._id, // Enforce authenticated user as leader
      members: [req.user._id], // Creator is automatically the first member
      maxMembers: maxMembers || 5,
      status: 'Forming',
    });

    const populatedTeam = await Team.findById(newTeam._id)
      .populate('leader', 'name email avatar')
      .populate('members', 'name email avatar skills');

    return res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: populatedTeam,
    });
  } catch (error) {
    // Handle compound unique index violation (duplicate team name in same hackathon)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
      return res.status(409).json({
        success: false,
        message: `A team with the name '${req.body.name}' already exists in this hackathon`,
      });
    }
    console.error('Create team error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating team',
    });
  }
};

/**
 * @desc    Join a team using its invite code
 * @route   POST /api/teams/join
 * @access  Private
 */
const joinTeam = async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a team invite code',
      });
    }

    const cleanCode = inviteCode.trim().toUpperCase();

    // 1. Look up team by invite code
    const team = await Team.findOne({ inviteCode: cleanCode });
    if (!team) {
      return res.status(404).json({
        success: false,
        message: `Invalid invite code. No team found with code '${cleanCode}'`,
      });
    }

    // 2. Check if user is already a member of this team
    const isAlreadyMember = team.members.some(
      (m) => m.toString() === req.user._id.toString()
    );
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this team',
      });
    }

    // 3. Prevent user from being in multiple teams in the same hackathon
    const existingHackathonTeam = await Team.findOne({
      hackathon: team.hackathon,
      members: req.user._id,
    });
    if (existingHackathonTeam) {
      return res.status(409).json({
        success: false,
        message: `You are already a member of team '${existingHackathonTeam.name}' in this hackathon`,
      });
    }

    // 4. Verify team capacity
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        message: `Team is already at maximum capacity (${team.maxMembers} members)`,
      });
    }

    // 5. Add user to members list
    team.members.push(req.user._id);

    // Update status to Complete if capacity reached
    if (team.members.length === team.maxMembers) {
      team.status = 'Complete';
    }

    await team.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('leader', 'name email avatar')
      .populate('members', 'name email avatar skills')
      .populate('hackathon', 'title status');

    return res.status(200).json({
      success: true,
      message: `Successfully joined team '${team.name}'`,
      data: updatedTeam,
    });
  } catch (error) {
    console.error('Join team error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error joining team',
    });
  }
};

/**
 * @desc    Update team details (Team leader only)
 * @route   PUT /api/teams/:id
 * @access  Private (Leader only)
 */
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID format',
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // Enforce team leader ownership
    if (team.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the team leader can update team details',
      });
    }

    const { name, status, maxMembers } = req.body;

    // Disallow modifying sensitive internal fields
    delete req.body.hackathon;
    delete req.body.leader;
    delete req.body.inviteCode;
    delete req.body.members;

    if (maxMembers && maxMembers < team.members.length) {
      return res.status(400).json({
        success: false,
        message: `Cannot set maxMembers to ${maxMembers} because team already has ${team.members.length} members`,
      });
    }

    if (name) team.name = name.trim();
    if (status) team.status = status;
    if (maxMembers) team.maxMembers = maxMembers;

    await team.save();

    const updatedTeam = await Team.findById(id)
      .populate('leader', 'name email avatar')
      .populate('members', 'name email avatar skills');

    return res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: updatedTeam,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
      return res.status(409).json({
        success: false,
        message: `A team with the name '${req.body.name}' already exists in this hackathon`,
      });
    }
    console.error('Update team error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating team',
    });
  }
};

module.exports = {
  getTeams,
  getTeamById,
  createTeam,
  joinTeam,
  updateTeam,
};
