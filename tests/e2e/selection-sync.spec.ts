import { test, expect } from '@playwright/test';

/**
 * E2E Test: Selection Sync Between Participants
 *
 * This test verifies that when a user selects text in the code editor,
 * the selection is visible to other participants.
 *
 * Test scenario:
 * 1. User1 creates a session
 * 2. User2 joins the session
 * 3. User1 types some code
 * 4. User1 selects a portion of the text
 * 5. Verify User2 sees the remote selection highlight
 */

test.describe('Selection Sync', () => {
    // WebRTC sync tests can be flaky over the internet due to P2P latency
    test.describe.configure({ retries: 2 });

    test('selection should be visible to other participants', async ({ browser }) => {
        // Generate a unique session ID for this test
        const sessionId = `test-sel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
        const sessionUrl = `${baseUrl}/?session=${sessionId}`;

        // Create 2 separate browser contexts (simulates 2 different users)
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        try {
            // === STEP 1: User1 creates the session ===
            console.log('Step 1: User1 joining session...');
            await page1.goto(sessionUrl);
            await page1.waitForSelector('#participantNameInput', { timeout: 10000 });
            await page1.fill('#participantNameInput', 'User1');
            await page1.click('#joinSessionBtn');
            await page1.waitForSelector('#codeInput', { timeout: 15000 });
            console.log('User1 joined successfully');

            // === STEP 2: User2 joins the session ===
            console.log('Step 2: User2 joining session...');
            await page2.goto(sessionUrl);
            await page2.waitForSelector('#participantNameInput', { timeout: 10000 });
            await page2.fill('#participantNameInput', 'User2');
            await page2.click('#joinSessionBtn');
            await page2.waitForSelector('#codeInput', { timeout: 15000 });
            console.log('User2 joined successfully');

            // Wait for WebRTC DataChannel to open (sync indicator turns green)
            console.log('Waiting for WebRTC DataChannel to open...');
            await page1.waitForSelector('.sync-indicator.synced', { timeout: 30000 });
            await page2.waitForSelector('.sync-indicator.synced', { timeout: 30000 });

            // Extra stabilization time for DataChannel to be fully ready
            await page1.waitForTimeout(2000);

            // Verify both participants are connected
            console.log('Verifying both participants are connected...');
            await expect(page1.locator('#participantCount')).toHaveText('2', { timeout: 10000 });
            await expect(page2.locator('#participantCount')).toHaveText('2', { timeout: 10000 });
            console.log('Both participants connected with open DataChannel');

            // === STEP 3: User1 types some code ===
            console.log('Step 3: User1 typing code...');
            await page1.click('#codeInput');
            // Clear default content and type new text
            await page1.keyboard.press('Meta+a'); // Select all
            await page1.keyboard.type('Hello World\nThis is a test');
            await page1.waitForTimeout(1000);

            // Poll for code sync to User2
            await expect(async () => {
                const user2Code = await page2.locator('#codeInput').inputValue();
                expect(user2Code).toContain('Hello World');
            }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] });
            console.log('Code synced to User2');

            // === STEP 4: User1 selects text ===
            console.log('Step 4: User1 selecting text...');
            await page1.click('#codeInput');
            // Move to start and select "Hello World"
            await page1.keyboard.press('Meta+Home'); // Go to start
            await page1.keyboard.press('Shift+End'); // Select first line
            await page1.waitForTimeout(500);

            // === STEP 5: Verify User2 sees the selection ===
            console.log('Step 5: Verifying User2 sees remote selection...');

            // Check for remote cursor or selection indicator
            // The remote cursor should have a label with "User1"
            const remoteCursor = page2.locator('.remote-cursor:visible');
            const remoteSelection = page2.locator('.remote-selection div');

            // Wait for either remote cursor or selection to appear (with generous timeout for production)
            try {
                await expect(remoteCursor.or(remoteSelection.first())).toBeVisible({ timeout: 15000 });
                console.log('SUCCESS: User2 sees remote cursor/selection from User1');
            } catch {
                // Take screenshot on failure
                await page2.screenshot({ path: 'selection-sync-failure.png' });
                throw new Error('Remote selection not visible on User2 screen');
            }

            // Additional check: verify the cursor label shows "User1"
            const cursorLabel = page2.locator('.remote-cursor span');
            if (await cursorLabel.isVisible()) {
                const labelText = await cursorLabel.textContent();
                expect(labelText).toBe('User1');
                console.log('Remote cursor label shows correct user name');
            }

            console.log('SUCCESS: Selection sync test passed!');

        } finally {
            // Cleanup
            await context1.close();
            await context2.close();
        }
    });
});
