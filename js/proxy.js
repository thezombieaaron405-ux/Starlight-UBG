// Starts Scramjet v2 in the browser. Works from a sub-folder
// (like username.github.io/repo-name/) because every path is
// built from where this file lives instead of from "/".

const BASE = new URL("../", document.currentScript.src);
const BASE_PATH = BASE.pathname; // e.g. "/repo-name/" or "/"

const DEFAULT_SETTINGS = {
	// Public demo server run by Mercury Workshop (the Scramjet authors).
	// It is rate limited. Put your own Wisp server here for real use.
	wisp: "wss://wisp.mercurywork.shop/",
	transport: "libcurl", // "libcurl" or "epoxy"
	searchEngine: "https://duckduckgo.com/?q=%s",
};

const Settings = {
	load() {
		try {
			const saved = JSON.parse(localStorage.getItem("ug-settings") || "{}");
			return { ...DEFAULT_SETTINGS, ...saved };
		} catch {
			return { ...DEFAULT_SETTINGS };
		}
	},
	save(values) {
		try {
			localStorage.setItem("ug-settings", JSON.stringify(values));
		} catch {
			// private mode, nothing to do
		}
	},
	reset() {
		try {
			localStorage.removeItem("ug-settings");
		} catch {
			// private mode, nothing to do
		}
	},
};

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const s = document.createElement("script");
		s.src = src;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("Could not load " + src));
		document.head.appendChild(s);
	});
}

async function registerServiceWorker() {
	if (!("serviceWorker" in navigator)) {
		throw new Error(
			"This browser does not support service workers (or the page is not on https)."
		);
	}
	const reg = await navigator.serviceWorker.register(BASE_PATH + "sw.js", {
		scope: BASE_PATH,
		updateViaCache: "none",
	});
	await navigator.serviceWorker.ready;
	const sw = reg.active || reg.waiting || reg.installing;
	if (sw.state !== "activated") {
		await new Promise((resolve) => {
			sw.addEventListener("statechange", function onChange() {
				if (sw.state === "activated") {
					sw.removeEventListener("statechange", onChange);
					resolve();
				}
			});
		});
	}
	return sw;
}

function makeTransport(settings) {
	if (settings.transport === "epoxy") {
		// epoxy-transport 3.x only exports its class as "default"
		return new EpoxyTransport.default({ wisp: settings.wisp });
	}
	return new LibcurlTransport.LibcurlClient({ wisp: settings.wisp });
}

let controllerPromise = null;

// Same steps as @mercuryworkshop/proxy-bootstrap's loadRest(),
// but with files served from this site and a Wisp server you choose.
function startProxy() {
	if (controllerPromise) return controllerPromise;
	controllerPromise = (async () => {
		const settings = Settings.load();
		const sw = await registerServiceWorker();

		await loadScript(BASE_PATH + "scram/scramjet.js");
		await loadScript(BASE_PATH + "controller/controller.api.js");
		await loadScript(BASE_PATH + "scram/scramjet-utils.js");
		await loadScript(
			BASE_PATH +
				(settings.transport === "epoxy"
					? "transport/epoxy.js"
					: "transport/libcurl.js")
		);

		const { Controller } = $scramjetController;
		const controller = new Controller({
			serviceworker: sw,
			transport: makeTransport(settings),
			config: {
				prefix: BASE_PATH + "~/sj/",
				scramjetPath: BASE_PATH + "scram/scramjet.js",
				injectPath: BASE_PATH + "controller/controller.inject.js",
				wasmPath: BASE_PATH + "scram/scramjet.wasm",
			},
		});
		await controller.wait();
		return controller;
	})();
	controllerPromise.catch(() => {
		controllerPromise = null;
	});
	return controllerPromise;
}

// Turns what the user typed into a URL: a full URL, a bare domain,
// or a search.
function toUrl(input, searchEngine) {
	const text = input.trim();
	try {
		const url = new URL(text);
		if (url.protocol === "http:" || url.protocol === "https:") return url.href;
	} catch {
		// not a full URL
	}
	if (/^[^\s]+\.[^\s]{2,}$/.test(text)) {
		return "https://" + text;
	}
	return searchEngine.replace("%s", encodeURIComponent(text));
}
