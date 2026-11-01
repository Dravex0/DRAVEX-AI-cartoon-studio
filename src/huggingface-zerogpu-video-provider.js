const SPACE_ID = "zerogpu-aoti/wan2-2-fp8da-aoti-faster";
const API_NAME = "/generate_video";

function abortError() {
  const error = new Error("Hugging Face video generation was cancelled.");
  error.name = "AbortError";
  return error;
}

function videoFileFrom(data) {
  const candidate = Array.isArray(data) ? data[0] : data?.video ?? data?.output ?? data;
  if (typeof candidate === "string") return candidate;
  if (candidate && typeof candidate === "object") {
    return String(candidate.url || candidate.path || "").trim();
  }
  return "";
}

/**
 * Browser-side adapter for the public Hugging Face ZeroGPU Wan 2.2 I2V Space.
 * The caller must obtain explicit consent before uploading scene images/prompts.
 */
export function createHuggingFaceZeroGPUVideoProvider({
  client,
  handleFile,
  fetchImpl = fetch
} = {}) {
  if (!client || typeof client.submit !== "function") {
    throw new TypeError("A connected Gradio client is required.");
  }
  if (typeof handleFile !== "function") {
    throw new TypeError("The Gradio handle_file function is required.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function.");
  }

  return Object.freeze({
    id: "huggingface-zerogpu-wan22",
    name: "Hugging Face ZeroGPU · Wan 2.2 14B Fast",
    taskTypes: Object.freeze(["image-to-video"]),
    local: false,
    requiresUserKey: true,

    async generate(request, context = {}) {
      if (request?.taskType !== "image-to-video") {
        throw new TypeError("Wan 2.2 ZeroGPU supports image-to-video requests only.");
      }
      if (!request.image) throw new TypeError("A source image is required.");
      if (context.signal?.aborted) throw abortError();

      const duration = Number(request.durationSeconds ?? 3);
      if (!Number.isFinite(duration) || duration < 0.5 || duration > 5) {
        throw new RangeError("Wan 2.2 ZeroGPU supports scene durations from 0.5 to 5 seconds. Choose 3 or 5 seconds, or use ComfyUI for longer clips.");
      }
      const imageInput = handleFile(request.image);
      const submission = client.submit(API_NAME, [
        imageInput,
        String(request.prompt || ""),
        4,
        String(request.negativePrompt || ""),
        duration,
        1,
        1,
        Number.isInteger(request.seed) && request.seed >= 0 ? request.seed : 42,
        true
      ]);

      if (!submission || typeof submission[Symbol.asyncIterator] !== "function") {
        throw new Error("Hugging Face returned an invalid generation job.");
      }

      const cancel = () => submission.cancel?.();
      context.signal?.addEventListener("abort", cancel, { once: true });
      let outputData = null;
      try {
        for await (const message of submission) {
          if (context.signal?.aborted) throw abortError();
          if (message?.type === "status") {
            if (message.stage === "error" || message.success === false) {
              throw new Error(message.message || "The Hugging Face video queue reported an error.");
            }
            context.onProgress?.({
              stage: message.stage || "processing",
              queuePosition: Number.isFinite(message.position) ? message.position : null,
              etaSeconds: Number.isFinite(message.eta) ? message.eta : null,
              progress: Array.isArray(message.progress_data) ? message.progress_data : []
            });
          } else if (message?.type === "data") {
            outputData = message.data;
          }
        }
      } finally {
        context.signal?.removeEventListener("abort", cancel);
      }

      if (context.signal?.aborted) throw abortError();
      const fileUrl = videoFileFrom(outputData);
      if (!/^https:\/\//i.test(fileUrl)) {
        throw new Error("Wan 2.2 finished without returning a downloadable HTTPS video URL.");
      }

      const response = await fetchImpl(fileUrl, { signal: context.signal });
      if (!response.ok) {
        throw new Error("Hugging Face video download failed (HTTP " + response.status + ").");
      }
      const video = await response.blob();
      if (!video.size) throw new Error("Hugging Face returned an empty video file.");
      const mimeType = String(video.type || "").toLowerCase();
      if (mimeType && !mimeType.startsWith("video/") && mimeType !== "application/octet-stream") {
        throw new Error("Hugging Face returned a non-video file.");
      }

      context.onProgress?.({ stage: "completed", queuePosition: null, etaSeconds: 0, progress: [] });
      return {
        status: "completed",
        taskId: String(submission.event_id || ""),
        video: mimeType === "video/mp4" ? video : new Blob([video], { type: "video/mp4" })
      };
    }
  });
}

export const HUGGING_FACE_ZERO_GPU_SPACE_ID = SPACE_ID;
