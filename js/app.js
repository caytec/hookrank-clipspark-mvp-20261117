const DEMO_MODE = true;
const MAX_BYTES = 500 * 1024 * 1024;
const MAX_DURATION_SECONDS = 20 * 60;
const ACCEPTED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const ACCEPTED_EXTENSIONS = new Set(["mp4", "mov", "webm"]);

const input = document.querySelector("#video");
const run = document.querySelector("#run");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const errorBox = document.querySelector("#error");
const results = document.querySelector("#results");

let selectedFile = null;
let busy = false;
let cancelled = false;
let metadataUrl = null;

input.addEventListener("change", async () => {
  clearError();
  results.hidden = true;
  selectedFile = null;
  run.disabled = true;

  const file = input.files && input.files[0];
  if (!file) {
    setStatus("Select a video to begin.");
    return;
  }

  const extension = getExtension(file.name);
  const typeIsKnown = ACCEPTED_TYPES.has(file.type);
  const extensionIsKnown = ACCEPTED_EXTENSIONS.has(extension);

  if (!typeIsKnown && !extensionIsKnown) {
    input.value = "";
    showError("Unsupported format. Choose an MP4, MOV, or WebM file.");
    return;
  }

  if (file.size > MAX_BYTES) {
    input.value = "";
    showError("This file is larger than the 500 MB demo limit.");
    return;
  }

  selectedFile = file;
  setStatus(`${file.name} selected. Checking local video metadata…`);

  const duration = await readDuration(file);
  if (!selectedFile || selectedFile !== file) {
    return;
  }

  if (Number.isFinite(duration) && duration > MAX_DURATION_SECONDS) {
    input.value = "";
    selectedFile = null;
    showError("Video duration must be 20 minutes or less.");
    return;
  }

  run.disabled = false;
  if (Number.isFinite(duration)) {
    setStatus(`${file.name} selected. Duration: ${formatDuration(duration)}. Ready for a demo preview.`);
  } else {
    setStatus(`${file.name} selected. Ready for a demo preview.`);
  }
});

cancel.addEventListener("click", () => {
  cancelled = true;
  busy = false;
  cancel.hidden = true;
  run.disabled = !selectedFile;
  setStatus("Demo preview cancelled.");
});

run.addEventListener("click", async () => {
  if (!selectedFile || busy || !DEMO_MODE) {
    return;
  }

  busy = true;
  cancelled = false;
  clearError();
  run.disabled = true;
  cancel.hidden = false;
  results.hidden = true;
  setStatus("Creating a demo preview…");

  try {
    await wait(350);

    if (cancelled) {
      return;
    }

    render(createDemoResult(selectedFile.name));
    setStatus("Demo preview complete. It is synthetic and is not based on your video.");
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("Demo preview cancelled.");
      return;
    }

    showError("The demo preview could not be created. Please try again.");
  } finally {
    busy = false;
    run.disabled = !selectedFile;
    cancel.hidden = true;
  }
});

function createDemoResult(filename) {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "your video";

  return {
    clips: [
      {
        title: `A strong moment from ${base}`,
        hook: "A clear idea worth sharing",
        description: "This synthetic card demonstrates the intended HookRank result format.",
        hashtags: "#podcast #shorts #creator",
        post: "A useful moment from today’s conversation.",
        score: 72,
        why: "The demo uses a fixed illustrative score. Production scoring is not enabled.",
        start: 0,
        end: 30
      }
    ]
  };
}

function validateResult(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.clips) || data.clips.length > 3) {
    return { valid: false };
  }

  for (const clip of data.clips) {
    if (!clip || typeof clip !== "object") {
      return { valid: false };
    }

    const score = Number(clip.score);
    const start = Number(clip.start);
    const end = Number(clip.end);

    if (
      typeof clip.title !== "string" ||
      clip.title.length > 200 ||
      typeof clip.hook !== "string" ||
      clip.hook.length > 300 ||
      typeof clip.description !== "string" ||
      clip.description.length > 1000 ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start
    ) {
      return { valid: false };
    }
  }

  return { valid: true };
}

function readDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      if (metadataUrl) {
        URL.revokeObjectURL(metadataUrl);
        metadataUrl = null;
      }
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(Number.NaN);
    metadataUrl = URL.createObjectURL(file);
    video.src = metadataUrl;
  });
}

function getExtension(filename) {
  const match = String(filename).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function formatDuration(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function safe(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function setStatus(message) {
  status.textContent = message;
  status.setAttribute("aria-live", "polite");
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  status.textContent = "Action needed.";
  status.setAttribute("aria-live", "assertive");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
  status.setAttribute("aria-live", "polite");
}

function wait(milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);

    if (cancelled) {
      window.clearTimeout(timer);
      const error = new Error("Cancelled");
      error.name = "AbortError";
      reject(error);
    }
  });
}
