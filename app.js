// ... (giữ nguyên các biến khác: canvas, pdfDoc, v.v.)

let voices = [];
let selectedVoice = null;

// Hàm ước lượng giới tính dựa trên tên giọng (phổ biến 2025-2026)
function guessGender(voiceName) {
  const lower = voiceName.toLowerCase();
  if (lower.includes('hoaimy') || lower.includes('an') || lower.includes('anna') || 
      lower.includes('carol') || lower.includes('female') || lower.includes('my') || 
      lower.includes('zira') || lower.includes('hazel')) {
    return '♀ Nữ';
  }
  if (lower.includes('namminh') || lower.includes('benjamin') || lower.includes('daniel') || 
      lower.includes('male') || lower.includes('david') || lower.includes('nam')) {
    return '♂ Nam';
  }
  return ''; // không đoán được
}

// Load & filter voices chỉ vi-VN
function loadVoices() {
  voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '<option value="">Chọn giọng tiếng Việt (tự động nếu trống)</option>';

  // Lọc giọng vi-* hoặc lang 'vi-VN'
  const viVoices = voices
    .filter(v => v.lang.startsWith('vi') || v.lang === 'vi-VN')
    .sort((a, b) => {
      // Ưu tiên giọng Natural/Neural/Online lên đầu
      const aScore = a.name.includes('Natural') || a.name.includes('Neural') || a.name.includes('Online') ? -1 : 0;
      const bScore = b.name.includes('Natural') || b.name.includes('Neural') || b.name.includes('Online') ? -1 : 0;
      if (aScore !== bScore) return aScore - bScore;
      return a.name.localeCompare(b.name);
    });

  if (viVoices.length === 0) {
    voiceSelect.innerHTML += '<option value="">Không tìm thấy giọng vi-VN → dùng mặc định (có thể là Anh)</option>';
    status.textContent = "Không có giọng tiếng Việt → kiểm tra cài đặt Windows Speech";
  } else {
    viVoices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = index; // index trong mảng viVoices
      const gender = guessGender(voice.name);
      const isDefault = voice.default ? ' (mặc định)' : '';
      option.textContent = `${gender ? gender + ' - ' : ''}${voice.name}${isDefault}`;
      voiceSelect.appendChild(option);
    });
    status.textContent = `Tìm thấy ${viVoices.length} giọng tiếng Việt (Nam/Nữ)`;
  }

  // Lưu mảng viVoices riêng để dùng sau (vì voices đầy đủ có thể dài)
  window.viVoices = viVoices; // global tạm để dễ dùng
}

// Load voices (gọi nhiều lần vì async)
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices(); // gọi sớm

// Cập nhật rate
rateInput.addEventListener("input", () => {
  rateValue.textContent = rateInput.value + "x";
});

// ... (giữ nguyên phần load PDF, renderPage, zoom, font, prev/next)

// Phần toggleSpeak (chỉnh chọn voice)
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

  const text = spans.map(s => s.textContent).join(" ").trim();
  if (!text) {
    status.textContent = "Không có văn bản để đọc";
    return;
  }

  utterance = new SpeechSynthesisUtterance(text);

  // Chọn giọng từ viVoices
  const selectedIndex = voiceSelect.value;
  if (selectedIndex !== "" && window.viVoices && window.viVoices[selectedIndex]) {
    utterance.voice = window.viVoices[selectedIndex];
    status.textContent = `Đang đọc bằng: ${window.viVoices[selectedIndex].name}`;
  } else {
    utterance.lang = "vi-VN"; // fallback
    status.textContent = "Đang đọc (giọng mặc định vi-VN)";
  }

  utterance.rate = parseFloat(rateInput.value);

  utterance.onboundary = e => {
    if (e.name !== "word") return;
    highlightByCharIndex(e.charIndex);
  };

  utterance.onend = () => {
    clearHighlight();
    isPaused = false;
    playPauseBtn.textContent = "▶️ Phát";
    status.textContent = "Đọc xong trang " + pageNum;
  };

  speechSynthesis.speak(utterance);
  isPaused = false;
  playPauseBtn.textContent = "⏸️ Tạm dừng";
  status.textContent = "Đang đọc...";
}

// ... (giữ nguyên highlightByCharIndex, clearHighlight, các hàm khác)