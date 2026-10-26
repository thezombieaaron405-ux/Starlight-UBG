// Service worker for the Scramjet v2 controller.
// controller.sw.js sets up its own install/activate/message listeners;
// all we do here is send proxied requests to it.
importScripts("controller/controller.sw.js");

self.addEventListener("fetch", (event) => {
	if ($scramjetController.shouldRoute(event)) {
		event.respondWith($scramjetController.route(event));
	}
});
