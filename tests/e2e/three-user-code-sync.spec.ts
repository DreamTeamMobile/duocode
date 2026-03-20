import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Test: 3-User Code Sync (Relay)
 *
 * Verifies that code typed by the host is synced to both peers
 * via the host's message relay, and that code typed by a peer
 * relays through the host to the other peer.
 */

test.describe('3-User Code Sync via Relay', () => {
    test.describe.configure({ retries: 2 });

    async function joinSession(page: Page, sessionUrl: string, name: string) {
        await page.goto(sessionUrl);
        await page.waitForSelector('#participantNameInput', { timeout: 10000 });
        await page.fill('#participantNameInput', name);
        await page.click('#joinSessionBtn');
        await page.waitForSelector('#tabBar', { timeout: 15000 });
    }

    async function getCode(page: Page): Promise<string> {
        return page.locator('#codeInput').inputValue();
    }

    test('host code syncs to all peers, peer code relays to other peers', async ({ browser }) => {
        const sessionId = `test-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
        const sessionUrl = `${baseUrl}/?session=${sessionId}`;

        const ctx1 = await browser.newContext();
        const ctx2 = await browser.newContext();
        const ctx3 = await browser.newContext();

        const page1 = await ctx1.newPage();
        const page2 = await ctx2.newPage();
        const page3 = await ctx3.newPage();

        try {
            // Join all 3 users
            await joinSession(page1, sessionUrl, 'Host');
            await joinSession(page2, sessionUrl, 'PeerA');
            await joinSession(page3, sessionUrl, 'PeerB');

            // Wait for WebRTC connections
            await page1.waitForSelector('.sync-indicator.synced', { timeout: 30000 });
            await page2.waitForSelector('.sync-indicator.synced', { timeout: 30000 });
            await page3.waitForSelector('.sync-indicator.synced', { timeout: 30000 });

            // Verify all 3 participants connected
            await expect(page1.locator('#participantCount')).toHaveText('3', { timeout: 10000 });

            // Extra stabilization for DataChannels
            await page1.waitForTimeout(2000);

            // === TEST 1: Host types code, both peers should see it ===
            // Use click + type to simulate real user input (not fill which may skip events)
            await page1.locator('#codeInput').click();
            await page1.locator('#codeInput').type('hello world', { delay: 50 });

            // Wait for sync to both peers
            await expect(async () => {
                const peer1Code = await getCode(page2);
                const peer2Code = await getCode(page3);
                expect(peer1Code).toContain('hello world');
                expect(peer2Code).toContain('hello world');
            }).toPass({ timeout: 15000, intervals: [500, 1000, 2000] });

            console.log('TEST 1 PASSED: Host code synced to both peers');

            // === TEST 2: PeerB types code, should relay through host to PeerA ===
            await page3.locator('#codeInput').click();
            // Move to end of text
            await page3.keyboard.press('End');
            await page3.locator('#codeInput').type('\nfrom peer b', { delay: 50 });

            await expect(async () => {
                const hostCode = await getCode(page1);
                const peerACode = await getCode(page2);
                expect(hostCode).toContain('from peer b');
                expect(peerACode).toContain('from peer b');
            }).toPass({ timeout: 15000, intervals: [500, 1000, 2000] });

            console.log('TEST 2 PASSED: PeerB code relayed to Host and PeerA');

        } finally {
            await ctx1.close();
            await ctx2.close();
            await ctx3.close();
        }
    });
});
