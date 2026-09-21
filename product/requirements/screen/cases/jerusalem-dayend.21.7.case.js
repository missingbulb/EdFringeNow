"use strict";
const { jerusalemPrefs, jerusalemReady, settle } = require("../../shared/case-helpers");

/* The day's end dragged from midnight back to 21:30, a quarter of an hour at a
 * time: the late shows leave the calendar as the line passes them. */
module.exports = {
  description: "dragging the day's end earlier drops what no longer fits",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemPrefs({ dayStartMin: 17 * 60, dayEndMin: 24 * 60 }),
  ready: jerusalemReady,
  async capture(page, t) {
    const frame = async () => t.element("#scheduleWrap");
    const frames = [await frame()];
    const line = page.locator(".sch-dayline--end");
    await line.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
    await jerusalemReady(page);
    await settle(page);
    frames.push(await frame());
    return t.animate(frames);
  },
};
