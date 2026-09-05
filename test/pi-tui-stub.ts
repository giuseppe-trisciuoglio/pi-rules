/**
 * Minimal stand-ins for the @earendil-works/pi-tui symbols used by extension
 * code. The real package is aliased to the host's copy by pi's extension
 * loader and is never an npm dependency, so tests resolve these no-op
 * components instead. Rendering is a host concern; unit tests only need the
 * symbols to exist.
 */

export interface Component {
	render(width: number): string[];
	invalidate(): void;
}

export class Text implements Component {
	text: string;

	constructor(text: string = "", _paddingX?: number, _paddingY?: number) {
		this.text = text;
	}

	render(_width: number): string[] {
		return this.text.split("\n");
	}

	invalidate(): void {
		// Rendering is a host concern; this stub has nothing to invalidate.
	}

	setText(text: string): void {
		this.text = text;
	}
}

export class Box implements Component {
	children: Component[] = [];

	addChild(child: Component): void {
		this.children.push(child);
	}

	removeChild(child: Component): void {
		const index = this.children.indexOf(child);
		if (index >= 0) this.children.splice(index, 1);
	}

	render(width: number): string[] {
		return this.children.flatMap((child) => child.render(width));
	}

	invalidate(): void {
		// Rendering is a host concern; this stub has nothing to invalidate.
	}
}

export class Container implements Component {
	children: Component[] = [];

	addChild(child: Component): void {
		this.children.push(child);
	}

	removeChild(child: Component): void {
		const index = this.children.indexOf(child);
		if (index >= 0) this.children.splice(index, 1);
	}

	render(width: number): string[] {
		return this.children.flatMap((child) => child.render(width));
	}

	invalidate(): void {
		// Rendering is a host concern; this stub has nothing to invalidate.
	}
}
