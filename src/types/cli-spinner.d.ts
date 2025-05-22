declare module 'cli-spinner' {
    export class Spinner {
        constructor(text?: string);
        setSpinnerString(spinnerString: number | string): void;
        start(): void;
        stop(clear?: boolean): void;
        isSpinning(): boolean;
        text: string;
    }
}
