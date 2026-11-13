/**
 * Prepare an image-to-video request with the exact final frame of the preceding
 * scene when the selected provider supports Wan 2.2 continuity handoff.
 */
export async function prepareSceneContinuityInput({
  mode,
  taskType,
  index,
  scenes,
  previousScene,
  previousResult,
  imageInput,
  prompt = "",
  signal,
  extractLastFrame
} = {}) {
  const unchanged = {
    imageInput,
    prompt: String(prompt || ""),
    continuityFrameUsed: false,
    continuitySourceSceneId: null
  };
  if (mode !== "huggingface" || taskType !== "image-to-video"
    || !Number.isInteger(index) || index <= 0 || !Array.isArray(scenes)
    || typeof extractLastFrame !== "function") return unchanged;

  const expectedPreviousScene = scenes[index - 1];
  const adjacent = Boolean(previousScene && expectedPreviousScene && (
    previousScene === expectedPreviousScene
    || (previousScene.id != null && expectedPreviousScene.id != null
      && String(previousScene.id) === String(expectedPreviousScene.id))
  ));
  const previousVideo = previousResult?.video;
  if (!adjacent || !(previousVideo instanceof Blob) || previousVideo.size <= 0) return unchanged;
  if (signal?.aborted) {
    const error = new Error("Scene continuity preparation was cancelled.");
    error.name = "AbortError";
    throw error;
  }

  const frame = await extractLastFrame(previousVideo, { signal });
  if (!(frame instanceof Blob) || frame.size <= 0
    || !String(frame.type || "").toLowerCase().startsWith("image/")) {
    throw new Error("The previous scene did not produce a valid continuity frame.");
  }
  if (signal?.aborted) {
    const error = new Error("Scene continuity preparation was cancelled.");
    error.name = "AbortError";
    throw error;
  }

  const previousEndState = String(
    previousScene.endState || previousScene.visibleAction || previousScene.description || ""
  ).trim();
  const currentStartState = String(
    scenes[index]?.startState || scenes[index]?.description || ""
  ).trim();
  const continuityPrompt = [
    String(prompt || ""),
    "SCENE CONTINUITY: The supplied source image is the exact final decoded frame of the immediately preceding scene. Continue forward from this moment. Preserve the same character identity, face, body proportions, clothing, colors, carried objects, and environment layout. Do not restart, redesign, or replace the character.",
    "Previous scene ending: " + previousEndState + ". Current scene beginning: " + currentStartState + "."
  ].filter(Boolean).join("\n\n");

  return {
    imageInput: frame,
    prompt: continuityPrompt,
    continuityFrameUsed: true,
    continuitySourceSceneId: previousScene.id == null ? null : String(previousScene.id)
  };
}
