const tweets = [
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:42", text: "언젠가 사라질지도 모르는 기록을 위해, 오늘의 이야기를 남겨 둡니다.\n\n이 타래는 BackUp-X의 예시예요.", media: [] },
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:44", text: "본문을 직접 수정한 뒤 티스토리용 서식이나 이미지로 저장할 수 있습니다.", media: [] }
];
const $ = (selector) => document.querySelector(selector);
const view = $("#textView");
const NOTICE_VERSION = "1.6";
let avatarData = "";
let avatarImage = null;
let saveTimer = null;
let archiveTweets = [];
let archiveAccount = null;
let archiveFiles = null;

function openWorkspaceDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("BackUpXDB", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function workspaceState() {
  return {
    tweets, avatarData, url: $("#url").value, mainColor: $("#mainColor").value,
    bg: $("#bg").value, card: $("#card").value, size: $("#size").value,
    imageSize: $("#imageSize").value,
    font: $("#font").value, profile: $("#profile").checked,
    date: $("#date").checked, link: $("#link").checked
  };
}
async function saveWorkspace() {
  const indicator = $("#saveState");
  indicator.className = "saving";
  indicator.lastChild.textContent = " 저장 중…";
  try {
    const db = await openWorkspaceDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction("workspace", "readwrite").objectStore("workspace").put(workspaceState(), "current");
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    indicator.className = "saved";
    indicator.lastChild.textContent = " 자동 저장됨";
  } catch {
    indicator.className = "";
    indicator.lastChild.textContent = " 저장 실패";
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveWorkspace, 450);
}
async function loadWorkspace() {
  try {
    const db = await openWorkspaceDb();
    const saved = await new Promise((resolve, reject) => {
      const request = db.transaction("workspace").objectStore("workspace").get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!saved) { $("#saveState").lastChild.textContent = " 자동 저장 준비"; return; }
    tweets.splice(0, tweets.length, ...(saved.tweets || tweets));
    avatarData = saved.avatarData || "";
    for (const id of ["url", "mainColor", "bg", "card", "size", "imageSize", "font"]) if (saved[id] != null) $("#" + id).value = saved[id];
    for (const id of ["profile", "date", "link"]) if (saved[id] != null) $("#" + id).checked = saved[id];
    applySiteTheme($("#mainColor").value, $("#bg").value, $("#card").value);
    $("#imageSizeValue").textContent = $("#imageSize").value + "px";
    if (avatarData) { avatarImage = new Image(); avatarImage.src = avatarData; }
    render();
    $("#saveState").className = "saved";
    $("#saveState").lastChild.textContent = " 자동 저장 복원됨";
  } catch { $("#saveState").lastChild.textContent = " 자동 저장 준비"; }
}

function render() {
  view.innerHTML = tweets.map((tweet, index) => `
    <article class="tweet">
      <div class="avatar">${avatarData ? `<img src="${avatarData}" alt="프로필 사진">` : "BU"}</div>
      <div>
        <div class="meta"><b>${tweet.name}</b>${tweet.handle} · ${tweet.date}</div>
        <textarea data-i="${index}">${tweet.text}</textarea>
        ${tweet.media?.length ? `<div class="tweet-media">${tweet.media.map((src) => `<img src="${src}" alt="트윗 첨부 이미지" loading="lazy">`).join("")}</div>` : ""}
      </div>
    </article>`).join("");
  view.querySelectorAll("textarea").forEach((area) => {
    area.oninput = (event) => { tweets[Number(event.target.dataset.i)].text = event.target.value; scheduleSave(); };
  });
  view.style.fontFamily = $("#font").value;
}
render();
window.applyImportedThread = (items) => {
  tweets.splice(0, tweets.length, ...items.map((item) => ({
    name: item.name || item.author?.name || "이름 없음",
    handle: item.handle || (item.username ? "@" + item.username : item.author?.username ? "@" + item.author.username : "@unknown"),
    date: item.date || item.created_at || "",
    text: item.text || "",
    media: (item.media || []).map((media) => media.original_url || media.url).filter(Boolean)
  })));
  const author = items[0]?.author || items[0] || {};
  const profileImage = author.profile_image_data || author.profile_image_url;
  if (profileImage) {
    avatarData = profileImage;
    avatarImage = new Image();
    if (!profileImage.startsWith("data:")) avatarImage.crossOrigin = "anonymous";
    avatarImage.src = profileImage;
  }
  render();
  draw();
  setImportStatus("done", "불러오기 완료", 100);
  scheduleSave();
};
if (localStorage.getItem("backupXNoticeVersion") !== NOTICE_VERSION) $("#noticeBackdrop").hidden = false;
$("#noticeClose").onclick = () => {
  if ($("#noticeDismiss").checked) localStorage.setItem("backupXNoticeVersion", NOTICE_VERSION);
  $("#noticeBackdrop").hidden = true;
};

const photoEditor = { image: null, zoom: 1, offsetX: 0, offsetY: 0, dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 };

function editorMetrics() {
  const canvas = $("#photoEditorCanvas");
  const image = photoEditor.image;
  const base = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const scale = base * photoEditor.zoom;
  return { canvas, scale, width: image.naturalWidth * scale, height: image.naturalHeight * scale };
}

function clampPhotoOffset() {
  if (!photoEditor.image) return;
  const { canvas, width, height } = editorMetrics();
  const maxX = Math.max(0, (width - canvas.width) / 2);
  const maxY = Math.max(0, (height - canvas.height) / 2);
  photoEditor.offsetX = Math.max(-maxX, Math.min(maxX, photoEditor.offsetX));
  photoEditor.offsetY = Math.max(-maxY, Math.min(maxY, photoEditor.offsetY));
}

function drawPhotoEditor() {
  if (!photoEditor.image) return;
  clampPhotoOffset();
  const { canvas, width, height } = editorMetrics();
  const ctx = canvas.getContext("2d");
  const x = (canvas.width - width) / 2 + photoEditor.offsetX;
  const y = (canvas.height - height) / 2 + photoEditor.offsetY;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#dedbd4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photoEditor.image, x, y, width, height);
  const preview = $("#photoEditorPreview");
  const pctx = preview.getContext("2d");
  pctx.clearRect(0, 0, preview.width, preview.height);
  pctx.save();
  pctx.beginPath();
  pctx.arc(56, 56, 56, 0, Math.PI * 2);
  pctx.clip();
  pctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 112, 112);
  pctx.restore();
  $("#photoEditorZoomValue").textContent = Math.round(photoEditor.zoom * 100) + "%";
}

function openPhotoEditor(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      photoEditor.image = image;
      photoEditor.zoom = 1;
      photoEditor.offsetX = 0;
      photoEditor.offsetY = 0;
      $("#photoEditorZoom").value = "1";
      $("#photoEditorBackdrop").hidden = false;
      drawPhotoEditor();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function closePhotoEditor() {
  $("#photoEditorBackdrop").hidden = true;
  $("#avatarFile").value = "";
}

$("#avatarFile").onchange = (event) => openPhotoEditor(event.target.files[0]);
$("#photoEditorZoom").oninput = (event) => { photoEditor.zoom = Number(event.target.value); drawPhotoEditor(); };
$("#photoEditorReset").onclick = () => { photoEditor.zoom = 1; photoEditor.offsetX = 0; photoEditor.offsetY = 0; $("#photoEditorZoom").value = "1"; drawPhotoEditor(); };
$("#photoEditorCancel").onclick = closePhotoEditor;
$("#photoEditorClose").onclick = closePhotoEditor;
$("#photoEditorBackdrop").onclick = (event) => { if (event.target === $("#photoEditorBackdrop")) closePhotoEditor(); };
$("#photoEditorApply").onclick = () => {
  const source = $("#photoEditorCanvas");
  const output = document.createElement("canvas");
  output.width = 1024;
  output.height = 1024;
  output.getContext("2d").drawImage(source, 0, 0, 1024, 1024);
  avatarData = output.toDataURL("image/png", 1);
  avatarImage = new Image();
  avatarImage.onload = () => { render(); draw(); };
  avatarImage.src = avatarData;
  closePhotoEditor();
  scheduleSave();
};

const photoCanvasWrap = document.querySelector(".photo-editor-canvas-wrap");
photoCanvasWrap.onpointerdown = (event) => {
  if (!photoEditor.image || event.button !== 0) return;
  photoEditor.dragging = true;
  photoEditor.startX = event.clientX;
  photoEditor.startY = event.clientY;
  photoEditor.baseX = photoEditor.offsetX;
  photoEditor.baseY = photoEditor.offsetY;
  photoCanvasWrap.classList.add("is-dragging");
  photoCanvasWrap.setPointerCapture(event.pointerId);
};
photoCanvasWrap.onpointermove = (event) => {
  if (!photoEditor.dragging) return;
  const rect = photoCanvasWrap.getBoundingClientRect();
  photoEditor.offsetX = photoEditor.baseX + (event.clientX - photoEditor.startX) * 420 / rect.width;
  photoEditor.offsetY = photoEditor.baseY + (event.clientY - photoEditor.startY) * 420 / rect.height;
  drawPhotoEditor();
};
function endPhotoDrag(event) {
  if (!photoEditor.dragging) return;
  photoEditor.dragging = false;
  photoCanvasWrap.classList.remove("is-dragging");
  try { photoCanvasWrap.releasePointerCapture(event.pointerId); } catch {}
}
photoCanvasWrap.onpointerup = endPhotoDrag;
photoCanvasWrap.onpointercancel = endPhotoDrag;

function setImportStatus(type, label, percent = "") {
  const status = $("#status");
  status.hidden = false;
  status.className = "import-status" + (type ? " " + type : "");
  status.querySelector("span").textContent = label;
  status.querySelector("b").textContent = percent === "" ? "" : percent + "%";
}

function archiveStatus(type, label, percent = "") {
  const status = $("#archiveStatus");
  status.hidden = false;
  status.className = "import-status" + (type ? " " + type : "");
  status.querySelector("span").textContent = label;
  status.querySelector("b").textContent = percent === "" ? "" : percent + "%";
}
function decodeArchiveJs(bytes) {
  const source = new TextDecoder("utf-8").decode(bytes);
  const start = source.indexOf("[");
  if (start < 0) throw new Error("archive data not found");
  return JSON.parse(source.slice(start));
}
function findArchiveEntry(pattern) {
  return Object.keys(archiveFiles || {}).find((name) => pattern.test(name));
}
function mimeFor(name) {
  const extension = name.split(".").pop().toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" }[extension] || "application/octet-stream";
}
function bytesToDataUrl(bytes, name) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:${mimeFor(name)};base64,${btoa(binary)}`;
}
function mediaForTweet(tweet) {
  const id = tweet.id_str;
  return Object.keys(archiveFiles || {})
    .filter((name) => /tweets_media\//.test(name) && name.split("/").pop().startsWith(id + "-") && /\.(jpe?g|png|gif|webp)$/i.test(name))
    .sort()
    .map((name) => bytesToDataUrl(archiveFiles[name], name));
}
function archiveDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function buildThread(firstId) {
  const byParent = new Map();
  archiveTweets.forEach((tweet) => {
    const parent = tweet.in_reply_to_status_id_str;
    if (!parent) return;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(tweet);
  });
  const first = archiveTweets.find((tweet) => tweet.id_str === firstId);
  if (!first) return [];
  const result = [first];
  let current = first;
  while (true) {
    const candidates = (byParent.get(current.id_str) || []).filter((tweet) => !tweet.in_reply_to_user_id_str || tweet.in_reply_to_user_id_str === current.user_id_str || tweet.in_reply_to_screen_name?.toLowerCase() === archiveAccount.username.toLowerCase());
    if (!candidates.length) break;
    candidates.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    current = candidates[0];
    result.push(current);
  }
  return result;
}

$("#archiveFile").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!window.fflate) { archiveStatus("error", "ZIP 도구를 불러오지 못했습니다"); return; }
  try {
    archiveStatus("", "ZIP 여는 중", 15);
    archiveFiles = window.fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
    archiveStatus("", "계정과 트윗 읽는 중", 55);
    const tweetsName = findArchiveEntry(/(^|\/)data\/tweets\.js$/i) || findArchiveEntry(/(^|\/)tweets\.js$/i);
    const accountName = findArchiveEntry(/(^|\/)data\/account\.js$/i) || findArchiveEntry(/(^|\/)account\.js$/i);
    if (!tweetsName || !accountName) throw new Error("required archive files missing");
    archiveTweets = decodeArchiveJs(archiveFiles[tweetsName]).map((item) => item.tweet || item);
    const accountItem = decodeArchiveJs(archiveFiles[accountName])[0];
    const account = accountItem.account || accountItem;
    archiveAccount = { username: account.username || "unknown", name: account.accountDisplayName || account.username || "이름 없음" };
    const profileName = findArchiveEntry(/(^|\/)data\/profile\.js$/i) || findArchiveEntry(/(^|\/)profile\.js$/i);
    if (profileName) {
      const profileItem = decodeArchiveJs(archiveFiles[profileName])[0];
      const profile = profileItem.profile || profileItem;
      const avatarName = profile.avatarMediaUrl ? Object.keys(archiveFiles).find((name) => name.endsWith(profile.avatarMediaUrl.split("/").pop())) : null;
      if (avatarName) {
        avatarData = bytesToDataUrl(archiveFiles[avatarName], avatarName);
        avatarImage = new Image();
        avatarImage.src = avatarData;
      }
    }
    archiveStatus("done", `${archiveAccount.name} · 트윗 ${archiveTweets.length.toLocaleString()}개`, 100);
    scheduleSave();
  } catch (error) {
    console.error(error);
    archiveFiles = null; archiveTweets = []; archiveAccount = null;
    archiveStatus("error", "올바른 X 데이터 아카이브 ZIP인지 확인해 주세요");
  }
};

$("#load").onclick = () => {
  if (!archiveTweets.length || !archiveAccount) { setImportStatus("error", "먼저 X 데이터 아카이브 ZIP을 선택해 주세요"); return; }
  const url = $("#url").value.trim();
  const match = url.match(/status\/(\d+)/);
  if (!match) { setImportStatus("error", "타래의 첫 트윗 링크를 입력해 주세요"); return; }
  setImportStatus("", "아카이브에서 타래 찾는 중", 35);
  const thread = buildThread(match[1]);
  if (!thread.length) { setImportStatus("error", "ZIP에서 해당 트윗을 찾지 못했습니다"); return; }
  setImportStatus("", "원본 사진 가져오는 중", 75);
  window.applyImportedThread(thread.map((tweet) => ({
    name: archiveAccount.name,
    username: archiveAccount.username,
    date: archiveDate(tweet.created_at),
    text: tweet.full_text || tweet.text || "",
    media: mediaForTweet(tweet).map((url) => ({ original_url: url }))
  })));
};

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
}
function rgbToHex(r, g, b) {
  const format = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return "#" + format(r) + format(g) + format(b);
}
function mixColors(first, second, amount) {
  const a = hexToRgb(first), b = hexToRgb(second);
  return rgbToHex(a.r + (b.r - a.r) * amount, a.g + (b.g - a.g) * amount, a.b + (b.b - a.b) * amount);
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const values = [r, g, b].map((value) => { value /= 255; return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; });
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}
function recommendedPalette(main) {
  if (main.toLowerCase() === "#9b8f7f") return { background: "#d2c7b8", card: "#e8dfd3" };
  const lightness = luminance(main);
  return {
    background: mixColors(main, "#ffffff", lightness < .3 ? .68 : .56),
    card: mixColors(main, "#ffffff", .78)
  };
}
function applySiteTheme(main, background, card) {
  const root = document.documentElement;
  root.style.setProperty("--theme", main);
  root.style.setProperty("--theme-soft", mixColors(main, "#ffffff", .72));
  root.style.setProperty("--theme-text", luminance(main) < .38 ? "#ffffff" : "#2e2c29");
  root.style.setProperty("--work", background);
  root.style.setProperty("--panel", card);
  document.body.style.background = background;
}
$("#recommendColors").onclick = () => {
  const main = $("#mainColor").value;
  const palette = recommendedPalette(main);
  $("#bg").value = palette.background;
  $("#card").value = palette.card;
  applySiteTheme(main, palette.background, palette.card);
  draw();
  scheduleSave();
};
$("#resetColors").onclick = () => {
  $("#mainColor").value = "#9b8f7f";
  $("#bg").value = "#d2c7b8";
  $("#card").value = "#e8dfd3";
  applySiteTheme("#9b8f7f", "#d2c7b8", "#e8dfd3");
  draw();
  scheduleSave();
};

function exportHtml() {
  const profile = $("#profile").checked;
  const date = $("#date").checked;
  const link = $("#link").checked;
  const url = $("#url").value || "https://x.com/";
  const font = $("#font").value;
  return `<section style="max-width:680px;margin:auto;font-family:'${font}',sans-serif;color:#2e2c29">${tweets.map((tweet) => `
    <article style="padding:24px 0;border-bottom:1px solid #ddd">
      ${profile ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">${avatarData ? `<img src="${avatarData}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">` : ""}<div><b>${tweet.name}</b> <span style="color:#777">${tweet.handle}${date ? " · " + tweet.date : ""}</span></div></div>` : ""}
      <div style="white-space:pre-wrap;line-height:1.8">${tweet.text}</div>
      ${tweet.media?.map((src) => `<img src="${src}" style="display:block;width:100%;height:auto;margin-top:10px;border-radius:8px" alt="트윗 첨부 이미지">`).join("") || ""}
    </article>`).join("")}
    ${link ? `<p>원문: <a href="${url}">${url}</a></p>` : ""}
  </section>`;
}
$("#html").onclick = () => navigator.clipboard.writeText(exportHtml());
$("#rich").onclick = () => navigator.clipboard.write([new ClipboardItem({
  "text/html": new Blob([exportHtml()], { type: "text/html" }),
  "text/plain": new Blob([tweets.map((tweet) => tweet.text).join("\n\n")], { type: "text/plain" })
})]);

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  text.split("\n").forEach((paragraph) => {
    if (!paragraph) { lines.push(""); return; }
    let line = "";
    for (const character of paragraph) {
      if (ctx.measureText(line + character).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else line += character;
    }
    if (line) lines.push(line);
  });
  return lines;
}

function circleImage(ctx, image, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const ratio = Math.max(size / image.width, size / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
  ctx.restore();
}

function loadMediaImage(source) {
  return new Promise((resolve) => {
    const image = new Image();
    if (!source.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

async function draw() {
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const width = 720;
  const padding = 48;
  const fontSize = Number($("#imageSize").value);
  const font = $("#font").value;
  const showProfile = $("#profile").checked;
  const showDate = $("#date").checked;
  const showLink = $("#link").checked;
  const url = $("#url").value || "https://x.com/backup_note/status/example";
  ctx.font = `${fontSize}px "${font}"`;
  const wrapped = tweets.map((tweet) => wrapText(ctx, tweet.text, width - padding * 2 - 58));
  const mediaImages = await Promise.all(tweets.map((tweet) => Promise.all((tweet.media || []).map(loadMediaImage))));
  const mediaWidth = width - padding * 2 - (showProfile ? 58 : 0);
  let height = 42;
  wrapped.forEach((lines, index) => {
    height += (showProfile ? 58 : 0) + lines.length * fontSize * 1.7 + 42;
    mediaImages[index].forEach((image) => { if (image) height += mediaWidth * image.naturalHeight / image.naturalWidth + 10; });
  });
  if (showLink) height += 54;
  canvas.width = width * 2;
  canvas.height = Math.max(520, height) * 2;
  ctx.scale(2, 2);
  ctx.fillStyle = $("#bg").value;
  ctx.fillRect(0, 0, width, canvas.height / 2);
  ctx.fillStyle = $("#card").value;
  ctx.beginPath();
  ctx.roundRect(20, 20, width - 40, canvas.height / 2 - 40, 12);
  ctx.fill();
  let y = 48;
  tweets.forEach((tweet, index) => {
    if (showProfile) {
      if (avatarImage && avatarImage.complete) circleImage(ctx, avatarImage, padding, y, 44);
      else {
        ctx.fillStyle = $("#mainColor").value;
        ctx.beginPath();
        ctx.arc(padding + 22, y + 22, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = luminance($("#mainColor").value) < .45 ? "#ffffff" : "#2e2c29";
        ctx.font = `700 12px "${font}"`;
        ctx.textAlign = "center";
        ctx.fillText("BU", padding + 22, y + 27);
        ctx.textAlign = "left";
      }
      ctx.fillStyle = "#2e2c29";
      ctx.font = `700 14px "${font}"`;
      ctx.fillText(tweet.name, padding + 58, y + 17);
      ctx.fillStyle = "#918d86";
      ctx.font = `12px "${font}"`;
      const meta = tweet.handle + (showDate ? "  ·  " + tweet.date : "");
      ctx.fillText(meta, padding + 58, y + 37);
      y += 58;
    }
    ctx.fillStyle = "#2e2c29";
    ctx.font = `${fontSize}px "${font}"`;
    wrapped[index].forEach((line) => {
      y += fontSize * 1.7;
      if (line) ctx.fillText(line, padding + (showProfile ? 58 : 0), y);
    });
    for (const image of mediaImages[index]) {
      if (!image) continue;
      const imageHeight = mediaWidth * image.naturalHeight / image.naturalWidth;
      y += 10;
      ctx.drawImage(image, padding + (showProfile ? 58 : 0), y, mediaWidth, imageHeight);
      y += imageHeight;
    }
    y += 28;
    if (index < tweets.length - 1) {
      ctx.strokeStyle = "#e6e2db";
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 26;
    }
  });
  if (showLink) {
    ctx.fillStyle = "#918d86";
    ctx.font = `11px "${font}"`;
    ctx.fillText("원문  " + url, padding, y + 12);
  }
}

document.querySelectorAll("nav button").forEach((button) => button.onclick = () => {
  document.querySelectorAll("nav button").forEach((item) => item.classList.remove("on"));
  button.classList.add("on");
  const imageMode = button.dataset.tab === "image";
  view.hidden = imageMode;
  $("#imageView").hidden = !imageMode;
  $("#html").hidden = imageMode;
  $("#rich").hidden = imageMode;
  $("#png").hidden = !imageMode;
  if (imageMode) draw();
});
$("#png").onclick = async () => {
  await draw();
  const anchor = document.createElement("a");
  anchor.download = "backup-x-thread.png";
  anchor.href = $("#canvas").toDataURL();
  anchor.click();
};
["mainColor", "bg", "card", "size", "imageSize", "profile", "date", "link", "font"].forEach((id) => {
  $("#" + id).oninput = () => {
    if (id === "font") view.style.fontFamily = $("#" + id).value;
    if (id === "imageSize") $("#imageSizeValue").textContent = $("#imageSize").value + "px";
    draw();
    scheduleSave();
  };
});
$("#url").addEventListener("input", scheduleSave);
loadWorkspace();
