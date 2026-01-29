pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");
const textLayerDiv = document.getElementById("textLayer");
const voiceSelect = document.getElementById("voiceSelect");
const rateInput = document.getElementById("rate");
const rateValue = document.getElementById("rateValue");
const playPauseBtn = document.getElementById("playPauseBtn");
const status = document.getElementById("status");

let pdfDoc = null;
let pageNum = 1;
let scale = 1.3;
let fontScale = 1;
let utterance = null;
let spans = [];
let viVoices = [];
let isPaused = false;

/* ====== NHẬN DIỆN GIỌNG NAM / NỮ ====== */
function detectGender(name) {
  const n = name.toLowerCase();
  if (n.includes("an") || n.includes("my") || n.includes("female")) return "♀ Nữ";
  if (n.includes("nam") || n.includes("male")) return "♂ Nam";
  return "";
}

/* ====== LOAD GIỌNG VIỆT THẬT ====== */
function loadVoices() {
  const voices = speechSynthesis.getVoices();

  viVoices = voices.filter(v => v.lang === "vi-VN");

  voiceSelect.innerHTML = "";

  if (viVoices.length === 0) {
    status.textContent =
      "❌ Không có giọng vi-VN → hãy cài Vietnamese Speech trong Windows";
    voiceSelect.innerHTML =
      `<option value="">❌ Không có giọng tiếng Việt</option>`;
    return;
  }

  viVoices.forEach((voice, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${detectGender(voice.name)} - ${voice.name}`;
    voiceSelect.appendChild(opt);
  });

  status.textContent = `✅ Đã phát hiện ${viVoices.length} giọng tiếng Việt`;
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

/* ====== RATE ====== */
rateInput.oninput = () => {
  rateValue.textContent = rateInput.value + "x";
};

/* ====== LOAD PDF ====== */
document.getElementById("pdfInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  status.textContent = "Đang tải PDF...";
  const url = URL.createObjectURL(file);
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  pageNum = 1;
  renderPage();
});

/* ====== RENDER PAGE ====== */
async function renderPage() {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  textLayerDiv.innerHTML = "";
  spans = [];

  const textContent = await page.getTextContent();

  await pdfjsLib.renderTextLayer({
    textContent,
    container: textLayerDiv,
    viewport,
    textDivs: []
  }).promise;

  spans = [...textLayerDiv.querySelectorAll("span")];
  applyFontScale();
}

/* ====== CONTROLS ====== */
function prevPage() { if (pageNum > 1) { pageNum--; renderPage(); } }
function nextPage() { if (pageNum < pdfDoc.numPages) { pageNum++; renderPage(); } }
function zoomIn() { scale += 0.1; renderPage(); }
function zoomOut() { scale = Math.max(0.6, scale - 0.1); renderPage(); }

function fontUp() { fontScale += 0.1; applyFontScale(); }
function fontDown() { fontScale = Math.max(0.7, fontScale - 0.1); applyFontScale(); }

function applyFontScale() {
  spans.forEach(s => {
    s.style.transform = `scale(${fontScale})`;
    s.style.transformOrigin = "left top";
  });
}

/* ====== ĐỌC TIẾNG VIỆT ====== */
function toggleSpeak() {
  if (speechSynthesis.speaking) {
    if (isPaused) {
      speechSynthesis.resume();
      isPaused = false;
      playPauseBtn.textContent = "⏸️ Tạm dừng";
    } else {
      speechSynthesis.pause();
      isPaused = true;
      playPauseBtn.textContent = "▶️ Tiếp tục";
    }
    return;
  }

  if (viVoices.length === 0) {
    alert("❌ Không có giọng tiếng Việt để đọc");
    return;
  }

  const text = spans.map(s => s.textContent).join(" ").trim();
  if (!text) return;

  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  utterance.voice = viVoices[voiceSelect.value || 0];
  utterance.rate = parseFloat(rateInput.value);

  utterance.onboundary = e => {
    if (e.name === "word") highlightByCharIndex(e.charIndex);
  };

  utterance.onend = () => {
    clearHighlight();
    playPauseBtn.textContent = "▶️ Phát";
    status.textContent = "Đã đọc xong";
  };

  speechSynthesis.speak(utterance);
  playPauseBtn.textContent = "⏸️ Tạm dừng";
  status.textContent = `🔊 Đang đọc bằng ${utterance.voice.name}`;
}

/* ====== HIGHLIGHT ====== */
function highlightByCharIndex(index) {
  let count = 0;
  clearHighlight();
  for (const span of spans) {
    const len = span.textContent.length;
    if (count + len >= index) {
      span.classList.add("highlight");
      span.scrollIntoView({ behavior: "smooth", block: "center" });
      break;
    }
    count += len;
  }
}

function clearHighlight() {
  spans.forEach(s => s.classList.remove("highlight"));
}
