#!/usr/bin/env node
import { terminal as term, ScreenBuffer } from "terminal-kit";
import { Screen } from "./termutils";
import { ChildProcess, spawn } from "child_process";

// last displayed jobs
let lastJobs: any[] = [];
let lastText: string = '';
let refreshInt: number = 5000;
let interval: NodeJS.Timeout;
let refresh: boolean = true;
let inRefresh: boolean = false;

async function terminate() {
	await promiseWait(500);
	// term.brightBlack( 'About to exit...\n' );
	term.grabInput(false);
	term.fullscreen(false);
	term.hideCursor(false);

	// Add a 100ms delay, so the terminal will be ready when the process effectively exit, preventing bad escape sequences drop
	setTimeout(() => { console.log("EXIT!!!"); process.exit(0); }, 200);
}

function randomNumber(start: number, end: number) {
	var diff = end - start;
	return Math.floor(Math.random()*diff + start);
}

function generateRandomJobs() {
	let lines: any[] = [];
	const max: number = Math.floor(Math.random() * 10) + 2;
	for (let i = 0; i < max; i++) {
		const rand = randomNumber(100, 999);
		const job: {[key: string]: string | undefined} = {
			"jobid":"JOB00" + rand,
			"jobname":"TSJOB" + rand,
			"owner":"IBMUSER",
			"status": ["OUTPUT", "INPUT", "ACTIVE"].slice(Math.floor(Math.random() * 3)).shift(),
			"type":"JOB",
			"class":"A",
			"retcode":"CC " + ["0000", "0004", "0008", "0012"].slice(Math.floor(Math.random() * 4)).shift()
		};
		lines.push(job);
	}
	return lines;
}

function promiseWait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function fillScreenWithJobs(screen: Screen, jobs: any[], message?: string) {
	screen.clear();

	const header = [ " JOBID",
					" JOBNAME",
					" OWNER",
					" STATUS",
					" TYPE",
					" CLASS",
					" RETCODE" ];

	screen.setColor(Screen.aGreen);
	screen.drawTable(7, true, true);
	screen.drawBorder("zMonitor");

	screen.setColor(Screen.aGreen);
	screen.putInHeader(1, header);

	let i = 1;
	screen.setColor(Screen.aWhite);
	for (const job of jobs) {
		screen.putInCell(1, i, job['jobid']);
		screen.putInCell(2, i, job['jobname']);
		screen.putInCell(3, i, job['owner']);
		if (job['status'] == 'ACTIVE') {
			screen.setColor(Screen.aBYellow);
			screen.putInCell(4, i, job['status']);
			screen.setColor(Screen.aWhite);
		} else {
			screen.putInCell(4, i, job['status']);
		}
		screen.putInCell(5, i, job['type']);
		screen.putInCell(6, i, job['class']);
		screen.putInCell(7, i, job['retcode']);
		i++;
	}
	lastJobs = jobs;

	if (message) {
		const msgScreen = new Screen(screen, term.width, 3);
		msgScreen.drawBorder(undefined, "-:");
		msgScreen.putIn(message, Screen.aBYellow, true);
		msgScreen.draw({ x: 0, y: term.height - 3, dst: screen.getBuffer() });
	}

}

function renderScreenSyslog(screen: Screen, syslog: string, message?: string) {
	screen.clear();

	screen.setColor(Screen.aBGreen);
	screen.drawBorder("zMonitor");

	screen.setColor(Screen.aBGreen);

	screen.putIn(syslog);

	if (message) {
		const msgScreen = new Screen(screen, term.width, 3);
		msgScreen.drawBorder(undefined, "-:");
		msgScreen.putIn(message, Screen.aBYellow, true);
		msgScreen.draw({ x: 0, y: term.height - 3, dst: screen.getBuffer() });
	}
}

