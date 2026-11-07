# DRAVEX Browser QA Agent

The Browser QA Agent is a deterministic Playwright runner. It uses a real Chromium browser to open the app, enter a fixed synthetic prompt, press the create button, wait for the film preview, receive the browser download, validate the downloaded WebM container, and verify that the preview decodes at least one video frame.

## Evidence collected per desktop and Pixel 7 run

- Playwright browser recording of the test interaction.
- Screenshot before generation and screenshot after the film preview appears.
- JSON report with the prompt, browser project, selected video mode, step outcomes, browser errors, downloaded filename/size, and decoded video dimensions.
- The downloaded WebM file itself.
- Playwright trace, screenshot and video on failures.

The existing Playwright workflow uploads `playwright-report/` and `test-results/` as the `dravex-playwright-report` artifact, including successful-run attachments, for 14 days. The GitHub Actions run and artifact metadata are the entry points for reviewing each run.

## Important classification boundary

The current default workflow is `local-canvas`. A passing run proves only that the local storyboard/canvas path produced a downloadable and decodable WebM. It is explicitly reported as **local canvas animation**, not AI text-to-video.

Wan 2.2 through Hugging Face and local ComfyUI are separate opt-in provider paths. They require provider configuration and consent; this QA test does not submit prompts or images to remote services and does not claim that AI video clips were generated. A separate provider-enabled test must be designed only when a safe, configured test provider is available.

## How ChatGPT can review a run

Use the GitHub connector to inspect the exact commit's check runs, fetch the Playwright job logs, list the run artifacts, and download the `dravex-playwright-report` ZIP. Review the JSON report and attached screenshots/video/WebM rather than inferring success from a green workflow name. Binary artifacts are evidence; their existence alone is not proof that every scene is AI-generated or that production speech/lip-sync works.

## Safety

The test prompt is synthetic. It uses the local-canvas mode, does not enter tokens, does not sign in, and does not enable remote provider consent. No user media is uploaded.
