const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:5050';

async function runTests() {
  console.log('--- STARTING PIXEL CONQUEST BACKEND INTEGRATION TESTS ---');
  
  // Create client 1
  const client1 = io(SERVER_URL);
  
  // Register init listener immediately to avoid race condition
  const initPromise = new Promise((resolve) => {
    client1.once('init', ({ grid }) => resolve(grid));
  });
  
  // Wait for client 1 to connect
  await new Promise((resolve, reject) => {
    client1.on('connect', resolve);
    setTimeout(() => reject(new Error('Client 1 failed to connect')), 5000);
  });
  console.log('Client 1 connected.');

  // Join client 1
  client1.emit('join', { name: 'TestPlayer1', color: '#ff0055' });

  // Wait for initial load
  let initialGrid = await initPromise;
  console.log(`Initial state loaded. Grid has ${initialGrid.length} cells.`);

  // Test Case 1: Standard cell claim
  console.log('\n--- Test 1: Claiming an unclaimed cell ---');
  const targetCellId = 120;
  
  // Register listeners first
  const claimPromise = new Promise((resolve) => {
    client1.once('claim_success', (data) => resolve(data));
    client1.once('claim_failed', (data) => resolve(null));
  });

  client1.emit('claim_cell', { cellId: targetCellId });
  const claimSuccess = await claimPromise;

  if (claimSuccess && claimSuccess.cellId === targetCellId) {
    console.log('SUCCESS: Cell 120 successfully claimed by Client 1.');
  } else {
    console.error('FAILED: Cell 120 claim failed.');
    process.exit(1);
  }

  // Test Case 2: Cooldown check (Claiming again immediately should fail)
  console.log('\n--- Test 2: Enforcing action cooldown ---');
  
  // Register listeners first
  const cooldownPromise = new Promise((resolve) => {
    client1.once('claim_success', () => resolve(null));
    client1.once('claim_failed', (data) => resolve(data));
  });

  client1.emit('claim_cell', { cellId: 121 });
  const cooldownFailed = await cooldownPromise;

  if (cooldownFailed && cooldownFailed.reason === 'cooldown') {
    console.log(`SUCCESS: Claim rejected as expected due to cooldown: "${cooldownFailed.message}"`);
  } else {
    console.error('FAILED: Server did not enforce cooldown.');
    process.exit(1);
  }

  // Test Case 3: Cell lock / protection check (Client 2 trying to claim cell 120)
  console.log('\n--- Test 3: Enforcing cell protection lock ---');
  const client2 = io(SERVER_URL);
  
  await new Promise((resolve) => client2.on('connect', resolve));
  client2.emit('join', { name: 'TestPlayer2', color: '#00ff66' });
  
  // Wait a moment for registration
  await new Promise(r => setTimeout(r, 200));

  // Register listeners first
  const lockPromise = new Promise((resolve) => {
    client2.once('claim_success', () => resolve(null));
    client2.once('claim_failed', (data) => resolve(data));
  });

  // Client 2 attempts to claim Cell 120 (currently owned and shielded by Client 1)
  client2.emit('claim_cell', { cellId: targetCellId });
  const lockFailed = await lockPromise;

  if (lockFailed && lockFailed.reason === 'locked') {
    console.log(`SUCCESS: Client 2 claim of cell 120 rejected due to shield: "${lockFailed.message}"`);
  } else {
    console.error('FAILED: Client 2 claimed a locked cell or request failed incorrectly.');
    process.exit(1);
  }

  // Clean up
  client1.disconnect();
  client2.disconnect();
  console.log('\n--- ALL TEST CASES PASSED SUCCESSFULLY ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
