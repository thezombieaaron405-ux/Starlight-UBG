// Animated background scene drawn on <canvas id="sky">:
// purple night sky, planet, twinkling stars, a meteor shower,
// rock spires, blue mountains, and cliffs with glowing crystals.
//
// The sky and the landscape do not move, so each is drawn once into its
// own off-screen canvas (redrawn on resize). Every frame only the stars,
// meteors and crystal glow are drawn on top.
const Sky = (() => {
	const canvas = document.getElementById("sky");
	const ctx = canvas.getContext("2d");
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

	// Meteors fall down and to the left, at a shallow slant like the reference.
	const ANGLE = Math.PI * 0.81;
	const DIR_X = Math.cos(ANGLE);
	const DIR_Y = Math.sin(ANGLE);
	const PERP_X = -DIR_Y;
	const PERP_Y = DIR_X;

	// Crystal clusters, as fractions of the screen width and height.
	// They sit on the cliff edges and the valley floor.
	const CRYSTAL_SPOTS = [
		[0.065, 0.425], [0.1, 0.555], [0.15, 0.7], [0.27, 0.78],
		[0.935, 0.3], [0.9, 0.5], [0.845, 0.675], [0.73, 0.8],
		[0.56, 0.885],
	];

	let w = 0;
	let h = 0;
	let dpr = 1;
	let backLayer = null;
	let frontLayer = null;
	let stars = [];
	let crystals = [];
	let meteors = [];
	let running = false;
	let lastTime = 0;
	let nextMeteorIn = 0;

	// Small seeded random generator, so the landscape looks the same every time.
	function seeded(seed) {
		return () => {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function makeLayer() {
		const layer = document.createElement("canvas");
		layer.width = Math.floor(w * dpr);
		layer.height = Math.floor(h * dpr);
		const c = layer.getContext("2d");
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		return [layer, c];
	}

	// ---------- back layer: sky and planet ----------
	function drawBack() {
		const [layer, c] = makeLayer();

		const sky = c.createLinearGradient(0, 0, 0, h);
		sky.addColorStop(0, "#110a33");
		sky.addColorStop(0.3, "#2c1270");
		sky.addColorStop(0.55, "#6a27b0");
		sky.addColorStop(0.68, "#8e3cc9");
		sky.addColorStop(0.85, "#4a2aa6");
		sky.addColorStop(1, "#22186a");
		c.fillStyle = sky;
		c.fillRect(0, 0, w, h);

		// pink-purple glow along the horizon
		const glow = c.createRadialGradient(w * 0.5, h * 0.66, 0, w * 0.5, h * 0.66, Math.max(w, h) * 0.6);
		glow.addColorStop(0, "rgba(214, 110, 255, 0.35)");
		glow.addColorStop(1, "rgba(214, 110, 255, 0)");
		c.fillStyle = glow;
		c.fillRect(0, 0, w, h);

		// planet
		const pr = Math.max(48, Math.min(w * 0.095, h * 0.17));
		const px = w * 0.2;
		const py = h * 0.23;
		const halo = c.createRadialGradient(px, py, pr * 0.8, px, py, pr * 2);
		halo.addColorStop(0, "rgba(178, 90, 235, 0.25)");
		halo.addColorStop(1, "rgba(178, 90, 235, 0)");
		c.fillStyle = halo;
		c.fillRect(px - pr * 2, py - pr * 2, pr * 4, pr * 4);

		const body = c.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
		body.addColorStop(0, "#9a45c4");
		body.addColorStop(0.6, "#6a2499");
		body.addColorStop(1, "#4a1a7c");
		c.globalAlpha = 0.85;
		c.fillStyle = body;
		c.beginPath();
		c.arc(px, py, pr, 0, Math.PI * 2);
		c.fill();
		c.globalAlpha = 1;

		return layer;
	}

	// ---------- front layer: landscape ----------

	// Midpoint displacement: a bumpy ridge line made of n+1 heights.
	function ridge(rand, n, base, amp, rough = 0.55) {
		const ys = new Array(n + 1);
		ys[0] = base + (rand() - 0.5) * amp;
		ys[n] = base + (rand() - 0.5) * amp;
		let step = n;
		let scale = amp;
		while (step > 1) {
			const half = step / 2;
			for (let i = half; i < n; i += step) {
				ys[i] = (ys[i - half] + ys[i + half]) / 2 + (rand() - 0.5) * scale;
			}
			step = half;
			scale *= rough;
		}
		return ys;
	}

	function ridgePath(c, ys) {
		c.beginPath();
		c.moveTo(0, h);
		ys.forEach((y, i) => c.lineTo((i / (ys.length - 1)) * w, y));
		c.lineTo(w, h);
		c.closePath();
	}

	function strokeRidgeTop(c, ys, color, width) {
		c.beginPath();
		ys.forEach((y, i) => {
			const x = (i / (ys.length - 1)) * w;
			if (i === 0) c.moveTo(x, y);
			else c.lineTo(x, y);
		});
		c.strokeStyle = color;
		c.lineWidth = width;
		c.stroke();
	}

	// Darker shadow on the right side of each peak, for a rocky, faceted look.
	function shadePeaks(c, ys, color) {
		const n = ys.length - 1;
		c.fillStyle = color;
		for (let i = 1; i < n; i++) {
			if (ys[i] <= ys[i - 1] && ys[i] <= ys[i + 1]) {
				let j = i + 1;
				while (j < n && ys[j + 1] >= ys[j]) j++; // walk down to the next valley
				const x = (i / n) * w;
				const vx = (j / n) * w;
				c.beginPath();
				c.moveTo(x, ys[i]);
				for (let k = i + 1; k <= j; k++) c.lineTo((k / n) * w, ys[k]);
				c.lineTo(vx, ys[j] + (ys[j] - ys[i]) * 0.6);
				c.lineTo(x + (vx - x) * 0.25, ys[j] + (ys[j] - ys[i]) * 1.2);
				c.closePath();
				c.fill();
			}
		}
	}

	function drawSpires(c, rand) {
		const base = h * 0.68;
		const count = Math.round(8 + w / 120);
		for (let i = 0; i < count; i++) {
			const x = rand() * w;
			const bw = (0.008 + rand() * 0.016) * Math.max(w, 700);
			const top = h * (0.36 + rand() * 0.2);
			const tall = base - top;
			const grad = c.createLinearGradient(0, top, 0, base);
			grad.addColorStop(0, "rgba(78, 52, 176, 0.92)");
			grad.addColorStop(1, "rgba(66, 54, 178, 1)");
			c.fillStyle = grad;
			c.beginPath();
			c.moveTo(x - bw / 2, base);
			c.lineTo(x - bw * 0.38, top + tall * 0.45);
			c.lineTo(x - bw * 0.22, top + tall * 0.2);
			c.lineTo(x - bw * 0.06, top);
			c.lineTo(x + bw * 0.12, top + tall * 0.1);
			c.lineTo(x + bw * 0.18, top + tall * 0.3);
			c.lineTo(x + bw * 0.34, top + tall * 0.5);
			c.lineTo(x + bw / 2, base);
			c.closePath();
			c.fill();
		}
	}

	function cliff(c, points, rimColor) {
		const pts = points.map(([fx, fy]) => [fx * w, fy * h]);
		const isLeft = pts[0][0] === 0;
		const grad = c.createLinearGradient(isLeft ? 0 : w, 0, isLeft ? w * 0.3 : w * 0.7, 0);
		grad.addColorStop(0, "#0d0b30");
		grad.addColorStop(1, "#1d2878");
		c.fillStyle = grad;
		c.beginPath();
		pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
		c.closePath();
		c.fill();

		// lit rim along the cliff edge (skip the screen edges)
		c.beginPath();
		pts.slice(1, -1).forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
		c.strokeStyle = rimColor;
		c.lineWidth = 2;
		c.stroke();
	}

	function drawCrystal(c, x, y, s, rand) {
		// a few upward shards
		const shards = 3 + Math.floor(rand() * 3);
		for (let i = 0; i < shards; i++) {
			const ox = (rand() - 0.5) * s * 2.4;
			const tall = s * (1.2 + rand() * 1.6);
			const half = s * (0.3 + rand() * 0.25);
			const lean = (rand() - 0.5) * s * 0.8;
			const grad = c.createLinearGradient(x + ox, y - tall, x + ox, y);
			grad.addColorStop(0, "#d8ffff");
			grad.addColorStop(1, "#2fc8ff");
			c.fillStyle = grad;
			c.beginPath();
			c.moveTo(x + ox - half, y);
			c.lineTo(x + ox + lean, y - tall);
			c.lineTo(x + ox + half, y);
			c.lineTo(x + ox, y + half * 0.6);
			c.closePath();
			c.fill();
		}
	}

	function drawFront() {
		const [layer, c] = makeLayer();
		const rand = seeded(7);

		drawSpires(c, rand);

		// far purple mountains
		const far = ridge(rand, 64, h * 0.63, h * 0.16, 0.62);
		ridgePath(c, far);
		c.fillStyle = "rgba(88, 60, 186, 0.95)";
		c.fill();
		shadePeaks(c, far, "rgba(40, 20, 110, 0.35)");

		// middle blue mountains
		const mid = ridge(rand, 64, h * 0.71, h * 0.15, 0.6);
		ridgePath(c, mid);
		const midGrad = c.createLinearGradient(0, h * 0.6, 0, h);
		midGrad.addColorStop(0, "#3d4fc4");
		midGrad.addColorStop(1, "#1a2170");
		c.fillStyle = midGrad;
		c.fill();
		shadePeaks(c, mid, "rgba(14, 18, 80, 0.4)");
		strokeRidgeTop(c, mid, "rgba(120, 150, 255, 0.55)", 1.5);

		// valley floor
		const floor = ridge(rand, 64, h * 0.82, h * 0.06, 0.62);
		ridgePath(c, floor);
		const floorGrad = c.createLinearGradient(0, h * 0.78, 0, h);
		floorGrad.addColorStop(0, "#2c40b8");
		floorGrad.addColorStop(1, "#10164e");
		c.fillStyle = floorGrad;
		c.fill();
		strokeRidgeTop(c, floor, "rgba(110, 140, 255, 0.45)", 1.5);

		// lighter path down the middle of the valley, kept inside the floor shape
		c.save();
		ridgePath(c, floor);
		c.clip();
		const path = c.createRadialGradient(w * 0.5, h * 0.95, 0, w * 0.5, h * 0.95, Math.max(w * 0.3, h * 0.25));
		path.addColorStop(0, "rgba(120, 150, 255, 0.35)");
		path.addColorStop(1, "rgba(120, 150, 255, 0)");
		c.fillStyle = path;
		c.fillRect(0, 0, w, h);
		c.restore();

		// side cliffs
		cliff(c, [
			[0, 1], [0, 0.38], [0.04, 0.36], [0.075, 0.42], [0.062, 0.48],
			[0.1, 0.555], [0.093, 0.62], [0.15, 0.7], [0.2, 0.74],
			[0.27, 0.78], [0.3, 0.87], [0.24, 1],
		], "rgba(90, 120, 240, 0.7)");
		cliff(c, [
			[1, 1], [1, 0.12], [0.965, 0.16], [0.935, 0.3], [0.95, 0.38],
			[0.9, 0.5], [0.885, 0.6], [0.845, 0.675], [0.8, 0.73],
			[0.73, 0.8], [0.7, 0.9], [0.77, 1],
		], "rgba(90, 120, 240, 0.7)");

		// crystals
		const size = Math.max(5, Math.min(w, h) * 0.014);
		crystals = CRYSTAL_SPOTS.map(([fx, fy]) => {
			const x = fx * w;
			const y = fy * h;
			drawCrystal(c, x, y, size, rand);
			return { x, y: y - size, r: size * 6, speed: 0.6 + rand() * 0.8, phase: rand() * Math.PI * 2 };
		});

		return layer;
	}

	// ---------- stars and meteors ----------
	function makeStars() {
		const rand = seeded(42);
		const count = Math.round((w * h) / 4500);
		stars = Array.from({ length: count }, () => {
			const roll = rand();
			return {
				x: rand() * w,
				y: rand() * h * 0.72,
				r: rand() < 0.08 ? rand() * 1.2 + 1.3 : rand() * 1 + 0.3,
				color: roll < 0.15 ? "#8ff6ff" : roll < 0.25 ? "#ffb3f0" : "#ffffff",
				base: rand() * 0.5 + 0.4,
				speed: rand() * 1.5 + 0.5,
				phase: rand() * Math.PI * 2,
			};
		});
	}

	function spawnMeteor() {
		const scale = Math.min(1.4, Math.max(0.6, Math.min(w, h) / 700));
		meteors.push({
			x: w * (0.15 + Math.random() * 1.1),
			y: -h * 0.05 - Math.random() * h * 0.1,
			speed: (Math.random() * 300 + 450) * scale,
			length: (Math.random() * 150 + 110) * scale,
			width: (Math.random() * 1.5 + 2) * scale,
			life: 0,
		});
	}

	function drawStars(time) {
		const t = time / 1000;
		for (const s of stars) {
			const twinkle = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
			ctx.globalAlpha = s.base * twinkle;
			ctx.fillStyle = s.color;
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
			ctx.fill();
			if (s.r > 1.3) {
				// soft halo on the bigger stars
				ctx.globalAlpha *= 0.25;
				ctx.beginPath();
				ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
	}

	function drawMeteors() {
		const horizon = h * 0.7;
		ctx.globalCompositeOperation = "lighter";
		for (const m of meteors) {
			// fade in at the start, fade out as it nears the mountains
			const fade = Math.min(1, m.life * 5) * Math.max(0, Math.min(1, (horizon - m.y) / (h * 0.2)));
			if (fade <= 0) continue;
			const tailX = m.x - DIR_X * m.length;
			const tailY = m.y - DIR_Y * m.length;

			// tapered tail: wide at the head, a point at the end
			const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
			grad.addColorStop(0, `rgba(255, 240, 255, ${fade})`);
			grad.addColorStop(0.12, `rgba(255, 120, 230, ${0.85 * fade})`);
			grad.addColorStop(0.5, `rgba(200, 80, 240, ${0.35 * fade})`);
			grad.addColorStop(1, "rgba(160, 60, 230, 0)");
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.moveTo(m.x + PERP_X * m.width, m.y + PERP_Y * m.width);
			ctx.lineTo(tailX, tailY);
			ctx.lineTo(m.x - PERP_X * m.width, m.y - PERP_Y * m.width);
			ctx.closePath();
			ctx.fill();

			// glowing head
			const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.width * 5);
			glow.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
			glow.addColorStop(0.25, `rgba(255, 140, 235, ${0.7 * fade})`);
			glow.addColorStop(1, "rgba(255, 100, 230, 0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(m.x, m.y, m.width * 5, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalCompositeOperation = "source-over";
	}

	function drawCrystalGlow(time) {
		const t = time / 1000;
		ctx.globalCompositeOperation = "lighter";
		for (const cr of crystals) {
			const pulse = reduceMotion ? 0.8 : 0.6 + 0.4 * Math.sin(t * cr.speed + cr.phase);
			const g = ctx.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, cr.r);
			g.addColorStop(0, `rgba(110, 245, 255, ${0.55 * pulse})`);
			g.addColorStop(0.4, `rgba(60, 200, 255, ${0.18 * pulse})`);
			g.addColorStop(1, "rgba(60, 200, 255, 0)");
			ctx.fillStyle = g;
			ctx.fillRect(cr.x - cr.r, cr.y - cr.r, cr.r * 2, cr.r * 2);
		}
		ctx.globalCompositeOperation = "source-over";
	}

	function drawFrame(time) {
		ctx.clearRect(0, 0, w, h);
		ctx.drawImage(backLayer, 0, 0, w, h);
		drawStars(time);
		drawMeteors(); // drawn before the landscape so they pass behind the mountains
		ctx.drawImage(frontLayer, 0, 0, w, h);
		drawCrystalGlow(time);
	}

	function tick(time) {
		if (!running) return;
		const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
		lastTime = time;

		nextMeteorIn -= dt;
		if (nextMeteorIn <= 0) {
			spawnMeteor();
			nextMeteorIn = Math.random() * 0.45 + 0.15;
		}
		for (const m of meteors) {
			m.x += DIR_X * m.speed * dt;
			m.y += DIR_Y * m.speed * dt;
			m.life += dt;
		}
		meteors = meteors.filter((m) => m.y < h * 0.75 && m.x + m.length > 0);

		drawFrame(time);
		requestAnimationFrame(tick);
	}

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		w = window.innerWidth;
		h = window.innerHeight;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		backLayer = drawBack();
		frontLayer = drawFront();
		makeStars();
		if (!running) drawFrame(0);
	}

	function start() {
		if (running || reduceMotion) return;
		running = true;
		lastTime = 0;
		requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		meteors = [];
		drawFrame(0);
	}

	let resizeQueued = false;
	window.addEventListener("resize", () => {
		if (resizeQueued) return;
		resizeQueued = true;
		requestAnimationFrame(() => {
			resizeQueued = false;
			resize();
		});
	});
	resize();

	return { start, stop };
})();
