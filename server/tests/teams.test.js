const http = require('http');
const mongoose = require('mongoose');
const { User, Hackathon, Team } = require('../src/models');

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
  console.log('=== STARTING TEAMS API VERIFICATION ===\n');

  let createdHackathonId = null;
  const createdTeamIds = [];
  const emailsToClean = [
    `team_org_${timestamp}@example.com`,
    `team_lead_${timestamp}@example.com`,
    `team_user2_${timestamp}@example.com`,
    `team_user3_${timestamp}@example.com`,
  ];

  try {
    // Setup 1: Organizer to create a hackathon
    const orgRes = await request('POST', '/api/auth/register', {
      name: 'Team Organizer',
      email: emailsToClean[0],
      password: 'Password123!',
      role: 'organizer',
    });
    const orgToken = orgRes.body.token;

    const now = Date.now();
    const hackathonRes = await request(
      'POST',
      '/api/events',
      {
        title: `Team Hackathon ${timestamp}`,
        description: 'Testing team formation and join workflows.',
        startDate: new Date(now + 86400000).toISOString(),
        endDate: new Date(now + 86400000 * 4).toISOString(),
        registrationDeadline: new Date(now + 86400000 * 2).toISOString(),
        submissionDeadline: new Date(now + 86400000 * 3).toISOString(),
      },
      { Authorization: `Bearer ${orgToken}` }
    );
    createdHackathonId = hackathonRes.body.data._id;

    // Setup 2: Participant 1 (Team Leader)
    const leadRes = await request('POST', '/api/auth/register', {
      name: 'Alice Leader',
      email: emailsToClean[1],
      password: 'Password123!',
      role: 'participant',
    });
    const leadToken = leadRes.body.token;
    const leadId = leadRes.body.user._id;

    // Setup 3: Participant 2 (Team Member)
    const p2Res = await request('POST', '/api/auth/register', {
      name: 'Bob Teammate',
      email: emailsToClean[2],
      password: 'Password123!',
      role: 'participant',
    });
    const p2Token = p2Res.body.token;

    // Setup 4: Participant 3 (Separate team leader)
    const p3Res = await request('POST', '/api/auth/register', {
      name: 'Charlie Other',
      email: emailsToClean[3],
      password: 'Password123!',
      role: 'participant',
    });
    const p3Token = p3Res.body.token;

    // Test 1: POST /api/teams without token (401)
    console.log('Test 1: POST /api/teams without token');
    const noTokenRes = await request('POST', '/api/teams', { name: 'Unauthorized Team' });
    console.log('Status:', noTokenRes.status, '(Expected: 401)');

    // Test 2: POST /api/teams with valid leader token (201 Created)
    console.log('\nTest 2: POST /api/teams with Alice (Leader)');
    const createTeamRes = await request(
      'POST',
      '/api/teams',
      {
        name: 'Neural Innovators',
        hackathonId: createdHackathonId,
        maxMembers: 4,
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', createTeamRes.status, '(Expected: 201)');
    const createdTeam = createTeamRes.body.data;
    createdTeamIds.push(createdTeam._id);
    console.log('Team Name:', createdTeam.name);
    console.log('Auto Invite Code:', createdTeam.inviteCode);
    console.log('Leader set correctly?', createdTeam.leader._id === leadId);
    console.log('Leader auto-included in members?', createdTeam.members.some((m) => m._id === leadId));

    // Test 3: POST /api/teams when user is already in a team in this hackathon (409)
    console.log('\nTest 3: POST /api/teams - Alice trying to create a second team in same hackathon');
    const doubleTeamRes = await request(
      'POST',
      '/api/teams',
      {
        name: 'Alice Second Team',
        hackathonId: createdHackathonId,
      },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', doubleTeamRes.status, '(Expected: 409)');
    console.log('Message:', doubleTeamRes.body.message);

    // Test 4: POST /api/teams with duplicate name in same hackathon by Charlie (409)
    console.log('\nTest 4: POST /api/teams - Charlie trying to use duplicate team name in same hackathon');
    const dupNameRes = await request(
      'POST',
      '/api/teams',
      {
        name: 'Neural Innovators', // Same name
        hackathonId: createdHackathonId,
      },
      { Authorization: `Bearer ${p3Token}` }
    );
    console.log('Status:', dupNameRes.status, '(Expected: 409)');
    console.log('Message:', dupNameRes.body.message);

    // Test 5: GET /api/teams?hackathonId=... (200 OK)
    console.log('\nTest 5: GET /api/teams?hackathonId=' + createdHackathonId);
    const getTeamsRes = await request(
      'GET',
      `/api/teams?hackathonId=${createdHackathonId}`,
      null,
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', getTeamsRes.status, '(Expected: 200)');
    console.log('Count:', getTeamsRes.body.count, '(Expected >= 1)');

    // Test 6: GET /api/teams/:id (200 OK)
    console.log(`\nTest 6: GET /api/teams/${createdTeam._id}`);
    const getOneRes = await request('GET', `/api/teams/${createdTeam._id}`, null, {
      Authorization: `Bearer ${leadToken}`,
    });
    console.log('Status:', getOneRes.status, '(Expected: 200)');
    console.log('Team name:', getOneRes.body.data.name);
    console.log('Members count:', getOneRes.body.data.members.length);

    // Test 7: POST /api/teams/join with invalid invite code (404)
    console.log('\nTest 7: POST /api/teams/join with fake invite code');
    const badJoinRes = await request(
      'POST',
      '/api/teams/join',
      { inviteCode: 'DF-FAKE99' },
      { Authorization: `Bearer ${p2Token}` }
    );
    console.log('Status:', badJoinRes.status, '(Expected: 404)');
    console.log('Message:', badJoinRes.body.message);

    // Test 8: POST /api/teams/join when already a member (400)
    console.log('\nTest 8: POST /api/teams/join - Alice joining her own team');
    const selfJoinRes = await request(
      'POST',
      '/api/teams/join',
      { inviteCode: createdTeam.inviteCode },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', selfJoinRes.status, '(Expected: 400)');
    console.log('Message:', selfJoinRes.body.message);

    // Test 9: POST /api/teams/join by Bob (200 OK)
    console.log('\nTest 9: POST /api/teams/join - Bob joining with valid invite code');
    const goodJoinRes = await request(
      'POST',
      '/api/teams/join',
      { inviteCode: createdTeam.inviteCode },
      { Authorization: `Bearer ${p2Token}` }
    );
    console.log('Status:', goodJoinRes.status, '(Expected: 200)');
    console.log('Updated members count:', goodJoinRes.body.data.members.length, '(Expected: 2)');

    // Test 10: PUT /api/teams/:id by non-leader Bob (403 Forbidden)
    console.log(`\nTest 10: PUT /api/teams/${createdTeam._id} by Bob (non-leader)`);
    const badUpdateRes = await request(
      'PUT',
      `/api/teams/${createdTeam._id}`,
      { name: 'Bob Renamed Team' },
      { Authorization: `Bearer ${p2Token}` }
    );
    console.log('Status:', badUpdateRes.status, '(Expected: 403)');
    console.log('Message:', badUpdateRes.body.message);

    // Test 11: PUT /api/teams/:id by leader Alice (200 OK)
    console.log(`\nTest 11: PUT /api/teams/${createdTeam._id} by Alice (leader)`);
    const goodUpdateRes = await request(
      'PUT',
      `/api/teams/${createdTeam._id}`,
      { name: 'Neural Innovators Elite' },
      { Authorization: `Bearer ${leadToken}` }
    );
    console.log('Status:', goodUpdateRes.status, '(Expected: 200)');
    console.log('Updated team name:', goodUpdateRes.body.data.name);

    // Test 12: Maximum team size enforcement (400 Bad Request)
    console.log('\nTest 12: Maximum team size capacity enforcement');
    // Charlie creates a solo team with maxMembers: 1
    const soloTeamRes = await request(
      'POST',
      '/api/teams',
      {
        name: 'Charlie Solo Team',
        hackathonId: createdHackathonId,
        maxMembers: 1, // Full immediately since Charlie is leader and first member
      },
      { Authorization: `Bearer ${p3Token}` }
    );
    createdTeamIds.push(soloTeamRes.body.data._id);
    const soloInvite = soloTeamRes.body.data.inviteCode;

    // Bob tries to join Charlie's full team (note Bob must not be in another team in hackathon, so let's register a fresh user Dave)
    const dRes = await request('POST', '/api/auth/register', {
      name: 'Dave Extra',
      email: `team_dave_${timestamp}@example.com`,
      password: 'Password123!',
      role: 'participant',
    });
    emailsToClean.push(`team_dave_${timestamp}@example.com`);

    const capJoinRes = await request(
      'POST',
      '/api/teams/join',
      { inviteCode: soloInvite },
      { Authorization: `Bearer ${dRes.body.token}` }
    );
    console.log('Status:', capJoinRes.status, '(Expected: 400)');
    console.log('Message:', capJoinRes.body.message);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    console.log('\n🧹 Cleaning up temporary test records...');
    await mongoose.connect('mongodb://127.0.0.1:27017/dogfood_hackathon');
    if (createdTeamIds.length > 0) {
      await Team.deleteMany({ _id: { $in: createdTeamIds } });
      console.log(`   Deleted ${createdTeamIds.length} temporary test teams`);
    }
    if (createdHackathonId) {
      await Hackathon.deleteOne({ _id: createdHackathonId });
      console.log('   Deleted temporary test hackathon');
    }
    await User.deleteMany({ email: { $in: emailsToClean } });
    console.log('   Deleted temporary test users');
    await mongoose.disconnect();
    console.log('✅ Temporary test records cleaned up completely.');
  }
})();
