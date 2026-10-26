// Games that are files on this site. They load directly (no proxy).
const LOCAL_GAMES = [
	{ name: "Snake", icon: "🐍", path: "games/snake.html" },
	{ name: "2048", icon: "🔢", path: "games/2048.html" },
	{ name: "Flappy Block", icon: "🐤", path: "games/flappy.html" },
	{ name: "Breakout", icon: "🧱", path: "games/breakout.html" },
];

// Other websites, opened through Scramjet. Add or remove freely.
// Each of these loaded through the default Wisp server when tested (Oct 2026).
// Left out because they failed then: poki.com and paper-io.com (Scramjet sent
// them to "/undefined"), krunker.io and agar.io (the sites refused the Wisp
// server with "Access denied" / 403).
const WEB_GAMES = [
	{ name: "CrazyGames", icon: "🤪", url: "https://www.crazygames.com/" },
	{ name: "Coolmath Games", icon: "➗", url: "https://www.coolmathgames.com/" },
	{ name: "Slither.io", icon: "🪱", url: "https://slither.io/" },
	{ name: "Chess", icon: "♟️", url: "https://lichess.org/" },
	{ name: "Little Alchemy 2", icon: "⚗️", url: "https://littlealchemy2.com/" },
	{ name: "Wordle", icon: "🟩", url: "https://www.nytimes.com/games/wordle/index.html" },
	{ name: "Chrome Dino", icon: "🦖", url: "https://chromedino.com/" },
];
