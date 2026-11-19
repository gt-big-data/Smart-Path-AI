/** Uses a fresh disposable MongoDB on loopback port 27028 only. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const User = require('../models/User').default;
const routes = require('../routes/chatRoutes').default;

const uri = process.env.FOLDER_TEST_MONGO_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27028\/smartpath_folder_test_[a-z0-9]+$/.test(uri)) {
  throw new Error('FOLDER_TEST_MONGO_URI must name a disposable database on localhost:27028');
}
let server, base, owner, outsider, ownedDatabase = false;

before(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0);
  ownedDatabase = true;
  owner = String((await User.create({ email: 'owner@example.test', chats: [
    { chat_id: 'chat1', title: 'First', messages: [] },
    { chat_id: 'chat2', title: 'Second', messages: [] },
  ] }))._id);
  outsider = String((await User.create({ email: 'other@example.test', chats: [] }))._id);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { passport: { user: req.headers['x-test-user'] } }; next(); });
  app.use('/chat', routes);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (ownedDatabase) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function request(path, method, body, user = owner) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Test-User': user },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}

test('create a folder and move a chat in and out without affecting another user', async () => {
  const folder = await request('/chat/folder/new', 'POST', { name: 'Study notes' });
  assert.equal(folder.status, 201);
  assert.equal(folder.data.name, 'Study notes');
  const id = folder.data.folder_id;
  assert.equal((await request('/chat/move-to-folder', 'PATCH', { chat_id: 'chat1', folder_id: id })).status, 200);
  assert.equal((await User.findById(owner)).chats[0].folder_id, id);
  assert.equal((await request('/chat/move-to-folder', 'PATCH', { chat_id: 'chat1', folder_id: id }, outsider)).status, 404);
  assert.equal((await request('/chat/move-to-folder', 'PATCH', { chat_id: 'chat1', folder_id: null })).status, 200);
  assert.equal((await User.findById(owner)).chats[0].folder_id, null);
});

test('record visits only for owned chats and persist them', async () => {
  assert.equal((await request('/chat/activity/chat1', 'PATCH', {})).status, 204);
  const saved = await User.findById(owner);
  assert.ok(saved.chats[0].last_used_at instanceof Date);
  assert.equal(saved.chats[1].last_used_at, undefined);
  assert.equal((await request('/chat/activity/chat1', 'PATCH', {}, outsider)).status, 404);
});
