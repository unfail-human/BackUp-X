const tweets = [
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:42", text: "언젠가 사라질지도 모르는 기록을 위해, 오늘의 이야기를 남겨 둡니다.\n\n이 타래는 BackUp-X의 예시예요.", media: [] },
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:44", text: "본문을 직접 수정한 뒤 티스토리용 서식이나 이미지로 저장할 수 있습니다.", media: [] }
];
const $ = (selector) => document.querySelector(selector);
const view = $("#textView");
const NOTICE_VERSION = "2.0";
let avatarData = "";
let avatarImage = null;
let backgroundData = "";
let backgroundImage = null;
let saveTimer = null;

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
    tweets, avatarData, backgroundData, url: $("#url").value, mainColor: $("#mainColor").value,
    bg: $("#bg").value, bg2: $("#bg2").value, bgMode: $("#bgMode").value,
    card: $("#card").value, imageScale: $("#imageScale").value,
    font: $("#font").value, profile: $("#profile").checked,
    date: $("#date").checked, link: $("#link").checked,
    recommendColors: $("#recommendColors").checked
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
    backgroundData = saved.backgroundData || "";
    for (const id of ["url", "mainColor", "bg", "bg2", "bgMode", "card", "imageScale", "font"]) if (saved[id] != null) $("#" + id).value = saved[id];
    updateLoadButton();
    for (const id of ["profile", "date", "link", "recommendColors"]) if (saved[id] != null) $("#" + id).checked = saved[id];
    applySiteTheme($("#mainColor").value, $("#bg").value, $("#card").value);
    $("#imageScaleValue").textContent = $("#imageScale").value + "%";
    updateBackgroundControls();
    if (avatarData) { avatarImage = new Image(); avatarImage.src = avatarData; }
    if (backgroundData) { backgroundImage = new Image(); backgroundImage.onload = draw; backgroundImage.src = backgroundData; }
    render();
    $("#saveState").className = "saved";
    $("#saveState").lastChild.textContent = " 자동 저장 복원됨";
  } catch { $("#saveState").lastChild.textContent = " 자동 저장 준비"; }
}

