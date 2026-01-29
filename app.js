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
let voices = [];
let isPaused = false;

// Load voices (async)
function loadVoices() {
  voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '<option value="">Chọn giọng đọc</option>';

  const viVoices = voices.filter(v => v.lang.startsWith('vi'));

  if (viVoices.length === 0) {
    voiceSelect.innerHTML += '<option value="">Không tìm thấy giọng tiếng Việt</option>';
    status.textContent = "Trạng thái: Không có giọng tiếng Việt → có thể dùng giọng mặc định";
  } else {
    viVoices.forEach((voice, i) => {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = voice.name + (voice.default ? " (mặc định)" : "");
      voiceSelect.appendChild(option);
    });
    status.textContent = `Trạng thái: Đã tải ${viVoices.length} giọng tiếng Việt`;
  }
}

// Gọi lần đầu + lắng nghe event (vì voices load async)
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices(); // gọi sớm đề phòng

// Cập nhật tốc độ hiển thị
rateInput.addEventListener("input", () => {
  rateValue.textContent = rateInput.value + "x";
});

// Load PDF
document.getElementById("pdfInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  status.textContent = "Đang tải PDF...";
  const url = URL.createObjectURL(file);
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  pageNum = 1;
  renderPage();
  status.textContent = "PDF đã tải xong";
});

async function renderPage() {
  if (!pdfDoc) return;
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

/* Trang */
function prevPage() { if (pageNum > 1) { pageNum--; renderPage(); } }
function nextPage() { if (pageNum < pdfDoc?.numPages) { pageNum++; renderPage(); } }

/* Zoom & Font */
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

/* Đọc + Karaoke */
function toggleSpeak() {
  if (speechSynthesis.speaking) {
    if (isPaused) {
      speechSynthesis.resume();
      isPaused = false;
      playPauseBtn.textContent = "⏸️ Tạm dừng";
      status.textContent = "Đang đọc...";
    } else {
      speechSynthesis.pause();
      isPaused = true;
      playPauseBtn.textContent = "▶️ Tiếp tục";
      status.textContent = "Đã tạm dừng";
    }
    return;
  }

  // Bắt đầu đọc mới
  const text = spans.map(s => s.textContent).join(" ").trim();
  if (!text) {
    status.textContent = "Không có văn bản để đọc";
    return;
  }

  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";

  // Chọn giọng
  const selectedIndex = voiceSelect.value;
  if (selectedIndex !== "" && voices[selectedIndex]) {
    utterance.voice = voices[selectedIndex];
  }

  // Tốc độ
  utterance.rate = parseFloat(rateInput.value);

  utterance.onboundary = e => {
    if (e.name !== "word") return;
    highlightByCharIndex(e.charIndex);
  };

  utterance.onend = () => {
    clearHighlight();
    isPaused = false;
    playPauseBtn.textContent = "▶️ Phát";
    status.textContent = "Đã đọc xong trang " + pageNum;
  };

  speechSynthesis.speak(utterance);
  isPaused = false;
  playPauseBtn.textContent = "⏸️ Tạm dừng";
  status.textContent = "Đang đọc...";
}

function highlightByCharIndex(index) {
  let count = 0;
  clearHighlight();

  for (const span of spans) {
    const len = span.textContent.length;
    if (count + len >= index) {
      span.classList.add("highlight");
      span.scrollIntoView({ block: "center", behavior: "smooth" });
      break;
    }
    count += len;
  }
}

function clearHighlight() {
  spans.forEach(s => s.classList.remove("highlight"));
}