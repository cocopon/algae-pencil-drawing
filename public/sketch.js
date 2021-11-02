/*! Algae Pencil Drawing (c) 2016 cocopon, licensed under the CC-BY-NC-SA 4.0. */
const DEBUG = location.search.match('debug');
const PARAMS = {
	amp: {
		sub: 0.17,
	},
	freq: {
		main: 2,
		sub: 2230,
	},
	count: 36000,
	darkness: {
		min: 0.97,
		max: 1,
	},
	interval: 8000,
	tilt: 0.7,
	bokeh: {
		enabled: true,
		maxSize: 80,
		linear: true,
		sigma: 1.8,
	},
};
const CAMERA = {
	pos: {
		x: 0.5,
		y: 0.5,
		angle: 2.4,
		zoom: 1,
	},
	focus: {
		x: 0.5,
		y: 0.5,
		angle: 0,
		length: 0,
	},
};
let start = (new Date()).getTime();
let up = true;
let fps = null;

function initDebug() {
	const pane = new Tweakpane.Pane({title: 'Parameters'});
	pane.registerPlugin(TweakpaneEssentialsPlugin);

	fps = pane.addBlade({view: 'fpsgraph', label: 'fps', lineCount: 1});

	pane.addInput(PARAMS, 'count', {min: 10000, max: 100000, step: 1});
	pane.addButton({title: 'Refresh'}).on('click', () => {
		refreshAlga();
		pane.refresh();
	});

	const tabs = pane.addTab({
		pages: [
			{title: 'Shape'},
			{title: 'Camera'},
		],
	});

	const ts = tabs.pages[0];
	const ff = ts.addFolder({title: 'Frequency'});
	ff.addInput(PARAMS.freq, 'main', {min: 2, max: 10, step: 2});
	ff.addInput(PARAMS.freq, 'sub', {min: 100, max: 5000, step: 1});
	const fa = ts.addFolder({title: 'Amplitude'});
	fa.addInput(PARAMS.amp, 'sub', {min: 0, max: 0.4});

	const tc = tabs.pages[1];
	tc.addInput(PARAMS, 'darkness', {min: 0.8, max: 1});
	tc.addInput(PARAMS, 'tilt', {min: 0, max: 2});
	tc.addInput(CAMERA, 'pos', {
		x: {min: 0, max: 1},
		y: {min: 0, max: 1},
	});
	tc.addInput(CAMERA.pos, 'angle', {min: 0, max: TWO_PI});
	tc.addInput(CAMERA.pos, 'zoom', {min: 1, max: 2});
	const fb = tc.addFolder({title: 'Bokeh'});
	fb.addInput(PARAMS.bokeh, 'enabled');
	fb.addInput(PARAMS.bokeh, 'maxSize', {min: 1, max: 400, label: 'bokeh'});
	fb.addInput(PARAMS.bokeh, 'linear');
	fb.addInput(CAMERA, 'focus', {
		x: {min: 0, max: 1},
		y: {min: 0, max: 1},
	});
}

function drawDot(ox, oy, bokeh) {
	if (ox < 0 || ox >= width || oy < 0 || oy >= height) {
		return;
	}

	const sz = map(bokeh, 0, 1, 1, PARAMS.bokeh.maxSize);
	const count = map(bokeh, 0, 1, 5, 10);
	const al = map(pow(bokeh, 1), 0, 1, PARAMS.darkness.min, PARAMS.darkness.max);

	for (let i = 0; i < count; i++) {
		const da = random(TWO_PI);
		const dl = random() * sz;
		const x = round(ox + cos(da) * dl);
		const y = round(oy + sin(da) * dl);
		if (x < 0 || x >= width || y < 0 || y >= height) {
			continue;
		}

		const ofs = y * width * 4 + x * 4;
		pixels[ofs] *= al;
		pixels[ofs + 1] *= al;
		pixels[ofs + 2] *= al * 1.002;
	}
}

