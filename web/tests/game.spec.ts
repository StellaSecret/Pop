import { expect, test } from "@playwright/test";

async function boot(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#engine-status")).toContainText("WASM prêt");
  await expect
    .poll(async () => page.evaluate(() => window.__POP__?.getStats().active ?? 0))
    .toBeGreaterThan(0);
}

test("le moteur WASM démarre et affiche les paramètres", async ({ page }) => {
  await boot(page);
  await expect(page.locator("#difficulty option")).toHaveCount(4);
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#level")).toHaveText("1");
  await expect(page.locator("#game")).toBeVisible();
});

test("un clic éclate un ballon et met à jour score et combo", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator("#pause-overlay")).toBeVisible();

  const balloon = await page.evaluate(() => window.__POP__?.firstActiveBalloon());
  expect(balloon).not.toBeNull();
  const box = (await page.locator("#game").boundingBox())!;

  await page.mouse.click(box.x + balloon!.x, box.y + balloon!.y);

  await expect.poll(async () => page.evaluate(() => window.__POP__?.getStats().score ?? 0)).toBeGreaterThanOrEqual(10);
  await expect(page.locator("#combo")).toHaveText(/^x[1-9]/);
});

test("la difficulté et le nombre de ballons sont pilotables", async ({ page }) => {
  await boot(page);
  await page.locator("#difficulty").selectOption("3");
  await expect.poll(async () => page.evaluate(() => window.__POP__?.getStats().active ?? 0)).toBe(200);

  await page.locator("#balloons").fill("60");
  await expect(page.locator("#balloons-value")).toHaveText("60");
  await expect.poll(async () => page.evaluate(() => window.__POP__?.getStats().active ?? 0)).toBe(60);
});

test("les enregistrements audio réels sont chargés", async ({ page }) => {
  const audioResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/sounds/")) {
      audioResponses.push(`${response.url()} ${response.status()}`);
    }
  });

  await boot(page);
  await expect
    .poll(async () => page.evaluate(() => window.__POP__?.getLoadedSounds() ?? 0))
    .toBeGreaterThanOrEqual(1);

  expect(audioResponses.length).toBeGreaterThanOrEqual(1);
  expect(audioResponses.every((entry) => entry.endsWith("200"))).toBe(true);
  await expect(page.locator("#audio-status")).not.toContainText("Échec");
});

test("le redimensionnement conserve la zone de jeu", async ({ page }) => {
  await boot(page);
  const before = await page.locator("#game").evaluate((canvas: HTMLCanvasElement) => canvas.width);
  await page.setViewportSize({ width: 900, height: 700 });
  await expect
    .poll(async () => page.locator("#game").evaluate((canvas: HTMLCanvasElement) => canvas.width))
    .not.toBe(before);

  const balloon = await page.evaluate(() => window.__POP__?.firstActiveBalloon());
  const box = (await page.locator("#game").boundingBox())!;
  expect(balloon!.x).toBeGreaterThanOrEqual(0);
  expect(balloon!.x).toBeLessThanOrEqual(box.width);
  expect(balloon!.y).toBeGreaterThanOrEqual(0);
  expect(balloon!.y).toBeLessThanOrEqual(box.height);
});

test("le défi se termine avec un message personnalisé", async ({ page }) => {
  await boot(page);
  await page.locator("#mode").selectOption("challenge");
  await expect(page.locator("#challenge-setup")).toBeVisible();
  await page.locator("#balloons").fill("10");
  await page.locator("#player-name").fill("Alice");
  await page.locator("#challenge-start").click();
  await expect(page.locator("#challenge-setup")).toBeHidden();
  await expect.poll(async () => page.evaluate(() => window.__POP__?.getStats().active ?? 0)).toBe(10);

  await page.evaluate(() => {
    for (let i = 0; i < 50; i += 1) {
      const balloon = window.__POP__?.firstActiveBalloon();
      if (!balloon) {
        break;
      }
      window.__POP__?.popAt(balloon.x, balloon.y);
    }
  });

  await expect(page.locator("#challenge-complete")).toBeVisible();
  await expect(page.locator("#challenge-message")).toContainText("Alice");
  await expect.poll(async () => page.evaluate(() => window.__POP__?.getStats().completed ?? false)).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.__POP__?.getStats().finishTime ?? 0)).toBeGreaterThan(0);
});

test("les armes ont des cadences distinctes", async ({ page }) => {
  await boot(page);
  await expect(page.locator("#weapon option")).toHaveCount(4);
  await expect(page.locator("#weapon")).toHaveValue("click");

  const box = (await page.locator("#game").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  await expect.poll(async () => page.evaluate(() => window.__POP__?.getShotCount() ?? 0)).toBe(2);

  await page.locator("#weapon").selectOption("auto");
  const beforeAuto = await page.evaluate(() => window.__POP__?.getShotCount() ?? 0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  await expect.poll(async () => page.evaluate(() => window.__POP__?.getShotCount() ?? 0)).toBeGreaterThanOrEqual(beforeAuto + 2);
});

test("les projectiles et effets spéciaux sont visibles", async ({ page }) => {
  await boot(page);
  const box = (await page.locator("#game").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const counts = async () =>
    page.evaluate(() => window.__POP__?.getEffectCounts() ?? { bullets: 0, flames: 0, grenades: 0, blasts: 0 });

  await page.locator("#weapon").selectOption("auto");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect.poll(async () => (await counts()).bullets).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(async () => (await counts()).bullets).toBe(0);

  await page.locator("#weapon").selectOption("flame");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect.poll(async () => (await counts()).flames).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(async () => (await counts()).flames).toBe(0);

  await page.locator("#weapon").selectOption("grenade");
  await page.mouse.click(x, y);
  await expect.poll(async () => (await counts()).grenades).toBeGreaterThan(0);
  await expect.poll(async () => (await counts()).blasts).toBeGreaterThan(0);
});
