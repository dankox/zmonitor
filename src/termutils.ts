import { terminal as term, ScreenBuffer, Terminal} from "terminal-kit";
import { isNullOrUndefined } from "util";

export interface PutOpts {
	x?: number;
	y?: number;
	attr?: number | ScreenBuffer.Attributes;
	wrap?: boolean;
	dx?: number;
	dy?: number;
}

export class Screen {

	static readonly ansiColorIndex = {
		black: 0 ,
		red: 1 ,
		green: 2 ,
		yellow: 3 ,
		blue: 4 ,
		magenta: 5 ,
		violet: 5 ,
		cyan: 6 ,
		white: 7 ,
		grey: 8 ,
		gray: 8 ,
		brightBlack: 8 ,
		brightRed: 9 ,
		brightGreen: 10 ,
		brightYellow: 11 ,
		brightBlue: 12 ,
		brightMagenta: 13 ,
		brightViolet: 13 ,
		brightCyan: 14 ,
		brightWhite: 15
	} ;

	static readonly aBlack: ScreenBuffer.Attributes = {
		color: 0,
		bgColor: 0
	};

	static readonly aWhite: ScreenBuffer.Attributes = {
		color: Screen.ansiColorIndex.white,
		bgColor: 0
	};

	static readonly aGreen: ScreenBuffer.Attributes = {
		color: Screen.ansiColorIndex.green,
		bgColor: 0
	};

	static readonly aBYellow: ScreenBuffer.Attributes = {
		color: Screen.ansiColorIndex.brightYellow,
		bgColor: 0
	};

	private screenPos: ScreenBuffer.PutOptions = {
		x: 0,
		y: 0,
		attr: Screen.aWhite,
		wrap: false,
		dx: 1,
		dy: 0
	};

	private savePos: ScreenBuffer.PutOptions = {
		x: 0,
		y: 0,
		attr: Screen.aWhite,
		wrap: false,
		dx: 1,
		dy: 0
	};

	private screen: ScreenBuffer;
	private width: number;
	private height: number;
	private dest: Screen | Terminal;
	private msgPos: number;

	private hasBorder: boolean;
	private hasTableHeader: boolean;
	private numCols: number;
	private colsWidth: number;

	constructor(dest: Screen | Terminal, width: number, height: number) {
		this.width = width;
		this.height = height;
		this.msgPos = height - 2;
		this.dest = dest;

		const destination = (dest instanceof Screen ? dest.screen : dest);
		this.screen = new ScreenBuffer({ dst: destination, noFill: true, width: this.width, height: this.height } ) ;
		this.screen.fill({
			// Both foreground and background must have the same color
			attr: Screen.aBlack,
			char: " "
		});

		this.hasBorder = false;
		this.hasTableHeader = false;
		this.numCols = 1;
		this.colsWidth = this.width;
	}

	getBuffer() {
		return this.screen;
	}

	resize(width: number, height: number) {
		if (this.width == width && this.height == height) return;

		// set new screen buffer if w/h was changed
		this.width = width;
		this.height = height;
		this.msgPos = height - 2;
		const destination = (this.dest instanceof Screen ? this.dest.screen : this.dest);
		const tmpScreen = new ScreenBuffer({ dst: destination, noFill: true, width: this.width, height: this.height } ) ;
		delete this.screen; // remove previous screen buffer
		this.screen = tmpScreen;

		// reset border and columns
		this.hasBorder = false;
		this.hasTableHeader = false;
		this.numCols = 1;
		this.colsWidth = this.width;
	}

	clear() {
		// fill screen with same color to clear (black, maybe add option?)
		this.screen.fill({
			attr: Screen.aBlack,
			char: " "
		});

		// reset border and columns
		this.hasBorder = false;
		this.hasTableHeader = false;
		this.numCols = 1;
		this.colsWidth = this.width;
	}

	drawHorizontalLine(row: number, title?: string, lineChar?: string) {
		if (row < 0 || row >= this.height) {
			return;
		}
		let lChar = "=";
		if (lineChar && lineChar.length > 0) {
			lChar = lineChar[0];
		}

		let line = lChar.repeat(this.width);
		if (title) {
			const newTitle = `[ ${title} ]`;
			const titlePos = Math.floor(this.width / 2) - Math.floor(newTitle.length / 2) - 2;
			line = lChar.repeat(titlePos);
			line += newTitle;
			line += lChar.repeat(this.width - line.length);
		}
		this.put(line, { x: 0, y: row });
	}

	drawVerticalLine(col: number, lineChar?: string) {
		if (col < 0 || col >= this.width) {
			return;
		}
		let lChar = "|";
		if (lineChar && lineChar.length > 0) {
			lChar = lineChar[0];
		}

		let line = lChar.repeat(this.height);
		this.put(line, { x: col, y: 0, dx: 0, dy: 1 });
	}

