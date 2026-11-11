import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("keeps one primary create action and hides duplicate utility buttons", () => {
  assert.match(html, /id="makeFilm" class="primary-action">Создать мультфильм/);
  assert.doesNotMatch(html, /\.layout>\.panel:first-child \.actions:has\(#make\)\{display:none!important\}/);
  assert.doesNotMatch(html, /\.layout>\.panel:nth-child\(2\)>\.actions:has\(#play\)/);
  assert.match(html, /id=\"makeFilm\" class=\"primary-action\">Создать мультфильм/);
});

test("keeps video provider setup available inside a collapsed advanced section", () => {
  assert.match(html, /<details class="advanced-video-settings">/);
  assert.match(html, /id="hfVideoPanel"/);
  assert.match(html, /id="comfyPanel"/);
  assert.match(html, /id="videoGenerationMode"/);
  assert.match(html, /id="generateFullFilmComfy"/);
});

test("moves optional music into a collapsed section and keeps final WebM output", () => {
  assert.match(html, /<details class="advanced-audio-settings">/);
  assert.match(html, /id="audioFile"/);
  assert.match(html, /id="finalFilmPlayer"/);
  assert.match(html, /id="finalFilmDownload"/);
});

test("starts with a Russian interface and Russian story language", () => {
  assert.match(app, /let uiLang=readLocalStorage\('dravex-ui-language'\)\|\|'ru'/);
  assert.match(html, /<option value="ru" selected>Русский<\/option>/);
});

test("keeps basic video settings collapsed and removes diagnostic controls from the main screen", () => {
  assert.match(html, /<details class="simple-options quick-settings" open>/);
  assert.match(html, /#faceAnalysisPanel,#auditAllAnimations,#animationCompatibilityStatus/);
});
