const tweets = [
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:42", text: "언젠가 사라질지도 모르는 기록을 위해, 오늘의 이야기를 남겨 둡니다.\n\n이 타래는 BackUp-X의 예시예요." },
  { name: "백업하는 사람", handle: "@backup_note", date: "2026. 08. 19. 오후 5:44", text: "본문을 직접 수정한 뒤 티스토리용 서식이나 이미지로 저장할 수 있습니다." }
];
const $ = (selector) => document.querySelector(selector);
const view = $("#textView");
let avatarData = "";
let avatarImage = null;

function render() {
  view.innerHTML = tweets.map((tweet, index) => `
    <article class="tweet">
      <div class="avatar">${avatarData ? `<img src="${avatarData}" alt="프로필 사진">` : "BU"}</div>
      <div>
        <div class="meta"><b>${tweet.name}</b>${tweet.handle} · ${tweet.date}</div>
        <textarea data-i="${index}">${tweet.text}</textarea>
      </div>
    </article>`).join("");
  view.querySelectorAll("textarea").forEach((area) => {
    area.oninput = (event) => tweets[Number(event.target.dataset.i)].text = event.target.value;
  });
  view.style.fontFamily = $("#font").value;
}
render();

$("#avatarFile").onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    avatarData = reader.result;
    avatarImage = new Image();
    avatarImage.onload = () => { render(); draw(); };
    avatarImage.src = avatarData;
  };
  reader.readAsDataURL(file);
};

$("#load").onclick = () => {
  $("#status").textContent = /^https?:\/\/(x\.com|twitter\.com)\//i.test($("#url").value)
    ? "X API 연결 후 내 계정을 확인해 타래를 가져옵니다."
    : "올바른 내 X 트윗 링크를 입력해 주세요.";
};

function exportHtml() {
  const profile = $("#profile").checked;
  const date = $("#date").checked;
  const link = $("#link").checked;
  const url = $("#url").value || "https://x.com/";
  const font = $("#font").value;
  return `<section style="max-width:680px;margin:auto;font-family:'${font}',sans-serif;color:#3f382e">${tweets.map((tweet) => `
    <article style="padding:24px 0;border-bottom:1px solid #ddd">
      ${profile ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">${avatarData ? `<img src="${avatarData}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">` : ""}<div><b>${tweet.name}</b> <span style="color:#777">${tweet.handle}${date ? " · " + tweet.date : ""}</span></div></div>` : ""}
      <div style="white-space:pre-wrap;line-height:1.8">${tweet.text}</div>
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

function draw() {
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const width = 720;
  const padding = 48;
  const fontSize = Number($("#size").value);
  const font = $("#font").value;
  const showProfile = $("#profile").checked;
  const showDate = $("#date").checked;
  const showLink = $("#link").checked;
  const url = $("#url").value || "https://x.com/backup_note/status/example";
  ctx.font = `${fontSize}px "${font}"`;
  const wrapped = tweets.map((tweet) => wrapText(ctx, tweet.text, width - padding * 2 - 58));
  let height = 42;
  wrapped.forEach((lines) => height += (showProfile ? 58 : 0) + lines.length * fontSize * 1.7 + 42);
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
        ctx.fillStyle = "#c8b99f";
        ctx.beginPath();
        ctx.arc(padding + 22, y + 22, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3f382e";
        ctx.font = `700 12px "${font}"`;
        ctx.textAlign = "center";
        ctx.fillText("BU", padding + 22, y + 27);
        ctx.textAlign = "left";
      }
      ctx.fillStyle = "#3f382e";
      ctx.font = `700 14px "${font}"`;
      ctx.fillText(tweet.name, padding + 58, y + 17);
      ctx.fillStyle = "#776e61";
      ctx.font = `12px "${font}"`;
      const meta = tweet.handle + (showDate ? "  ·  " + tweet.date : "");
      ctx.fillText(meta, padding + 58, y + 37);
      y += 58;
    }
    ctx.fillStyle = "#3f382e";
    ctx.font = `${fontSize}px "${font}"`;
    wrapped[index].forEach((line) => {
      y += fontSize * 1.7;
      if (line) ctx.fillText(line, padding + (showProfile ? 58 : 0), y);
    });
    y += 28;
    if (index < tweets.length - 1) {
      ctx.strokeStyle = "#ded8cc";
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 26;
    }
  });
  if (showLink) {
    ctx.fillStyle = "#776e61";
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
$("#png").onclick = () => {
  draw();
  const anchor = document.createElement("a");
  anchor.download = "backup-x-thread.png";
  anchor.href = $("#canvas").toDataURL();
  anchor.click();
};
["bg", "card", "size", "profile", "date", "link", "font"].forEach((id) => {
  $("#" + id).oninput = () => {
    if (id === "font") view.style.fontFamily = $("#" + id).value;
    draw();
  };
});