function drawAlga(camPos, getBokeh) {
	const sz = min(width, height) * camPos.zoom;

	loadPixels();
	for (let i = 0; i < PARAMS.count; i++) {
		const ip = i / PARAMS.count;
		// main wave
		const ma = ip * 2 * PI;
		const ml = sin(camPos.angle + PARAMS.freq.main * ma) * sz;
		const mx = cos(ma) * ml;
		const my = sin(ma) * ml;
		// sub wave
		const sa = ma + PI / 2;
		const sl = sin(PARAMS.freq.sub * ma) * sz * PARAMS.amp.sub;
		const sx = cos(sa) * sl;
		const sy = sin(sa) * sl;

		const ca = atan2(my + sy, mx + sx);
		const cl = dist(0, 0, mx + sx, my + sy);
		const x = camPos.x * width + cos(ca) * cl;
		const y = camPos.y * height + sin(ca) * cl * PARAMS.tilt;
		drawDot(x, y, getBokeh(x, y));
	}
	updatePixels();
}

function setup() {
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
	noStroke();
	background(0);
	frameRate(30);

	if (DEBUG) {
		initDebug();
	} else {
		refreshAlga();
	}
}

function ease(t) {
	return pow((1 - cos(t * PI)) / 2, 1);
}

function updateFocusPosition(t) {
	if (DEBUG) {
		return;
	}
	if (mouseIsPressed) {
		CAMERA.focus.x = mouseX / width;
		CAMERA.focus.y = mouseY / height;
		return;
	}

	const fl = map(ease(t), 0, 1, 0, CAMERA.focus.length);
	CAMERA.focus.x = CAMERA.pos.x + cos(CAMERA.focus.angle) * fl;
	CAMERA.focus.y = CAMERA.pos.y + sin(CAMERA.focus.angle) * fl;
}

function draw() {
	fps?.begin();

	const now = (new Date()).getTime();
	if (mouseIsPressed) {
		start = now - PARAMS.interval * 0.2;
	}
	const t = DEBUG ? 0.5 : (now - start) / PARAMS.interval;
	updateFocusPosition(t);
	if (t >= 1) {
		start = now;
		refreshAlga();
	}

	if (!DEBUG) {
		PARAMS.bokeh.linear = !mouseIsPressed;
	}

	fill(255, 30);
	rect(0, 0, width, height);

	drawAlga(CAMERA.pos, (x, y) => {
		if (!PARAMS.bokeh.enabled) {
			return 0;
		}

		const fx = CAMERA.focus.x * width;
		const fy = CAMERA.focus.y * height;
		const d = PARAMS.bokeh.linear ?
			dist(0, y, 0, fy) * 2 :
			dist(x, y, fx, fy);
		const td = pow(cos(t * PI), 48) * 2000;
		return 1 - exp(-pow((d + td) * 0.002, 2) / (2 * PARAMS.bokeh.sigma * PARAMS.bokeh.sigma));
	});

	fps?.end();
}

function refreshAlga() {
	const fmp = random(1);
	PARAMS.freq.main = floor(map(fmp, 0, 1, 1, 4)) * 2;
	PARAMS.freq.sub = floor(random(1000, 5000));
	PARAMS.amp.sub = random(0.05, map(fmp, 0, 1, 0.4, 0.08));

	CAMERA.pos.x = random(0.1, 0.9);
	CAMERA.pos.y = 0.5 + random(0.2, 0.4) * (up ? -1 : +1);
	CAMERA.pos.angle = random(TWO_PI);
	CAMERA.pos.zoom = random(1, 1.2);
	CAMERA.focus.angle = atan2(0.5 - CAMERA.pos.y, 0.5 - CAMERA.pos.x);
	CAMERA.focus.length = sqrt(2) * random(0.5, 1);

	up = !up;
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}

function touchStarted() {
	if (!DEBUG) {
		return false;
	}
}
