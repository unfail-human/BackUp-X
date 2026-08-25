const tweets = [
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:42", text: "언젠가 사라질지도 모르는 기록을 위해, 오늘의 이야기를 남겨 둡니다.\n\n이 타래는 BackUp-X의 예시예요.", media: [] },
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:44", text: "본문을 직접 수정한 뒤 티스토리용 서식이나 이미지로 저장할 수 있습니다.", media: [] }
];
const $ = (selector) => document.querySelector(selector);
const view = $("#textView");
const NOTICE_VERSION = "2.3";
let avatarData = "";
let avatarRemoteUrl = "";
let avatarImage = null;
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
    tweets, avatarData, avatarRemoteUrl, url: $("#url").value, mainColor: $("#mainColor").value,
    bg: $("#bg").value, bg2: $("#bg2").value, bgMode: $("#bgMode").value, gradientAngle: $("#gradientAngle").value,
    card: $("#card").value, textSize: $("#textSize").value,
    font: $("#font").value,
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
    avatarRemoteUrl = saved.avatarRemoteUrl || (!avatarData.startsWith("data:") && !avatarData.startsWith("blob:") ? avatarData : "");
    for (const id of ["url", "mainColor", "bg", "bg2", "bgMode", "gradientAngle", "card", "textSize", "font"]) if (saved[id] != null) $("#" + id).value = saved[id];
    if (saved.mainColor === "#9b8f7f" && saved.bg === "#d2c7b8" && saved.card === "#e8dfd3") {
      $("#bg").value = "#f6f2eb";
      $("#bg2").value = "#ded4c7";
      $("#card").value = "#eee8df";
    }
    if (saved.bgMode === "image" || !$("#bgMode").value) $("#bgMode").value = "gradient";
    if (localStorage.getItem("backupXGradientDefault") !== "1") {
      $("#bgMode").value = "gradient";
      localStorage.setItem("backupXGradientDefault", "1");
    }
    if (!saved.textSize || saved.textSize === "13") $("#textSize").value = "15";
    if (saved.font === "KoPub Dotum") $("#font").value = "KoPub Dotum Medium";
    if (saved.font === "KoPub Batang") $("#font").value = "KoPub Batang Medium";
    if (saved.font === "Pretendard") $("#font").value = "Pretendard Variable";
    if (!saved.font || saved.font === "온글잎 박다현체") $("#font").value = "Pretendard Variable";
    $("#gradientStart").value = $("#bg").value;
    $("#gradientAngleValue").textContent = $("#gradientAngle").value + "°";
    updateLoadButton();
    if (saved.recommendColors != null) $("#recommendColors").checked = saved.recommendColors;
    applySiteTheme($("#mainColor").value);
    $("#textSizeValue").textContent = $("#textSize").value + "px";
    applyTypography();
    updateBackgroundControls();
    if (avatarData) {
      avatarImage = new Image();
      if (!avatarData.startsWith("data:") && !avatarData.startsWith("blob:")) avatarImage.crossOrigin = "anonymous";
      avatarImage.onerror = () => { avatarImage = null; draw(); };
      avatarImage.src = avatarData;
    }
    render();
    $("#saveState").className = "saved";
    $("#saveState").lastChild.textContent = " 자동 저장 복원됨";
  } catch { $("#saveState").lastChild.textContent = " 자동 저장 준비"; }
}

async function ensureFontLoaded(font = $("#font").value) {
  if (!document.fonts) return;
  try {
    await document.fonts.load(`400 16px "${font}"`, "한글 폰트 적용 확인");
    await document.fonts.ready;
  } catch (error) {
    console.warn("웹폰트를 불러오지 못했습니다.", error);
  }
}

