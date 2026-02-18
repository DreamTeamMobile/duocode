import { test, expect } from '@playwright/test';

/**
 * Test text tool functionality
 * Validates:
 * 1. Text tool click shows text input at correct position
 * 2. Typing and pressing Ctrl+Enter commits text to canvas
 * 3. Double-click on shapes shows text input
 * 4. Text on shapes commits correctly
 * 5. Text syncs between participants
 */

test.describe('Text Tool', () => {
    // WebRTC sync tests can be flaky over the internet due to P2P latency
    test.describe.configure({ retries: 2 });

    test('text tool click should show text input and commit text', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        const sessionId = `text-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseURL = process.env.TEST_URL || 'http://localhost:3000';

        console.log('Step 1: Joining session...');
        await page.goto(`${baseURL}/?session=${sessionId}`);
        await page.fill('#participantNameInput', 'TextToolUser');
        await page.click('#joinSessionBtn');
        await page.waitForSelector('#tabBar', { timeout: 10000 });
        console.log('User joined successfully');

        console.log('Step 2: Switch to Diagram tab...');
        await page.click('button:has-text("Diagram")');
        await page.waitForSelector('#diagramArea', { timeout: 5000 });

        const canvas = await page.$('#diagramArea');
        const box = await canvas!.boundingBox();

        console.log('Step 3: Select text tool...');
        await page.click('[data-tool="text"]');

        console.log('Step 4: Click on canvas to show text input...');
        const clickX = box!.x + 200;
        const clickY = box!.y + 200;
        await page.mouse.click(clickX, clickY);

        // Wait for text input to appear
        await page.waitForTimeout(300);

        console.log('Step 5: Verify text input is visible...');
        const textInputVisible = await page.evaluate(() => {
            const overlay = document.querySelector('.text-input-overlay');
            if (!overlay) return false;
            const style = window.getComputedStyle(overlay);
            return style.display !== 'none';
        });
        expect(textInputVisible).toBe(true);
        console.log('SUCCESS: Text input is visible');

        console.log('Step 6: Type text and press Ctrl+Enter...');
        await page.keyboard.type('Hello Canvas');
        await page.keyboard.press('Control+Enter');

        // Wait for text to be committed
        await page.waitForTimeout(500);

        console.log('Step 7: Verify text input is hidden...');
        const textInputHidden = await page.evaluate(() => {
            const overlay = document.querySelector('.text-input-overlay');
            if (!overlay) return true;
            const style = window.getComputedStyle(overlay);
            return style.display === 'none';
        });
        expect(textInputHidden).toBe(true);
        console.log('SUCCESS: Text input is hidden after commit');

        console.log('Step 8: Verify text appears on canvas...');
        const canvasHasText = await page.evaluate(() => {
            const strokes = (window as any).DuoCodeDebug ? (window as any).DuoCodeDebug.getDrawingStrokes() : [];
            return strokes.some((stroke: any) => stroke.tool === 'text' && stroke.text === 'Hello Canvas');
        });
        expect(canvasHasText).toBe(true);
        console.log('SUCCESS: Text committed to canvas');

        await context.close();
    });

    test('double-click on rectangle should add text to shape', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        const sessionId = `shape-text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseURL = process.env.TEST_URL || 'http://localhost:3000';

        console.log('Step 1: Joining session...');
        await page.goto(`${baseURL}/?session=${sessionId}`);
        await page.fill('#participantNameInput', 'ShapeTextUser');
        await page.click('#joinSessionBtn');
        await page.waitForSelector('#tabBar', { timeout: 10000 });

        console.log('Step 2: Switch to Diagram tab...');
        await page.click('button:has-text("Diagram")');
        await page.waitForSelector('#diagramArea', { timeout: 5000 });

        const canvas = await page.$('#diagramArea');
        const box = await canvas!.boundingBox();

        console.log('Step 3: Draw a rectangle...');
        await page.click('[data-tool="rectangle"]');

        const rectStartX = box!.x + 150;
        const rectStartY = box!.y + 150;
        const rectEndX = box!.x + 350;
        const rectEndY = box!.y + 300;

        await page.mouse.move(rectStartX, rectStartY);
        await page.mouse.down();
        await page.mouse.move(rectEndX, rectEndY);
        await page.mouse.up();

        await page.waitForTimeout(500);

        console.log('Step 4: Verify rectangle was created...');
        const rectCreated = await page.evaluate(() => {
            const strokes = (window as any).DuoCodeDebug ? (window as any).DuoCodeDebug.getDrawingStrokes() : [];
            return strokes.some((stroke: any) => stroke.tool === 'rectangle');
        });
        expect(rectCreated).toBe(true);
        console.log('SUCCESS: Rectangle created');

        console.log('Step 5: Double-click on rectangle to add text...');
        const rectCenterX = (rectStartX + rectEndX) / 2;
        const rectCenterY = (rectStartY + rectEndY) / 2;
        await page.mouse.dblclick(rectCenterX, rectCenterY);

        await page.waitForTimeout(300);

        console.log('Step 6: Verify text input appears...');
        const textInputVisible = await page.evaluate(() => {
            const overlay = document.querySelector('.text-input-overlay');
            if (!overlay) return false;
            const style = window.getComputedStyle(overlay);
            return style.display !== 'none';
        });
        expect(textInputVisible).toBe(true);
        console.log('SUCCESS: Text input appears on double-click');

        console.log('Step 7: Type text and press Ctrl+Enter...');
        await page.keyboard.type('Rectangle Label');
        await page.keyboard.press('Control+Enter');

        await page.waitForTimeout(500);

        console.log('Step 8: Verify text is associated with rectangle...');
        const rectHasText = await page.evaluate(() => {
            const strokes = (window as any).DuoCodeDebug ? (window as any).DuoCodeDebug.getDrawingStrokes() : [];
            // Check if any rectangle has the expected text
            return strokes.some((stroke: any) => stroke.tool === 'rectangle' && stroke.text === 'Rectangle Label');
        });
        expect(rectHasText).toBe(true);
        console.log('SUCCESS: Text added to rectangle');

        await context.close();
    });

    test('text should sync between participants', async ({ browser }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        const sessionId = `text-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseURL = process.env.TEST_URL || 'http://localhost:3000';
        const sessionURL = `${baseURL}/?session=${sessionId}`;

        console.log('Step 1: User1 joining session...');
        await page1.goto(sessionURL);
        await page1.fill('#participantNameInput', 'TextSyncUser1');
        await page1.click('#joinSessionBtn');
        await page1.waitForSelector('#tabBar', { timeout: 10000 });

        console.log('Step 2: User2 joining session...');
        await page2.goto(sessionURL);
        await page2.fill('#participantNameInput', 'TextSyncUser2');
        await page2.click('#joinSessionBtn');
        await page2.waitForSelector('#tabBar', { timeout: 10000 });

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

        const canvas1 = await page1.$('#diagramArea');
        const box1 = await canvas1!.boundingBox();

        console.log('Step 4: User1 adds text using text tool...');
        await page1.click('[data-tool="text"]');
        await page1.mouse.click(box1!.x + 250, box1!.y + 250);
        await page1.waitForTimeout(300);
        await page1.keyboard.type('Synced Text');
        await page1.keyboard.press('Control+Enter');

        console.log('Step 5: Verify User2 received the text...');
        // Poll for sync instead of fixed wait
        await expect(async () => {
            const user2HasText = await page2.evaluate(() => {
                const strokes = (window as any).DuoCodeDebug ? (window as any).DuoCodeDebug.getDrawingStrokes() : [];
                return strokes.some((stroke: any) => stroke.tool === 'text' && stroke.text === 'Synced Text');
            });
            expect(user2HasText).toBe(true);
        }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] });
        console.log('SUCCESS: Text synced to User2');

        console.log('Step 6: User2 adds standalone text...');
        const canvas2 = await page2.$('#diagramArea');
        const box2 = await canvas2!.boundingBox();

        await page2.click('[data-tool="text"]');
        await page2.mouse.click(box2!.x + 400, box2!.y + 200);
        await page2.waitForTimeout(300);
        await page2.keyboard.type('User2 Text');
        await page2.keyboard.press('Control+Enter');

        console.log('Step 7: Verify User1 received text from User2...');
        // Poll for sync instead of fixed wait
        await expect(async () => {
            const user1HasUser2Text = await page1.evaluate(() => {
                const strokes = (window as any).DuoCodeDebug ? (window as any).DuoCodeDebug.getDrawingStrokes() : [];
                return strokes.some((stroke: any) => stroke.tool === 'text' && stroke.text === 'User2 Text');
            });
            expect(user1HasUser2Text).toBe(true);
        }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] });
        console.log('SUCCESS: User2 text synced to User1');

        console.log('SUCCESS: All text sync tests passed!');

        await context1.close();
        await context2.close();
    });

    test('text input should not close immediately on focus', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        const sessionId = `blur-test-${Date.now()}`;
        const baseURL = process.env.TEST_URL || 'http://localhost:3000';

        console.log('Step 1: Joining session...');
        await page.goto(`${baseURL}/?session=${sessionId}`);
        await page.fill('#participantNameInput', 'BlurTestUser');
        await page.click('#joinSessionBtn');
        await page.waitForSelector('#tabBar', { timeout: 10000 });

        console.log('Step 2: Switch to Diagram tab...');
        await page.click('button:has-text("Diagram")');
        await page.waitForSelector('#diagramArea', { timeout: 5000 });

        const canvas = await page.$('#diagramArea');
        const box = await canvas!.boundingBox();

        console.log('Step 3: Select text tool and click canvas...');
        await page.click('[data-tool="text"]');
        await page.mouse.click(box!.x + 300, box!.y + 300);

        // Wait for text input to appear
        await page.waitForTimeout(300);

        console.log('Step 4: Wait and verify text input stays visible...');
        // Wait longer than the blur timeout (100ms + some buffer) to ensure it doesn't close
        await page.waitForTimeout(500);

        const stillVisible = await page.evaluate(() => {
            const overlay = document.querySelector('.text-input-overlay');
            if (!overlay) return false;
            const style = window.getComputedStyle(overlay);
            return style.display !== 'none';
        });
        expect(stillVisible).toBe(true);
        console.log('SUCCESS: Text input stays visible after click');

        console.log('Step 5: Verify input is focused...');
        const inputFocused = await page.evaluate(() => {
            const input = document.getElementById('canvasTextInput');
            return input && document.activeElement === input;
        });
        expect(inputFocused).toBe(true);
        console.log('SUCCESS: Text input is focused');

        await context.close();
    });
});
