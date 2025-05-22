declare module 'speedtest-net' {
    interface SpeedTestOptions {
        acceptLicense?: boolean;
        acceptGdpr?: boolean;
    }

    interface SpeedTestResult {
        download: {
            bandwidth: number;
        };
        upload: {
            bandwidth: number;
        };
        ping: {
            latency: number;
        };
        isp: string;
        server: {
            location: string;
            name: string;
        };
    }

    export default function speedTest(options?: SpeedTestOptions): Promise<SpeedTestResult>;
}