const FONT_STACKS = {
  "온글잎 박다현체": '"온글잎 박다현체","Ownglyph PDH",sans-serif',
  "Pretendard Variable": '"Pretendard Variable",sans-serif',
  "Noto Sans KR": '"Noto Sans KR",sans-serif',
  "KoPub Dotum Light": '"KoPub Dotum Light",sans-serif',
  "KoPub Dotum Medium": '"KoPub Dotum Medium",sans-serif',
  "KoPub Dotum Bold": '"KoPub Dotum Bold",sans-serif',
  "KoPub Batang Light": '"KoPub Batang Light",serif',
  "KoPub Batang Medium": '"KoPub Batang Medium",serif',
  "KoPub Batang Bold": '"KoPub Batang Bold",serif',
  "system-ui": 'system-ui,sans-serif',
  "Apple SD Gothic Neo": '"Apple SD Gothic Neo",sans-serif',
  "Malgun Gothic": '"Malgun Gothic",sans-serif',
  "Arial": 'Arial,sans-serif',
  "Georgia": 'Georgia,serif'
};

async function applyTypography() {
  const font = $("#font").value;
  document.documentElement.style.setProperty("--active-font", FONT_STACKS[font] || `"${font}", sans-serif`);
  document.documentElement.style.setProperty("--tweet-font-size", $("#textSize").value + "px");
  await ensureFontLoaded(font);
  document.body.dataset.activeFont = font;
}
function resizeTweetArea(area) {
  const minimumHeight = 120;
  area.style.height = "0px";
  area.style.height = Math.max(minimumHeight, area.scrollHeight + 2) + "px";
}
function resizeAllTweetAreas() {
  view.querySelectorAll("textarea").forEach(resizeTweetArea);
}
function settleTweetLayout() {
  requestAnimationFrame(() => requestAnimationFrame(resizeAllTweetAreas));
  document.fonts.ready.then(resizeAllTweetAreas);
}
window.addEventListener("resize", settleTweetLayout);
function render() {
  view.innerHTML = tweets.map((tweet, index) => `
    <article class="tweet">
      <div class="avatar">${avatarData ? `<img src="${avatarData}" alt="프로필 사진">` : "BU"}</div>
      <div class="tweet-body">
        <div class="tweet-head"><div class="meta"><b class="meta-name">${tweet.name}</b><span class="meta-sub">${tweet.handle}<i>·</i>${tweet.date}</span></div></div>
        <textarea data-i="${index}">${tweet.text}</textarea>
        ${tweet.media?.length ? `<div class="tweet-media">${tweet.media.map((src) => `<img src="${src}" alt="트윗 첨부 이미지" loading="lazy">`).join("")}</div>` : ""}
        <div class="tweet-media-tools"><label>원본 사진 ${tweet.media?.length ? "교체" : "추가"}<input type="file" accept="image/*" multiple data-media-i="${index}"></label>${tweet.media?.length ? `<button type="button" data-clear-media="${index}">사진 모두 지우기</button>` : ""}</div>
        <div class="tweet-actions"><button type="button" class="insert-toggle" data-open-insert="${index}" aria-label="이 게시글 다음에 트윗 추가">+</button>${index > 0 ? `<button type="button" class="delete-tweet" data-delete-tweet="${index}" aria-label="이 게시글 삭제">×</button>` : ""}</div>
        <div class="thread-insert" data-insert-box="${index}" hidden><input data-insert-url="${index}" placeholder="이 다음에 넣을 누락 트윗 링크"><button type="button" data-insert-go="${index}">추가</button></div>
      </div>
    </article>`).join("");
  view.querySelectorAll("textarea").forEach((area) => {
    resizeTweetArea(area);
    area.oninput = (event) => { tweets[Number(event.target.dataset.i)].text = event.target.value; resizeTweetArea(event.target); draw(); scheduleSave(); };
  });
  settleTweetLayout();
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
  applyTypography();
  settleTweetLayout();
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
  avatarRemoteUrl = author.profile_image_url || (!String(profileImage || "").startsWith("data:") ? profileImage || "" : "");
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

async function imageToLocalData(url) {
  if (!url || url.startsWith("data:")) return url;
  try {
    const response = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!response.ok) return url;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
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
  imported = await Promise.all(imported.map(async (tweet) => ({
    ...tweet,
    media: await Promise.all((tweet.media || []).map(imageToLocalData))
  })));
  if (inserting) tweets.splice(insertAfter + 1, 0, imported[0]);
  else tweets.splice(0, tweets.length, ...imported);
  if (importedAuthor?.avatar_url) {
    avatarRemoteUrl = importedAuthor.avatar_url;
    avatarData = await imageToLocalData(importedAuthor.avatar_url);
    avatarImage = new Image();
    if (!avatarData.startsWith("data:") && !avatarData.startsWith("blob:")) avatarImage.crossOrigin = "anonymous";
    avatarImage.onload = draw;
    avatarImage.onerror = () => { avatarImage = null; draw(); };
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
  if (main.toLowerCase() === "#9b8f7f") return { background: "#f6f2eb", card: "#eee8df" };
  const lightness = luminance(main);
  return {
    background: mixColors(main, "#ffffff", lightness < .3 ? .68 : .56),
    card: mixColors(main, "#ffffff", .78)
  };
}
function sitePalette(main) {
  if (main.toLowerCase() === "#9b8f7f") return { background: "#eeeae3", panel: "#fbfaf8", soft: "#f3eee7", line: "#ded7cd", hover: "#f0ebe4" };
  return {
    background: mixColors(main, "#ffffff", .91),
    panel: mixColors(main, "#ffffff", .975),
    soft: mixColors(main, "#ffffff", .86),
    line: mixColors(main, "#ffffff", .73),
    hover: mixColors(main, "#ffffff", .9)
  };
}
function applySiteTheme(main) {
  const site = sitePalette(main);
  const root = document.documentElement;
  root.style.setProperty("--theme", main);
  root.style.setProperty("--theme-soft", site.soft);
  root.style.setProperty("--theme-text", luminance(main) < .38 ? "#ffffff" : "#2e2c29");
  root.style.setProperty("--work", site.background);
  root.style.setProperty("--panel", site.panel);
  root.style.setProperty("--soft", site.soft);
  root.style.setProperty("--hover", site.hover);
  root.style.setProperty("--line", site.line);
  root.style.setProperty("--line-strong", mixColors(main, "#ffffff", .61));
  document.body.style.background = site.background;
}
function applyRecommendedColors() {
  const main = $("#mainColor").value;
  const palette = recommendedPalette(main);
  $("#bg").value = palette.background;
  $("#gradientStart").value = palette.background;
  $("#bg2").value = main.toLowerCase() === "#9b8f7f" ? "#ded4c7" : mixColors(main, "#ffffff", .68);
  $("#card").value = palette.card;
  applySiteTheme(main);
  updateGradientPreview();
  draw();
  scheduleSave();
}
$("#recommendColors").onchange = () => {
  if ($("#recommendColors").checked) applyRecommendedColors();
  else scheduleSave();
};
$("#resetColors").onclick = () => {
  $("#mainColor").value = "#9b8f7f";
  $("#bg").value = "#f6f2eb";
  $("#bg2").value = "#ded4c7";
  $("#gradientStart").value = "#f6f2eb";
  $("#gradientAngle").value = "135";
  $("#gradientAngleValue").textContent = "135°";
  $("#card").value = "#eee8df";
  $("#bgMode").value = "gradient";
  $("#recommendColors").checked = true;
  updateBackgroundControls();
  applySiteTheme("#9b8f7f");
  draw();
  scheduleSave();
};
function updateBackgroundControls() {
  const mode = $("#bgMode").value;
  $("#gradientPanel").hidden = mode !== "gradient";
  updateGradientPreview();
}
function updateGradientPreview() {
  const angle = $("#gradientAngle").value + "deg";
  const first = $("#bg").value;
  const second = $("#bg2").value;
  const root = document.documentElement;
  $("#gradientPreview").style.background = `linear-gradient(${angle}, ${first}, ${second})`;
  root.style.setProperty("--image-angle", angle);
  root.style.setProperty("--image-bg-1", first);
  root.style.setProperty("--image-bg-2", second);
  root.style.setProperty("--image-card", $("#card").value);
}
$("#gradientStart").oninput = () => {
  $("#bg").value = $("#gradientStart").value;
  $("#recommendColors").checked = false;
  updateGradientPreview(); draw(); scheduleSave();
};
$("#gradientAngle").oninput = () => {
  $("#gradientAngleValue").textContent = $("#gradientAngle").value + "°";
  updateGradientPreview(); draw(); scheduleSave();
};
$("#bgMode").onchange = () => { updateBackgroundControls(); draw(); scheduleSave(); };

function exportHtml(includeEmbeddedAvatar = false) {
  const font = $("#font").value;
  const textSize = Number($("#textSize").value);
  const hintSize = Math.max(11, textSize - 2);
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
  const lineBreaks = (value) => safe(value).replace(/\r?\n/g, "<br>");
  const main = $("#mainColor").value;
  const line = mixColors(main, "#ffffff", .78);
  const soft = mixColors(main, "#ffffff", .93);
  const originalUrl = ($("#url").value || "").split("?")[0];
  const original = safe(originalUrl);
  const fontStack = `'${safe(font)}','Pretendard Variable','Pretendard','Noto Sans KR',Arial,sans-serif`;

  const posts = tweets.map((tweet, index) => {
    const exportAvatar = /^https?:\/\//i.test(avatarRemoteUrl) ? avatarRemoteUrl : (/^https?:\/\//i.test(avatarData) || (includeEmbeddedAvatar && /^data:image\//i.test(avatarData)) ? avatarData : "");
    const avatar = exportAvatar ? `<img src="${safe(exportAvatar)}" width="44" height="44" alt="프로필 사진" referrerpolicy="no-referrer" style="display:inline-block;width:44px;height:44px;margin:0 12px 0 0;border:0;border-radius:50%;object-fit:cover;vertical-align:middle">` : "";
    const media = (tweet.media || []).map((src) => `<p style="margin:14px 0 0;text-align:center"><img src="${safe(src)}" alt="트윗 첨부 이미지" style="display:block;max-width:100%;height:auto;margin:0 auto;border:1px solid ${line};border-radius:10px"></p>`).join("");
    return `<tr><td style="padding:24px 26px;border:0;${index < tweets.length - 1 ? `border-bottom:1px solid ${line};` : ""}background-color:#ffffff;vertical-align:top">
      <p style="margin:0 0 16px;padding:0;font-family:${fontStack};line-height:1.4;text-align:left">${avatar}<span style="display:inline-block;vertical-align:middle"><strong style="display:block;color:#2e2c29;font-size:${textSize}px;line-height:1.3">${safe(tweet.name)}</strong><span style="display:block;margin-top:3px;color:#918d86;font-size:${hintSize}px;line-height:1.4">${safe(tweet.handle)}&nbsp;&nbsp;·&nbsp;&nbsp;${safe(tweet.date)}</span></span></p>
      <div style="margin:0;padding:0;color:#2e2c29;font-family:${fontStack};font-size:${textSize}px;line-height:1.75;text-align:left;word-break:break-word">${lineBreaks(tweet.text)}</div>
      ${media}
    </td></tr>`;
  }).join("");
  const source = original ? `<tr><td style="padding:0 18px 18px;border:0;background-color:#ffffff"><p style="margin:0;padding:10px 14px;background-color:${soft};color:#746e66;font-family:${fontStack};font-size:${hintSize}px;line-height:1.5;text-align:left;word-break:break-all"><a href="${original}" style="color:#746e66;text-decoration:none"><strong>원문 트윗 보기</strong>&nbsp;&nbsp;›&nbsp;&nbsp;${original}</a></p></td></tr>` : "";
  return `<table data-ke-align="alignCenter" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;margin:24px auto;border:1px solid ${line};border-collapse:separate;border-spacing:0;background-color:#ffffff"><tbody>${posts}${source}</tbody></table>`;
}

$("#rich").onclick = async () => {
  const button = $("#rich");
  button.disabled = true;
  button.textContent = "서식 복사 중…";
  button.classList.remove("copied", "copy-error");
  try {
    const html = exportHtml();
    const plain = tweets.map((tweet) => `${tweet.name} ${tweet.handle} · ${tweet.date}\n${tweet.text}`).join("\n\n") + ($("#url").value ? `\n\n원문: ${$("#url").value.split("?")[0]}` : "");
    if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error("rich clipboard unavailable");
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], {type:"text/html"}),
      "text/plain": new Blob([plain], {type:"text/plain"})
    })]);
    button.classList.add("copied");
    button.textContent = "✓ HTML 서식 복사 완료";
  } catch (error) {
    console.warn("서식 복사 실패", error);
    button.classList.add("copy-error");
    button.textContent = "복사 실패 · 다시 시도";
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.classList.remove("copied", "copy-error");
      button.textContent = "서식 복사";
    }, 2000);
  }
};

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
function mediaGridLayout(images, width) {
  const valid = images.filter(Boolean);
  if (!valid.length) return { height: 0, rows: [] };
  if (valid.length === 1) {
    const height = Math.min(420, Math.max(120, width * valid[0].naturalHeight / valid[0].naturalWidth));
    return { height: height + 22, rows: [{ y: 22, height, items: [{ image: valid[0], x: 0, width }] }] };
  }
  const gap = 6, tileWidth = (width - gap) / 2;
  const rows = [];
  let y = 22;
  for (let index = 0; index < valid.length; index += 2) {
    const pair = valid.slice(index, index + 2);
    const height = Math.min(320, Math.max(120, ...pair.map((image) => tileWidth * image.naturalHeight / image.naturalWidth)));
    rows.push({ y, height, items: pair.map((image, itemIndex) => ({ image, x: itemIndex * (tileWidth + gap), width: tileWidth })) });
    y += height + gap;
  }
  return { height: y, rows };
}

