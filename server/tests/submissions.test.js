const http = require('http');
const mongoose = require('mongoose');
const { User, Hackathon, Team, Submission } = require('../src/models');

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
  console.log('=== STARTING SUBMISSIONS API VERIFICATION ===\n');

  const createdHackathonIds = [];
  const createdTeamIds = [];
  const createdSubmissionIds = [];
  const emailsToClean = [
    `sub_org_${timestamp}@example.com`,
    `sub_lead_${timestamp}@example.com`,
    `sub_member_${timestamp}@example.com`,
  ];

  try {
    // 1. Organizer creates Hackathon
    const orgRes = await request('POST', '/api/auth/register', {
      name: 'Submission Org',
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
        title: `Submission Challenge ${timestamp}`,
        description: 'Testing project submission flow.',
        startDate: new Date(now + 86400000).toISOString(),
        endDate: new Date(now + 86400000 * 5).toISOString(),
        registrationDeadline: new Date(now + 86400000 * 2).toISOString(),
        submissionDeadline: new Date(now + 86400000 * 4).toISOString(),
        tracks: [{ name: 'Artificial Intelligence', description: 'AI Track' }],
      },
      { Authorization: `Bearer ${orgToken}` }
    );
    const hackathonId = eventRes.body.data._id;
    createdHackathonIds.push(hackathonId);

    // 2. Leader creates Team
    const leadRes = await request('POST', '/api/auth/register', {
      name: 'Leader Larry',
      email: emailsToClean[1],
      password: 'Password123!',
      role: 'participant',
    });
    const leadToken = leadRes.body.token;

    const teamRes = await request(
      'POST',
      '/api/teams',
      {
        name: `Alpha Builders ${timestamp}`,
        hackathonId,
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    const teamId = teamRes.body.data._id;
    const inviteCode = teamRes.body.data.inviteCode;
    createdTeamIds.push(teamId);

    // 3. Member joins Team
    const memRes = await request('POST', '/api/auth/register', {
      name: 'Member Mary',
      email: emailsToClean[2],
      password: 'Password123!',
      role: 'participant',
    });
    const memToken = memRes.body.token;

    await request(
      'POST',
      '/api/teams/join',
      { inviteCode },
      { Authorization: `Bearer ${memToken}` }
    );

    // Test 1: POST /api/submissions without token (401)
    console.log('Test 1: POST /api/submissions without token');
    const noTokenRes = await request('POST', '/api/submissions', { title: 'No Token Project' });
    console.log('Status:', noTokenRes.status, '(Expected: 401)');

    // Test 2: POST /api/submissions by member Mary (non-leader) (403 Forbidden)
    console.log('\nTest 2: POST /api/submissions by regular team member');
    const memberSubRes = await request(
      'POST',
      '/api/submissions',
      {
        teamId,
        title: 'Unauthorized Project',
        description: 'Should be rejected',
        track: 'Artificial Intelligence',
      },
      { Authorization: `Bearer ${memToken}` }
    );
    console.log('Status:', memberSubRes.status, '(Expected: 403)');
    console.log('Message:', memberSubRes.body.message);

    // Test 3: POST /api/submissions by leader Larry (201 Created)
    console.log('\nTest 3: POST /api/submissions by team leader');
    const validSubRes = await request(
      'POST',
      '/api/submissions',
      {
        teamId,
        title: 'FarmGuard Vision AI',
        tagline: 'Deep learning for crop disease prevention',
        description: 'Full stack AI detection platform with mobile camera scanning.',
        track: 'Artificial Intelligence',
        tags: ['AI', 'Agriculture', 'Vision'],
        repoUrl: 'https://github.com/example/farmguard',
        demoUrl: 'https://farmguard.demo.app',
        status: 'submitted',
        averageScore: 999, // Should be ignored and set to 0!
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', validSubRes.status, '(Expected: 201)');
    const createdSub = validSubRes.body.data;
    createdSubmissionIds.push(createdSub._id);
    console.log('Created title:', createdSub.title);
    console.log('Auto submittedAt assigned?', Boolean(createdSub.submittedAt));
    console.log('Client averageScore ignored?', createdSub.averageScore === 0);

    // Test 4: POST /api/submissions duplicate submission for same team in same hackathon (409 Conflict)
    console.log('\nTest 4: POST /api/submissions - Duplicate submission for same team');
    const dupSubRes = await request(
      'POST',
      '/api/submissions',
      {
        teamId,
        title: 'Second Project by Same Team',
        description: 'Duplicate should fail',
        track: 'Artificial Intelligence',
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', dupSubRes.status, '(Expected: 409)');
    console.log('Message:', dupSubRes.body.message);

    // Test 5: GET /api/submissions?hackathonId=... (200 OK)
    console.log('\nTest 5: GET /api/submissions?hackathonId=' + hackathonId);
    const getSubsRes = await request(
      'GET',
      `/api/submissions?hackathonId=${hackathonId}`,
      null,
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', getSubsRes.status, '(Expected: 200)');
    console.log('Count:', getSubsRes.body.count, '(Expected >= 1)');

    // Test 6: GET /api/submissions/:id (200 OK)
    console.log(`\nTest 6: GET /api/submissions/${createdSub._id}`);
    const getOneRes = await request('GET', `/api/submissions/${createdSub._id}`, null, {
      Authorization: `Bearer ${leadToken}`,
    });
    console.log('Status:', getOneRes.status, '(Expected: 200)');
    console.log('Project title match:', getOneRes.body.data.title === 'FarmGuard Vision AI');
    console.log('Populated team name:', getOneRes.body.data.team.name);

    // Test 7: PUT /api/submissions/:id by non-leader member (403 Forbidden)
    console.log(`\nTest 7: PUT /api/submissions/${createdSub._id} by regular member`);
    const badUpdateRes = await request(
      'PUT',
      `/api/submissions/${createdSub._id}`,
      { title: 'Member Hijacked Title' },
      { Authorization: `Bearer ${memToken}` }
    );
    console.log('Status:', badUpdateRes.status, '(Expected: 403)');
    console.log('Message:', badUpdateRes.body.message);

    // Test 8: PUT /api/submissions/:id by team leader (200 OK)
    console.log(`\nTest 8: PUT /api/submissions/${createdSub._id} by team leader`);
    const goodUpdateRes = await request(
      'PUT',
      `/api/submissions/${createdSub._id}`,
      {
        title: 'FarmGuard Vision AI (Final Edition)',
        tagline: 'Autonomous crop disease detection and yield forecast',
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', goodUpdateRes.status, '(Expected: 200)');
    console.log('Updated title:', goodUpdateRes.body.data.title);

    // Test 9: GET /api/submissions/gallery/:hackathonId (Public Gallery)
    console.log(`\nTest 9: GET /api/submissions/gallery/${hackathonId} (Public)`);
    const galleryRes = await request('GET', `/api/submissions/gallery/${hackathonId}`);
    console.log('Status:', galleryRes.status, '(Expected: 200)');
    console.log('Gallery item count:', galleryRes.body.count, '(Expected >= 1)');
    console.log('Project in gallery:', galleryRes.body.data[0].title);

    // Test 10: Submission Deadline Enforcement (400 Bad Request if deadline passed)
    console.log('\nTest 10: Submission Deadline Enforcement');
    // Create an expired hackathon
    const expiredEventRes = await request(
      'POST',
      '/api/events',
      {
        title: `Expired Hackathon ${timestamp}`,
        description: 'Testing deadline rejection',
        startDate: new Date(now - 86400000 * 5).toISOString(),
        endDate: new Date(now - 86400000 * 1).toISOString(),
        registrationDeadline: new Date(now - 86400000 * 4).toISOString(),
        submissionDeadline: new Date(now - 86400000 * 2).toISOString(), // 2 days ago!
      },
      { Authorization: `Bearer ${orgToken}` }
    );
    const expiredHackathonId = expiredEventRes.body.data._id;
    createdHackathonIds.push(expiredHackathonId);

    // Register fresh participant for expired event
    const freshRes = await request('POST', '/api/auth/register', {
      name: 'Fresh Lead',
      email: `sub_fresh_${timestamp}@example.com`,
      password: 'Password123!',
      role: 'participant',
    });
    emailsToClean.push(`sub_fresh_${timestamp}@example.com`);

    // Create team in expired hackathon directly in DB (bypass registration deadline for testing submission deadline)
    await mongoose.connect('mongodb://127.0.0.1:27017/dogfood_hackathon');
    const expiredTeam = await Team.create({
      name: `Expired Team ${timestamp}`,
      hackathon: expiredHackathonId,
      leader: freshRes.body.user._id,
      members: [freshRes.body.user._id],
    });
    createdTeamIds.push(expiredTeam._id);
    await mongoose.disconnect();

    const lateSubRes = await request(
      'POST',
      '/api/submissions',
      {
        teamId: expiredTeam._id,
        title: 'Late Project Submission',
        description: 'Should be rejected due to deadline',
        track: 'General',
        status: 'submitted',
      },
      { Authorization: `Bearer ${freshRes.body.token}` }
    );
    console.log('Status:', lateSubRes.status, '(Expected: 400)');
    console.log('Message:', lateSubRes.body.message);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    console.log('\n🧹 Cleaning up temporary test records...');
    await mongoose.connect('mongodb://127.0.0.1:27017/dogfood_hackathon');
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