	drawBorder(title?: string, borderStr?: string) {
		let vChar = undefined;
		let hChar = undefined;
		if (borderStr) {
			hChar = borderStr[0];
			vChar = borderStr[1];
		}

		this.drawVerticalLine(0, vChar);
		this.drawVerticalLine(this.width - 1, vChar);
		this.drawHorizontalLine(0, title, hChar);
		this.drawHorizontalLine(this.height - 1, undefined, hChar);

		if (!this.hasBorder) this.colsWidth = Math.floor((this.width - this.numCols + 1) / this.numCols);
		this.hasBorder = true;
	}

	drawTable(numCols: number, hasBorder: boolean = true, hasHeader: boolean = false) {
		this.numCols = numCols;
		this.hasBorder = hasBorder;
		this.hasTableHeader = hasHeader;
		this.colsWidth = Math.floor((this.width - numCols + 1) / numCols);
		let lastPos: number = 0;

		if (hasBorder) {
			this.drawVerticalLine(0);
			lastPos = 1;
			this.colsWidth = Math.floor((this.width - numCols - 1) / numCols);
		}

		for (let i = 0; i < this.numCols - 1; i++) {
			this.drawVerticalLine(lastPos + this.colsWidth);
			lastPos += this.colsWidth + 1;
		}

		if (hasBorder) {
			this.drawVerticalLine(this.width - 1);
		}

		if (hasBorder) {
			this.drawHorizontalLine(0);
			this.drawHorizontalLine(this.height - 1);
			if (hasHeader) {
				this.drawHorizontalLine(2);
			}
		} else {
			if (hasHeader) {
				this.drawHorizontalLine(1);
			}
		}
	}

	getTableColsNum() {
		return this.numCols;
	}

	putInCell(x: number, y: number, text: string, color?: ScreenBuffer.Attributes) {
		if (x > this.numCols) return;
		if (y >= this.height) return;
		if (this.hasTableHeader && y >= this.height - 2) return;

		// (pos - 1) * width + (number of vertical lines)
		let cellX = (x - 1) * this.colsWidth + (x - 1);
		if (this.hasBorder) cellX += 1;

		let cellY = (y - 1);
		if (this.hasBorder) cellY += 1;
		if (this.hasTableHeader) cellY += 2;

		let attr = this.screenPos.attr;
		if (color) attr = color;

		this.put(text.substr(0, this.colsWidth), { x: cellX, y: cellY, attr: attr });
	}

	putInHeader(pos: number, text: string | string[], color?: ScreenBuffer.Attributes) {
		if (!this.hasTableHeader || pos > this.numCols) return;

		// (pos - 1) * width + (number of vertical lines)
		let cellX = (pos - 1) * this.colsWidth + (pos - 1);
		let cellY = 0;
		if (this.hasBorder) {
			cellX += 1;
			cellY = 1;
		}

		let attr = this.screenPos.attr;
		if (color) attr = color;

		if ("string" == typeof text) {
			this.put(text.substr(0, this.colsWidth), { x: cellX, y: cellY, attr: attr });
		} else {
			for (const str of text) {
				this.put(str.substr(0, this.colsWidth), { x: cellX, y: cellY, attr: attr });
				cellX += this.colsWidth + 1;
				if (cellX >= this.width) break;
			}
		}
	}

	putIn(text: string, color?: ScreenBuffer.Attributes) {
		let cellX = 0;
		if (this.hasBorder) cellX = 1;
		let cellY = 0;
		if (this.hasBorder) cellY = 1;
		let attr = this.screenPos.attr;
		if (color) attr = color;

		this.put(text.substr(0, this.colsWidth), { x: cellX, y: cellY, attr: attr });
	}

	put(text: string, options?: PutOpts) {
		if (options) {
			this.saveCursor();
			this.setCursor(options);
			this.screen.put(this.screenPos, text);
			this.restoreCursor();
		} else {
			this.screen.put(this.screenPos, text);
		}
	}

	draw(options?: ScreenBuffer.DrawOptions) {
		// this.screen.draw({delta: true});
		this.screen.draw(options);
	}

	setCursor(options: PutOpts) {
		if (!isNullOrUndefined(options.x)) this.screenPos.x = options.x;
		if (!isNullOrUndefined(options.y)) this.screenPos.y = options.y;
		if (!isNullOrUndefined(options.attr)) this.screenPos.attr = options.attr;
		if (!isNullOrUndefined(options.dx)) this.screenPos.dx = options.dx;
		if (!isNullOrUndefined(options.dy)) this.screenPos.dy = options.dy;
	}

	setColor(color: ScreenBuffer.Attributes) {
		this.screenPos.attr = color;
	}

	saveCursor(attrOnly: boolean = false) {
		if (!attrOnly) {
			this.savePos.x = this.screenPos.x;
			this.savePos.y = this.screenPos.y;
			this.savePos.dx = this.screenPos.dx;
			this.savePos.dy = this.screenPos.dy;
		}
		this.savePos.attr = this.screenPos.attr;
	}

	restoreCursor(attrOnly: boolean = false) {
		if (!attrOnly) {
			this.screenPos.x = this.savePos.x;
			this.screenPos.y = this.savePos.y;
			this.screenPos.dx = this.savePos.dx;
			this.screenPos.dy = this.savePos.dy;
		}
		this.screenPos.attr = this.savePos.attr;
	}

}