function drawContainedImage(ctx, image, x, y, width, height, radius = 10) {
  ctx.save();
  ctx.fillStyle = mixColors($("#mainColor").value, "#ffffff", .82);
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill(); ctx.clip();
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio, drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

async function draw() {
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const width = 720;
  const cardX = 28;
  const cardPadding = 30;
  const avatarSize = 44;
  const columnGap = 14;
  const fontSize = Number($("#textSize").value);
  const lineHeight = fontSize * 1.62;
  const imageScale = 1;
  const pixelScale = 2;
  const font = $("#font").value;
  const canvasFont = FONT_STACKS[font] || `"${font}",sans-serif`;
  await ensureFontLoaded(font);
  const showProfile = true;
  const showDate = true;
  const showLink = false;
  const url = ($("#url").value || "https://x.com/backup_note/status/example").split("?")[0];
  const avatarColumn = showProfile ? avatarSize + columnGap : 0;
  const contentX = cardX + cardPadding + avatarColumn;
  const contentWidth = width - (cardX + cardPadding) * 2 - avatarColumn;
  ctx.font = `${fontSize}px ${canvasFont}`;
  const wrapped = tweets.map((tweet) => wrapText(ctx, tweet.text, contentWidth));
  const mediaImages = await Promise.all(tweets.map((tweet) => Promise.all((tweet.media || []).map(loadMediaImage))));
  const layouts = wrapped.map((lines, index) => {
    const headerHeight = showProfile ? 48 : 6;
    const textHeight = Math.max(lineHeight, lines.length * lineHeight);
    const mediaLayout = mediaGridLayout(mediaImages[index], contentWidth);
    return { headerHeight, textHeight, mediaHeight: mediaLayout.height, mediaLayout, height: headerHeight + textHeight + mediaLayout.height + 28 };
  });
  const cardTop = 28;
  const cardBottom = 28;
  const linkHeight = showLink ? 56 : 0;
  const cardHeight = cardPadding + layouts.reduce((sum, layout) => sum + layout.height, 0) + linkHeight + cardPadding;
  const logicalHeight = Math.max(420, cardTop + cardHeight + cardBottom);
  canvas.width = Math.round(width * pixelScale);
  canvas.height = Math.round(logicalHeight * pixelScale);
  canvas.style.width = `min(100%, ${Math.round(width * imageScale)}px)`;
  ctx.scale(pixelScale, pixelScale);
  if ($("#bgMode").value === "gradient") {
    const radians = (Number($("#gradientAngle").value) - 90) * Math.PI / 180;
    const centerX = width / 2, centerY = logicalHeight / 2;
    const radius = Math.abs(width * Math.cos(radians)) / 2 + Math.abs(logicalHeight * Math.sin(radians)) / 2;
    const gradient = ctx.createLinearGradient(centerX - Math.cos(radians) * radius, centerY - Math.sin(radians) * radius, centerX + Math.cos(radians) * radius, centerY + Math.sin(radians) * radius);
    gradient.addColorStop(0, $("#bg").value);
    gradient.addColorStop(1, $("#bg2").value);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, logicalHeight);
  } else {
    ctx.fillStyle = $("#bg").value;
    ctx.fillRect(0, 0, width, logicalHeight);
  }
  ctx.save();
  ctx.shadowColor = "rgba(43,37,31,.14)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = $("#card").value;
  ctx.beginPath();
  ctx.roundRect(cardX, cardTop, width - cardX * 2, cardHeight, 20);
  ctx.fill();
  ctx.restore();
  let y = cardTop + cardPadding;
  tweets.forEach((tweet, index) => {
    const layout = layouts[index];
    const tweetTop = y;
    if (showProfile) {
      if (index < tweets.length - 1) {
        ctx.strokeStyle = mixColors($("#mainColor").value, $("#card").value, .68);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cardX + cardPadding + avatarSize / 2, y + avatarSize + 5);
        ctx.lineTo(cardX + cardPadding + avatarSize / 2, y + layout.height + 8);
        ctx.stroke();
      }
      if (avatarImage && avatarImage.complete && avatarImage.naturalWidth) circleImage(ctx, avatarImage, cardX + cardPadding, y, avatarSize);
      else {
        ctx.fillStyle = $("#mainColor").value;
        ctx.beginPath();
        ctx.arc(cardX + cardPadding + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = luminance($("#mainColor").value) < .45 ? "#ffffff" : "#2e2c29";
        ctx.font = `700 12px ${canvasFont}`;
        ctx.textAlign = "center";
        ctx.fillText("BU", cardX + cardPadding + avatarSize / 2, y + 27);
        ctx.textAlign = "left";
      }
      ctx.fillStyle = "#2e2c29";
      ctx.font = `700 ${fontSize}px ${canvasFont}`;
      ctx.fillText(tweet.name, contentX, y + 16);
      ctx.fillStyle = "#918d86";
      ctx.font = `${Math.max(10, fontSize - 2)}px ${canvasFont}`;
      const meta = tweet.handle + (showDate ? "  ·  " + tweet.date : "");
      ctx.fillText(meta, contentX, y + 36);
      y += layout.headerHeight;
    } else {
      y += layout.headerHeight;
    }
    ctx.fillStyle = "#2e2c29";
    ctx.font = `${fontSize}px ${canvasFont}`;
    wrapped[index].forEach((line) => {
      y += lineHeight;
      if (line) ctx.fillText(line, contentX, y);
    });
    const mediaTop = y;
    layout.mediaLayout.rows.forEach((row) => row.items.forEach((item) => {
      drawContainedImage(ctx, item.image, contentX + item.x, mediaTop + row.y, item.width, row.height);
    }));
    y = tweetTop + layout.height;
    if (index < tweets.length - 1) {
      ctx.strokeStyle = mixColors($("#card").value, "#6f675f", .14);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(contentX, y - 4);
      ctx.lineTo(width - cardX - cardPadding, y - 4);
      ctx.stroke();
    }
  });
  if (showLink) {
    const pillY = y + 8;
    ctx.fillStyle = mixColors($("#mainColor").value, $("#card").value, .78);
    ctx.beginPath();
    ctx.roundRect(cardX + cardPadding, pillY, width - (cardX + cardPadding) * 2, 36, 18);
    ctx.fill();
    ctx.fillStyle = "#716b64";
    ctx.font = `${Math.max(10, fontSize - 2)}px ${canvasFont}`;
    const maxLink = url.length > 72 ? url.slice(0, 69) + "…" : url;
    ctx.fillText("원문  " + maxLink, cardX + cardPadding + 16, pillY + 22);
  }
}

