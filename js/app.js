const $ = (id) => document.getElementById(id);

// ---------- tabs ----------
function showTab(name) {
	document.querySelectorAll(".tab").forEach((b) => {
		b.classList.toggle("active", b.dataset.tab === name);
	});
	document.querySelectorAll(".panel").forEach((p) => {
		p.classList.toggle("active", p.id === "tab-" + name);
	});
}
document.querySelectorAll(".tab").forEach((b) => {
	b.addEventListener("click", () => showTab(b.dataset.tab));
});

// ---------- viewer ----------
const viewer = $("viewer");
const iframe = $("v-frame");
const urlText = $("v-url");
const statusBox = $("v-status");
let frame = null; // Scramjet Frame, made the first time the proxy is used

function setStatus(message, details, isError) {
	if (!message) {
		statusBox.hidden = true;
		return;
	}
	statusBox.hidden = false;
	statusBox.className = "status" + (isError ? " error" : "");
	statusBox.innerHTML = "";
	const p = document.createElement("p");
	p.textContent = message;
	statusBox.appendChild(p);
	if (details) {
		const pre = document.createElement("pre");
		pre.textContent = details;
		statusBox.appendChild(pre);
	}
}

function openViewer() {
	viewer.hidden = false;
	document.body.style.overflow = "hidden";
}

function closeViewer() {
	viewer.hidden = true;
	document.body.style.overflow = "";
	iframe.src = "about:blank";
	urlText.textContent = "";
	setStatus(null);
}

function withTimeout(promise, ms, message) {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
	]);
}

async function getFrame() {
	if (frame) return frame;
	const controller = await withTimeout(
		startProxy(),
		30000,
		"The proxy took too long to start."
	);
	frame = controller.createFrame(iframe, {
		plugins: [
			new $scramjetUtils.HttpCachePlugin(),
			new $scramjetUtils.UrlWatcherPlugin((url) => {
				urlText.textContent = url;
			}),
			new $scramjetUtils.CatchEscapedLinksPlugin(
				(url) => new URL("?goto=" + encodeURIComponent(url.href), BASE)
			),
		],
	});
	return frame;
}

async function openProxied(url) {
	openViewer();
	setStatus(null);
	urlText.textContent = "Loading " + url + " …";
	try {
		const f = await getFrame();
		f.go(url);
	} catch (err) {
		urlText.textContent = url;
		setStatus(
			"Could not start the proxy.",
			err.message +
				"\n\nCheck the Wisp server in Settings. The site must be served over https.",
			true
		);
	}
}

function openLocal(path) {
	openViewer();
	setStatus(null);
	urlText.textContent = path;
	iframe.src = path;
}

$("v-close").addEventListener("click", closeViewer);
$("v-back").addEventListener("click", () => iframe.contentWindow?.history.back());
$("v-forward").addEventListener("click", () => iframe.contentWindow?.history.forward());
$("v-reload").addEventListener("click", () => iframe.contentWindow?.location.reload());
$("v-full").addEventListener("click", () => {
	const el = $("v-frame");
	if (el.requestFullscreen) el.requestFullscreen();
});
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && !viewer.hidden && !document.fullscreenElement) {
		closeViewer();
	}
});

// ---------- games ----------
function card(game, tag, onClick) {
	const b = document.createElement("button");
	b.className = "card";
	b.dataset.name = game.name.toLowerCase();
	b.innerHTML = '<span class="icon"></span><span class="name"></span><span class="tag"></span>';
	b.querySelector(".icon").textContent = game.icon;
	b.querySelector(".name").textContent = game.name;
	b.querySelector(".tag").textContent = tag;
	b.addEventListener("click", onClick);
	return b;
}

for (const g of LOCAL_GAMES) {
	$("local-games").appendChild(card(g, "on this site", () => openLocal(g.path)));
}
for (const g of WEB_GAMES) {
	$("web-games").appendChild(
		card(g, new URL(g.url).hostname.replace(/^www\./, ""), () => openProxied(g.url))
	);
}

$("game-search").addEventListener("input", (e) => {
	const q = e.target.value.trim().toLowerCase();
	document.querySelectorAll(".card").forEach((c) => {
		c.hidden = q !== "" && !c.dataset.name.includes(q);
	});
});

// ---------- browse ----------
$("browse-form").addEventListener("submit", (e) => {
	e.preventDefault();
	const text = $("browse-input").value;
	if (!text.trim()) return;
	openProxied(toUrl(text, Settings.load().searchEngine));
});

// ---------- settings ----------
const settingsForm = $("settings-form");

function fillSettings() {
	const s = Settings.load();
	settingsForm.wisp.value = s.wisp;
	settingsForm.transport.value = s.transport;
	settingsForm.searchEngine.value = s.searchEngine;
}
fillSettings();

settingsForm.addEventListener("submit", (e) => {
	e.preventDefault();
	const wisp = settingsForm.wisp.value.trim();
	if (!/^wss?:\/\//.test(wisp)) {
		$("settings-status").textContent = "The Wisp server must start with wss:// or ws://";
		return;
	}
	Settings.save({
		wisp,
		transport: settingsForm.transport.value,
		searchEngine: settingsForm.searchEngine.value.trim() || DEFAULT_SETTINGS.searchEngine,
	});
	$("settings-status").textContent = "Saved. Reloading…";
	setTimeout(() => location.reload(), 400);
});

$("settings-reset").addEventListener("click", () => {
	Settings.reset();
	fillSettings();
	$("settings-status").textContent = "Reset to defaults. Reloading…";
	setTimeout(() => location.reload(), 400);
});

// ---------- ?goto= links (from pages that tried to open a new tab) ----------
const gotoUrl = new URL(location.href).searchParams.get("goto");
if (gotoUrl) {
	history.replaceState(null, "", location.pathname);
	openProxied(gotoUrl);
}
