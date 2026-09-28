const http = require('http');
const mongoose = require('mongoose');
const { User, Hackathon } = require('../src/models');

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
  console.log('=== STARTING HACKATHON EVENTS API VERIFICATION ===\n');

  let createdEventId = null;
  const emailsToClean = [
    `org_${timestamp}@example.com`,
    `part_${timestamp}@example.com`,
    `org2_${timestamp}@example.com`,
  ];

  try {
    // 1. Register Organizer
    const orgRes = await request('POST', '/api/auth/register', {
      name: 'Event Organizer 1',
      email: emailsToClean[0],
      password: 'Password123!',
      role: 'organizer',
    });
    const orgToken = orgRes.body.token;
    const orgId = orgRes.body.user._id;

    // 2. Register Participant (for 403 forbidden test)
    const partRes = await request('POST', '/api/auth/register', {
      name: 'Event Participant',
      email: emailsToClean[1],
      password: 'Password123!',
      role: 'participant',
    });
    const partToken = partRes.body.token;

    // 3. Register Another Organizer (for 403 ownership test)
    const org2Res = await request('POST', '/api/auth/register', {
      name: 'Event Organizer 2',
      email: emailsToClean[2],
      password: 'Password123!',
      role: 'organizer',
    });
    const org2Token = org2Res.body.token;

    // Test 1: GET /api/events (Public)
    console.log('Test 1: GET /api/events');
    const getEventsRes = await request('GET', '/api/events');
    console.log('Status:', getEventsRes.status, '(Expected: 200)');
    console.log('Success:', getEventsRes.body.success, 'Count:', getEventsRes.body.count);

    // Test 2: GET /api/events/invalid_id (Invalid ID validation)
    console.log('\nTest 2: GET /api/events/not_a_valid_id');
    const badIdRes = await request('GET', '/api/events/not_a_valid_id');
    console.log('Status:', badIdRes.status, '(Expected: 400)');
    console.log('Message:', badIdRes.body.message);

    // Test 3: POST /api/events without token (401)
    console.log('\nTest 3: POST /api/events without token');
    const noTokenRes = await request('POST', '/api/events', { title: 'No Token Event' });
    console.log('Status:', noTokenRes.status, '(Expected: 401)');

    // Test 4: POST /api/events with participant token (403 Forbidden)
    console.log('\nTest 4: POST /api/events with participant role');
    const partCreateRes = await request(
      'POST',
      '/api/events',
      {
        title: 'Participant Event',
        description: 'Should be rejected',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        registrationDeadline: new Date(),
        submissionDeadline: new Date(Date.now() + 40000000),
      },
      { Authorization: `Bearer ${partToken}` }
    );
    console.log('Status:', partCreateRes.status, '(Expected: 403)');
    console.log('Message:', partCreateRes.body.message);

    // Test 5: POST /api/events with organizer token (201 Created & Tamper-proof organizer)
    console.log('\nTest 5: POST /api/events with organizer token');
    const now = Date.now();
    const newEventData = {
      title: `Cloud AI Hackathon ${timestamp}`,
      description: 'Build enterprise AI applications and workflows.',
      organizer: 'fake_client_organizer_id', // Should be ignored/overwritten!
      startDate: new Date(now + 86400000).toISOString(),
      endDate: new Date(now + 86400000 * 4).toISOString(),
      registrationDeadline: new Date(now + 86400000 * 2).toISOString(),
      submissionDeadline: new Date(now + 86400000 * 3).toISOString(),
      tracks: [
        { name: 'Generative AI', description: 'Next-gen tools' },
        { name: 'Cloud Native', description: 'Kubernetes and microservices' },
      ],
      prizes: [{ title: 'First Place', amount: '$5,000' }],
      status: 'LIVE',
      badgeColor: 'purple',
    };
    const createRes = await request('POST', '/api/events', newEventData, {
      Authorization: `Bearer ${orgToken}`,
    });
    console.log('Status:', createRes.status, '(Expected: 201)');
    console.log('Created title:', createRes.body.data.title);
    console.log('Organizer set to authenticated user?', createRes.body.data.organizer === orgId);
    createdEventId = createRes.body.data._id;

    // Test 6: GET /api/events/:id
    console.log(`\nTest 6: GET /api/events/${createdEventId}`);
    const getOneRes = await request('GET', `/api/events/${createdEventId}`);
    console.log('Status:', getOneRes.status, '(Expected: 200)');
    console.log('Title match?', getOneRes.body.data.title === newEventData.title);
    console.log('Populated organizer name:', getOneRes.body.data.organizer.name);

    // Test 7: PUT /api/events/:id by another organizer (403 Forbidden)
    console.log(`\nTest 7: PUT /api/events/${createdEventId} by unauthorized organizer`);
    const badUpdateRes = await request(
      'PUT',
      `/api/events/${createdEventId}`,
      { title: 'Hijacked Event Title' },
      { Authorization: `Bearer ${org2Token}` }
    );
    console.log('Status:', badUpdateRes.status, '(Expected: 403)');
    console.log('Message:', badUpdateRes.body.message);

    // Test 8: PUT /api/events/:id by creator organizer (200 OK)
    console.log(`\nTest 8: PUT /api/events/${createdEventId} by creator organizer`);
    const goodUpdateRes = await request(
      'PUT',
      `/api/events/${createdEventId}`,
      {
        title: `Cloud AI Hackathon Updated ${timestamp}`,
        status: 'COMPLETED',
      },
      { Authorization: `Bearer ${orgToken}` }
    );
    console.log('Status:', goodUpdateRes.status, '(Expected: 200)');
    console.log('Updated title:', goodUpdateRes.body.data.title);
    console.log('Updated status:', goodUpdateRes.body.data.status);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up temporary test records...');
    await mongoose.connect('mongodb://127.0.0.1:27017/dogfood_hackathon');
    if (createdEventId) {
      await Hackathon.deleteOne({ _id: createdEventId });
      console.log('   Deleted temporary test hackathon');
    }
    await User.deleteMany({ email: { $in: emailsToClean } });
    console.log('   Deleted temporary test users');
    await mongoose.disconnect();
    console.log('✅ Temporary test records cleaned up completely.');
  }
})();
