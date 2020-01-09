#!/usr/bin/env node
import { terminal as term, ScreenBuffer } from "terminal-kit";
import { Screen } from "./termutils";

// last displayed jobs
let lastJobs: any[];

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

function promiseWait(delay: number) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			return resolve();
		}, delay);
	});
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
		msgScreen.putIn(message, Screen.aBYellow);
		msgScreen.draw({ x: 0, y: term.height - 3, dst: screen.getBuffer() });
	}

}

let screen = new Screen(term, term.width, term.height);
let jobs = generateRandomJobs();
fillScreenWithJobs(screen, jobs);

// swap to alternate screen buffer (in terminal)
// it helps to retain what was in terminal beffore
term.fullscreen(true);
term.hideCursor(true);

screen.draw();

let interval = setInterval(() => {
	const jobs = generateRandomJobs();
	fillScreenWithJobs(screen, jobs);
	screen.draw();
}, 2000);

term.grabInput(true);

term.on('key', (name: any, matches: any, data: any) => {
	if (matches.indexOf('CTRL_C') >= 0 ) {
		clearInterval(interval);
		fillScreenWithJobs(screen, lastJobs, 'CTRL-C received...');
		screen.draw();
		terminate();
	}

	if (matches.indexOf('CTRL_R') >= 0 ) {
		fillScreenWithJobs(screen, lastJobs, 'CTRL-R received... asking terminal some information...');
		term.requestCursorLocation();
		term.requestScreenSize();
		screen.draw();
	}
});

term.on('resize', (width: any, height: any) => {
	screen.resize(width, height);
	fillScreenWithJobs(screen, lastJobs, `resize with new w/h: ${width}/${height}`);
	screen.draw();
});