function render() {
  view.innerHTML = tweets.map((tweet, index) => `
    <article class="tweet">
      <div class="avatar">${avatarData ? `<img src="${avatarData}" alt="프로필 사진">` : "BU"}</div>
      <div class="tweet-body">
        <div class="tweet-head"><div class="meta"><b>${tweet.name}</b>${tweet.handle} · ${tweet.date}</div></div>
        <textarea data-i="${index}">${tweet.text}</textarea>
        ${tweet.media?.length ? `<div class="tweet-media">${tweet.media.map((src) => `<img src="${src}" alt="트윗 첨부 이미지" loading="lazy">`).join("")}</div>` : ""}
        <div class="tweet-media-tools"><label>원본 사진 ${tweet.media?.length ? "교체" : "추가"}<input type="file" accept="image/*" multiple data-media-i="${index}"></label>${tweet.media?.length ? `<button type="button" data-clear-media="${index}">사진 모두 지우기</button>` : ""}</div>
        <div class="tweet-actions"><button type="button" class="insert-toggle" data-open-insert="${index}" aria-label="이 게시글 다음에 트윗 추가">+</button>${index > 0 ? `<button type="button" class="delete-tweet" data-delete-tweet="${index}" aria-label="이 게시글 삭제">×</button>` : ""}</div>
        <div class="thread-insert" data-insert-box="${index}" hidden><input data-insert-url="${index}" placeholder="이 다음에 넣을 누락 트윗 링크"><button type="button" data-insert-go="${index}">추가</button></div>
      </div>
    </article>`).join("");
  view.querySelectorAll("textarea").forEach((area) => {
    area.oninput = (event) => { tweets[Number(event.target.dataset.i)].text = event.target.value; scheduleSave(); };
  });
  view.querySelectorAll("[data-media-i]").forEach((input) => {
    input.onchange = async (event) => {
      const files = [...event.target.files];
      if (!files.length) return;
      const images = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })));
      tweets[Number(event.target.dataset.mediaI)].media = images;
      render(); draw(); scheduleSave();
    };
  });
  view.querySelectorAll("[data-clear-media]").forEach((button) => {
    button.onclick = () => { tweets[Number(button.dataset.clearMedia)].media = []; render(); draw(); scheduleSave(); };
  });
  view.querySelectorAll("[data-open-insert]").forEach((button) => {
    button.onclick = () => {
      const box = view.querySelector(`[data-insert-box="${button.dataset.openInsert}"]`);
      box.hidden = !box.hidden;
      if (!box.hidden) box.querySelector("input").focus();
    };
  });
  view.querySelectorAll("[data-delete-tweet]").forEach((button) => {
    button.onclick = () => {
      tweets.splice(Number(button.dataset.deleteTweet), 1);
      render(); draw(); scheduleSave();
      setImportStatus("done", `게시글 삭제 완료 · 총 ${tweets.length}개`, 100);
    };
  });
  view.querySelectorAll("[data-insert-go]").forEach((button) => {
    button.onclick = async () => {
      const index = Number(button.dataset.insertGo);
      const input = view.querySelector(`[data-insert-url="${index}"]`);
      try { await importLinkedTweet(input.value.trim(), index); }
      catch (error) { setImportStatus("error", error.message === "different author" ? "첫 트윗과 같은 계정의 링크만 추가할 수 있어요" : error.message === "invalid url" ? "올바른 누락 트윗 링크를 입력해 주세요" : "트윗을 불러오지 못했습니다"); }
    };
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
function isTweetUrl(value) {
  return /^https?:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i.test(value.trim());
}
function updateLoadButton() {
  $("#load").disabled = !isTweetUrl($("#url").value);
}

function loadOEmbed(url) {
  return new Promise((resolve, reject) => {
    const callback = "backupXOembed" + Date.now() + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const cleanup = () => { delete window[callback]; script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 12000);
    window[callback] = (data) => { clearTimeout(timer); cleanup(); resolve(data); };
    script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error("load failed")); };
    script.src = `https://publish.x.com/oembed?omit_script=1&dnt=1&callback=${callback}&url=${encodeURIComponent(url)}`;
    document.head.appendChild(script);
  });
}
function parseOEmbed(data) {
  const doc = new DOMParser().parseFromString(data.html, "text/html");
  const paragraph = doc.querySelector("blockquote p");
  if (!paragraph) throw new Error("post unavailable");
  const canonicalUrl = data.url.split("?")[0];
  const linkedPosts = [...paragraph.querySelectorAll('a[href*="/status/"]')]
    .map((anchor) => anchor.href.split("?")[0])
    .filter((url, index, all) => url !== canonicalUrl && all.indexOf(url) === index);
  paragraph.querySelectorAll("a").forEach((anchor) => {
    if (/pic\.twitter\.com|t\.co/i.test(anchor.textContent)) anchor.remove();
  });
  const authorUrl = new URL(data.author_url);
  const dateLink = [...doc.querySelectorAll("blockquote > a")].pop();
  return {
    name: data.author_name || authorUrl.pathname.slice(1),
    username: authorUrl.pathname.split("/").filter(Boolean)[0],
    date: dateLink?.textContent?.trim() || "",
    text: paragraph.textContent.trim(),
    media: [],
    linkedPosts
  };
}
function tweetIdFromUrl(url) {
  return url.match(/status\/(\d+)/)?.[1] || "";
}
function formatTweetDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function fxStatusToItem(status) {
  const author = status.author || {};
  const media = status.media?.all || status.media?.photos || [];
  return {
    name: author.name || author.screen_name || "이름 없음",
    handle: "@" + (author.screen_name || "unknown"),
    date: formatTweetDate(status.created_at),
    text: status.text || "",
    media: [...new Set(media.filter((item) => item.type === "photo" || item.type === "gif").map((item) => item.url).filter(Boolean))]
  };
}
async function loadFxThread(url) {
  const id = tweetIdFromUrl(url);
  const response = await fetch(`https://api.fxtwitter.com/2/thread/${id}`);
  if (!response.ok) throw new Error("thread failed");
  const data = await response.json();
  if (data.code && data.code !== 200) throw new Error("thread unavailable");
  const statuses = (data.thread?.length ? data.thread : [data.status]).filter((item) => item?.type === "status");
  if (!statuses.length) throw new Error("thread unavailable");
  return { statuses, status: data.status || statuses[0], author: data.author || data.status?.author || statuses[0]?.author };
}
async function importLinkedTweet(url, insertAfter = null) {
  if (!isTweetUrl(url)) throw new Error("invalid url");
  const inserting = Number.isInteger(insertAfter);
  setImportStatus("", inserting ? "누락 트윗 불러오는 중" : "첫 트윗 불러오는 중", 25);
  let imported;
  let importedAuthor;
  try {
    setImportStatus("", inserting ? "누락 트윗 확인 중" : "이어지는 타래 확인 중", 55);
    const fx = await loadFxThread(url);
    importedAuthor = fx.author;
    if (inserting) {
      const exact = fx.statuses.find((status) => status.id === tweetIdFromUrl(url)) || fx.status;
      imported = [fxStatusToItem(exact)];
    } else {
      const rootAuthor = fx.statuses[0]?.author?.screen_name?.toLowerCase();
      imported = fx.statuses.filter((status) => status.author?.screen_name?.toLowerCase() === rootAuthor).slice(0, 30).map(fxStatusToItem);
    }
  } catch {
    const tweet = parseOEmbed(await loadOEmbed(url));
    imported = [{ name: tweet.name, handle: "@" + tweet.username, date: tweet.date, text: tweet.text, media: [] }];
  }
  if (inserting && tweets.length && tweets[0].handle.toLowerCase() !== imported[0].handle.toLowerCase()) throw new Error("different author");
  if (inserting) tweets.splice(insertAfter + 1, 0, imported[0]);
  else tweets.splice(0, tweets.length, ...imported);
  if (importedAuthor?.avatar_url) {
    avatarData = importedAuthor.avatar_url;
    avatarImage = new Image();
    avatarImage.crossOrigin = "anonymous";
    avatarImage.onload = draw;
    avatarImage.src = avatarData;
  }
  render();
  draw();
  setImportStatus("done", inserting ? `누락 트윗 추가 완료 · 총 ${tweets.length}개` : `타래 불러오기 완료 · ${tweets.length}개`, 100);
  scheduleSave();
}
$("#load").onclick = async () => {
  try { await importLinkedTweet($("#url").value.trim()); }
  catch (error) { setImportStatus("error", error.message === "invalid url" ? "올바른 공개 트윗 링크를 입력해 주세요" : "트윗을 불러오지 못했습니다"); }
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
function applyRecommendedColors() {
  const main = $("#mainColor").value;
  const palette = recommendedPalette(main);
  $("#bg").value = palette.background;
  $("#bg2").value = mixColors(main, "#ffffff", .32);
  $("#card").value = palette.card;
  applySiteTheme(main, palette.background, palette.card);
  draw();
  scheduleSave();
}
$("#recommendColors").onchange = () => {
  if ($("#recommendColors").checked) applyRecommendedColors();
  else scheduleSave();
};
$("#resetColors").onclick = () => {
  $("#mainColor").value = "#9b8f7f";
  $("#bg").value = "#d2c7b8";
  $("#bg2").value = "#b8a895";
  $("#card").value = "#e8dfd3";
  $("#bgMode").value = "solid";
  backgroundData = "";
  backgroundImage = null;
  $("#recommendColors").checked = true;
  updateBackgroundControls();
  applySiteTheme("#9b8f7f", "#d2c7b8", "#e8dfd3");
  draw();
  scheduleSave();
};
function updateBackgroundControls() {
  const mode = $("#bgMode").value;
  $("#gradientColorField").hidden = mode !== "gradient";
  $("#backgroundImageField").hidden = mode !== "image";
  $("#clearBackground").hidden = mode !== "image" || !backgroundData;
}
$("#bgMode").onchange = () => { updateBackgroundControls(); draw(); scheduleSave(); };
$("#backgroundFile").onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    backgroundData = reader.result;
    backgroundImage = new Image();
    backgroundImage.onload = () => { updateBackgroundControls(); draw(); scheduleSave(); };
    backgroundImage.src = backgroundData;
  };
  reader.readAsDataURL(file);
};
$("#clearBackground").onclick = () => {
  backgroundData = "";
  backgroundImage = null;
  $("#backgroundFile").value = "";
  updateBackgroundControls(); draw(); scheduleSave();
};

