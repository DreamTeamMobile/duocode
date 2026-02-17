import { test, expect } from '@playwright/test';

/**
 * Test canvas pan tool and multi-participant sync
 * Validates:
 * 1. Pan tool works without coordinate drift
 * 2. Drawing content syncs between participants
 * 3. Viewport (pan/zoom) does NOT sync between participants
 */

test.describe('Canvas Pan and Sync', () => {
    // WebRTC sync tests can be flaky over the internet due to P2P latency
    test.describe.configure({ retries: 2 });

    test('pan tool should not cause coordinate drift and drawings should sync', async ({ browser }) => {
        // Create two browser contexts for two users
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Generate unique session ID
        const sessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseURL = process.env.TEST_URL || 'http://localhost:3000';
        const sessionURL = `${baseURL}/?session=${sessionId}`;

        console.log('Step 1: User1 joining session...');
        await page1.goto(sessionURL);
        await page1.fill('#participantNameInput', 'PanTestUser1');
        await page1.click('#joinSessionBtn');
        await page1.waitForSelector('#tabBar', { timeout: 10000 });
        console.log('User1 joined successfully');

        console.log('Step 2: User2 joining session...');
        await page2.goto(sessionURL);
        await page2.fill('#participantNameInput', 'PanTestUser2');
        await page2.click('#joinSessionBtn');
        await page2.waitForSelector('#tabBar', { timeout: 10000 });
        console.log('User2 joined successfully');

        // Wait for WebRTC DataChannel to open
        console.log('Waiting for WebRTC DataChannel to open...');
        await page1.waitForSelector('.sync-indicator.synced', { timeout: 30000 });
        await page2.waitForSelector('.sync-indicator.synced', { timeout: 30000 });
        console.log('DataChannel open on both pages');

        // Extra stabilization time for DataChannel to be fully ready
        await page1.waitForTimeout(2000);

        console.log('Step 3: Both users switch to Diagram tab...');
        await page1.click('button:has-text("Diagram")');
        await page2.click('button:has-text("Diagram")');
        await page1.waitForSelector('#diagramArea', { timeout: 5000 });
        await page2.waitForSelector('#diagramArea', { timeout: 5000 });

        console.log('Step 4: User1 draws a line...');
        // Select line tool
        await page1.click('[data-tool="line"]');

        // Get canvas position
        const canvas1 = await page1.$('#diagramArea');
        const box1 = await canvas1!.boundingBox();

        // Draw first line
        await page1.mouse.move(box1!.x + 100, box1!.y + 100);
        await page1.mouse.down();
        await page1.mouse.move(box1!.x + 200, box1!.y + 200);
        await page1.mouse.up();

        console.log('Step 5: Verify User2 sees the line...');
        // Poll for sync instead of fixed wait
        await expect(async () => {
            const canvas2HasContent = await page2.evaluate(() => {
                const canvas = document.getElementById('diagramArea') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d')!;
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let nonBgPixels = 0;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    if ((r > 200 && g > 200 && b > 200) || (r < 30 && g < 30 && b < 30)) {
                        nonBgPixels++;
                    }
                }
                return nonBgPixels > 100;
            });
            expect(canvas2HasContent).toBe(true);
        }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] });
        console.log('SUCCESS: User2 sees the line');

        console.log('Step 6: User1 pans their canvas...');
        await page1.click('[data-tool="pan"]');
        await page1.mouse.move(box1!.x + 200, box1!.y + 200);
        await page1.mouse.down();
        await page1.mouse.move(box1!.x + 50, box1!.y + 50);
        await page1.mouse.up();

        // Wait to ensure any sync would have happened
        await page1.waitForTimeout(2000);

        console.log('Step 7: Verify User2 viewport was NOT affected...');
        // Check User2's canvas - the line should still be visible at original position
        // If viewport was synced, User2's view would have panned too
        const user2LineStillVisible = await page2.evaluate(() => {
            const canvas = document.getElementById('diagramArea') as HTMLCanvasElement;
            const ctx = canvas.getContext('2d')!;
            // Check a specific region where the original line was drawn
            // If viewport synced, this region would be empty
            const imageData = ctx.getImageData(50, 50, 200, 200);
            let nonBgPixels = 0;
            for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                if ((r > 200 && g > 200 && b > 200) || (r < 30 && g < 30 && b < 30)) {
                    nonBgPixels++;
                }
            }
            return nonBgPixels > 50;
        });

        console.log(`User2 line still in original region: ${user2LineStillVisible}`);

        // Check that User1's view actually panned (line moved)
        const user1LineMoved = await page1.evaluate(() => {
            const canvas = document.getElementById('diagramArea') as HTMLCanvasElement;
            const ctx = canvas.getContext('2d')!;
            // After panning UP and LEFT, the line should be in upper-left corner
            // Original line was at ~100-200, after pan of 150px up-left, should be near edge
            const imageData = ctx.getImageData(0, 0, 100, 100);
            let nonBgPixels = 0;
            for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                if ((r > 200 && g > 200 && b > 200) || (r < 30 && g < 30 && b < 30)) {
                    nonBgPixels++;
                }
            }
            return nonBgPixels > 50;
        });

        console.log(`User1 line moved to upper region: ${user1LineMoved}`);

        // The key test: User1's pan should NOT have affected User2
        // So User2 should still see line in original position, while User1 sees it moved
        expect(user1LineMoved).toBe(true);
        expect(user2LineStillVisible).toBe(true);
        console.log('SUCCESS: Viewports are independent!');

        console.log('Step 8: User1 draws second line after panning...');
        await page1.click('[data-tool="line"]');
        await page1.mouse.move(box1!.x + 300, box1!.y + 150);
        await page1.mouse.down();
        await page1.mouse.move(box1!.x + 400, box1!.y + 250);
        await page1.mouse.up();

        console.log('Step 9: Verify second line synced to User2...');
        // Poll for sync instead of fixed wait
        await expect(async () => {
            const user2SeesSecondLine = await page2.evaluate(() => {
                const canvas = document.getElementById('diagramArea') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d')!;
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let nonBgPixels = 0;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    if ((r > 200 && g > 200 && b > 200) || (r < 30 && g < 30 && b < 30)) {
                        nonBgPixels++;
                    }
                }
                return nonBgPixels;
            });
            console.log(`User2 total drawing pixels: ${user2SeesSecondLine}`);
            expect(user2SeesSecondLine).toBeGreaterThan(200);
        }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] });
        console.log('SUCCESS: Second line synced to User2');

        console.log('SUCCESS: All pan tool and sync tests passed!');

        // Cleanup
        await context1.close();
        await context2.close();
    });

    test('multiple pan operations should not cause cumulative drift', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        const sessionId = `drift-test-${Date.now()}`;
        const baseURL = process.env.TEST_URL || 'http://localhost:3000';

        console.log('Step 1: Joining session...');
        await page.goto(`${baseURL}/?session=${sessionId}`);
        await page.fill('#participantNameInput', 'DriftTestUser');
        await page.click('#joinSessionBtn');
        await page.waitForSelector('#tabBar', { timeout: 10000 });

        console.log('Step 2: Switch to Diagram tab...');
        await page.click('button:has-text("Diagram")');
        await page.waitForSelector('#diagramArea', { timeout: 5000 });

        const canvas = await page.$('#diagramArea');
        const box = await canvas!.boundingBox();

        // Helper to draw a line and check its position
        const drawLineAndCheck = async (startX: number, startY: number, expectedStartX: number, expectedStartY: number, label: string) => {
            await page.click('[data-tool="line"]');
            await page.mouse.move(box!.x + startX, box!.y + startY);
            await page.mouse.down();
            await page.mouse.move(box!.x + startX + 50, box!.y + startY + 50);
            await page.mouse.up();

            // Check if line appeared where expected (within tolerance)
            const linePosition = await page.evaluate(({ expX, expY }: { expX: number; expY: number }) => {
                const canvas = document.getElementById('diagramArea') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d')!;
                // Check small region around expected start position
                const checkRadius = 30;
                const imageData = ctx.getImageData(
                    Math.max(0, expX - checkRadius),
                    Math.max(0, expY - checkRadius),
                    checkRadius * 2,
                    checkRadius * 2
                );
                let pixels = 0;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    if ((r > 200 && g > 200 && b > 200) || (r < 30 && g < 30 && b < 30)) {
                        pixels++;
                    }
                }
                return pixels > 10;
            }, { expX: expectedStartX, expY: expectedStartY });

            console.log(`${label}: Line at expected position: ${linePosition}`);
            return linePosition;
        };

        console.log('Step 3: Draw line 1...');
        const line1Ok = await drawLineAndCheck(200, 200, 200, 200, 'Line 1');
        expect(line1Ok).toBe(true);

        console.log('Step 4: Pan canvas...');
        await page.click('[data-tool="pan"]');
        await page.mouse.move(box!.x + 300, box!.y + 300);
        await page.mouse.down();
        await page.mouse.move(box!.x + 200, box!.y + 200);
        await page.mouse.up();

        console.log('Step 5: Draw line 2 after first pan...');
        // After panning -100,-100, a click at 300,300 should draw at logical ~400,400
        const line2Ok = await drawLineAndCheck(300, 300, 300, 300, 'Line 2');
        expect(line2Ok).toBe(true);

        console.log('Step 6: Pan canvas again...');
        await page.click('[data-tool="pan"]');
        await page.mouse.move(box!.x + 200, box!.y + 200);
        await page.mouse.down();
        await page.mouse.move(box!.x + 300, box!.y + 300);
        await page.mouse.up();

        console.log('Step 7: Draw line 3 after second pan...');
        const line3Ok = await drawLineAndCheck(250, 250, 250, 250, 'Line 3');
        expect(line3Ok).toBe(true);

        console.log('SUCCESS: No cumulative drift detected!');

        await context.close();
    });
});
