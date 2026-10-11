// Separate entry point: never restarts the archived performance server.
process.env.PORT ||= '8899';
process.env.CHARACTER_KNOWLEDGE='1';
process.env.REALTIME_ONLY='1';
process.env.DISCUSSION_TEST_MODE='0';
await import('../start-server.mjs');