function runZoweUSS(cmd: string): Promise<string> {
	return new Promise<string>((resolve, reject) =>{
		let zoweProcess: ChildProcess;
		zoweProcess = spawn('zowe', ['uss', 'issue', 'ssh', cmd], {shell: true});

		let stderr: Buffer[] = [];
		let stdout: Buffer[] = [];
		if (zoweProcess.stderr) {
			zoweProcess.stderr.on('data', (data) => {
				stderr.push(data);
			});
		}
		if (zoweProcess.stdout) {
			zoweProcess.stdout.on('data', (data) => {
				stdout.push(data);
			});
		}
		zoweProcess.on("close", (code, signal) => {
			// console.log("close");
			if (stdout.length > 0) resolve(Buffer.concat(stdout).toString());
		});
		zoweProcess.on("exit", (code, signal) => {
			// console.log("exit");
			if (stdout.length > 0) resolve(Buffer.concat(stdout).toString());
		});
		zoweProcess.on("error", (err) => {
			// console.log("error " + err);
			reject(err + "\n" + Buffer.concat(stderr).toString());
		});
	});
}

function updateScreen(screen: Screen) {
// async function updateScreen(screen: Screen) {
	// if (refresh) {
	// 	await drawSyslogScreen(screen);
	// } else {
	// 	await promiseWait(refreshInt);
	// }
	// await updateScreen(screen);
	clearInterval(interval);
	interval = setInterval(() => {
		drawSyslogScreen(screen);
		// const jobs = generateRandomJobs();
		// fillScreenWithJobs(screen, jobs);
		// screen.draw();
	}, refreshInt);
}

async function drawSyslogScreen(screen: Screen) {
	try {
		lastText = await runZoweUSS('zsyslog');
		renderScreenSyslog(screen, lastText);
	} catch (err) {
		renderScreenSyslog(screen, lastText, err.message);
	}
	screen.draw();
}

async function main() {
	// swap to alternate screen buffer (in terminal)
	// it helps to retain what was in terminal beffore
	term.fullscreen(true);
	term.hideCursor(true);

	let screen = new Screen(term, term.width, term.height);
	renderScreenSyslog(screen, "getting syslog...");
	screen.draw();

	// setup refresh of screen/data
	refresh = true;
	updateScreen(screen);

	// setup key handling
	term.grabInput(true);

	term.on('key', (name: any, matches: any, data: any) => {
		// terminate
		if (matches.indexOf('CTRL_C') >= 0 ) {
			clearInterval(interval);
			refresh = false;
			renderScreenSyslog(screen, lastText, 'CTRL-C received... terminating...');
			// fillScreenWithJobs(screen, lastJobs, 'CTRL-C received...');
			screen.draw();
			terminate();
		}

		// change refresh interval
		if (matches.indexOf('CTRL_R') >= 0 ) {
			if (refreshInt == 10000) refreshInt = 5000;
			else if (refreshInt == 5000) refreshInt = 2000;
			else refreshInt = 10000;
			renderScreenSyslog(screen, lastText, `Refresh interval set to ${refreshInt}ms`);
			// fillScreenWithJobs(screen, lastJobs, 'CTRL-R received... asking terminal some information...');
			term.requestCursorLocation();
			term.requestScreenSize();
			screen.draw();
			updateScreen(screen);
		}

		// stop/start refresh
		if (matches.indexOf('CTRL_S') >= 0 ) {
			if (refresh) {
				refresh = false;
				clearInterval(interval);
				renderScreenSyslog(screen, lastText, `Refresh disabled!`);
				screen.draw();
			} else {
				refresh = true;
				updateScreen(screen);
				renderScreenSyslog(screen, lastText, `Refresh enabled!`);
				screen.draw();
			}
		}
	});

	term.on('resize', (width: any, height: any) => {
		screen.resize(width, height);
		renderScreenSyslog(screen, lastText, `resize with new w/h: ${width}/${height}`);
		// fillScreenWithJobs(screen, lastJobs, `resize with new w/h: ${width}/${height}`);
		screen.draw();
	});
}

main();