function exportHtml() {
  const profile = $("#profile").checked;
  const date = $("#date").checked;
  const link = $("#link").checked;
  const url = ($("#url").value || "https://x.com/").split("?")[0];
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
function drawCover(ctx, image, width, height) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function draw() {
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const width = 720;
  const padding = 48;
  const fontSize = 14;
  const imageScale = Number($("#imageScale").value) / 100;
  const pixelScale = 2 * imageScale;
  const font = $("#font").value;
  const showProfile = $("#profile").checked;
  const showDate = $("#date").checked;
  const showLink = $("#link").checked;
  const url = ($("#url").value || "https://x.com/backup_note/status/example").split("?")[0];
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
  const logicalHeight = Math.max(520, height);
  canvas.width = Math.round(width * pixelScale);
  canvas.height = Math.round(logicalHeight * pixelScale);
  canvas.style.width = `min(100%, ${Math.round(width * imageScale)}px)`;
  ctx.scale(pixelScale, pixelScale);
  if ($("#bgMode").value === "gradient") {
    const gradient = ctx.createLinearGradient(0, 0, width, logicalHeight);
    gradient.addColorStop(0, $("#bg").value);
    gradient.addColorStop(1, $("#bg2").value);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, logicalHeight);
  } else if ($("#bgMode").value === "image" && backgroundImage?.complete) {
    drawCover(ctx, backgroundImage, width, logicalHeight);
  } else {
    ctx.fillStyle = $("#bg").value;
    ctx.fillRect(0, 0, width, logicalHeight);
  }
  ctx.fillStyle = $("#card").value;
  ctx.beginPath();
  ctx.roundRect(20, 20, width - 40, logicalHeight - 40, 12);
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

document.querySelectorAll("nav button[data-tab]").forEach((button) => button.onclick = () => {
  document.querySelectorAll("nav button[data-tab]").forEach((item) => item.classList.remove("on"));
  button.classList.add("on");
  const imageMode = button.dataset.tab === "image";
  view.hidden = imageMode;
  $("#imageView").hidden = !imageMode;
  $("#rich").hidden = imageMode;
  $("#png").hidden = !imageMode;
  document.querySelector(".editor footer").hidden = !imageMode;
  if (imageMode) draw();
});
$("#png").onclick = async () => {
  await draw();
  const anchor = document.createElement("a");
  anchor.download = "backup-x-thread.png";
  anchor.href = $("#canvas").toDataURL();
  anchor.click();
};
["mainColor", "bg", "bg2", "card", "imageScale", "profile", "date", "link", "font"].forEach((id) => {
  $("#" + id).oninput = () => {
    if (id === "mainColor" && $("#recommendColors").checked) { applyRecommendedColors(); return; }
    if ((id === "bg" || id === "bg2" || id === "card") && $("#recommendColors").checked) $("#recommendColors").checked = false;
    if (id === "font") view.style.fontFamily = $("#" + id).value;
    if (id === "imageScale") $("#imageScaleValue").textContent = $("#imageScale").value + "%";
    draw();
    scheduleSave();
  };
});
$("#url").addEventListener("input", () => { updateLoadButton(); scheduleSave(); });
loadWorkspace();
