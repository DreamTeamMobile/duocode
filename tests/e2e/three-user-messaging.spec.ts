import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * E2E Test: 3-User Message Broadcast
 *
 * This test verifies that when 3 users are in a session and each sends a message,
 * ALL 3 users should see ALL 3 messages in their message logs.
 *
 * Test scenario:
 * 1. User1 creates a session
 * 2. User2 joins the session
 * 3. User3 joins the session
 * 4. User1 sends "Hello from User1"
 * 5. User2 sends "Hello from User2"
 * 6. User3 sends "Hello from User3"
 * 7. Verify ALL users see ALL 3 messages
 */

test.describe('3-User Message Broadcast', () => {
    // WebRTC sync tests can be flaky over the internet due to P2P latency
    test.describe.configure({ retries: 2 });

    test('all 3 users should see all 3 messages', async ({ browser }) => {
        // Generate a unique session ID for this test
        const sessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseUrl = process.env.TEST_URL || 'https://duocode.app';
        const sessionUrl = `${baseUrl}/?session=${sessionId}`;

        // Create 3 separate browser contexts (simulates 3 different users)
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const context3 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();
        const page3 = await context3.newPage();

        // Enable console log collection
        const consoleLogs: { page1: string[]; page2: string[]; page3: string[] } = { page1: [], page2: [], page3: [] };

        page1.on('console', (msg: ConsoleMessage) => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
                consoleLogs.page1.push(`[${msg.type()}] ${msg.text()}`);
            }
        });
        page2.on('console', (msg: ConsoleMessage) => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
                consoleLogs.page2.push(`[${msg.type()}] ${msg.text()}`);
            }
        });
        page3.on('console', (msg: ConsoleMessage) => {
            if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
                consoleLogs.page3.push(`[${msg.type()}] ${msg.text()}`);
            }
        });

        try {
            // === STEP 1: User1 creates the session ===
            console.log('Step 1: User1 joining session...');
            await page1.goto(sessionUrl);
            await page1.waitForSelector('#participantNameInput', { timeout: 10000 });
            await page1.fill('#participantNameInput', 'User1');
            await page1.click('#joinSessionBtn');
            await page1.waitForSelector('#tabBar', { timeout: 15000 });
            // On desktop the messages panel is already open as a sidebar.
            // On mobile, click the FAB to open it.
            const fab1 = page1.locator('.messages-fab');
            if (await fab1.isVisible({ timeout: 1000 }).catch(() => false)) {
                await fab1.click();
            }
            await page1.waitForSelector('#messagesList', { state: 'visible', timeout: 5000 });
            console.log('User1 joined successfully');

            // === STEP 2: User2 joins the session ===
            console.log('Step 2: User2 joining session...');
            await page2.goto(sessionUrl);
            await page2.waitForSelector('#participantNameInput', { timeout: 10000 });
            await page2.fill('#participantNameInput', 'User2');
            await page2.click('#joinSessionBtn');
            await page2.waitForSelector('#tabBar', { timeout: 15000 });
            const fab2 = page2.locator('.messages-fab');
            if (await fab2.isVisible({ timeout: 1000 }).catch(() => false)) {
                await fab2.click();
            }
            await page2.waitForSelector('#messagesList', { state: 'visible', timeout: 5000 });
            console.log('User2 joined successfully');

            // === STEP 3: User3 joins the session ===
            console.log('Step 3: User3 joining session...');
            await page3.goto(sessionUrl);
            await page3.waitForSelector('#participantNameInput', { timeout: 10000 });
            await page3.fill('#participantNameInput', 'User3');
            await page3.click('#joinSessionBtn');
            await page3.waitForSelector('#tabBar', { timeout: 15000 });
            const fab3 = page3.locator('.messages-fab');
            if (await fab3.isVisible({ timeout: 1000 }).catch(() => false)) {
                await fab3.click();
            }
            await page3.waitForSelector('#messagesList', { state: 'visible', timeout: 5000 });
            console.log('User3 joined successfully');

            // Wait for WebRTC DataChannel to open on all pages
            console.log('Waiting for WebRTC DataChannel to open...');
            await page1.waitForSelector('.sync-indicator.synced', { timeout: 30000 });
            await page2.waitForSelector('.sync-indicator.synced', { timeout: 30000 });
            await page3.waitForSelector('.sync-indicator.synced', { timeout: 30000 });

            // Extra stabilization time for all DataChannels to be fully ready
            await page1.waitForTimeout(3000);

            // Verify all 3 participants are connected
            console.log('Verifying all participants are connected...');
            await expect(page1.locator('#participantCount')).toHaveText('3', { timeout: 10000 });
            await expect(page2.locator('#participantCount')).toHaveText('3', { timeout: 10000 });
            await expect(page3.locator('#participantCount')).toHaveText('3', { timeout: 10000 });
            console.log('All 3 participants connected with open DataChannel');

            // === STEP 4: User1 sends a message ===
            console.log('Step 4: User1 sending message...');
            await page1.fill('#messageText', 'Hello from User1');
            await page1.click('#sendMessageBtn');
            await page1.waitForTimeout(2000);

            // === STEP 5: User2 sends a message ===
            console.log('Step 5: User2 sending message...');
            await page2.fill('#messageText', 'Hello from User2');
            await page2.click('#sendMessageBtn');
            await page2.waitForTimeout(2000);

            // === STEP 6: User3 sends a message ===
            console.log('Step 6: User3 sending message...');
            await page3.fill('#messageText', 'Hello from User3');
            await page3.click('#sendMessageBtn');

            // === STEP 7: Verify ALL users see ALL 3 messages ===
            console.log('Step 7: Verifying all users see all messages...');

            // Helper function to check messages on a page
            async function verifyMessages(page: Page, userName: string) {
                const messagesHtml = await page.locator('#messagesList').innerHTML();

                const hasUser1Msg = messagesHtml.includes('Hello from User1');
                const hasUser2Msg = messagesHtml.includes('Hello from User2');
                const hasUser3Msg = messagesHtml.includes('Hello from User3');

                console.log(`${userName} messages: User1=${hasUser1Msg}, User2=${hasUser2Msg}, User3=${hasUser3Msg}`);

                return { hasUser1Msg, hasUser2Msg, hasUser3Msg };
            }

            // Poll for all messages to arrive on all users (instead of fixed waits)
            await expect(async () => {
                const user1Messages = await verifyMessages(page1, 'User1');
                const user2Messages = await verifyMessages(page2, 'User2');
                const user3Messages = await verifyMessages(page3, 'User3');

                // Assert User1 sees all 3 messages
                expect(user1Messages.hasUser1Msg).toBe(true);
                expect(user1Messages.hasUser2Msg).toBe(true);
                expect(user1Messages.hasUser3Msg).toBe(true);

                // Assert User2 sees all 3 messages
                expect(user2Messages.hasUser1Msg).toBe(true);
                expect(user2Messages.hasUser2Msg).toBe(true);
                expect(user2Messages.hasUser3Msg).toBe(true);

                // Assert User3 sees all 3 messages
                expect(user3Messages.hasUser1Msg).toBe(true);
                expect(user3Messages.hasUser2Msg).toBe(true);
                expect(user3Messages.hasUser3Msg).toBe(true);
            }).toPass({ timeout: 15000, intervals: [1000, 2000, 3000] });

            console.log('SUCCESS: All 3 users see all 3 messages!');

        } catch (error) {
            // Print console logs on failure for debugging
            console.log('\n=== User1 Console Logs ===');
            consoleLogs.page1.filter(l => l.includes('channel') || l.includes('Channel') || l.includes('sendMessage') || l.includes('relay') || l.includes('onmessage') || l.includes('Sent')).forEach(l => console.log(l));
            console.log('\n=== User2 Console Logs ===');
            consoleLogs.page2.filter(l => l.includes('channel') || l.includes('Channel') || l.includes('sendMessage') || l.includes('relay') || l.includes('onmessage') || l.includes('Sent')).forEach(l => console.log(l));
            console.log('\n=== User3 Console Logs ===');
            consoleLogs.page3.filter(l => l.includes('channel') || l.includes('Channel') || l.includes('sendMessage') || l.includes('relay') || l.includes('onmessage') || l.includes('Sent')).forEach(l => console.log(l));
            throw error;
        } finally {
            // Cleanup
            await context1.close();
            await context2.close();
            await context3.close();
        }
    });
});
