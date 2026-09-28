const http = require('http');
const mongoose = require('mongoose');
const { User, Hackathon, Team, Submission, Score } = require('../src/models');

const request = (method, path, body, headers = {}) => {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, text: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

(async () => {
  const timestamp = Date.now();
  console.log('=== STARTING JUDGING & SCORING API VERIFICATION ===\n');

  const createdHackathonIds = [];
  const createdTeamIds = [];
  const createdSubmissionIds = [];
  const createdScoreIds = [];
  const emailsToClean = [
    `sc_org_${timestamp}@example.com`,
    `sc_judge1_${timestamp}@example.com`,
    `sc_judge2_${timestamp}@example.com`,
    `sc_lead_${timestamp}@example.com`,
  ];

  try {
    // 1. Setup Organizer & Hackathon
    const orgRes = await request('POST', '/api/auth/register', {
      name: 'Score Organizer',
      email: emailsToClean[0],
      password: 'Password123!',
      role: 'organizer',
    });
    const orgToken = orgRes.body.token;

    const now = Date.now();
    const eventRes = await request(
      'POST',
      '/api/events',
      {
        title: `Judging Challenge ${timestamp}`,
        description: 'Testing score calculation and judging workflows.',
        startDate: new Date(now + 86400000).toISOString(),
        endDate: new Date(now + 86400000 * 5).toISOString(),
        registrationDeadline: new Date(now + 86400000 * 2).toISOString(),
        submissionDeadline: new Date(now + 86400000 * 4).toISOString(),
        rubric: [
          { criterion: 'Innovation', maxScore: 25, weight: 1 },
          { criterion: 'Technical Execution', maxScore: 25, weight: 1 },
        ],
      },
      { Authorization: `Bearer ${orgToken}` }
    );
    const hackathonId = eventRes.body.data._id;
    createdHackathonIds.push(hackathonId);

    // 2. Setup Independent Judge 1
    const j1Res = await request('POST', '/api/auth/register', {
      name: 'Judge Judy',
      email: emailsToClean[1],
      password: 'Password123!',
      role: 'judge',
    });
    const j1Token = j1Res.body.token;
    const j1Id = j1Res.body.user._id;

    // 3. Setup Second Judge
    const j2Res = await request('POST', '/api/auth/register', {
      name: 'Judge Joe',
      email: emailsToClean[2],
      password: 'Password123!',
      role: 'judge',
    });
    const j2Token = j2Res.body.token;

    // 4. Setup Team Leader (Participant who also happens to have judge role on another team, or create a team with Judge Joe on it to test conflict of interest)
    const leadRes = await request('POST', '/api/auth/register', {
      name: 'Leader Luke',
      email: emailsToClean[3],
      password: 'Password123!',
      role: 'participant',
    });
    const leadToken = leadRes.body.token;

    const teamRes = await request(
      'POST',
      '/api/teams',
      {
        name: `Scoring Team ${timestamp}`,
        hackathonId,
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    const teamId = teamRes.body.data._id;
    const inviteCode = teamRes.body.data.inviteCode;
    createdTeamIds.push(teamId);

    // Have Judge Joe join this team (creating a conflict of interest for Judge Joe!)
    await request(
      'POST',
      '/api/teams/join',
      { inviteCode },
      { Authorization: `Bearer ${j2Token}` }
    );

    // Leader submits project
    const subRes = await request(
      'POST',
      '/api/submissions',
      {
        teamId,
        title: 'Project Zenith AI',
        description: 'Autonomous judging benchmark platform',
        track: 'General',
        status: 'submitted',
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    const submissionId = subRes.body.data._id;
    createdSubmissionIds.push(submissionId);

    // Test 1: POST /api/scores without token (401)
    console.log('Test 1: POST /api/scores without token');
    const noTokenRes = await request('POST', '/api/scores', { submissionId });
    console.log('Status:', noTokenRes.status, '(Expected: 401)');

    // Test 2: POST /api/scores with participant role (403 Forbidden)
    console.log('\nTest 2: POST /api/scores with participant role');
    const partScoreRes = await request(
      'POST',
      '/api/scores',
      {
        submissionId,
        rubricScores: [{ criterion: 'Innovation', score: 20, maxScore: 25 }],
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', partScoreRes.status, '(Expected: 403)');
    console.log('Message:', partScoreRes.body.message);

    // Test 3: POST /api/scores - Judge Joe evaluating his OWN team (Conflict of Interest 403)
    console.log('\nTest 3: POST /api/scores - Judge evaluating own team (Conflict of Interest)');
    const conflictRes = await request(
      'POST',
      '/api/scores',
      {
        submissionId,
        rubricScores: [{ criterion: 'Innovation', score: 25, maxScore: 25 }],
      },
      { Authorization: `Bearer ${j2Token}` }
    );
    console.log('Status:', conflictRes.status, '(Expected: 403)');
    console.log('Message:', conflictRes.body.message);

    // Test 4: POST /api/scores - Score exceeding maxScore boundary (400 Bad Request)
    console.log('\nTest 4: POST /api/scores - Score exceeding maxScore (30 > 25)');
    const overMaxRes = await request(
      'POST',
      '/api/scores',
      {
        submissionId,
        rubricScores: [{ criterion: 'Innovation', score: 30, maxScore: 25 }],
      },
      { Authorization: `Bearer ${j1Token}` }
    );
    console.log('Status:', overMaxRes.status, '(Expected: 400)');
    console.log('Message:', overMaxRes.body.message);

    // Test 5: POST /api/scores - Valid evaluation by independent Judge Judy (201 Created)
    console.log('\nTest 5: POST /api/scores - Valid evaluation by Judge Judy');
    const validScoreRes = await request(
      'POST',
      '/api/scores',
      {
        submissionId,
        rubricScores: [
          { criterion: 'Innovation', score: 24, maxScore: 25 },
          { criterion: 'Technical Execution', score: 22, maxScore: 25 },
        ],
        totalScore: 9999, // Should be ignored and calculated as 24+22=46
        feedback: 'Superb architecture and clean code presentation.',
        status: 'submitted',
      },
      { Authorization: `Bearer ${j1Token}` }
    );
    console.log('Status:', validScoreRes.status, '(Expected: 201)');
    const createdScore = validScoreRes.body.data;
    createdScoreIds.push(createdScore._id);
    console.log('Server computed totalScore:', createdScore.totalScore, '(Expected: 46)');
    console.log('Judge email:', createdScore.judge.email);

    // Verify submission aggregate updated
    const getSubRes = await request('GET', `/api/submissions/${submissionId}`, null, {
      Authorization: `Bearer ${orgToken}`,
    });
    console.log('Updated submission averageScore:', getSubRes.body.data.averageScore, '(Expected: 46)');
    console.log('Updated totalEvaluations count:', getSubRes.body.data.totalEvaluations, '(Expected: 1)');

    // Test 6: POST /api/scores - Duplicate evaluation by same judge (409 Conflict)
    console.log('\nTest 6: POST /api/scores - Duplicate evaluation by same judge');
    const dupScoreRes = await request(
      'POST',
      '/api/scores',
      {
        submissionId,
        rubricScores: [{ criterion: 'Innovation', score: 20, maxScore: 25 }],
      },
      { Authorization: `Bearer ${j1Token}` }
    );
    console.log('Status:', dupScoreRes.status, '(Expected: 409)');
    console.log('Message:', dupScoreRes.body.message);

    // Test 7: GET /api/scores/pending (200 OK)
    console.log('\nTest 7: GET /api/scores/pending (Queue should now exclude evaluated project)');
    const pendingRes = await request(
      'GET',
      `/api/scores/pending?hackathonId=${hackathonId}`,
      null,
      { Authorization: `Bearer ${j1Token}` }
    );
    console.log('Status:', pendingRes.status, '(Expected: 200)');
    console.log('Pending count for Judge Judy:', pendingRes.body.count, '(Expected: 0, since already evaluated)');

    // Test 8: GET /api/scores/submission/:submissionId (200 OK)
    console.log(`\nTest 8: GET /api/scores/submission/${submissionId}`);
    const getScoresRes = await request(
      'GET',
      `/api/scores/submission/${submissionId}`,
      null,
      { Authorization: `Bearer ${orgToken}` }
    );
    console.log('Status:', getScoresRes.status, '(Expected: 200)');
    console.log('Evaluations found:', getScoresRes.body.count, '(Expected: 1)');

    // Test 9: PUT /api/scores/:id by unauthorized judge (403 Forbidden)
    console.log(`\nTest 9: PUT /api/scores/${createdScore._id} by Judge Joe (unauthorized)`);
    const badUpdateRes = await request(
      'PUT',
      `/api/scores/${createdScore._id}`,
      { feedback: 'Altered feedback' },
      { Authorization: `Bearer ${j2Token}` }
    );
    console.log('Status:', badUpdateRes.status, '(Expected: 403)');
    console.log('Message:', badUpdateRes.body.message);

    // Test 10: PUT /api/scores/:id by owner judge (200 OK)
    console.log(`\nTest 10: PUT /api/scores/${createdScore._id} by owner Judge Judy`);
    const goodUpdateRes = await request(
      'PUT',
      `/api/scores/${createdScore._id}`,
      {
        rubricScores: [
          { criterion: 'Innovation', score: 25, maxScore: 25 },
          { criterion: 'Technical Execution', score: 25, maxScore: 25 },
        ],
        feedback: 'Revised: Perfect 50/50 across all criteria.',
      },
      { Authorization: `Bearer ${j1Token}` }
    );
    console.log('Status:', goodUpdateRes.status, '(Expected: 200)');
    console.log('Updated totalScore:', goodUpdateRes.body.data.totalScore, '(Expected: 50)');

    const finalSubRes = await request('GET', `/api/submissions/${submissionId}`, null, {
      Authorization: `Bearer ${orgToken}`,
    });
    console.log('Final updated submission averageScore:', finalSubRes.body.data.averageScore, '(Expected: 50)');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    console.log('\n🧹 Cleaning up temporary test records...');
    await mongoose.connect('mongodb://127.0.0.1:27017/dogfood_hackathon');
    if (createdScoreIds.length > 0) {
      await Score.deleteMany({ _id: { $in: createdScoreIds } });
      console.log(`   Deleted ${createdScoreIds.length} temporary test scores`);
    }
    if (createdSubmissionIds.length > 0) {
      await Submission.deleteMany({ _id: { $in: createdSubmissionIds } });
      console.log(`   Deleted ${createdSubmissionIds.length} temporary test submissions`);
    }
    if (createdTeamIds.length > 0) {
      await Team.deleteMany({ _id: { $in: createdTeamIds } });
      console.log(`   Deleted ${createdTeamIds.length} temporary test teams`);
    }
    if (createdHackathonIds.length > 0) {
      await Hackathon.deleteMany({ _id: { $in: createdHackathonIds } });
      console.log(`   Deleted ${createdHackathonIds.length} temporary test hackathons`);
    }
    await User.deleteMany({ email: { $in: emailsToClean } });
    console.log('   Deleted temporary test users');
    await mongoose.disconnect();
    console.log('✅ Temporary test records cleaned up completely.');
  }
})();
