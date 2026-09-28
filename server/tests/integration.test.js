const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { User, Hackathon, Team, Submission, Score } = require('../src/models');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dogfood_hackathon';

// Track temporary IDs for safe cleanup in finally block
const createdIds = {
  users: [],
  hackathons: [],
  teams: [],
  submissions: [],
  scores: [],
};

const results = [];

const logStep = (stepName, passed, detail = '') => {
  results.push({ stepName, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon}: ${stepName} ${detail ? `(${detail})` : ''}`);
};

async function runIntegrationTests() {
  console.log('====================================================');
  console.log('🚀 STARTING SAFE MONGOOSE MODELS INTEGRATION TEST');
  console.log(`📡 Target Database: ${mongoUri}`);
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // Phase 1: Connection & Index Synchronization
    // ----------------------------------------------------
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB. Synchronizing unique indexes...');
    await Promise.all([
      User.init(),
      Hackathon.init(),
      Team.init(),
      Submission.init(),
      Score.init(),
    ]);
    logStep('Phase 1: DB Connection & Index Sync', true, 'All compound & unique indexes built');

    const timestamp = Date.now();

    // ----------------------------------------------------
    // Phase 2: User Model & Password Security
    // ----------------------------------------------------
    const organizer = new User({
      name: 'Test Organizer',
      email: `test_org_${timestamp}@example.com`,
      password: 'StrongOrganizerPassword123!',
      role: 'organizer',
      avatar: 'TO',
      skills: ['Leadership', 'Event Planning'],
    });
    await organizer.save();
    createdIds.users.push(organizer._id);

    const judge = new User({
      name: 'Test Judge',
      email: `test_judge_${timestamp}@example.com`,
      password: 'StrongJudgePassword123!',
      role: 'judge',
      avatar: 'TJ',
      skills: ['Code Review', 'Architecture'],
    });
    await judge.save();
    createdIds.users.push(judge._id);

    // Verify bcrypt hash
    const isHashed = organizer.password.startsWith('$2') && organizer.password.length === 60;
    logStep('Phase 2a: Password Hashing', isHashed, 'Password hashed with bcrypt 60-char salt');

    // Verify comparePassword method
    const correctPassMatch = await organizer.comparePassword('StrongOrganizerPassword123!');
    const wrongPassMatch = await organizer.comparePassword('WrongPassword!');
    const authValid = correctPassMatch && !wrongPassMatch;
    logStep('Phase 2b: Password Comparison', authValid, 'Correct matches, wrong fails');

    // Verify toJSON password exclusion
    const userJson = organizer.toJSON();
    const passwordStripped = !('password' in userJson);
    logStep('Phase 2c: toJSON Password Stripping', passwordStripped, 'Password excluded from client JSON');

    // ----------------------------------------------------
    // Phase 3: Hackathon Event Creation
    // ----------------------------------------------------
    const now = new Date();
    const startDate = new Date(now.getTime() + 86400000); // +1 day
    const endDate = new Date(now.getTime() + 86400000 * 4); // +4 days
    const regDeadline = new Date(now.getTime() + 86400000 * 2); // +2 days
    const subDeadline = new Date(now.getTime() + 86400000 * 3); // +3 days

    const hackathon = new Hackathon({
      title: `Test AI Hackathon ${timestamp}`,
      description: 'Integration test hackathon event for judging verification.',
      organizer: organizer._id,
      startDate,
      endDate,
      registrationDeadline: regDeadline,
      submissionDeadline: subDeadline,
      tracks: [
        { name: 'Artificial Intelligence', description: 'AI agent solutions' },
        { name: 'Web3 & Security', description: 'Decentralized tools' },
      ],
      prizes: [
        { title: 'Grand Winner', amount: '$3,000' },
        { title: 'Best Technical Execution', amount: '$1,000' },
      ],
      rubric: [
        { criterion: 'Innovation', maxScore: 25, weight: 1 },
        { criterion: 'Technical Execution', maxScore: 25, weight: 1 },
        { criterion: 'Impact', maxScore: 25, weight: 1 },
        { criterion: 'Presentation', maxScore: 25, weight: 1 },
      ],
      status: 'LIVE',
      badgeColor: 'purple',
    });
    await hackathon.save();
    createdIds.hackathons.push(hackathon._id);
    logStep('Phase 3: Hackathon Creation', true, `Event "${hackathon.title}" created with 4 rubric criteria`);

    // ----------------------------------------------------
    // Phase 4: Team Model & Duplicate Name Rejection
    // ----------------------------------------------------
    const team = new Team({
      name: 'Cyber Innovators',
      hackathon: hackathon._id,
      leader: organizer._id,
    });
    await team.save();
    createdIds.teams.push(team._id);

    const hasInviteCode = Boolean(team.inviteCode && team.inviteCode.startsWith('DF-'));
    logStep('Phase 4a: Team & Auto Invite Code', hasInviteCode, `Generated invite code: ${team.inviteCode}`);

    // Verify duplicate team name rejection within same hackathon
    let duplicateTeamRejected = false;
    try {
      const duplicateTeam = new Team({
        name: 'Cyber Innovators', // Same name in same hackathon
        hackathon: hackathon._id,
        leader: judge._id,
      });
      await duplicateTeam.save();
      createdIds.teams.push(duplicateTeam._id); // in case it saved
    } catch (err) {
      if (err.code === 11000) {
        duplicateTeamRejected = true;
      } else {
        console.error('Unexpected error on duplicate team:', err);
      }
    }
    logStep(
      'Phase 4b: Duplicate Team Name Rejection',
      duplicateTeamRejected,
      'MongoDB rejected duplicate team name in same hackathon with E11000'
    );

    // ----------------------------------------------------
    // Phase 5: Submission & One-Submission-Per-Team Rule
    // ----------------------------------------------------
    const submission = new Submission({
      title: 'Neural Vision AI',
      tagline: 'Deep learning for crop disease prevention.',
      description: 'End-to-end computer vision platform with mobile app.',
      hackathon: hackathon._id,
      team: team._id,
      track: 'Artificial Intelligence',
      tags: ['AI', 'Computer Vision', 'PyTorch'],
      repoUrl: 'https://github.com/example/neural-vision',
      demoUrl: 'https://neural-vision.example.com',
      status: 'submitted',
    });
    await submission.save();
    createdIds.submissions.push(submission._id);

    const hasSubmittedAt = Boolean(submission.submittedAt);
    logStep('Phase 5a: Submission Created', hasSubmittedAt, `Auto-assigned submittedAt: ${submission.submittedAt}`);

    // Verify duplicate submission rejection for same team & hackathon
    let duplicateSubmissionRejected = false;
    try {
      const secondSubmission = new Submission({
        title: 'Second Project Proposal',
        description: 'Team trying to submit a second project to same event.',
        hackathon: hackathon._id,
        team: team._id, // Same team in same hackathon!
        track: 'Artificial Intelligence',
        status: 'submitted',
      });
      await secondSubmission.save();
      createdIds.submissions.push(secondSubmission._id);
    } catch (err) {
      if (err.code === 11000) {
        duplicateSubmissionRejected = true;
      } else {
        console.error('Unexpected error on duplicate submission:', err);
      }
    }
    logStep(
      'Phase 5b: One-Submission-Per-Team Rejection',
      duplicateSubmissionRejected,
      'MongoDB rejected 2nd submission for same team with E11000'
    );

    // ----------------------------------------------------
    // Phase 6: Score Calculation & Rubric Limits
    // ----------------------------------------------------
    const score = new Score({
      hackathon: hackathon._id,
      submission: submission._id,
      judge: judge._id,
      rubricScores: [
        { criterion: 'Innovation', score: 24, maxScore: 25 },
        { criterion: 'Technical Execution', score: 22, maxScore: 25 },
        { criterion: 'Impact', score: 23, maxScore: 25 },
        { criterion: 'Presentation', score: 21, maxScore: 25 },
      ],
      totalScore: 9999, // Client sends fake total! Server must recalculate: 24+22+23+21 = 90
      feedback: 'Incredible technical execution and demo clarity.',
      status: 'submitted',
    });
    await score.save();
    createdIds.scores.push(score._id);

    const totalRecalculated = score.totalScore === 90;
    logStep(
      'Phase 6a: Server-Calculated Total Score',
      totalRecalculated,
      `Calculated 90 from rubric criteria (ignored client 9999)`
    );

    // Verify rejection if score > maxScore
    let invalidScoreRejected = false;
    try {
      const invalidScore = new Score({
        hackathon: hackathon._id,
        submission: submission._id,
        judge: organizer._id,
        rubricScores: [
          { criterion: 'Innovation', score: 35, maxScore: 25 }, // 35 > 25 invalid!
        ],
      });
      await invalidScore.save();
      createdIds.scores.push(invalidScore._id);
    } catch (err) {
      invalidScoreRejected = true;
    }
    logStep(
      'Phase 6b: Rubric Max Score Limit Validation',
      invalidScoreRejected,
      'Mongoose rejected score exceeding maxScore (35/25)'
    );

    // ----------------------------------------------------
    // Phase 7: One Score Per Judge Per Submission
    // ----------------------------------------------------
    let duplicateScoreRejected = false;
    try {
      const duplicateScore = new Score({
        hackathon: hackathon._id,
        submission: submission._id, // Same submission
        judge: judge._id, // Same judge!
        rubricScores: [
          { criterion: 'Innovation', score: 20, maxScore: 25 },
        ],
      });
      await duplicateScore.save();
      createdIds.scores.push(duplicateScore._id);
    } catch (err) {
      if (err.code === 11000) {
        duplicateScoreRejected = true;
      } else {
        console.error('Unexpected error on duplicate score:', err);
      }
    }
    logStep(
      'Phase 7: One Score Per Judge Per Submission',
      duplicateScoreRejected,
      'MongoDB rejected duplicate judge score with E11000'
    );

    // ----------------------------------------------------
    // Phase 8: Cross-Collection Reference Population
    // ----------------------------------------------------
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('team', 'name inviteCode')
      .populate('hackathon', 'title status');

    const populatedScore = await Score.findById(score._id)
      .populate('judge', 'name email role')
      .populate('submission', 'title');

    const refsWork =
      populatedSubmission.team.name === 'Cyber Innovators' &&
      populatedSubmission.hackathon.status === 'LIVE' &&
      populatedScore.judge.email.includes('test_judge') &&
      populatedScore.submission.title === 'Neural Vision AI';

    logStep('Phase 8: Reference Population', refsWork, 'Joined Team, Hackathon, Judge, and Submission documents');

  } catch (error) {
    console.error('\n❌ Unhandled error during integration test:', error);
    logStep('Overall Test Suite Execution', false, error.message);
  } finally {
    console.log('\n🧹 CLEANING UP TEMPORARY TEST RECORDS...');
    try {
      if (createdIds.scores.length > 0) {
        const res = await Score.deleteMany({ _id: { $in: createdIds.scores } });
        console.log(`   Deleted ${res.deletedCount} temporary scores`);
      }
      if (createdIds.submissions.length > 0) {
        const res = await Submission.deleteMany({ _id: { $in: createdIds.submissions } });
        console.log(`   Deleted ${res.deletedCount} temporary submissions`);
      }
      if (createdIds.teams.length > 0) {
        const res = await Team.deleteMany({ _id: { $in: createdIds.teams } });
        console.log(`   Deleted ${res.deletedCount} temporary teams`);
      }
      if (createdIds.hackathons.length > 0) {
        const res = await Hackathon.deleteMany({ _id: { $in: createdIds.hackathons } });
        console.log(`   Deleted ${res.deletedCount} temporary hackathons`);
      }
      if (createdIds.users.length > 0) {
        const res = await User.deleteMany({ _id: { $in: createdIds.users } });
        console.log(`   Deleted ${res.deletedCount} temporary users`);
      }
      console.log('✅ Temporary test records cleaned up completely.');
    } catch (cleanupErr) {
      console.error('❌ Error during cleanup:', cleanupErr);
    } finally {
      await mongoose.disconnect();
      console.log('📡 Disconnected cleanly from MongoDB.\n');
    }
  }

  // Final Summary Report
  console.log('====================================================');
  console.log('📊 INTEGRATION TEST RESULTS SUMMARY');
  console.log('====================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`Total Checks: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`Final Status: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runIntegrationTests();