function renderImagePreview() {
  const capture = $("#imageCapture");
  const clone = view.cloneNode(true);
  clone.id = "imagePreviewContent";
  clone.hidden = false;
  const measuredWidth = Math.ceil(view.getBoundingClientRect().width);
  if (measuredWidth > 0) view.dataset.previewWidth = String(measuredWidth);
  const previewWidth = measuredWidth || Number(view.dataset.previewWidth) || Math.ceil($(".editor").getBoundingClientRect().width);
  clone.style.width = previewWidth + "px";
  clone.querySelectorAll(".tweet-actions,.tweet-media-tools,.thread-insert").forEach((item) => item.remove());
  clone.querySelectorAll("textarea").forEach((area) => {
    const text = document.createElement("div");
    text.className = "preview-text";
    text.textContent = area.value;
    area.replaceWith(text);
  });
  capture.replaceChildren(clone);
  capture.style.setProperty("--capture-angle", $("#gradientAngle").value + "deg");
  capture.style.setProperty("--capture-bg-1", $("#bg").value);
  capture.style.setProperty("--capture-bg-2", $("#bg2").value);
}

document.querySelectorAll("nav button[data-tab]").forEach((button) => button.onclick = () => {
  document.querySelectorAll("nav button[data-tab]").forEach((item) => item.classList.remove("on"));
  button.classList.add("on");
  const imageMode = button.dataset.tab === "image";
  if (imageMode) renderImagePreview();
  view.hidden = imageMode;
  $("#imageView").hidden = !imageMode;
  $("#rich").hidden = imageMode;
  $("#png").hidden = !imageMode;
});
async function sourceToDataUrl(source) {
  if (!source || source.startsWith("data:") || source.startsWith("blob:")) return source;
  try {
    const response = await fetch(source, { mode: "cors", cache: "force-cache" });
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

async function capturePreviewCanvas(element, scale = 2) {
  const width = Math.ceil(element.scrollWidth);
  const height = Math.ceil(element.scrollHeight);
  const clone = element.cloneNode(true);
  const originals = [element, ...element.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((original, index) => {
    const computed = getComputedStyle(original);
    for (const property of computed) {
      copies[index].style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
    }
  });
  const originalImages = [...element.querySelectorAll("img")];
  const clonedImages = [...clone.querySelectorAll("img")];
  await Promise.all(originalImages.map(async (image, index) => {
    const localSource = await sourceToDataUrl(image.currentSrc || image.src);
    if (localSource) clonedImages[index].src = localSource;
    else clonedImages[index].remove();
  }));
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const image = await new Promise((resolve, reject) => {
    const output = new Image();
    output.onload = () => resolve(output);
    output.onerror = () => reject(new Error("미리보기를 이미지로 변환하지 못했습니다."));
    output.src = svgUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

$("#png").onclick = async () => {
  const button = $("#png");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "PNG 만드는 중…";
  try {
    await document.fonts.ready;
    renderImagePreview();
    await Promise.all([...$("#imageCapture").querySelectorAll("img")].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
      image.onload = image.onerror = resolve;
    })));
    const canvas = await capturePreviewCanvas($("#imagePreviewContent"), 2);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG 변환에 실패했습니다.")), "image/png");
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.download = "backup-x-thread.png";
    anchor.href = objectUrl;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    button.textContent = "PNG 저장 완료";
  } catch (error) {
    console.error(error);
    button.textContent = "PNG 저장 실패";
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = originalLabel;
    }, 1200);
  }
};
["mainColor", "bg", "bg2", "card", "textSize", "font"].forEach((id) => {
  $("#" + id).oninput = () => {
    if (id === "mainColor" && $("#recommendColors").checked) { applyRecommendedColors(); return; }
    if ((id === "bg" || id === "bg2" || id === "card") && $("#recommendColors").checked) $("#recommendColors").checked = false;
    if (id === "bg") $("#gradientStart").value = $("#bg").value;
    if (id === "bg" || id === "bg2" || id === "card") updateGradientPreview();
    if (id === "mainColor") applySiteTheme($("#mainColor").value);
    if (id === "font" || id === "textSize") {
      applyTypography();
      view.querySelectorAll("textarea").forEach(resizeTweetArea);
    }
    if (id === "textSize") $("#textSizeValue").textContent = $("#textSize").value + "px";
    draw();
    if (!$("#imageView").hidden) renderImagePreview();
    scheduleSave();
  };
});
$("#url").addEventListener("input", () => { updateLoadButton(); scheduleSave(); });
loadWorkspace();
